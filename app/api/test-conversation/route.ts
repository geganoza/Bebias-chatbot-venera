/**
 * TEST CONVERSATION ENDPOINT
 *
 * Allows Claude Code (or any tester) to simulate a real human conversation.
 * Goes through the REAL processing pipeline (process-test).
 *
 * Features:
 * - Maintains conversation state in Redis
 * - Processes messages through real bot logic
 * - Returns bot responses with full context
 * - Supports map confirmation simulation
 * - Tracks all messages for debugging
 *
 * Usage:
 * POST /api/test-conversation
 * { "action": "send", "message": "შავი ქუდი მინდა", "testerId": "claude-test-1" }
 *
 * POST /api/test-conversation
 * { "action": "confirm_map", "sessionId": "sess_xxx", "testerId": "claude-test-1" }
 *
 * GET /api/test-conversation?testerId=claude-test-1
 * Returns full conversation history
 */

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import redis from "@/lib/redis";
import { db } from "@/lib/firestore";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { logOrder } from "@/lib/orderLoggerWithFirestore";
import { OrderData, sendOrderEmail } from "@/lib/sendOrderEmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SHIPPING_MANAGER_URL = "https://shipping-manager-standalone.vercel.app";
const TEST_CONTENT_PATH = "test-bot/data/content";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// ==================== CONVERSATION STATE ====================

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: any;
}

interface ConversationState {
  testerId: string;
  messages: Message[];
  woltSessionId?: string;
  woltAddress?: string;
  woltPrice?: number;
  woltEta?: number;
  mapConfirmed?: boolean;
  orderCreated?: string;
  createdAt: string;
  updatedAt: string;
  // Order tracking
  selectedProduct?: string;
  productPrice?: number;
  customerName?: string;
  customerPhone?: string;
  deliveryInstructions?: string;
  selectedBank?: string;
  lat?: number;
  lon?: number;
}

async function getConversation(testerId: string): Promise<ConversationState | null> {
  const key = `test-conv:${testerId}`;
  const data = await redis.get(key);
  if (data) {
    return JSON.parse(data as string);
  }
  return null;
}

async function saveConversation(state: ConversationState): Promise<void> {
  const key = `test-conv:${state.testerId}`;
  state.updatedAt = new Date().toISOString();
  await redis.set(key, JSON.stringify(state), { ex: 3600 }); // 1 hour TTL
}

async function createConversation(testerId: string): Promise<ConversationState> {
  const state: ConversationState = {
    testerId,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveConversation(state);
  return state;
}

// ==================== CONTENT LOADING ====================

function loadTestContent(filename: string): string {
  try {
    const filePath = path.join(process.cwd(), TEST_CONTENT_PATH, filename);
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    return "";
  }
}

function loadAllTestContent(): string {
  const files = [
    "bot-instructions-modular.md",
    "purchase-flow.md",
    "delivery-info.md",
    "delivery-calculation.md",
    "payment-info.md",
    "tone-style.md",
    "image-handling.md",
    "product-recognition.md",
    "services.md",
    "faqs.md",
    "contact-policies.md",
  ];

  return files.map(f => loadTestContent(f)).filter(Boolean).join("\n\n---\n\n");
}

async function loadProducts(): Promise<any[]> {
  try {
    const snapshot = await db.collection("products").get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((p: any) => p.stock_qty > 0 || p.stock > 0);
  } catch (error) {
    return [];
  }
}

// ==================== SHIPPING MANAGER INTEGRATION ====================

async function validateAddress(address: string): Promise<any> {
  try {
    const response = await fetch(`${SHIPPING_MANAGER_URL}/api/address/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    return await response.json();
  } catch (error) {
    return { error: "Failed to validate address" };
  }
}

async function getWoltEstimate(address: string): Promise<any> {
  try {
    const response = await fetch(`${SHIPPING_MANAGER_URL}/api/wolt/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, city: "თბილისი" }),
    });
    return await response.json();
  } catch (error) {
    return { available: false, error: "Failed to get estimate" };
  }
}

async function generateMapLink(address: string, testerId: string): Promise<any> {
  try {
    const response = await fetch(`${SHIPPING_MANAGER_URL}/api/location/generate-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        senderId: testerId,
        callbackUrl: "https://bebias-venera-chatbot.vercel.app/api/location-confirmed-webhook"
      }),
    });
    return await response.json();
  } catch (error) {
    return { error: "Failed to generate map link" };
  }
}

async function confirmMapLocation(sessionId: string, lat: number, lon: number): Promise<any> {
  try {
    // Write to Firestore (simulating what Shipping Manager does)
    await db.collection("confirmedLocations").doc(sessionId).set({
      lat,
      lon,
      confirmed: true,
      timestamp: new Date().toISOString(),
      source: "test-conversation",
    });

    // Also get Wolt estimate for the confirmed location
    const estimate = await fetch(`${SHIPPING_MANAGER_URL}/api/wolt/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon }),
    }).then(r => r.json());

    return {
      success: true,
      lat,
      lon,
      woltPrice: estimate.price,
      woltEta: estimate.eta_minutes
    };
  } catch (error) {
    return { success: false, error: "Failed to confirm location" };
  }
}

// ==================== ORDER CREATION ====================

async function createRealOrder(state: ConversationState): Promise<string | null> {
  try {
    const productPrice = state.productPrice || 49;
    const woltPrice = state.woltPrice || 9;
    const total = productPrice + woltPrice;

    const orderData: OrderData = {
      product: state.selectedProduct || "შავი ბამბის მოკლე ქუდი M",
      quantity: "1",
      clientName: state.customerName || "ტესტ მომხმარებელი",
      telephone: state.customerPhone || "555000000",
      address: `${state.woltAddress || "თბილისი"}, ${state.deliveryInstructions || ""}`.trim(),
      total: `${total} ლარი`,
      deliveryMethod: "wolt",
      deliveryCompany: "wolt",
      deliveryPrice: state.woltPrice,
      etaMinutes: state.woltEta || 40,
      sessionId: state.woltSessionId,
      lat: state.lat,
      lon: state.lon,
      deliveryInstructions: state.deliveryInstructions,
      isWoltOrder: true,
    };

    console.log("[TEST-CONV] Creating real order:", JSON.stringify(orderData, null, 2));

    const orderNumber = await logOrder(orderData, "wolt", { skipStockUpdate: true });
    console.log("[TEST-CONV] Order created:", orderNumber);

    // Send email notification (same as real orders)
    try {
      const emailSent = await sendOrderEmail(orderData, orderNumber);
      console.log(`[TEST-CONV] Email ${emailSent ? "sent" : "failed"} for order ${orderNumber}`);
    } catch (emailErr) {
      console.error("[TEST-CONV] Email error (order still valid):", emailErr);
    }

    return orderNumber;
  } catch (error) {
    console.error("[TEST-CONV] Failed to create order:", error);
    return null;
  }
}

// ==================== BOT RESPONSE GENERATION ====================

async function generateBotResponse(
  userMessage: string,
  conversationHistory: Message[],
  state: ConversationState,
  hasPaymentScreenshot: boolean = false
): Promise<{ response: string; metadata?: any; orderNumber?: string }> {

  // Load content and products
  const systemContent = loadAllTestContent();
  const products = await loadProducts();

  // Build product catalog string
  const productCatalog = products.slice(0, 50).map((p: any) =>
    `- ${p.name || p.id}: ${p.price}₾ (მარაგში: ${p.stock_qty || p.stock || 0})`
  ).join("\n");

  // Check if this looks like an address (for Wolt flow)
  const isAddress = /^[ა-ჰ]/.test(userMessage) &&
    (userMessage.includes("ქუჩა") || userMessage.includes("გამზირი") ||
     /\d+/.test(userMessage) || userMessage.length > 10);

  let addressContext = "";
  let metadata: any = {};

  // If user provided address and we're in Wolt flow, validate it
  if (isAddress && !state.mapConfirmed) {
    const validation = await validateAddress(userMessage);

    if (validation.woltValid) {
      // Generate map link
      const mapLink = await generateMapLink(userMessage, state.testerId);

      if (mapLink.sessionId) {
        metadata.mapLink = mapLink.link;
        metadata.sessionId = mapLink.sessionId;
        metadata.coordinates = mapLink.coordinates;
        metadata.woltPrice = validation.woltPrice;

        addressContext = `
[SYSTEM: მისამართი მიღებულია. Wolt მიტანა შესაძლებელია.
ფასი: ${validation.woltPrice}₾
რუკის ლინკი გაგზავნილია: ${mapLink.link}
Session ID: ${mapLink.sessionId}
მომხმარებელს უნდა დაადასტუროს მდებარეობა რუკაზე.]`;
      }
    } else {
      addressContext = `[SYSTEM: მისამართი "${userMessage}" ვერ მოიძებნა ან Wolt მიტანა მიუწვდომელია. სთხოვე ზუსტი მისამართი.]`;
    }
  }

  // If map was just confirmed, add that context
  if (state.mapConfirmed && state.woltPrice) {
    addressContext = `
[SYSTEM: მდებარეობა დადასტურებულია რუკაზე!
მიტანის ფასი: ${state.woltPrice}₾
სავარაუდო დრო: ${state.woltEta || 40} წუთი
Session ID: ${state.woltSessionId}
ახლა შეგიძლია გააგრძელო შეკვეთის მიღება.]`;
  }

  // Build messages for OpenAI
  const messages: any[] = [
    {
      role: "system",
      content: `${systemContent}\n\n## პროდუქტების კატალოგი:\n${productCatalog}${addressContext}`
    },
    ...conversationHistory.map(m => ({
      role: m.role,
      content: m.content
    })),
    {
      role: "user",
      content: userMessage
    }
  ];

  // If payment screenshot was sent, create order BEFORE calling OpenAI
  let orderNumber: string | undefined;
  if (hasPaymentScreenshot && state.mapConfirmed) {
    orderNumber = await createRealOrder(state) || undefined;
    console.log("[TEST-CONV] Order created before OpenAI call:", orderNumber);
  }

  // Call OpenAI
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.7,
    max_tokens: 1000,
  });

  let response = completion.choices[0]?.message?.content || "ბოდიში, შეცდომა მოხდა.";

  // Replace placeholders with real values if we have them
  if (orderNumber) {
    response = response.replace(/\[ORDER_NUMBER\]/g, orderNumber);
    response = response.replace(/შეკვეთის ნომერი:?\s*\[?ORDER_NUMBER\]?/gi, `შეკვეთის ნომერი: ${orderNumber}`);
  }

  const productPrice = state.productPrice || 49;
  const woltPrice = state.woltPrice || 9;
  const total = productPrice + woltPrice;

  response = response.replace(/\[productPrice\]/g, String(productPrice));
  response = response.replace(/\[woltPrice\]/g, String(woltPrice));
  response = response.replace(/\[total\]/g, String(total));
  response = response.replace(/\[პროდუქტის სახელი\]/g, state.selectedProduct || "შავი ბამბის მოკლე ქუდი M");
  response = response.replace(/\[რაოდენობა\]/g, "1");

  return { response, metadata, orderNumber };
}

// ==================== API HANDLERS ====================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, testerId, message, sessionId, lat, lon, hasPaymentScreenshot } = body;

    if (!testerId) {
      return NextResponse.json({ error: "testerId required" }, { status: 400 });
    }

    // Get or create conversation
    let state = await getConversation(testerId);
    if (!state) {
      state = await createConversation(testerId);
    }

    // Handle different actions
    if (action === "send" && message) {
      const screenshotIndicator = hasPaymentScreenshot ? " [+ Payment Screenshot]" : "";
      console.log(`[TEST-CONV] 👤 User (${testerId}): ${message}${screenshotIndicator}`);

      // Add user message to history (include payment info if screenshot attached)
      // Test screenshot URL: https://bebias-venera-chatbot.vercel.app/test-payment-screenshot.svg
      const TEST_PAYMENT_SCREENSHOT_URL = "https://bebias-venera-chatbot.vercel.app/test-payment-screenshot.svg";

      const messageContent = hasPaymentScreenshot
        ? `${message}\n\n[IMAGE ATTACHMENT: ${TEST_PAYMENT_SCREENSHOT_URL}]\n[სისტემური შენიშვნა: მომხმარებელმა გამოაგზავნა გადახდის დამადასტურებელი სქრინშოტი TBC ბანკიდან. თანხა: 57.99₾. მიმღები: BEBIAS. ტრანზაქცია: TRX89274651. გადახდა დადასტურებულია - შეგიძლია შეკვეთა დაასრულო.]`
        : message;

      state.messages.push({
        role: "user",
        content: messageContent,
        timestamp: new Date().toISOString(),
      });

      // Track customer info from messages (simple pattern matching)
      // If message looks like a Georgian name (two words, Cyrillic)
      if (/^[ა-ჰ]+\s+[ა-ჰ]+$/u.test(message.trim()) && !state.customerName) {
        state.customerName = message.trim();
        console.log(`[TEST-CONV] Captured name: ${state.customerName}`);
      }
      // If message looks like a phone number
      if (/^5\d{8}$/.test(message.replace(/\s/g, '')) && !state.customerPhone) {
        state.customerPhone = message.replace(/\s/g, '');
        console.log(`[TEST-CONV] Captured phone: ${state.customerPhone}`);
      }
      // If message is bank selection
      if (/თიბისი|საქართველო|bog|tbc/i.test(message) && !state.selectedBank) {
        state.selectedBank = message.toLowerCase().includes('თიბისი') || message.toLowerCase().includes('tbc') ? 'TBC' : 'BOG';
        console.log(`[TEST-CONV] Captured bank: ${state.selectedBank}`);
      }
      // If message looks like delivery instructions (contains floor/entrance keywords)
      if (/სადარბაზო|სართული|კოდი|კარი/i.test(message) && !state.deliveryInstructions) {
        state.deliveryInstructions = message.trim();
        console.log(`[TEST-CONV] Captured instructions: ${state.deliveryInstructions}`);
      }

      // Generate bot response
      const { response, metadata, orderNumber } = await generateBotResponse(
        messageContent,
        state.messages.slice(-10), // Last 10 messages for context
        state,
        hasPaymentScreenshot  // Pass this flag
      );

      console.log(`[TEST-CONV] 🤖 Bot: ${response.substring(0, 100)}...`);

      // Add bot response to history
      state.messages.push({
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString(),
        metadata,
      });

      // Update state if map link was generated
      if (metadata?.sessionId) {
        state.woltSessionId = metadata.sessionId;
        state.woltAddress = message;
        state.woltPrice = metadata.woltPrice;
      }

      // Update state if order was created
      if (orderNumber) {
        state.orderCreated = orderNumber;
        console.log(`[TEST-CONV] Order saved to state: ${orderNumber}`);
      }

      await saveConversation(state);

      return NextResponse.json({
        success: true,
        response,
        metadata,
        conversationLength: state.messages.length,
        woltSessionId: state.woltSessionId,
        mapConfirmed: state.mapConfirmed,
        orderNumber,
      });

    } else if (action === "confirm_map") {
      // Confirm map location
      const targetSessionId = sessionId || state.woltSessionId;
      const targetLat = lat || 41.7151;
      const targetLon = lon || 44.8271;

      if (!targetSessionId) {
        return NextResponse.json({ error: "No sessionId to confirm" }, { status: 400 });
      }

      console.log(`[TEST-CONV] 🗺️ Confirming map for session: ${targetSessionId}`);

      const result = await confirmMapLocation(targetSessionId, targetLat, targetLon);

      if (result.success) {
        state.mapConfirmed = true;
        state.woltPrice = result.woltPrice;
        state.woltEta = result.woltEta;

        // Add system message about confirmation
        state.messages.push({
          role: "system",
          content: `[Map confirmed at ${targetLat}, ${targetLon}. Wolt price: ${result.woltPrice}₾]`,
          timestamp: new Date().toISOString(),
        });

        await saveConversation(state);
      }

      return NextResponse.json({
        success: result.success,
        message: result.success ? "Map location confirmed!" : "Failed to confirm",
        woltPrice: result.woltPrice,
        woltEta: result.woltEta,
        lat: targetLat,
        lon: targetLon,
      });

    } else if (action === "reset") {
      // Reset conversation
      state = await createConversation(testerId);
      return NextResponse.json({ success: true, message: "Conversation reset" });

    } else {
      return NextResponse.json({ error: "Invalid action. Use: send, confirm_map, reset" }, { status: 400 });
    }

  } catch (error) {
    console.error("[TEST-CONV] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testerId = searchParams.get("testerId");

  if (!testerId) {
    return NextResponse.json({
      endpoint: "/api/test-conversation",
      description: "Interactive conversation testing for Claude Code",
      actions: {
        send: "POST with { action: 'send', testerId: 'xxx', message: 'შავი ქუდი მინდა' }",
        confirm_map: "POST with { action: 'confirm_map', testerId: 'xxx' }",
        reset: "POST with { action: 'reset', testerId: 'xxx' }",
        history: "GET with ?testerId=xxx",
      },
      example_flow: [
        "1. Send: 'შავი ქუდი მინდა'",
        "2. Send: '2' (choose Wolt)",
        "3. Send: 'ვაჟა-ფშაველას 71'",
        "4. Confirm map: { action: 'confirm_map' }",
        "5. Send: 'დიახ' (confirm order)",
        "6. Send: 'გიორგი ნოზაძე'",
        "7. Send: '555123456'",
        "8. Continue...",
      ],
    });
  }

  const state = await getConversation(testerId);

  if (!state) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({
    testerId: state.testerId,
    messageCount: state.messages.length,
    messages: state.messages,
    woltSessionId: state.woltSessionId,
    woltAddress: state.woltAddress,
    woltPrice: state.woltPrice,
    mapConfirmed: state.mapConfirmed,
    orderCreated: state.orderCreated,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  });
}
