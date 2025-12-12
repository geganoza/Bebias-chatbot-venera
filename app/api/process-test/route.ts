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

interface AddressValidateResponse {
  // Bot action instruction
  action: 'SEND_TO_WOLT' | 'SEND_MAP_LINK' | 'ASK_TO_SELECT' | 'ASK_FOR_ADDRESS' | 'MANUAL_HANDLING';
  matchType: 'EXACT' | 'PARTIAL' | 'STREET_ONLY' | 'AMBIGUOUS' | 'DISTRICT' | 'NOT_FOUND';

  // Shipping data for Wolt (when action is SEND_TO_WOLT or SEND_MAP_LINK)
  shipping?: {
    coordinates: { lat: number; lon: number };
    street: string;
    city: string;
    country: string;
    language: string;
    formattedAddress: string;
  };

  // Map confirmation URL (when action is SEND_MAP_LINK)
  mapConfirmationUrl?: string;

  // Street options (when action is ASK_TO_SELECT)
  options?: string[];

  // Customer-facing message (Georgian)
  customerMessage: string;

  // Confidence score (0-1)
  confidence: number;

  // Original parsed data
  parsed?: {
    street: string | null;
    number: string | null;
    originalAddress: string;
  };

  // Error code if any
  error?: string;
}

interface WoltEstimateResponse {
  available: boolean;
  price?: number;
  formatted_address?: string;
  error?: string;
  error_code?: string;
}

interface WoltValidateResponse {
  valid: boolean;
  displayTime?: string;
  scheduledTime?: string;
  error?: string;
}

async function validateAddress(address: string): Promise<AddressValidateResponse> {
  try {
    console.log(`[TEST WOLT] Validating address: ${address}`);
    const response = await fetch(`${SHIPPING_MANAGER_URL}/api/address/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const result = await response.json();
    console.log(`[TEST WOLT] Address validation result:`, JSON.stringify(result));
    return result;
  } catch (error) {
    console.error(`[TEST WOLT] Address validation error:`, error);
    return {
      action: 'MANUAL_HANDLING',
      matchType: 'NOT_FOUND',
      customerMessage: 'მისამართის შემოწმება ვერ მოხერხდა. გთხოვთ დაელოდოთ, მენეჯერი დაგეხმარებათ.',
      confidence: 0,
      error: 'VALIDATION_ERROR',
    };
  }
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

interface MapLinkResponse {
  link: string;
  sessionId: string;
  expiresAt?: string;
  error?: string;
}

const CHATBOT_CALLBACK_URL = "https://bebias-venera-chatbot.vercel.app/api/location-confirmed-webhook";

async function generateMapLink(address: string, senderId: string): Promise<MapLinkResponse> {
  try {
    console.log(`[TEST WOLT] Generating map link for: ${address}, senderId: ${senderId}`);
    const response = await fetch(`${SHIPPING_MANAGER_URL}/api/location/generate-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        senderId,
        callbackUrl: CHATBOT_CALLBACK_URL
      }),
    });
    const result = await response.json();
    console.log(`[TEST WOLT] Map link result:`, JSON.stringify(result));
    return result;
  } catch (error) {
    console.error(`[TEST WOLT] Generate map link error:`, error);
    return { link: '', sessionId: '', error: "API error" };
  }
}

async function getConfirmedLocation(sessionId: string): Promise<{ confirmed: boolean; lat?: number; lon?: number }> {
  try {
    console.log(`[TEST WOLT] Getting confirmed location for session: ${sessionId}`);
    const response = await fetch(`${SHIPPING_MANAGER_URL}/api/location/confirm?sessionId=${sessionId}`);
    const result = await response.json();
    console.log(`[TEST WOLT] Confirmed location result:`, JSON.stringify(result));
    if (result.confirmed && result.data) {
      return { confirmed: true, lat: result.data.lat, lon: result.data.lon };
    }
    return { confirmed: false };
  } catch (error) {
    console.error(`[TEST WOLT] Get confirmed location error:`, error);
    return { confirmed: false };
  }
}

interface WoltPreorderData {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  coordinates: { lat: number; lon: number };
  productName: string;
  quantity: number;
  productPrice: number;
  deliveryPrice: number;
  deliveryTime: string; // "now" or ISO timestamp
  deliveryEta?: number; // minutes
  deliveryInstructions?: string;
}

interface WoltPreorderResponse {
  success: boolean;
  preorderId?: string;
  error?: string;
}

/**
 * Create a Wolt preorder in Shipping Manager
 * This creates a preorder that warehouse staff will confirm before sending to Wolt
 */
async function createWoltPreorder(orderData: WoltPreorderData): Promise<WoltPreorderResponse> {
  try {
    console.log(`[TEST WOLT] Creating Wolt preorder for order: ${orderData.orderNumber}`);
    console.log(`[TEST WOLT] Preorder data:`, JSON.stringify(orderData));

    const response = await fetch(`${SHIPPING_MANAGER_URL}/api/wolt/preorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });

    const result = await response.json();
    console.log(`[TEST WOLT] Preorder result:`, JSON.stringify(result));

    if (result.success) {
      console.log(`[TEST WOLT] ✅ Preorder created: ${result.preorderId}`);
      return { success: true, preorderId: result.preorderId };
    } else {
      console.error(`[TEST WOLT] ❌ Preorder creation failed:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error(`[TEST WOLT] ❌ Preorder API error:`, error);
    return { success: false, error: "API error" };
  }
}

/**
 * Detect Wolt flow and get context to inject
 */
async function getWoltContext(
  history: Array<{ role: string; content: any }>,
  currentMessage: string,
  senderId: string
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

    // Check for Wolt selection: "2" or contains "ვოლთ"/"ვოლტ" (both spellings) or "wolt"
    if (msg.role === "user") {
      const trimmed = content.trim();
      if (trimmed === "2" || /ვოლთ|ვოლტ|wolt/i.test(trimmed)) {
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

  // Check if user is selecting from street options (bot showed numbered list)
  // Get last assistant message and the user address that came right before it
  let lastAssistantMsg = "";
  let lastUserAddress = "";
  let foundOptionsMsg = false;
  for (let i = recentHistory.length - 1; i >= 0; i--) {
    const msg = recentHistory[i];
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
    if (msg.role === "assistant" && !lastAssistantMsg) {
      lastAssistantMsg = content;
      console.log(`[TEST WOLT] Last assistant msg found: "${content.substring(0, 100)}..."`);
      // Check if this is the options message
      if (content.includes("გთხოვთ აირჩიოთ")) {
        foundOptionsMsg = true;
      }
    }
    // Find the user address that came RIGHT BEFORE the options message (not just any address)
    if (foundOptionsMsg && msg.role === "user" && content.length > 3 && !/^[0-9]$/.test(content.trim())) {
      // This should be the original address user entered before getting options
      if (!lastUserAddress) {
        lastUserAddress = content.trim();
        console.log(`[TEST WOLT] Original user address found: "${lastUserAddress}"`);
      }
    }
  }

  // Handle street selection ("1", "2", etc.) when bot showed options
  if (/^[12]$/.test(currentMessage.trim()) && lastAssistantMsg.includes("გთხოვთ აირჩიოთ")) {
    console.log(`[TEST WOLT] 🔢 User selected option ${currentMessage} from street list`);

    // Extract street options from bot's message
    const optionMatches = lastAssistantMsg.match(/\d+\.\s+([^\n]+)/g);
    if (optionMatches) {
      const selectedIndex = parseInt(currentMessage.trim()) - 1;
      if (selectedIndex >= 0 && selectedIndex < optionMatches.length) {
        const selectedStreet = optionMatches[selectedIndex].replace(/^\d+\.\s+/, '').trim();
        console.log(`[TEST WOLT] 📍 Selected street: "${selectedStreet}"`);

        // Extract building number from original address
        const numberMatch = lastUserAddress.match(/\d+/);
        const buildingNumber = numberMatch ? numberMatch[0] : '';
        const fullAddress = `${selectedStreet} ${buildingNumber}`.trim();
        console.log(`[TEST WOLT] 📍 Full address: "${fullAddress}"`);

        // Re-validate with selected street
        const validation = await validateAddress(fullAddress);
        console.log(`[TEST WOLT] 📍 Re-validation result: action=${validation.action}`);

        if (validation.action === 'SEND_TO_WOLT' && validation.shipping) {
          const estimate = await getWoltEstimate(validation.shipping.formattedAddress);
          if (estimate.available && estimate.price) {
            return `[WOLT_ACTION: SEND_TO_WOLT]\n[WOLT_ADDRESS: ${validation.shipping.formattedAddress}]\n[WOLT_PRICE: ${estimate.price}]\n[WOLT_MESSAGE: მისამართი დადასტურებულია: ${validation.shipping.formattedAddress}]`;
          }
        }

        // CRITICAL: If SEND_MAP_LINK, generate the map link with URL!
        if (validation.action === 'SEND_MAP_LINK') {
          const addressForMap = validation.shipping?.formattedAddress || fullAddress;
          const mapLinkResult = await generateMapLink(addressForMap, senderId);
          console.log(`[TEST WOLT] 🗺️ Generated map link for street selection: ${mapLinkResult.link}`);

          const estimate = await getWoltEstimate(addressForMap);
          const priceInfo = estimate.available ? `[WOLT_PRICE_ESTIMATE: ${estimate.price}]` : '';

          return `[WOLT_ACTION: SEND_MAP_LINK]\n[WOLT_MAP_URL: ${mapLinkResult.link}]\n[WOLT_SESSION_ID: ${mapLinkResult.sessionId}]\n[WOLT_ADDRESS: ${addressForMap}]\n${priceInfo}\n[WOLT_MESSAGE: ${validation.customerMessage}]`;
        }

        // Other actions (ASK_FOR_ADDRESS, MANUAL_HANDLING, etc.)
        return `[WOLT_ACTION: ${validation.action}]\n[WOLT_MESSAGE: ${validation.customerMessage}]`;
      }
    }
  }

  // SIMPLIFIED: Just send to Shipping Manager API - it handles all address parsing
  // Only skip: single digits (time selection like "1", "2"), time keywords ("ახლა", "15:00")
  const isTimeInput = /^[0-9]$/.test(currentMessage.trim()) ||
                      /ახლა|^\d{1,2}[:\s]?\d{0,2}$|საათ|დღეს|ხვალ/.test(currentMessage.trim());

  // Skip validation if this looks like time input, otherwise let API decide
  const shouldValidate = currentMessage.length >= 3 && !isTimeInput;

  console.log(`[TEST WOLT] Checking: priceShown=${woltPriceShown}, isTimeInput=${isTimeInput}, shouldValidate=${shouldValidate}, msg="${currentMessage.substring(0, 40)}"`);

  if (shouldValidate) {
    console.log(`[TEST WOLT] 📍 Sending to API for validation: "${currentMessage}"`);

    // STEP 1: Validate address - API handles all parsing
    const validation = await validateAddress(currentMessage);
    console.log(`[TEST WOLT] 📍 Validation result: action=${validation.action}, matchType=${validation.matchType}`);

    // Handle different actions per API contract
    switch (validation.action) {
      case 'SEND_TO_WOLT': {
        // Exact match - use formattedAddress for price estimate
        console.log(`[TEST WOLT] ✅ SEND_TO_WOLT - getting price for: ${validation.shipping?.formattedAddress}`);
        const addressForEstimate = validation.shipping?.formattedAddress || currentMessage;
        const estimate = await getWoltEstimate(addressForEstimate);
        console.log(`[TEST WOLT] 📍 Price response:`, JSON.stringify(estimate));

        if (estimate.available && estimate.price) {
          // Store coordinates for later use in order
          const coords = validation.shipping?.coordinates;
          return `[WOLT_ACTION: SEND_TO_WOLT]\n[WOLT_ADDRESS: ${addressForEstimate}]\n[WOLT_PRICE: ${estimate.price}]\n[WOLT_COORDS: ${coords?.lat},${coords?.lon}]\n[WOLT_MESSAGE: ${validation.customerMessage}]`;
        } else {
          return `[WOLT_ACTION: SEND_TO_WOLT]\n[WOLT_ADDRESS: ${addressForEstimate}]\n[WOLT_UNAVAILABLE]\n[WOLT_ERROR: ${estimate.error || "Wolt მიტანა არ არის ხელმისაწვდომი"}]`;
        }
      }

      case 'SEND_MAP_LINK': {
        // Street found but needs map confirmation - generate session-based link
        console.log(`[TEST WOLT] 🗺️ SEND_MAP_LINK - generating session-based map link`);
        const addressForEstimate = validation.shipping?.formattedAddress || currentMessage;

        // Generate map link with session ID for later confirmation
        const mapLinkResult = await generateMapLink(addressForEstimate, senderId);
        console.log(`[TEST WOLT] 📍 Map link generated: sessionId=${mapLinkResult.sessionId}`);

        // Get preliminary price
        const estimate = await getWoltEstimate(addressForEstimate);
        const priceInfo = estimate.available ? `[WOLT_PRICE_ESTIMATE: ${estimate.price}]` : '';

        // Include sessionId in context so it can be saved in conversation state
        return `[WOLT_ACTION: SEND_MAP_LINK]\n[WOLT_MAP_URL: ${mapLinkResult.link}]\n[WOLT_SESSION_ID: ${mapLinkResult.sessionId}]\n[WOLT_ADDRESS: ${addressForEstimate}]\n${priceInfo}\n[WOLT_MESSAGE: ${validation.customerMessage}]`;
      }

      case 'ASK_TO_SELECT': {
        // Multiple streets match - show options
        console.log(`[TEST WOLT] ❓ ASK_TO_SELECT - showing ${validation.options?.length} options`);
        const optionsList = validation.options?.join('\n') || '';
        return `[WOLT_ACTION: ASK_TO_SELECT]\n[WOLT_OPTIONS:\n${optionsList}\n]\n[WOLT_MESSAGE: ${validation.customerMessage}]`;
      }

      case 'ASK_FOR_ADDRESS': {
        // Only district provided - need full address
        console.log(`[TEST WOLT] 📝 ASK_FOR_ADDRESS - need full street address`);
        return `[WOLT_ACTION: ASK_FOR_ADDRESS]\n[WOLT_MESSAGE: ${validation.customerMessage}]`;
      }

      case 'MANUAL_HANDLING': {
        // Address not found - escalate to manager
        console.log(`[TEST WOLT] ❌ MANUAL_HANDLING - escalating to manager`);
        return `[WOLT_ACTION: MANUAL_HANDLING]\n[WOLT_ESCALATE: true]\n[WOLT_MESSAGE: ${validation.customerMessage}]`;
      }

      default: {
        // Unknown action - fallback to direct estimate
        console.log(`[TEST WOLT] ⚠️ Unknown action - falling back to direct estimate`);
        const estimate = await getWoltEstimate(currentMessage);
        if (estimate.available && estimate.price) {
          return `[WOLT_PRICE: ${estimate.price}]\n[WOLT_ADDRESS: ${estimate.formatted_address || currentMessage}]`;
        } else {
          return `[WOLT_UNAVAILABLE]\n[WOLT_ERROR: ${estimate.error || "მისამართი არ არის ხელმისაწვდომი"}]`;
        }
      }
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
  woltSessionId?: string; // Session ID for map confirmation flow
  woltAddress?: string;   // Address being validated
}

async function loadConversation(senderId: string): Promise<ConversationData> {
  try {
    console.log(`[TEST] 📥 LOADING conversation for ${senderId}`);
    const doc = await db.collection("conversations").doc(senderId).get();
    if (doc.exists) {
      const data = doc.data() as ConversationData;
      console.log(`[TEST] 📥 LOADED! History length: ${data.history?.length || 0}`);
      if (data.history?.length > 0) {
        const lastMsg = data.history[data.history.length - 1];
        console.log(`[TEST] 📥 Last message role: ${lastMsg?.role}, preview: "${String(lastMsg?.content || '').substring(0, 40)}..."`);
      }
      return data;
    } else {
      console.log(`[TEST] 📥 No document found for ${senderId} - new conversation`);
    }
  } catch (error) {
    console.error("[TEST] ❌ Error loading conversation:", error);
  }
  return { recipientId: senderId, history: [] };
}

async function saveConversation(data: ConversationData): Promise<void> {
  try {
    console.log(`[TEST] 💾 SAVING conversation for ${data.recipientId}, history length: ${data.history?.length || 0}`);
    await db.collection("conversations").doc(data.recipientId).set(data, { merge: true });
    console.log(`[TEST] 💾 SAVED successfully!`);
  } catch (error) {
    console.error("[TEST] ❌ Error saving conversation:", error);
  }
}

// ==================== MESSAGE SENDING ====================

async function sendMessage(recipientId: string, text: string): Promise<void> {
  // Detect Instagram users by IG_ prefix
  const isInstagram = recipientId.startsWith('IG_');
  const actualRecipientId = isInstagram ? recipientId.replace('IG_', '') : recipientId;
  const token = isInstagram
    ? process.env.INSTAGRAM_PAGE_ACCESS_TOKEN
    : process.env.PAGE_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: actualRecipientId },
        message: { text },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[TEST] ❌ API error:`, errorData);
      throw new Error(`API error: ${JSON.stringify(errorData)}`);
    }

    console.log(`[TEST] ✅ Sent ${isInstagram ? 'Instagram' : 'Messenger'} message to ${actualRecipientId}`);
  } catch (error) {
    console.error(`[TEST] ❌ Failed to send message:`, error);
    throw error;
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
    const timeMatch = text.match(/⏰[^:]*:\s*(.+?)(?=[\r\n]|⏱|💰|WOLT|$)/);
    const etaMatch = text.match(/⏱[^:]*:\s*~?(\d+)\s*წუთი/);
    const instructionsMatch = text.match(/📝[^:]*:\s*(.+?)(?=[\r\n]|💰|WOLT|$)/);

    // Extract product price from product line (format: "product x 1 - 49₾")
    const productPriceMatch = productMatch[1].match(/(\d+(?:\.\d+)?)\s*₾/);

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
      // New fields for Wolt preorder
      etaMinutes: etaMatch ? parseInt(etaMatch[1]) : undefined,
      deliveryInstructions: instructionsMatch ? instructionsMatch[1].trim() : undefined,
      productPrice: productPriceMatch ? parseFloat(productPriceMatch[1]) : undefined,
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
    console.log(`[TEST] 📜 Loaded history: ${conversationData.history?.length || 0} messages`);
    if (conversationData.history?.length > 0) {
      console.log(`[TEST] 📜 Last message role: ${conversationData.history[conversationData.history.length - 1]?.role}`);
    }
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

    // Handle "clear" command - reset conversation history
    if (combinedText.toLowerCase().trim() === "clear") {
      console.log(`[TEST] 🧹 Clear command received - resetting history`);

      // Clear Firestore conversation
      await db.collection("conversations").doc(senderId).set({
        recipientId: senderId,
        history: [],
        orders: [],
        lastActive: new Date().toISOString(),
      });

      await sendMessage(senderId, "✅ ისტორია წაიშალა! შეგიძლია თავიდან დაიწყო ტესტირება 🧹");
      await clearMessageBatch(senderId);
      await redis.del(lockKey);
      console.log(`[TEST] 🔓 Lock released after clear`);
      return NextResponse.json({ status: "cleared" });
    }

    // Load ALL test content (including purchase-flow.md!)
    const systemContent = loadAllTestContent();

    // Load products
    const products = await loadProducts();
    const productList = products
      .filter(p => (p.stock_qty || 0) > 0)
      .map(p => `- ${p.name}: ${p.price}₾ (მარაგშია: ${p.stock_qty})`)
      .join("\n");

    // Get Wolt context if in Wolt flow
    const woltContext = await getWoltContext(conversationData.history, combinedText, senderId);
    if (woltContext) {
      console.log(`[TEST WOLT] Injecting context: ${woltContext}`);

      // Extract and save sessionId if present (for map confirmation flow)
      const sessionMatch = woltContext.match(/\[WOLT_SESSION_ID:\s*([^\]]+)\]/);
      if (sessionMatch) {
        conversationData.woltSessionId = sessionMatch[1].trim();
        console.log(`[TEST WOLT] 📍 Saved sessionId: ${conversationData.woltSessionId}`);
      }

      // Extract and save address if present
      const addressMatch = woltContext.match(/\[WOLT_ADDRESS:\s*([^\]]+)\]/);
      if (addressMatch) {
        conversationData.woltAddress = addressMatch[1].trim();
        console.log(`[TEST WOLT] 📍 Saved address: ${conversationData.woltAddress}`);
      }
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
        // Check if we have a saved sessionId from map confirmation flow
        if (conversationData.woltSessionId) {
          console.log(`[TEST WOLT] 📍 Checking for confirmed location with sessionId: ${conversationData.woltSessionId}`);
          const confirmedLocation = await getConfirmedLocation(conversationData.woltSessionId);
          if (confirmedLocation.confirmed && confirmedLocation.lat && confirmedLocation.lon) {
            console.log(`[TEST WOLT] ✅ Using confirmed coordinates: ${confirmedLocation.lat}, ${confirmedLocation.lon}`);
            orderData.woltCoordinates = {
              lat: confirmedLocation.lat,
              lon: confirmedLocation.lon,
            };
          } else {
            console.log(`[TEST WOLT] ⚠️ No confirmed location found for sessionId`);
          }
          // Clear the sessionId after using it
          delete conversationData.woltSessionId;
        }

        // Use saved address if available
        if (conversationData.woltAddress && !orderData.address) {
          orderData.address = conversationData.woltAddress;
        }

        const orderNumber = await createOrder(orderData);
        response = response.replace(/\[ORDER_NUMBER\]/g, orderNumber);
        console.log(`[TEST] ✅ Order created: ${orderNumber}`);

        // Create Wolt preorder if this is a Wolt order with coordinates
        if (orderData.isWoltOrder && orderData.woltCoordinates) {
          console.log(`[TEST WOLT] 📦 Creating Wolt preorder for order ${orderNumber}`);

          // Parse product name and quantity from product string
          // Format: "product name x quantity - price₾"
          const productParts = orderData.product.match(/^(.+?)\s*x\s*(\d+)/);
          const productName = productParts ? productParts[1].trim() : orderData.product;
          const quantity = productParts ? parseInt(productParts[2]) : 1;

          // Determine delivery time
          // "now", "ახლა", or specific time like "16:00" or full ISO timestamp
          let deliveryTime = "now";
          if (orderData.woltScheduledTime) {
            const timeStr = orderData.woltScheduledTime.toLowerCase();
            if (timeStr === "now" || timeStr === "ახლა" || timeStr.includes("ახლავე")) {
              deliveryTime = "now";
            } else {
              // Already a formatted time or ISO string
              deliveryTime = orderData.woltScheduledTime;
            }
          }

          const preorderData: WoltPreorderData = {
            orderNumber,
            customerName: orderData.clientName,
            customerPhone: orderData.telephone,
            address: orderData.address,
            coordinates: orderData.woltCoordinates,
            productName,
            quantity,
            productPrice: orderData.productPrice || 0,
            deliveryPrice: orderData.deliveryPrice || 0,
            deliveryTime,
            deliveryEta: orderData.etaMinutes,
            deliveryInstructions: orderData.deliveryInstructions !== "-" ? orderData.deliveryInstructions : undefined,
          };

          const preorderResult = await createWoltPreorder(preorderData);
          if (preorderResult.success) {
            console.log(`[TEST WOLT] ✅ Wolt preorder created: ${preorderResult.preorderId}`);
          } else {
            console.error(`[TEST WOLT] ⚠️ Wolt preorder failed but Firestore order was created`);
          }
        }

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

    // Send product images (with Instagram support)
    const isInstagram = senderId.startsWith('IG_');
    const actualSenderId = isInstagram ? senderId.replace('IG_', '') : senderId;
    const imageToken = isInstagram
      ? process.env.INSTAGRAM_PAGE_ACCESS_TOKEN
      : process.env.PAGE_ACCESS_TOKEN;

    for (const match of imageMatches) {
      const productId = match[1].trim();
      const product = products.find(p => p.id === productId);
      if (product?.image && product.image.startsWith("http")) {
        try {
          await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${imageToken}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: actualSenderId },
              message: { attachment: { type: "image", payload: { url: product.image } } },
            }),
          });
          console.log(`[TEST] ✅ Sent image for ${productId} via ${isInstagram ? 'Instagram' : 'Messenger'}`);
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

    // CRITICAL: Ensure recipientId matches senderId
    conversationData.recipientId = senderId;
    console.log(`[TEST] 📊 Before save: recipientId=${conversationData.recipientId}, history length=${conversationData.history.length}`);

    await saveConversation(conversationData);

    // VERIFY: Read back immediately to confirm save worked
    const verifyDoc = await db.collection("conversations").doc(senderId).get();
    const verifyData = verifyDoc.exists ? verifyDoc.data() : null;
    console.log(`[TEST] ✔️ VERIFY after save: history length=${verifyData?.history?.length || 'NOT FOUND'}`);
    if (!verifyData || (verifyData.history?.length || 0) === 0) {
      console.error(`[TEST] ❌ CRITICAL: Save verification FAILED! History not persisted!`);
    }
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
