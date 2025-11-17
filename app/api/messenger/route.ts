import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import { kv } from "@vercel/kv";
import { sendOrderEmail, parseOrderNotification } from "../../../lib/sendOrderEmail";
import { logOrder } from "../../../lib/orderLogger";

type Message = { role: "system" | "user" | "assistant"; content: string };
type Product = {
  id: string;
  name: string;
  price: number;
  currency?: string;
  stock: number;
  availability?: string;
  category?: string;
  attributes?: Record<string, any>;
  image?: string;
  url?: string;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "your_verify_token_123";

const MAX_HISTORY_LENGTH = 10; // Keep last 10 messages per user

type ConversationData = {
  senderId: string;
  history: Message[];
  orders: Array<{
    orderNumber: string;
    timestamp: string;
    items: string;
  }>;
  lastActive: string;
  storeVisitRequests?: number; // Track how many times user asked about visiting physical store
};

async function loadProducts(): Promise<Product[]> {
  try {
    const file = path.join(process.cwd(), "data", "products.json");
    const txt = await fs.readFile(file, "utf8");
    return JSON.parse(txt) as Product[];
  } catch (err) {
    console.error("❌ Error loading products:", err);
    return [];
  }
}

async function loadContentFile(filename: string): Promise<string> {
  try {
    const file = path.join(process.cwd(), "data", "content", filename);
    return await fs.readFile(file, "utf8");
  } catch (err) {
    console.error(`❌ Error loading ${filename}:`, err);
    return "";
  }
}

async function loadAllContent() {
  const [instructions, services, faqs, delivery, payment] = await Promise.all([
    loadContentFile("bot-instructions.md"),
    loadContentFile("services.md"),
    loadContentFile("faqs.md"),
    loadContentFile("delivery-info.md"),
    loadContentFile("payment-info.md"),
  ]);

  return { instructions, services, faqs, delivery, payment };
}

async function loadConversation(senderId: string): Promise<ConversationData> {
  try {
    // Try Vercel KV first (for production)
    if (process.env.KV_REST_API_URL) {
      const data = await kv.get<ConversationData>(`conversation:${senderId}`);
      if (data) {
        console.log(`📂 Loaded conversation from KV for user ${senderId}`);
        return data;
      }
    } else {
      // Fallback to file system for local development
      const baseDir = path.join(process.cwd(), "data", "conversations");
      try {
        await fs.mkdir(baseDir, { recursive: true });
      } catch (mkdirErr) {
        // Ignore if already exists
      }

      const file = path.join(baseDir, `${senderId}.json`);
      const txt = await fs.readFile(file, "utf8");
      const data = JSON.parse(txt) as ConversationData;
      console.log(`📂 Loaded conversation from file for user ${senderId}`);
      return data;
    }
  } catch (err) {
    // Return new conversation if not found
  }

  console.log(`📂 Creating new conversation for user ${senderId}`);
  return {
    senderId,
    history: [],
    orders: [],
    lastActive: new Date().toISOString()
  };
}

async function saveConversation(data: ConversationData): Promise<void> {
  try {
    data.lastActive = new Date().toISOString();

    // Try Vercel KV first (for production)
    if (process.env.KV_REST_API_URL) {
      // Store conversation with 30-day expiration
      await kv.set(`conversation:${data.senderId}`, data, { ex: 60 * 60 * 24 * 30 });
      console.log(`💾 Saved conversation to KV for user ${data.senderId}`);
    } else {
      // Fallback to file system for local development
      const baseDir = path.join(process.cwd(), "data", "conversations");
      try {
        await fs.mkdir(baseDir, { recursive: true });
      } catch (mkdirErr) {
        // Ignore if already exists
      }

      const file = path.join(baseDir, `${data.senderId}.json`);
      await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
      console.log(`💾 Saved conversation to file for user ${data.senderId}`);
    }
  } catch (err) {
    console.error(`❌ Error saving conversation for user ${data.senderId}:`, err);
  }
}

// Store message for Meta review dashboard
async function logMetaMessage(userId: string, senderId: string, senderType: 'user' | 'bot', text: string): Promise<void> {
  try {
    if (!process.env.KV_REST_API_URL) {
      console.log("⚠️ Skipping meta message log (no KV in local dev)");
      return;
    }

    const key = `meta-messages:${userId}`;

    // Get existing conversation
    const existing = await kv.get<{ userId: string; messages: any[] }>(key);

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId,
      senderType,
      text,
      timestamp: new Date().toISOString()
    };

    const conversation = {
      userId,
      messages: [...(existing?.messages || []), message]
    };

    // Keep last 100 messages per conversation
    if (conversation.messages.length > 100) {
      conversation.messages = conversation.messages.slice(-100);
    }

    // Store with 7-day expiration (for Meta review)
    await kv.set(key, conversation, { ex: 60 * 60 * 24 * 7 });
    console.log(`📋 Logged meta message for dashboard: ${senderType} - "${text.substring(0, 50)}..."`);
  } catch (err) {
    console.error("❌ Error logging meta message:", err);
  }
}

function detectGeorgian(text: string) {
  return /[\u10A0-\u10FF]/.test(text);
}

function detectStoreVisitRequest(text: string): boolean {
  // Georgian patterns
  const georgianPatterns = [
    /მაღაზი/i,           // store
    /საწყობ/i,           // warehouse
    /მოვიდ/i,            // come/visit
    /ადგილ/i,            // place/location
    /სად\s+(ხარ|ბრძან)/i, // where are you
    /მისამართ/i,         // address
    /ფიზიკურ/i,          // physical
    /ვიზიტ/i,            // visit
    /ადგილზე/i,          // on location
  ];

  // English patterns
  const englishPatterns = [
    /\b(store|shop|location|address|warehouse)\b/i,
    /\bcome\s+(to|visit)\b/i,
    /\bwhere\s+(are\s+you|is\s+(your|the))\b/i,
    /\b(visit|see)\s+(store|shop|warehouse)\b/i,
    /\bphysical\s+(store|location)\b/i,
  ];

  const allPatterns = [...georgianPatterns, ...englishPatterns];
  return allPatterns.some(pattern => pattern.test(text));
}

function parseImageCommands(response: string): { productIds: string[]; cleanResponse: string } {
  console.log(`🔍 parseImageCommands called with response length: ${response.length}`);
  console.log(`🔍 Response preview (first 300 chars):`, response.substring(0, 300));
  console.log(`🔍 Response preview (last 300 chars):`, response.substring(Math.max(0, response.length - 300)));

  const imageRegex = /SEND_IMAGE:\s*([A-Z0-9\-_]+)/gi;
  const matches = [...response.matchAll(imageRegex)];
  console.log(`🔍 Found ${matches.length} SEND_IMAGE matches`);

  const productIds = matches.map(match => {
    console.log(`🔍 Matched product ID: "${match[1]}"`);
    return match[1].trim();
  });

  // Remove SEND_IMAGE commands from response
  const cleanResponse = response.replace(imageRegex, '').trim();

  return { productIds, cleanResponse };
}

async function sendMessage(recipientId: string, messageText: string) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  console.log(`📤 Sending message to ${recipientId}:`, messageText);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: messageText },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Facebook API error:", data);
    } else {
      console.log("✅ Message sent successfully:", data);
    }

    return data;
  } catch (err) {
    console.error("❌ Error sending message:", err);
    throw err;
  }
}

/**
 * Split text into natural message chunks (sentence by sentence)
 * Handles Georgian and English sentences, emojis, lists, etc.
 */
function splitIntoMessageChunks(text: string): string[] {
  // Split by double line breaks first (paragraphs)
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);

  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    // Check if this is a list (numbered or bulleted)
    if (/^[\d\.\-\*•]\s/.test(paragraph) || paragraph.includes('\n')) {
      // Keep lists together as one chunk
      chunks.push(paragraph);
      continue;
    }

    // Split into sentences (supports Georgian period "." and common punctuation)
    // Match: sentence ending with . ! ? followed by space or end, keeping emojis attached
    const sentencePattern = /[^.!?]+[.!?]+(?:\s*[\u{1F300}-\u{1F9FF}])?/gu;
    const sentences = paragraph.match(sentencePattern);

    if (sentences && sentences.length > 0) {
      sentences.forEach(sentence => {
        const trimmed = sentence.trim();
        if (trimmed.length > 0) {
          chunks.push(trimmed);
        }
      });
    } else {
      // No sentence endings found, send whole paragraph
      chunks.push(paragraph);
    }
  }

  return chunks;
}

/**
 * Send a message split into natural chunks with delays between each
 * Simulates human typing for better user experience
 */
async function sendMessageInChunks(recipientId: string, messageText: string) {
  const chunks = splitIntoMessageChunks(messageText);

  console.log(`📨 Sending ${chunks.length} message chunks to ${recipientId}`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Send typing indicator (optional - Facebook may show "typing..." bubble)
    try {
      await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          sender_action: "typing_on"
        }),
      });
    } catch (err) {
      console.error("⚠️ Error sending typing indicator:", err);
    }

    // Delay based on chunk length to simulate natural typing speed
    // Rough estimate: 40-60 chars per second (fast human typing)
    const typingDelay = Math.min(Math.max(chunk.length * 20, 300), 2000); // 300ms min, 2s max
    await new Promise(resolve => setTimeout(resolve, typingDelay));

    // Send the actual message
    await sendMessage(recipientId, chunk);

    // Small pause between messages (like human would pause between sentences)
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }

  console.log(`✅ All ${chunks.length} chunks sent successfully`);
}

async function sendImage(recipientId: string, imageUrl: string) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  // Encode Georgian characters in the filename for Facebook API
  let encodedImageUrl = imageUrl;
  try {
    const urlObj = new URL(imageUrl);
    // Split path into segments and encode each segment individually
    const pathSegments = urlObj.pathname.split('/');
    const encodedSegments = pathSegments.map(segment => {
      // Only encode if segment contains non-ASCII characters
      if (/[^\x00-\x7F]/.test(segment)) {
        return encodeURIComponent(segment);
      }
      return segment;
    });
    encodedImageUrl = `${urlObj.protocol}//${urlObj.host}${encodedSegments.join('/')}${urlObj.search}`;
    console.log(`📸 Sending image to ${recipientId}:`, imageUrl);
    console.log(`📸 Encoded URL:`, encodedImageUrl);
  } catch (err) {
    console.log(`⚠️ Could not parse URL, using as-is:`, imageUrl);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "image",
            payload: {
              url: encodedImageUrl,
              is_reusable: true
            }
          }
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Facebook API error sending image:", data);
      console.error("❌ Full error details:", JSON.stringify(data, null, 2));
    } else {
      console.log("✅ Image sent successfully:", data);
    }

    return data;
  } catch (err) {
    console.error("❌ Error sending image:", err);
    throw err;
  }
}

async function getAIResponse(userMessage: string, history: Message[] = [], previousOrders: ConversationData['orders'] = [], storeVisitCount: number = 0): Promise<string> {
  try {
    const [products, content, contactInfoStr] = await Promise.all([
      loadProducts(),
      loadAllContent(),
      loadContentFile("contact-info.json"),
    ]);

    const contactInfo = contactInfoStr ? JSON.parse(contactInfoStr) : null;

    const isKa = detectGeorgian(userMessage);

    // Build product catalog for AI context - show all products
    const productContext = products
      .map((p) => {
        const hasImage = p.image && p.image !== 'IMAGE_URL_HERE' && !p.image.includes('facebook.com') && p.image.startsWith('http');
        return `${p.name} (ID: ${p.id}) - Price: ${p.price} ${p.currency || ""}, Stock: ${p.stock}, Category: ${p.category || "N/A"}${hasImage ? ' [HAS_IMAGE]' : ''}`;
      })
      .join("\n");

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

# Product Catalog
${productContext}

# Current Date and Time
Georgia Time (GMT+4): ${georgiaTime}

**CRITICAL - DELIVERY DATE CALCULATION:** Use the above date/time to calculate accurate delivery dates. NEVER tell customers "1-3 business days" - instead calculate and specify exact days like "Monday", "Tuesday", "Wednesday", etc.
${orderHistory ? `\n# Customer Order History\nThis is a returning customer with previous orders:\n${orderHistory}\n\nWhen relevant, you may reference their previous orders (e.g., "Would you like to repeat your last order?")` : ''}

**═══════════════════════════════════════════════════════**
**ABSOLUTE CRITICAL RULE - IMAGES ARE MANDATORY**
**═══════════════════════════════════════════════════════**

EVERY TIME you mention ANY product that has [HAS_IMAGE] in the catalog, you MUST - WITHOUT EXCEPTION - end your response with:

SEND_IMAGE: [EXACT_PRODUCT_ID]

**THIS IS NOT OPTIONAL. THIS IS MANDATORY. NO EXCEPTIONS EVER.**

**REQUIRED FORMAT FOR EVERY PRODUCT RESPONSE:**

Your Georgian response to customer

SEND_IMAGE: PRODUCT_ID

**EXAMPLES - YOU MUST FOLLOW THIS EXACT PATTERN:**

Example 1:
User: "შავი ქუდი გაქვთ?"
Your response MUST be:
"დიახ, გვაქვს შავი ბამბის მოკლე ქუდი. ფასი: 49 ლარი.

SEND_IMAGE: H-SHORT-COT-BLACK"

Example 2:
User: "წითელი?"
Your response MUST be:
"დიახ, გვაქვს წითელი ბამბის მოკლე ქუდი. ფასი: 49 ლარი.

SEND_IMAGE: H-SHORT-COT-RED"

Example 3:
User: "სტაფილოსფერი?"
Your response MUST be:
"დიახ, გვაქვს სტაფილოსფერი ბამბის მოკლე ქუდი. ფასი: 49 ლარი.

SEND_IMAGE: H-SHORT-COT-ORANGE"

**CONTEXT RULE:**
If customer asks "ფოტო გაქვთ?" without product name, find the last product with [HAS_IMAGE] from conversation and send its image.

**NEVER tell customer about "SEND_IMAGE"** - just add it at the end silently!

**REPEAT: EVERY PRODUCT WITH [HAS_IMAGE] = MUST SEND IMAGE. ZERO EXCEPTIONS.**

${storeVisitCount >= 2 && contactInfo ? `
**REPEATED PHYSICAL STORE/WAREHOUSE VISIT REQUEST:**
The customer has now asked ${storeVisitCount} times about visiting a physical store or warehouse. Use a more clear and definitive response:

"${contactInfo.address_policy.geo_persistent_followup}"

This is the final answer. Make it clear that physical visits are not possible.
` : ''}

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

# Product Catalog
${productContext}

# Current Date and Time
Georgia Time (GMT+4): ${georgiaTime}

**CRITICAL:** Use the date and time above to calculate PRECISE delivery dates! Never tell customers "1-3 working days" - instead calculate and provide SPECIFIC dates like "Monday", "Tuesday", "Wednesday", etc.
${orderHistory ? `\n# Customer's Previous Orders\nThis is a returning customer with the following orders:\n${orderHistory}\n\nYou can reference their previous orders when appropriate (e.g., "Would you like to reorder from your last purchase?")` : ''}

**EXTREMELY IMPORTANT - SENDING IMAGES:**
When discussing a specific product that has [HAS_IMAGE] marker, you MUST use this format at the END of your response:

SEND_IMAGE: [product_id]

**USING CONTEXT:**
If the customer asks "do you have a photo?" or "show me a picture" without mentioning a specific product name, look at the conversation history and find the last mentioned product that has [HAS_IMAGE]. Send that product's image!

Example:
1. You: "This is the orange cotton short hat! Price: 49 GEL..."
2. Customer: "Do you have a photo?"
3. You must understand they're asking about the orange hat (H-SHORT-COT-ORANGE) and send:

SEND_IMAGE: H-SHORT-COT-ORANGE

Products with images that you MUST send:
- H-SHORT-COT-TURQ [HAS_IMAGE] - Turquoise cotton short hat
- H-SHORT-COT-ORANGE [HAS_IMAGE] - Orange cotton short hat
- H-COT-WHITE-UNDYED [HAS_IMAGE] - White undyed cotton hat
- H-POMP-WOOL-TURQ [HAS_IMAGE] - Turquoise wool pompom hat
- S-WOOL-GREEN-WHITE-CUFF [HAS_IMAGE] - Green wool sock

Never mention "SEND_IMAGE" to customer - just add it at the end!

${storeVisitCount >= 2 && contactInfo ? `
**IMPORTANT - PHYSICAL STORE/WAREHOUSE VISIT REQUEST:**
The customer has already asked about visiting the physical store or warehouse ${storeVisitCount} times. Use the more firm and detailed response:

"${contactInfo.address_policy.eng_persistent_followup}"

This is the final answer and you must be clear that physical visits are not possible.
` : ''}

Respond in English, concisely and clearly (max 200 words).

**REMINDER - When to send images:**
Send images ONLY when:
- Customer directly requests a photo ("do you have photos?", "show me picture", "send photo")
- Customer asks about a specific product where showing image would help (e.g. "what does it look like?", "the orange one?")
- Add SEND_IMAGE commands at the end of your response. Never mention this to the customer!`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return completion.choices[0]?.message?.content || (isKa ? "ბოდიში, ვერ გავიგე." : "Sorry, I didn't understand that.");
  } catch (err) {
    console.error("❌ OpenAI API error:", err);
    return "Sorry, there was an error processing your request.";
  }
}

// GET handler for webhook verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("🔍 Messenger webhook verification request:");
  console.log("  Mode:", mode);
  console.log("  Token received:", token);
  console.log("  Token received length:", token?.length);
  console.log("  Token expected:", VERIFY_TOKEN);
  console.log("  Token expected length:", VERIFY_TOKEN?.length);
  console.log("  Tokens match:", token === VERIFY_TOKEN);
  console.log("  Mode check:", mode === "subscribe");
  console.log("  Challenge:", challenge);

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    console.log("✅ Messenger webhook verified successfully!");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("❌ Messenger webhook verification failed");
  console.error(`  Mode: '${mode}' (expected: 'subscribe')`);
  console.error(`  Token: '${token}' (expected: '${VERIFY_TOKEN}')`);
  console.error(`  Challenge: '${challenge}'`);
  return new NextResponse("Forbidden", { status: 403 });
}

// POST handler for incoming messages
export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("📩 Incoming Messenger webhook:");
    console.log(JSON.stringify(body, null, 2));

    // Check if this is a page event
    if (body.object === "page") {
      // Iterate over entries
      for (const entry of body.entry || []) {
        console.log(`📦 Processing entry ID: ${entry.id}`);

        // Iterate over messaging events
        for (const event of entry.messaging || []) {
          console.log(`💬 Processing messaging event:`, JSON.stringify(event, null, 2));

          const senderId = event.sender?.id;
          const messageText = event.message?.text;

          if (senderId && messageText) {
            console.log(`👤 User ${senderId} said: "${messageText}"`);

            // Log incoming message for Meta review dashboard
            await logMetaMessage(senderId, senderId, 'user', messageText);

            // Load conversation data from file
            const conversationData = await loadConversation(senderId);
            console.log(`📝 Retrieved ${conversationData.history.length} previous messages for user ${senderId}`);

            // Show previous orders if any
            if (conversationData.orders.length > 0) {
              console.log(`🛒 Customer has ${conversationData.orders.length} previous orders`);
            }

            // Initialize storeVisitRequests if undefined
            if (conversationData.storeVisitRequests === undefined) {
              conversationData.storeVisitRequests = 0;
            }

            // Detect if user is asking about physical store/warehouse visit
            const isStoreVisitRequest = detectStoreVisitRequest(messageText);
            if (isStoreVisitRequest) {
              conversationData.storeVisitRequests += 1;
              console.log(`🏪 Store visit request detected (count: ${conversationData.storeVisitRequests})`);
            }

            // Get AI response with conversation context, order history, and store visit count
            const response = await getAIResponse(messageText, conversationData.history, conversationData.orders, conversationData.storeVisitRequests);

            console.log(`🤖 AI Response length: ${response.length} chars`);
            console.log(`🤖 AI Response (first 500 chars):`, response.substring(0, 500));
            console.log(`🤖 AI Response (last 200 chars):`, response.substring(Math.max(0, response.length - 200)));

            // Update conversation history
            conversationData.history.push({ role: "user", content: messageText });
            conversationData.history.push({ role: "assistant", content: response });

            // Trim history if it exceeds maximum length (keeping last N exchanges)
            // Each exchange = 2 messages (user + assistant), so max = MAX_HISTORY_LENGTH * 2
            if (conversationData.history.length > MAX_HISTORY_LENGTH * 2) {
              const trimCount = conversationData.history.length - MAX_HISTORY_LENGTH * 2;
              conversationData.history.splice(0, trimCount);
              console.log(`✂️ Trimmed ${trimCount} old messages from history`);
            }

            // Parse response for image commands
            const { productIds, cleanResponse: responseWithoutImages } = parseImageCommands(response);

            // Send product images if requested
            if (productIds.length > 0) {
              console.log(`🖼️ Found ${productIds.length} image(s) to send:`, productIds);

              // Load products to get image URLs
              const allProducts = await loadProducts();
              const productMap = new Map(allProducts.map(p => [p.id, p]));

              for (const productId of productIds) {
                const product = productMap.get(productId);
                if (product && product.image &&
                    product.image !== "IMAGE_URL_HERE" &&
                    !product.image.includes('facebook.com') &&
                    product.image.startsWith('http')) {
                  await sendImage(senderId, product.image);
                  console.log(`✅ Sent image for ${productId}`);
                } else {
                  console.warn(`⚠️ No valid image found for product ${productId}`);
                }
              }
            }

            // Check if response contains order notification and send email
            const orderData = parseOrderNotification(responseWithoutImages);
            if (orderData) {
              console.log("📧 Order notification detected, processing order...");

              // Log order and get order number
              const orderNumber = await logOrder(orderData, 'messenger');
              console.log(`📝 Order logged with number: ${orderNumber}`);

              // Add order to conversation data
              conversationData.orders.push({
                orderNumber,
                timestamp: new Date().toISOString(),
                items: orderData.product || "Unknown items"
              });

              // Send email with order number
              const emailSent = await sendOrderEmail(orderData, orderNumber);
              if (emailSent) {
                console.log("✅ Order email sent successfully");
              } else {
                console.error("❌ Failed to send order email");
              }

              // Remove the ORDER_NOTIFICATION block from the response shown to user
              let finalResponse = responseWithoutImages.replace(/ORDER_NOTIFICATION:[\s\S]*?(?=\n\n|$)/g, '').trim();

              // Replace [ORDER_NUMBER] placeholder with actual order number
              finalResponse = finalResponse.replace(/\[ORDER_NUMBER\]/g, orderNumber);

              // Save conversation data with order
              await saveConversation(conversationData);

              await sendMessageInChunks(senderId, finalResponse);

              // Log bot response for Meta review dashboard
              await logMetaMessage(senderId, 'VENERA_BOT', 'bot', finalResponse);
            } else {
              // Save conversation data
              await saveConversation(conversationData);

              // Send response back to user
              await sendMessageInChunks(senderId, responseWithoutImages);

              // Log bot response for Meta review dashboard
              await logMetaMessage(senderId, 'VENERA_BOT', 'bot', responseWithoutImages);
            }
          } else {
            console.log("⚠️ Event does not contain sender ID or message text");
          }
        }
      }

      // Return 200 OK to acknowledge receipt
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    console.log("⚠️ Unknown webhook event");
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  } catch (err: any) {
    console.error("❌ POST /api/messenger error:", err);
    return NextResponse.json(
      { error: err?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
