/**
 * Core bot functionality shared between messenger route and Redis batch processor
 * This file contains all the essential bot logic extracted from the main messenger route
 */

import OpenAI from "openai";
import { db } from "./firestore";
import fs from "fs";
import path from "path";

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
 * Save conversation to Firestore
 */
export async function saveConversation(conversationData: ConversationData): Promise<void> {
  const docRef = db.collection('conversations').doc(conversationData.senderId);
  await docRef.set({
    ...conversationData,
    lastActive: new Date().toISOString(),
  });
}

/**
 * Detect if text is Georgian
 */
export function detectGeorgian(text: string): boolean {
  const georgianPattern = /[\u10A0-\u10FF]/;
  return georgianPattern.test(text);
}

/**
 * Load products from JSON file
 */
export async function loadProducts(): Promise<Product[]> {
  const productsPath = path.join(process.cwd(), "data", "products.json");
  const productsRaw = await fs.promises.readFile(productsPath, "utf-8");
  return JSON.parse(productsRaw);
}

/**
 * Load content files
 */
export async function loadContentFile(filename: string): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), "data", "content", filename);
    return await fs.promises.readFile(filePath, "utf-8");
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return "";
  }
}

/**
 * Load all content
 */
export async function loadAllContent() {
  const [instructions, services, faqs, delivery, payment] = await Promise.all([
    loadContentFile("bot-instructions.md"),
    loadContentFile("services.md"),
    loadContentFile("faqs.md"),
    loadContentFile("delivery.md"),
    loadContentFile("payment.md"),
  ]);

  return {
    instructions,
    services,
    faqs,
    delivery,
    payment,
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

  // Enhanced keyword detection
  const keywords = {
    colors: {
      'წითელ': ['red', 'წითელი', 'წითელ'],
      'შავ': ['black', 'შავი', 'შავ'],
      'თეთრ': ['white', 'თეთრი', 'თეთრ', 'undyed'],
      'ნაცრისფერ': ['grey', 'gray', 'ნაცრისფერი'],
      'ლურჯ': ['blue', 'ლურჯი'],
      'turquoise': ['turquoise', 'ღია ღვინისფერ', 'ღია'],
      'მწვანე': ['green', 'მწვანე'],
      'ყავისფერ': ['brown', 'ყავისფერი'],
      'orange': ['orange', 'ნარინჯისფერ'],
      'აგურისფერ': ['brick', 'აგურისფერ'],
      'გირჩისფერ': ['cone', 'გირჩისფერ'],
    },
    materials: {
      'ბამბა': ['cotton', 'ბამბა', 'ბამბის'],
      'შალი': ['wool', 'შალი', 'შალის'],
    },
    types: {
      'ქუდი': ['hat', 'ქუდი', 'ქუდები'],
      'წინდა': ['sock', 'წინდა', 'წინდები'],
    },
    styles: {
      'პომპონ': ['pompom', 'პომპონი', 'პომპონით', 'პომპონიანი'],
      'მოკლე': ['short', 'მოკლე'],
      'სადა': ['plain', 'სადა'],
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
  operatorInstruction?: string
): Promise<string> {
  const userText = typeof userMessage === 'string' ? userMessage : userMessage.find(c => c.type === 'text')?.text ?? '';
  const isKa = detectGeorgian(userText);

  try {
    const [products, content, contactInfoStr] = await Promise.all([
      loadProducts(),
      loadAllContent(),
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

    return completion.choices[0]?.message?.content || (isKa ? "ბოდიში, ვერ გავიგე." : "Sorry, I didn't understand that.");
  } catch (err: any) {
    console.error("❌ OpenAI API error:", err);

    // Return error message in appropriate language
    return isKa
      ? "ბოდიში, შეცდომა მოხდა თქვენი მოთხოვნის დამუშავებისას. გთხოვთ, სცადოთ ხელახლა."
      : "Sorry, there was an error processing your request. Please try again.";
  }
}