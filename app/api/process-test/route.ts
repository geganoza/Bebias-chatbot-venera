/**
 * TEST PROCESSING ROUTE - 100% INDEPENDENT FROM MAIN
 *
 * This route is COMPLETELY SEPARATE from production.
 * All content loaded from: test-bot/data/content/
 *
 * Used by test users (Giorgi) via messenger webhook routing.
 */

import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { getMessageBatch, clearMessageBatch } from "@/lib/redis";
import redis from "@/lib/redis";
import { db } from "@/lib/firestore";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

// ==================== CONSTANTS ====================
const TEST_CONTENT_PATH = "test-bot/data/content";
const SHIPPING_MANAGER_URL = "https://shipping-manager-standalone.vercel.app";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// ==================== CONTENT LOADING (TEST-BOT ONLY) ====================

/**
 * Load a single content file from test-bot folder
 */
function loadTestContent(filename: string): string {
  try {
    const filePath = path.join(process.cwd(), TEST_CONTENT_PATH, filename);
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`[TEST] Error loading ${filename}:`, error);
    return "";
  }
}

/**
 * Load ALL content files from test-bot/data/content/
 * This is the key difference from main - we load EVERYTHING including purchase-flow.md
 */
function loadAllTestContent(): string {
  console.log(`[TEST] Loading ALL content from ${TEST_CONTENT_PATH}/`);

  const files = [
    "bot-instructions-modular.md",
    "purchase-flow.md",           // CRITICAL: This was missing before!
    "delivery-info.md",
    "delivery-calculation.md",
    "payment-info.md",
    "tone-style.md",
    "image-handling.md",
    "product-recognition.md",
    "services.md",
    "faqs.md",
    "contact-policies.md",
    "context/context-awareness-rules.md",
    "context/context-retention-rules.md",
    "core/critical-rules.md",
    "core/order-flow-steps.md",
    "core/order-lookup-system.md",
    "core/honesty-escalation.md",
  ];

  const contents: string[] = [];

  for (const file of files) {
    const content = loadTestContent(file);
    if (content) {
      contents.push(`\n\n--- ${file} ---\n${content}`);
      console.log(`[TEST] ✅ Loaded: ${file} (${content.length} chars)`);
    } else {
      console.log(`[TEST] ⚠️ Missing: ${file}`);
    }
  }

  console.log(`[TEST] Loaded ${contents.length} content files`);
  return contents.join("\n");
}

/**
 * Load products from Firestore
 */
async function loadProducts(): Promise<any[]> {
  try {
    const snapshot = await db.collection("products").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("[TEST] Error loading products:", error);
    return [];
  }
}

// ==================== WOLT API INTEGRATION ====================

interface WoltEstimateResponse {
  available: boolean;
  price?: number;
  formatted_address?: string;
  error?: string;
}

interface WoltValidateResponse {
  valid: boolean;
  displayTime?: string;
  scheduledTime?: string;
  error?: string;
}

async function getWoltEstimate(address: string): Promise<WoltEstimateResponse> {
  try {
    console.log(`[TEST WOLT] Getting estimate for: ${address}`);
    const response = await fetch(`${SHIPPING_MANAGER_URL}/api/wolt/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, city: "თბილისი" }),
    });
    return await response.json();
  } catch (error) {
    console.error(`[TEST WOLT] Estimate error:`, error);
    return { available: false, error: "API error" };
  }
}

async function validateWoltSchedule(scheduledTime: string): Promise<WoltValidateResponse> {
  try {
    console.log(`[TEST WOLT] Validating schedule: ${scheduledTime}`);
    const response = await fetch(`${SHIPPING_MANAGER_URL}/api/wolt/validate-schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledTime }),
    });
    return await response.json();
  } catch (error) {
    console.error(`[TEST WOLT] Validate error:`, error);
    return { valid: false, error: "API error" };
  }
}

/**
 * Detect Wolt flow and get context to inject
 */
async function getWoltContext(
  history: Array<{ role: string; content: any }>,
  currentMessage: string
): Promise<string | null> {
  const recentHistory = history.slice(-10);

  let woltSelected = false;
  let woltPriceShown = false;
  let woltTimeRequested = false;

  console.log(`[TEST WOLT] Checking ${recentHistory.length} messages for Wolt context`);
  console.log(`[TEST WOLT] Current message: "${currentMessage}"`);

  // Log all history messages for debugging
  recentHistory.forEach((msg, i) => {
    const preview = typeof msg.content === "string"
      ? msg.content.substring(0, 50)
      : JSON.stringify(msg.content).substring(0, 50);
    console.log(`[TEST WOLT] History[${i}] ${msg.role}: "${preview}..."`);
  });

  for (const msg of recentHistory) {
    // Handle both string and array content formats
    let content = "";
    if (typeof msg.content === "string") {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      content = msg.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join(" ");
    }

    // Check for Wolt selection: "2" or contains "ვოლთ" or "wolt"
    if (msg.role === "user") {
      const trimmed = content.trim();
      if (trimmed === "2" || /ვოლთ|wolt/i.test(trimmed)) {
        woltSelected = true;
        console.log(`[TEST WOLT] ✅ Wolt selected in history: "${trimmed}"`);
      }
    }

    if (msg.role === "assistant") {
      if (content.includes("მიტანის ფასი:") && !content.includes("[X.XX]")) {
        woltPriceShown = true;
        console.log(`[TEST WOLT] ✅ Price already shown`);
      }
      if (content.includes("როდის გინდა") || content.includes("როდის გსურთ")) {
        woltTimeRequested = true;
        console.log(`[TEST WOLT] ✅ Time already requested`);
      }
    }
  }

  if (!woltSelected) {
    console.log(`[TEST WOLT] ❌ Wolt not selected in history`);
    return null;
  }

  // User providing address
  console.log(`[TEST WOLT] Checking if address: priceShown=${woltPriceShown}, msgLen=${currentMessage.length}, msg="${currentMessage.substring(0, 30)}"`);

  if (!woltPriceShown && currentMessage.length >= 5 && !/^[0-9]$/.test(currentMessage)) {
    console.log(`[TEST WOLT] 📍 Calling Wolt API for address: "${currentMessage}"`);
    const estimate = await getWoltEstimate(currentMessage);
    console.log(`[TEST WOLT] 📍 API response:`, JSON.stringify(estimate));
    if (estimate.available && estimate.price) {
      return `[WOLT_PRICE: ${estimate.price}]\n[WOLT_ADDRESS: ${estimate.formatted_address || currentMessage}]`;
    } else {
      return `[WOLT_UNAVAILABLE]\n[WOLT_ERROR: ${estimate.error || "მისამართი არ არის ხელმისაწვდომი"}]`;
    }
  }

  // User providing time
  if (woltPriceShown && woltTimeRequested) {
    const time = currentMessage.trim().toLowerCase();
    let scheduledTime = "now";

    if (time === "ახლა" || time === "now") {
      scheduledTime = "now";
    } else {
      const match = time.match(/(\d{1,2})[:\s]?(\d{2})?/);
      if (match) {
        const hour = parseInt(match[1]);
        const minute = match[2] ? parseInt(match[2]) : 0;
        const date = new Date();
        if (time.includes("ხვალ")) date.setDate(date.getDate() + 1);
        date.setHours(hour, minute, 0, 0);
        scheduledTime = date.toISOString().replace("Z", "+04:00");
      }
    }

    const validation = await validateWoltSchedule(scheduledTime);
    if (validation.valid) {
      return `[WOLT_TIME_VALID: ${validation.displayTime}]\n[WOLT_SCHEDULED: ${validation.scheduledTime}]`;
    } else {
      return `[WOLT_TIME_INVALID: ${validation.error}]`;
    }
  }

  return null;
}

// ==================== CONVERSATION MANAGEMENT ====================

interface ConversationData {
  recipientId: string;
  history: Array<{ role: string; content: any }>;
  orders?: any[];
  manualMode?: boolean;
  lastActive?: string;
}

async function loadConversation(senderId: string): Promise<ConversationData> {
  try {
    const doc = await db.collection("conversations").doc(senderId).get();
    if (doc.exists) {
      return doc.data() as ConversationData;
    }
  } catch (error) {
    console.error("[TEST] Error loading conversation:", error);
  }
  return { recipientId: senderId, history: [] };
}

async function saveConversation(data: ConversationData): Promise<void> {
  try {
    await db.collection("conversations").doc(data.recipientId).set(data, { merge: true });
  } catch (error) {
    console.error("[TEST] Error saving conversation:", error);
  }
}

// ==================== MESSAGE SENDING ====================

async function sendMessage(recipientId: string, text: string): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });
    console.log(`[TEST] ✅ Sent message to ${recipientId}`);
  } catch (error) {
    console.error(`[TEST] ❌ Failed to send message:`, error);
  }
}

// ==================== ORDER PROCESSING ====================

function parseOrderConfirmation(text: string): any | null {
  if (!text.includes("შეკვეთა მიღებულია")) return null;
  if (!text.includes("[ORDER_NUMBER]") && !text.includes("🎫")) return null;

  const nameMatch = text.match(/👤[^:]*:\s*(.+?)(?=[\r\n]|📞|$)/);
  const phoneMatch = text.match(/📞[^:]*:\s*(.+?)(?=[\r\n]|📍|$)/);
  const addressMatch = text.match(/📍[^:]*:\s*(.+?)(?=[\r\n]|📦|$)/);
  const productMatch = text.match(/📦[^:]*:\s*(.+?)(?=[\r\n]|💰|🚚|$)/);
  const totalMatch = text.match(/💰[^:]*:\s*(.+?)(?=[\r\n]|WOLT|$)/);

  if (nameMatch && phoneMatch && addressMatch && productMatch && totalMatch) {
    const isWoltOrder = text.includes("WOLT_ORDER: true") || text.includes("🚚");
    const woltPriceMatch = text.match(/🚚[^:]*:.*?(\d+(?:\.\d+)?)\s*₾/);
    const timeMatch = text.match(/⏰[^:]*:\s*(.+?)(?=[\r\n]|💰|WOLT|$)/);

    return {
      clientName: nameMatch[1].trim(),
      telephone: phoneMatch[1].trim().replace(/\s/g, ""),
      address: addressMatch[1].trim(),
      product: productMatch[1].trim(),
      total: totalMatch[1].trim(),
      quantity: "1",
      isWoltOrder,
      deliveryPrice: woltPriceMatch ? parseFloat(woltPriceMatch[1]) : undefined,
      woltScheduledTime: timeMatch ? timeMatch[1].trim() : undefined,
      deliveryMethod: isWoltOrder ? "wolt" : undefined,
    };
  }

  return null;
}

async function createOrder(orderData: any): Promise<string> {
  const { logOrder } = await import("@/lib/orderLoggerWithFirestore");
  return await logOrder(orderData, "messenger");
}

// ==================== MAIN HANDLER ====================

async function handler(req: Request) {
  const body = await req.json();
  const { senderId, batchKey } = body;

  console.log(`[TEST] ========================================`);
  console.log(`[TEST] Processing message for TEST USER: ${senderId}`);
  console.log(`[TEST] ========================================`);

  // Generate unique processing ID for logging
  const processingId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const lockKey = `test_batch_processing_${senderId}`;

  try {
    // CRITICAL: Acquire a processing lock to prevent duplicate responses
    const lockAcquired = await redis.set(lockKey, processingId, {
      nx: true,  // Only set if not exists
      ex: 30,    // 30 second expiry
    });

    if (!lockAcquired) {
      console.log(`[TEST] ⏭️ Lock exists - another processor handling this batch`);
      return NextResponse.json({ status: "already_processing" });
    }

    console.log(`[TEST] 🔐 Lock acquired - Processing ID: ${processingId}`);

    // Check manual mode
    const conversationData = await loadConversation(senderId);
    if (conversationData.manualMode) {
      console.log(`[TEST] Manual mode active - skipping`);
      await clearMessageBatch(senderId);
      await redis.del(lockKey);
      return NextResponse.json({ status: "manual_mode" });
    }

    // Get messages from Redis
    const messages = await getMessageBatch(senderId);
    if (messages.length === 0) {
      await redis.del(lockKey);
      console.log(`[TEST] 🔓 Lock released (no messages)`);
      return NextResponse.json({ status: "no_messages" });
    }

    console.log(`[TEST] Processing ${messages.length} messages`);

    // Combine messages
    const combinedText = messages.map(m => m.text).filter(Boolean).join(". ");
    console.log(`[TEST] Combined text: "${combinedText}"`);

    // Load ALL test content (including purchase-flow.md!)
    const systemContent = loadAllTestContent();

    // Load products
    const products = await loadProducts();
    const productList = products
      .filter(p => (p.stock_qty || 0) > 0)
      .map(p => `- ${p.name}: ${p.price}₾ (მარაგშია: ${p.stock_qty})`)
      .join("\n");

    // Get Wolt context if in Wolt flow
    const woltContext = await getWoltContext(conversationData.history, combinedText);
    if (woltContext) {
      console.log(`[TEST WOLT] Injecting context: ${woltContext}`);
    }

    // Build system prompt
    const systemPrompt = `${systemContent}

--- AVAILABLE PRODUCTS ---
${productList}

${woltContext ? `--- WOLT SYSTEM CONTEXT ---\n${woltContext}` : ""}

CURRENT TIME: ${new Date().toISOString()}
`;

    // Build messages for OpenAI
    const aiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...conversationData.history.slice(-20),
      { role: "user", content: combinedText },
    ];

    // Call OpenAI
    console.log(`[TEST] Calling OpenAI...`);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: aiMessages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    let response = completion.choices[0]?.message?.content || "ბოდიში, შეცდომა მოხდა.";
    console.log(`[TEST] OpenAI response: ${response.substring(0, 100)}...`);

    // Process order if detected
    const orderData = parseOrderConfirmation(response);
    if (orderData) {
      console.log(`[TEST] Order detected! Creating...`);
      try {
        const orderNumber = await createOrder(orderData);
        response = response.replace(/\[ORDER_NUMBER\]/g, orderNumber);
        console.log(`[TEST] ✅ Order created: ${orderNumber}`);

        conversationData.orders = conversationData.orders || [];
        conversationData.orders.push({
          orderNumber,
          timestamp: new Date().toISOString(),
          items: orderData.product,
        });
      } catch (err) {
        console.error(`[TEST] ❌ Order creation failed:`, err);
      }
    }

    // Handle SEND_IMAGE commands
    const imageRegex = /SEND_IMAGE:\s*(.+?)(?:\n|$)/gi;
    const imageMatches = [...response.matchAll(imageRegex)];
    response = response.replace(imageRegex, "").trim();

    // Send product images
    for (const match of imageMatches) {
      const productId = match[1].trim();
      const product = products.find(p => p.id === productId);
      if (product?.image && product.image.startsWith("http")) {
        try {
          await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: senderId },
              message: { attachment: { type: "image", payload: { url: product.image } } },
            }),
          });
          console.log(`[TEST] ✅ Sent image for ${productId}`);
        } catch (err) {
          console.error(`[TEST] ❌ Failed to send image:`, err);
        }
      }
    }

    // Send response
    await sendMessage(senderId, response);

    // Update conversation history
    conversationData.history.push(
      { role: "user", content: combinedText },
      { role: "assistant", content: response }
    );
    if (conversationData.history.length > 40) {
      conversationData.history = conversationData.history.slice(-40);
    }
    conversationData.lastActive = new Date().toISOString();

    await saveConversation(conversationData);
    await clearMessageBatch(senderId);

    // Release the lock
    await redis.del(lockKey);
    console.log(`[TEST] 🔓 Lock released for ${senderId}`);

    console.log(`[TEST] ✅ Done processing for ${senderId}`);

    return NextResponse.json({ status: "processed", messageCount: messages.length });

  } catch (error: any) {
    console.error(`[TEST] ❌ Error:`, error);
    await clearMessageBatch(senderId);

    // Release lock on error
    try {
      await redis.del(lockKey);
      console.log(`[TEST] 🔓 Lock released after error for ${senderId}`);
    } catch (lockErr) {
      console.error(`[TEST] Failed to release lock:`, lockErr);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);

export async function GET() {
  return NextResponse.json({
    status: "Test Processing Route Active",
    contentPath: TEST_CONTENT_PATH,
    isolation: "100% separate from production",
    files: [
      "bot-instructions-modular.md",
      "purchase-flow.md",
      "delivery-info.md",
      "...and more"
    ],
  });
}
