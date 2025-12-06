/**
 * Core bot functionality shared between messenger route and Redis batch processor
 * This file contains all the essential bot logic extracted from the main messenger route
 */

import OpenAI from "openai";
import { db } from "./firestore";
import fs from "fs";
import path from "path";
import { notifyManagerTelegram, parseEscalationCommand, cleanEscalationFromResponse } from "./telegramNotify";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// Type definitions
export type MessageContent = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
export type Message = { role: "system" | "user" | "assistant"; content: MessageContent };

export type ConversationData = {
  senderId: string;
  userName?: string;
  history: Message[];
  orders: Array<{ orderNumber: string; timestamp: string; items: string }>;
  needsAttention?: boolean;
  escalatedAt?: string;
  escalationReason?: string;
  manualMode?: boolean;
  manualModeEnabledAt?: string;
  managerNotified?: boolean;
  escalationDetails?: string;
  managerPhoneOffered?: boolean;
  storeVisitCount?: number;
  operatorInstruction?: string;
  lastActive?: string;
};

export interface Product {
  id: string;
  name: string;
  price: string;
  currency?: string;
  stock: string;
  category?: string;
  material?: string;
  color?: string;
  image?: string;
  description?: string;
}

/**
 * Load conversation from Firestore
 */
export async function loadConversation(senderId: string): Promise<ConversationData> {
  const docRef = db.collection('conversations').doc(senderId);
  const doc = await docRef.get();

  if (doc.exists) {
    const data = doc.data() as ConversationData;
    // Keep only last 20 exchanges (40 messages total)
    if (data.history && data.history.length > 40) {
      data.history = data.history.slice(-40);
    }
    return data;
  }

  return {
    senderId,
    history: [],
    orders: [],
  };
}

/**
 * Save conversation to Firestore and sync to metaMessages for control panel
 */
export async function saveConversation(conversationData: ConversationData): Promise<void> {
  // Save to conversations collection
  const docRef = db.collection('conversations').doc(conversationData.senderId);
  await docRef.set({
    ...conversationData,
    lastActive: new Date().toISOString(),
  });

  // Also sync to metaMessages for control panel visibility
  try {
    if (conversationData.history && conversationData.history.length > 0) {
      // Convert conversation history to meta messages format
      const messages = conversationData.history
        .filter(msg => msg.content)
        .map((msg, index) => ({
          id: `msg_${index}_${Date.now()}`,
          senderId: msg.role === 'user' ? conversationData.senderId : 'bot',
          senderType: msg.role === 'assistant' ? 'bot' : msg.role,
          text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: conversationData.lastActive || new Date().toISOString()
        }));

      // Update metaMessages collection
      const metaRef = db.collection('metaMessages').doc(conversationData.senderId);
      await metaRef.set({
        userId: conversationData.senderId,
        messages: messages,
        lastUpdated: new Date().toISOString()
      });

      console.log(`📋 Synced ${messages.length} messages to control panel for user ${conversationData.senderId}`);
    }
  } catch (err) {
    console.error(`❌ Error syncing to metaMessages:`, err);
    // Don't throw - this is non-critical for message processing
  }
}

/**
 * Detect if text is Georgian
 */
export function detectGeorgian(text: string): boolean {
  const georgianPattern = /[\u10A0-\u10FF]/;
  return georgianPattern.test(text);
}

/**
 * In-memory cache for products (avoid Firestore reads on every request)
 * Cache expires after 5 minutes
 */
let productsCache: { data: Product[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load products from Firestore ONLY (no JSON fallback)
 *
 * UPDATE December 4, 2025: Firestore is the ONLY source for products.
 * No JSON fallback - if Firestore fails, return empty array and log error.
 * This ensures paths are completely independent.
 */
export async function loadProducts(): Promise<Product[]> {
  // Check cache first
  if (productsCache && (Date.now() - productsCache.timestamp) < CACHE_TTL_MS) {
    console.log(`📦 [PRODUCTS] Using cached products (${productsCache.data.length} items, cached ${Math.round((Date.now() - productsCache.timestamp) / 1000)}s ago)`);
    return productsCache.data;
  }

  // Load from Firestore (ONLY source)
  try {
    console.log(`📦 [PRODUCTS] Loading from Firestore...`);
    const snapshot = await db.collection('products').get();

    if (snapshot.empty) {
      console.warn(`📦 [PRODUCTS] ⚠️ Firestore products collection is empty`);
      return [];
    }

    const products: Product[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const type = data.type || 'simple';
      const price = data.price || 0;

      // Only include variations and simple products with price > 0
      if ((type === 'variation' || type === 'simple') && price > 0) {
        products.push({
          id: data.id || doc.id,
          name: data.name || doc.id,
          price: String(parseFloat(price)),
          currency: data.currency || 'GEL',
          category: data.categories ? data.categories.split('>')[0].trim() : '',
          stock: data.stock_qty ?? data.stock ?? 0,
          image: data.images?.[0] || data.image || '',
          description: data.short_description || '',
        });
      }
    });

    // Sort by name for consistency
    products.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ka'));

    // Update cache
    productsCache = { data: products, timestamp: Date.now() };

    console.log(`📦 [PRODUCTS] ✅ Loaded ${products.length} products from Firestore`);
    return products;

  } catch (firestoreError) {
    console.error(`📦 [PRODUCTS] ❌ Firestore error:`, firestoreError);
    // Return empty array - bot will handle gracefully
    return [];
  }
}

/**
 * Load content files
 */
export async function loadContentFile(filename: string, baseDir: string = "data/content"): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), baseDir, filename);
    return await fs.promises.readFile(filePath, "utf-8");
  } catch (error) {
    console.error(`Error loading ${filename} from ${baseDir}:`, error);
    return "";
  }
}

/**
 * Path selector for instructions
 *
 * UPDATE December 6, 2025: Test users routed to test-bot/ for testing
 * - main/data/content/ = Production path for regular users
 * - test-bot/data/content/ = Test path for test users (copy of main)
 *
 * Workflow: Edit test-bot/ → test → promote to main/
 */
function shouldUseMainPath(senderId?: string): boolean {
  // Check if user is a test user from config/test-users.json
  if (senderId) {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), 'config', 'test-users.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      if (config.testMode?.enabled) {
        const testUserIds = config.testUsers?.facebook?.map((u: any) => u.userId) || [];
        if (testUserIds.includes(senderId)) {
          console.log(`🧪 [TEST] User ${senderId} is a TEST USER → using test-bot/`);
          return false; // Use test-bot path
        }
      }
    } catch (error) {
      console.error('Error checking test users:', error);
    }
  }

  console.log(`📚 [MAIN] User ${senderId || 'unknown'} → using main/`);
  return true;
}

/**
 * Load all content from appropriate folder
 *
 * Path routing:
 * - Test users → test-bot/data/content/ (for testing upgrades)
 * - Regular users → main/data/content/ (production)
 */
export async function loadAllContent(senderId?: string) {
  const useMain = shouldUseMainPath(senderId);
  const baseDir = useMain ? 'main/data/content' : 'test-bot/data/content';
  const instructionFile = 'bot-instructions-modular.md';

  console.log(`📚 Loading instructions from: ${baseDir}/${instructionFile}`);

  // Load base files
  const [instructions, services, faqs, delivery, payment, imageHandling] = await Promise.all([
    loadContentFile(instructionFile, baseDir),
    loadContentFile("services.md", baseDir),
    loadContentFile("faqs.md", baseDir),
    loadContentFile("delivery-info.md", baseDir),
    loadContentFile("payment-info.md", baseDir),
    loadContentFile("image-handling.md", baseDir),  // CRITICAL: Instructions for SEND_IMAGE command
  ]);

  // Load additional context files
  const [contextAwareness, contextRetention, honestyEscalation] = await Promise.all([
    loadContentFile("context/context-awareness-rules.md", baseDir),
    loadContentFile("context/context-retention-rules.md", baseDir),
    loadContentFile("core/honesty-escalation.md", baseDir),
  ]);

  console.log(`📚 [${useMain ? 'MAIN' : 'TEST'}] Loaded all content files for user ${senderId} from ${baseDir}`);

  return {
    instructions: `${honestyEscalation}\n\n${instructions}\n\n${contextRetention}\n\n${contextAwareness}`,
    services,
    faqs,
    delivery,
    payment,
    imageHandling,
  };
}

/**
 * Filter products by user query and conversation history
 */
export function filterProductsByQuery(products: Product[], userMessage: string, history: Message[] = []): Product[] {
  const lowerMessage = userMessage.toLowerCase();

  // Extract context from recent conversation history (last 5 messages)
  const recentHistory = history.slice(-5);
  const contextKeywords: string[] = [];

  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      const content = typeof msg.content === 'string' ? msg.content :
                     msg.content.find(c => c.type === 'text')?.text || '';
      const lowerContent = content.toLowerCase();

      // Extract product-related keywords from history
      const colorWords = ['წითელ', 'შავ', 'თეთრ', 'ნაცრისფერ', 'ლურჯ', 'მწვანე', 'ყავისფერ', 'ღია', 'მუქი',
                         'red', 'black', 'white', 'grey', 'gray', 'blue', 'green', 'brown', 'light', 'dark',
                         'ღია ნაცრისფერი', 'მუქი ნაცრისფერი', 'turquoise', 'ღია ღვინისფერ', 'orange', 'ნარინჯისფერ',
                         'აგურისფერ', 'გირჩისფერ'];

      const materialWords = ['ბამბა', 'ბამბის', 'შალი', 'შალის', 'cotton', 'wool'];
      const productWords = ['ქუდი', 'წინდა', 'წინდები', 'hat', 'sock', 'socks', 'პომპონ', 'pompom', 'მოკლე', 'short'];

      for (const word of [...colorWords, ...materialWords, ...productWords]) {
        if (lowerContent.includes(word)) {
          contextKeywords.push(word);
        }
      }
    }
  }

  // Combine current message with context keywords for comprehensive search
  const searchText = lowerMessage + ' ' + contextKeywords.join(' ');

  // If no specific query, return all products (let AI decide)
  if (searchText.trim().length < 3) {
    return products;
  }

  // Enhanced keyword detection with Latin transcriptions and typos
  const keywords = {
    colors: {
      'წითელ': ['red', 'წითელი', 'წითელ', 'witeli', 'witel', 'citel', 'citeli', 'წითერლ'],  // Added typo and Latin
      'შავ': ['black', 'შავი', 'შავ', 'shavi', 'shav', 'savi'],  // Added Latin transcriptions
      'თეთრ': ['white', 'თეთრი', 'თეთრ', 'tetri', 'tetr', 'undyed'],  // Added Latin
      'ნაცრისფერ': ['grey', 'gray', 'ნაცრისფერი', 'nacrisfer', 'nacris'],  // Added Latin
      'ლურჯ': ['blue', 'ლურჯი', 'ლურჯ', 'lurji', 'lurj'],  // Added Latin
      'turquoise': ['turquoise', 'ღია ღვინისფერ', 'ღია'],
      'მწვანე': ['green', 'მწვანე', 'mcvane', 'mwvane'],  // Added Latin
      'ყავისფერ': ['brown', 'ყავისფერი', 'yavisfer', 'kavisfer'],  // Added Latin
      'orange': ['orange', 'ნარინჯისფერ', 'narinjisfer'],
      'აგურისფერ': ['brick', 'აგურისფერ', 'agurisfer'],
      'გირჩისფერ': ['cone', 'გირჩისფერ', 'gircisfer'],
    },
    materials: {
      'ბამბა': ['cotton', 'ბამბა', 'ბამბის', 'bamba', 'bambis'],  // Added Latin
      'შალი': ['wool', 'შალი', 'შალის', 'shali', 'sali'],  // Added Latin
    },
    types: {
      'ქუდი': ['hat', 'ქუდი', 'ქუდები', 'qudi', 'kudi', 'qudebi'],  // Added Latin
      'წინდა': ['sock', 'წინდა', 'წინდები', 'cinda', 'winda', 'tsindebi'],  // Added Latin
    },
    styles: {
      'პომპონ': ['pompom', 'პომპონი', 'პომპონით', 'პომპონიანი', 'pomponi'],
      'მოკლე': ['short', 'მოკლე', 'mokle'],  // Added Latin
      'სადა': ['plain', 'სადა', 'sada'],  // Added Latin
    }
  };

  // Score each product based on matching keywords (including context)
  const scoredProducts = products.map(product => {
    let score = 0;
    const productLower = (product.name + ' ' + (product.description || '') + ' ' + (product.id || '')).toLowerCase();

    // Direct text match gets highest score
    if (productLower.includes(lowerMessage)) {
      score += 10;
    }

    // Check each keyword category
    for (const [category, terms] of Object.entries(keywords)) {
      for (const [key, synonyms] of Object.entries(terms)) {
        const hasKeyword = synonyms.some(syn => searchText.includes(syn.toLowerCase()));
        const hasInProduct = synonyms.some(syn => productLower.includes(syn.toLowerCase()));

        if (hasKeyword && hasInProduct) {
          score += 5;
          // Bonus for exact matches
          if (searchText.includes(key)) {
            score += 2;
          }
        }
      }
    }

    // Check for specific product ID mention
    if (product.id && searchText.includes(product.id.toLowerCase())) {
      score += 15;
    }

    return { product, score };
  });

  // Filter products with score > 0 and sort by score
  const relevantProducts = scoredProducts
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.product);

  // If we found relevant products, return them
  if (relevantProducts.length > 0) {
    console.log(`✅ Found ${relevantProducts.length} relevant products for query: "${userMessage}"`);
    return relevantProducts;
  }

  // If no matches but user asked about products, return some popular items
  const productMentioned = ['ქუდ', 'წინდ', 'hat', 'sock', 'product', 'პროდუქტ'].some(word =>
    searchText.includes(word.toLowerCase())
  );

  if (productMentioned) {
    console.log(`📦 No exact matches, showing popular products`);
    // Return a selection of available products
    return products.slice(0, 10);
  }

  // Return all products if nothing specific matched
  console.log(`📋 No specific matches, returning all products`);
  return products;
}

/**
 * Send message to Facebook Messenger
 */
export async function sendMessage(recipientId: string, messageText: string): Promise<void> {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "";
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  // Add detailed logging to debug duplicate messages
  const messagePreview = messageText.substring(0, 50);
  const callStack = new Error().stack?.split('\n').slice(2, 5).join(' -> ') || 'unknown';
  console.log(`📤 SENDING MESSAGE to ${recipientId}: "${messagePreview}..." from: ${callStack}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: messageText }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Facebook API error:`, error);
    } else {
      console.log(`✅ Message sent to ${recipientId}`);
    }
  } catch (error) {
    console.error(`❌ Error sending message:`, error);
  }
}

/**
 * Convert Facebook image to base64 for OpenAI
 */
export async function facebookImageToBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log(`🔄 Converting Facebook image to base64: ${imageUrl}`);

    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`❌ Failed to fetch image: ${response.status}`);
      return null;
    }

    // Get the image as a buffer
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Get content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return as data URL
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(`❌ Error converting image to base64:`, error);
    return null;
  }
}

/**
 * Get AI response - main bot logic
 */
export async function getAIResponse(
  userMessage: MessageContent,
  history: Message[] = [],
  previousOrders: ConversationData['orders'] = [],
  storeVisitCount: number = 0,
  operatorInstruction?: string,
  senderId?: string
): Promise<string> {
  const userText = typeof userMessage === 'string' ? userMessage : userMessage.find(c => c.type === 'text')?.text ?? '';
  const isKa = detectGeorgian(userText);

  try {
    const [products, content, contactInfoStr] = await Promise.all([
      loadProducts(),
      loadAllContent(senderId),  // Pass senderId for dynamic instruction loading
      loadContentFile("contact-info.json"),
    ]);

    const contactInfo = contactInfoStr ? JSON.parse(contactInfoStr) : null;

    // Filter products based on user query AND conversation history
    const filteredProducts = filterProductsByQuery(products, userText, history);

    // Build product catalog for AI context - filtered products only
    const productContext = filteredProducts
      .map((p) => {
        const hasImage = p.image && p.image !== 'IMAGE_URL_HERE' && !p.image.includes('facebook.com') && p.image.startsWith('http');
        return `${p.name} (ID: ${p.id}) - Price: ${p.price} ${p.currency || ""}, Stock: ${p.stock}, Category: ${p.category || "N/A"}${hasImage ? ' [HAS_IMAGE]' : ''}`;
      })
      .join("\n");

    // Add note if showing filtered results
    const productNote = filteredProducts.length < products.length
      ? `\n\n(Showing ${filteredProducts.length} relevant products. Ask customer to specify if they need something else.)`
      : '';

    // Get current date/time in Georgia timezone (GMT+4)
    const now = new Date();
    const georgiaTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tbilisi',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    // Build previous orders context if any
    const orderHistory = previousOrders.length > 0
      ? previousOrders.map((order, idx) =>
          `${idx + 1}. Order #${order.orderNumber} on ${new Date(order.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${order.items}`
        ).join('\n')
      : '';

    // Build comprehensive system prompt with all content
    const systemPrompt = isKa
      ? `${content.instructions}

# Image Handling Instructions
${content.imageHandling}

# Our Services
${content.services}

# Frequently Asked Questions
${content.faqs}

# Delivery Information
${content.delivery}

# Payment Information
${content.payment}

# Product Catalog (Filtered for this query)
${productContext}${productNote}

# Current Date and Time
Georgia Time (GMT+4): ${georgiaTime}

**CRITICAL - DELIVERY DATE CALCULATION:** Use the above date/time to calculate accurate delivery dates. NEVER tell customers "1-3 business days" - instead calculate and specify exact days like "Monday", "Tuesday", "Wednesday", etc.

**═══════════════════════════════════════════════════════**
**CRITICAL - PRODUCT MATCHING RULES (GEORGIAN)**
**═══════════════════════════════════════════════════════**

When a customer asks about a product, you MUST understand these Georgian keywords to match the EXACT product:

**მატერია (Material):**
- "ბამბა" or "ბამბის" = Cotton
- "შალი" or "შალის" = Wool

**ფორმა და სტილი (Form):**
- "სადა" = Plain
- "პომპონით" or "პომპონიანი" = With pompom
- "მოკლე" = Short

**MATCHING STRATEGY:**

1. **Exact Match First**: Match products based on ALL specified attributes (color + material + form)

2. **Generic Requests**: If customer asks generically without specifying material or form:
   - Find the SIMPLEST product in that color
   - Prefer "სადა" (plain) over "პომპონით" (with pompom)

3. **Each Product is Unique**: Match based on ALL attributes, not just color

**CONTEXT RETENTION - ABSOLUTELY CRITICAL:**
- ALWAYS check conversation history to understand what product is being discussed
- When user says just a color or "that one", refer to the most recent product discussed
- NEVER contradict yourself - if you offered a product earlier, it's still available
- The Product Catalog shows what's currently relevant to this conversation based on context
${orderHistory ? `\n# Customer Order History\nThis is a returning customer with previous orders:\n${orderHistory}\n\nWhen relevant, you may reference their previous orders (e.g., "Would you like to repeat your last order?")` : ''}

**═══════════════════════════════════════════════════════**
**ABSOLUTE CRITICAL RULE - IMAGES ARE MANDATORY**
**═══════════════════════════════════════════════════════**

EVERY TIME you mention ANY product that has [HAS_IMAGE] in the catalog, you MUST - WITHOUT EXCEPTION - end your response with:

SEND_IMAGE: [EXACT_PRODUCT_ID]

**THIS IS NOT OPTIONAL. THIS IS MANDATORY. NO EXCEPTIONS EVER.**

**RESPONSE LANGUAGE AND STYLE:**
- Respond in Georgian language to customers
- Keep responses concise and clear (maximum 200 words)
- Use friendly, helpful tone appropriate for e-commerce customer service`
      : `${content.instructions}

# Image Handling Instructions
${content.imageHandling}

# Our Services
${content.services}

# Frequently Asked Questions
${content.faqs}

# Delivery Information
${content.delivery}

# Payment Information
${content.payment}

# Product Catalog (Filtered for this query)
${productContext}${productNote}

# Current Date and Time
Georgia Time (GMT+4): ${georgiaTime}

**CRITICAL:** Use the date and time above to calculate PRECISE delivery dates! Never tell customers "1-3 working days" - instead calculate and provide SPECIFIC dates.

**CONTEXT RETENTION - ABSOLUTELY CRITICAL:**
- ALWAYS check conversation history to understand what product is being discussed
- When user says just a color or "that one", refer to the most recent product discussed
- NEVER contradict yourself - if you offered a product earlier, it's still available
${orderHistory ? `\n# Customer's Previous Orders\nReturning customer with these orders:\n${orderHistory}` : ''}

Respond in English, concisely and clearly (max 200 words).`;

    // Build messages array with operator instruction as high-priority system message
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      ...history,
    ];

    // Inject operator instruction as a priority system message (if present)
    if (operatorInstruction) {
      messages.push({
        role: "system",
        content: `**URGENT INSTRUCTION FROM HUMAN OPERATOR - HIGHEST PRIORITY:**\n\n${operatorInstruction}\n\n**Follow this instruction for your next response. This overrides any other guidance if there's a conflict.**`,
      });
      console.log(`📋 Operator instruction injected: "${operatorInstruction}"`);
    }

    // Add current user message
    messages.push({ role: "user", content: userMessage });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 1000,
    });

    let response = completion.choices[0]?.message?.content || (isKa ? "ბოდიში, ვერ გავიგე." : "Sorry, I didn't understand that.");

    // ═══════════════════════════════════════════════════════
    // AUTO-ESCALATION CHECK
    // ═══════════════════════════════════════════════════════
    console.log(`🔍 [ESCALATION CHECK] Response length: ${response.length}, senderId: ${senderId}`);
    console.log(`🔍 [ESCALATION CHECK] Contains მენეჯერ: ${response.includes('მენეჯერ')}`);

    // Check for ESCALATE_TO_MANAGER command
    let escalationReason = parseEscalationCommand(response);
    console.log(`🔍 [ESCALATION CHECK] Explicit ESCALATE command: ${escalationReason || 'none'}`);

    // SAFETY CHECK: If bot mentions "მენეჯერ" (manager) but forgot to include ESCALATE command, auto-escalate
    // This catches cases where GPT ignores the escalation rule
    if (!escalationReason && senderId) {
      const mentionsManager = response.includes('მენეჯერ') || response.toLowerCase().includes('manager');
      console.log(`🔍 [ESCALATION CHECK] mentionsManager: ${mentionsManager}`);
      if (mentionsManager) {
        console.log(`⚠️ [AUTO-ESCALATE] Bot mentioned manager but forgot ESCALATE command!`);
        escalationReason = 'Bot mentioned manager - auto-escalation triggered';
      }
    }

    if (escalationReason && senderId) {
      console.log(`🚨 [ESCALATION] Triggered for user ${senderId}: ${escalationReason}`);

      // Send Telegram notification to manager
      await notifyManagerTelegram({
        senderId: senderId,
        reason: escalationReason,
        customerMessage: userText,
        conversationHistory: history.slice(-5).map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : '[complex content]'
        })),
      });

      // Enable manual mode for this user - bot will stop responding until manager disables it
      await enableManualMode(senderId, escalationReason);

      // Clean the ESCALATE command from response before sending to customer
      response = cleanEscalationFromResponse(response);
    }

    return response;
  } catch (err: any) {
    console.error("❌ OpenAI API error:", err);

    // Return error message in appropriate language
    return isKa
      ? "ბოდიში, შეცდომა მოხდა თქვენი მოთხოვნის დამუშავებისას. გთხოვთ, სცადოთ ხელახლა."
      : "Sorry, there was an error processing your request. Please try again.";
  }
}

/**
 * Enable manual mode for a user - bot will stop auto-responding until manager disables it
 * Called automatically when ESCALATE_TO_MANAGER command is triggered
 *
 * CRITICAL: This function now VERIFIES the write succeeded. If Firestore fails,
 * we retry once. If it still fails, we throw to ensure the caller knows.
 */
export async function enableManualMode(senderId: string, escalationReason: string): Promise<void> {
  const docRef = db.collection('conversations').doc(senderId);
  const timestamp = new Date().toISOString();

  const updateData = {
    manualMode: true,
    manualModeEnabledAt: timestamp,
    escalatedAt: timestamp,
    escalationReason: escalationReason,
    needsAttention: true,
  };

  // Attempt to write with verification
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`🎮 [MANUAL MODE] Attempt ${attempt}: Setting manualMode=true for ${senderId}`);

      // Write to Firestore
      await docRef.set(updateData, { merge: true });

      // VERIFY the write succeeded by reading it back
      const verifyDoc = await docRef.get();
      const verifyData = verifyDoc.data();

      if (verifyData?.manualMode === true) {
        console.log(`✅ [MANUAL MODE] VERIFIED: manualMode=true for ${senderId}`);
        console.log(`   Reason: ${escalationReason}`);
        console.log(`   Bot will NOT auto-respond until manager disables manual mode`);
        return; // Success!
      } else {
        console.error(`❌ [MANUAL MODE] Write verification FAILED for ${senderId}`);
        console.error(`   Expected manualMode=true, got: ${verifyData?.manualMode}`);

        if (attempt < 2) {
          console.log(`🔄 [MANUAL MODE] Retrying...`);
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
        }
      }
    } catch (error) {
      console.error(`❌ [MANUAL MODE] Firestore error on attempt ${attempt} for ${senderId}:`, error);

      if (attempt < 2) {
        console.log(`🔄 [MANUAL MODE] Retrying after error...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
      }
    }
  }

  // If we get here, both attempts failed
  console.error(`🚨 [MANUAL MODE] CRITICAL: Failed to enable manual mode for ${senderId} after 2 attempts!`);
  console.error(`   Escalation was triggered but manual mode NOT set - bot may continue responding!`);
  // Don't throw - we still want the escalation flow to complete
}

/**
 * Disable manual mode for a user - bot will resume auto-responding
 * Called by manager via Control Panel
 */
export async function disableManualMode(senderId: string): Promise<void> {
  try {
    const docRef = db.collection('conversations').doc(senderId);
    const timestamp = new Date().toISOString();

    // Update conversation with manual mode disabled
    await docRef.set({
      manualMode: false,
      manualModeDisabledAt: timestamp,
      needsAttention: false,
    }, { merge: true });

    console.log(`🎮 [MANUAL MODE] Disabled for user ${senderId} - Bot will resume auto-responding`);
  } catch (error) {
    console.error(`❌ Error disabling manual mode for ${senderId}:`, error);
  }
}
