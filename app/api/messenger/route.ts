import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import { db } from "../../../lib/firestore";
import { sendOrderEmail, parseOrderNotification } from "../../../lib/sendOrderEmail";
import { logOrder } from "../../../lib/orderLogger";
import { Client as QStashClient } from "@upstash/qstash";
import { isFeatureEnabled } from "../../../lib/featureFlags";
import { addMessageToBatch, testRedisConnection } from "../../../lib/redis";

// Force dynamic rendering to ensure console.log statements appear in production
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Force Node.js runtime (not Edge)
export const maxDuration = 60; // Maximum duration for this function

type MessageContent = string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
type Message = { role: "system" | "user" | "assistant"; content: MessageContent };

// Message debouncing/combining system removed - not used

/**
 * Convert Facebook image URL to base64 data URL for OpenAI vision API
 * Facebook CDN URLs cannot be accessed directly by OpenAI, so we download and convert to base64
 */
async function facebookImageToBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log(`📥 Downloading Facebook image: ${imageUrl.substring(0, 100)}...`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`❌ Failed to download image: ${response.status} ${response.statusText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Detect image type from URL or default to jpeg
    let mimeType = 'image/jpeg';
    if (imageUrl.includes('.png')) mimeType = 'image/png';
    else if (imageUrl.includes('.gif')) mimeType = 'image/gif';
    else if (imageUrl.includes('.webp')) mimeType = 'image/webp';

    const dataUrl = `data:${mimeType};base64,${base64}`;
    console.log(`✅ Converted image to base64 (${(base64.length / 1024).toFixed(2)} KB)`);

    return dataUrl;
  } catch (error) {
    console.error(`❌ Error converting Facebook image to base64:`, error);
    return null;
  }
}

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

/**
 * OPTIMIZATION: Filter products based on user query AND conversation history to reduce token usage
 * Instead of sending all 76k chars of products, send only relevant ones
 */
function filterProductsByQuery(products: Product[], userMessage: string, history: Message[] = []): Product[] {
  const message = userMessage.toLowerCase();

  // Product category keywords (Georgian and English)
  const categoryKeywords: { [key: string]: string[] } = {
    'hat': ['ქუდ', 'შაპკა', 'hat', 'beanie', 'cap'],
    'sock': ['წინდ', 'sock', 'socks'],
    'scarf': ['შარფ', 'scarf', 'მოწნული'],
    'glove': ['ხელთათმან', 'glove', 'გლუვ'],
  };

  // Color keywords (Georgian and English)
  const colorKeywords: string[] = [
    'შავ', 'თეთრ', 'წითელ', 'ლურჯ', 'მწვანე', 'ყვითელ', 'ვარდისფერ', 'ნარინჯისფერ',
    'სტაფილოსფერ', 'ფირუზისფერ', 'იისფერ', 'ტყფისფერ', 'ნაცრისფერ', 'ცისფერ',
    'აგურისფერ', 'გირჩისფერ', // Added missing Georgian colors
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'orange',
    'turquoise', 'purple', 'brown', 'gray', 'grey', 'brick', 'mustard'
  ];

  // Material keywords (Georgian and English)
  const materialKeywords: string[] = [
    'ბამბა', 'ბამბის', 'შალ', 'შალის', 'მატყლ',
    'cotton', 'wool', 'cashmere', 'knit'
  ];

  // Extract context from recent conversation history
  let contextCategory = '';
  let contextColor = '';
  let contextMaterial = '';

  // Look at last 5 messages for context
  const recentHistory = history.slice(-5);
  for (const msg of recentHistory) {
    const msgContent = typeof msg.content === 'string' ? msg.content.toLowerCase() : '';

    // Extract category context
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => msgContent.includes(kw))) {
        contextCategory = category;
      }
    }

    // Extract color context
    for (const color of colorKeywords) {
      if (msgContent.includes(color.toLowerCase())) {
        contextColor = color;
      }
    }

    // Extract material context
    for (const material of materialKeywords) {
      if (msgContent.includes(material.toLowerCase())) {
        contextMaterial = material;
      }
    }
  }

  // Check if user is asking about specific product types
  let matchedProducts: Product[] = [];

  // First, check for category matches (from current message or context)
  let categoryToMatch = '';
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => message.includes(kw))) {
      categoryToMatch = category;
      break;
    }
  }

  // Use context category if no category in current message
  if (!categoryToMatch && contextCategory) {
    categoryToMatch = contextCategory;
  }

  if (categoryToMatch) {
    // Filter products by this category
    const categoryProducts = products.filter(p =>
      p.category?.toLowerCase().includes(categoryToMatch) ||
      p.name.toLowerCase().includes(categoryToMatch) ||
      categoryKeywords[categoryToMatch].some(kw => p.name.toLowerCase().includes(kw))
    );
    matchedProducts.push(...categoryProducts);
  }

  // Then check for color matches (from current message or context)
  let matchedColors = colorKeywords.filter(c => message.includes(c.toLowerCase()));

  // If user just says a color without category, use context category
  if (matchedColors.length > 0 && matchedProducts.length === 0 && contextCategory) {
    const categoryProducts = products.filter(p =>
      p.category?.toLowerCase().includes(contextCategory) ||
      p.name.toLowerCase().includes(contextCategory) ||
      categoryKeywords[contextCategory].some(kw => p.name.toLowerCase().includes(kw))
    );
    matchedProducts.push(...categoryProducts);
  }

  if (matchedColors.length > 0) {
    const colorProducts = products.filter(p =>
      matchedColors.some(c => p.name.toLowerCase().includes(c.toLowerCase()) || p.id.toLowerCase().includes(c.toLowerCase()))
    );
    if (matchedProducts.length === 0) {
      matchedProducts = colorProducts;
    } else {
      // Intersect with category matches
      matchedProducts = matchedProducts.filter(p => colorProducts.some(cp => cp.id === p.id));
    }
  } else if (contextColor && matchedProducts.length > 0) {
    // Use context color if no color in current message but there are category matches
    const colorProducts = products.filter(p =>
      p.name.toLowerCase().includes(contextColor.toLowerCase()) || p.id.toLowerCase().includes(contextColor.toLowerCase())
    );
    matchedProducts = matchedProducts.filter(p => colorProducts.some(cp => cp.id === p.id));
  }

  // Check for material matches
  const matchedMaterials = materialKeywords.filter(m => message.includes(m.toLowerCase()));
  if (matchedMaterials.length > 0) {
    const materialProducts = products.filter(p =>
      matchedMaterials.some(m => p.name.toLowerCase().includes(m.toLowerCase()))
    );
    if (matchedProducts.length === 0) {
      matchedProducts = materialProducts;
    } else {
      // Intersect with existing matches
      matchedProducts = matchedProducts.filter(p => materialProducts.some(mp => mp.id === p.id));
    }
  }

  // Remove duplicates
  const uniqueProducts = Array.from(new Map(matchedProducts.map(p => [p.id, p])).values());

  // Always include products mentioned in recent conversation
  const recentProductIds = new Set<string>();
  for (const msg of recentHistory) {
    const msgContent = typeof msg.content === 'string' ? msg.content : '';
    // Look for product IDs in the conversation (e.g., in SEND_IMAGE commands)
    const idMatch = msgContent.match(/SEND_IMAGE:\s*([^\s]+)/);
    if (idMatch) {
      recentProductIds.add(idMatch[1]);
    }
    // Also look for products mentioned by name
    for (const product of products) {
      if (msgContent.includes(product.name)) {
        recentProductIds.add(product.id);
      }
    }
  }

  // Add recently discussed products if not already included
  for (const productId of recentProductIds) {
    const product = products.find(p => p.id === productId);
    if (product && !uniqueProducts.some(p => p.id === productId)) {
      uniqueProducts.push(product);
    }
  }

  // If we found matches, return them (max 30 products)
  if (uniqueProducts.length > 0) {
    console.log(`📦 Product filter: Found ${uniqueProducts.length} matching products for query with context`);
    return uniqueProducts.slice(0, 30);
  }

  // If no specific matches, return top products with images (bestsellers fallback)
  const productsWithImages = products.filter(p =>
    p.image && p.image !== 'IMAGE_URL_HERE' && !p.image.includes('facebook.com') && p.image.startsWith('http')
  );

  console.log(`📦 Product filter: No specific match, returning ${Math.min(productsWithImages.length, 20)} bestsellers`);
  return productsWithImages.slice(0, 20);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "your_verify_token_123";

const MAX_HISTORY_LENGTH = 20; // Keep last 20 exchanges (40 messages) per user

type ConversationData = {
  senderId: string;
  userName?: string; // Facebook user's display name
  profilePic?: string; // Facebook user's profile picture URL
  history: Message[];
  orders: Array<{
    orderNumber: string;
    timestamp: string;
    items: string;
  }>;
  lastActive: string;
  storeVisitRequests?: number; // Track how many times user asked about visiting physical store
  manualMode?: boolean; // Manual mode enabled - bot will not auto-respond
  manualModeEnabledAt?: string; // Timestamp when manual mode was enabled
  manualModeDisabledAt?: string; // Timestamp when manual mode was disabled
  botInstruction?: string; // One-time instruction from operator for next bot response
  botInstructionAt?: string; // Timestamp when instruction was set

  // Escalation system fields
  needsAttention?: boolean; // Flag for manager attention
  escalatedAt?: string; // When the conversation was escalated
  escalationReason?: string; // Why it needs attention (e.g., "late order", "delivery issue")
  escalationDetails?: string; // Order details provided by customer
  managerNotified?: boolean; // Whether manager was notified
  managerPhoneOffered?: boolean; // Whether phone number was already offered
};

/**
 * Save message to Firestore and queue to QStash for async processing
 * This replaces synchronous processing with async queueing
 */
async function saveMessageAndQueue(event: any): Promise<void> {
  const senderId = event.sender?.id;
  const message = event.message;
  const messageText = message?.text;
  const messageAttachments = message?.attachments;
  const messageId = message?.mid;

  if (!senderId) {
    console.log("⚠️ Event does not contain sender ID, skipping.");
    return;
  }

  console.log(`📝 Saving message from ${senderId} to Firestore...`);

  // Extract message content (same logic as processMessagingEvent)
  let userContent: MessageContent = "";
  const contentParts: ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[] = [];
  let userTextForProcessing = messageText || "";

  if (messageText) {
    contentParts.push({ type: "text", text: messageText });
  }

  if (messageAttachments) {
    for (const attachment of messageAttachments) {
      console.log(`📎 Attachment type: ${attachment.type}`, JSON.stringify(attachment).substring(0, 200));

      // Handle direct image attachments
      if (attachment.type === "image") {
        console.log(`🖼️ Converting image attachment: ${attachment.payload.url.substring(0, 60)}...`);

        // Convert Facebook image to base64 NOW (before queueing)
        const base64Image = await facebookImageToBase64(attachment.payload.url);

        if (base64Image) {
          // OPTIMIZATION: Store placeholder for history, but keep base64 for current message processing
          // This reduces token cost by ~50% since images won't be re-sent with history
          contentParts.push({ type: "image_url", image_url: { url: base64Image } });
          console.log(`✅ Image converted to base64 (will store placeholder in history)`);
        } else {
          console.warn(`⚠️ Failed to convert image`);
          if (!messageText) {
            contentParts.push({ type: "text", text: "[User sent an image]" });
          }
        }
      }
      // Handle Instagram/Facebook share attachments (shared posts)
      else if (attachment.type === "share" || attachment.type === "fallback") {
        const shareUrl = attachment.payload?.url;
        const shareTitle = attachment.payload?.title;
        const shareImageUrl = attachment.payload?.image_url;

        console.log(`🔗 Share attachment: title="${shareTitle}", hasImage=${!!shareImageUrl}`);

        // If the share has an image_url, try to convert it
        if (shareImageUrl) {
          console.log(`🖼️ Converting share image: ${shareImageUrl.substring(0, 60)}...`);
          const base64Image = await facebookImageToBase64(shareImageUrl);

          if (base64Image) {
            contentParts.push({ type: "image_url", image_url: { url: base64Image } });
            console.log(`✅ Share image converted to base64`);
          } else {
            console.warn(`⚠️ Failed to convert share image`);
          }
        }

        // Also add context about the shared post
        if (shareTitle || shareUrl) {
          const shareContext = `[User shared a post${shareTitle ? `: "${shareTitle}"` : ''}]`;
          contentParts.push({ type: "text", text: shareContext });
        }
      }
    }
  }

  // Determine final userContent
  if (contentParts.length > 1) {
    userContent = contentParts;
  } else if (contentParts.length === 1) {
    if (contentParts[0].type === 'text') {
      userContent = contentParts[0].text;
    } else {
      userContent = contentParts;
    }
  } else {
    console.log("⚠️ Message has no processable content, skipping.");
    return;
  }

  // Load conversation
  const conversationData = await loadConversation(senderId);

  // OPTIMIZATION: Store text placeholder instead of base64 images in history
  // This reduces token cost by ~50% since old images won't be re-sent to OpenAI
  let contentForHistory: MessageContent;
  if (Array.isArray(userContent)) {
    // Replace base64 images with text placeholder
    contentForHistory = userContent.map(part => {
      if (part.type === 'image_url' && part.image_url?.url?.startsWith('data:')) {
        return { type: 'text' as const, text: '[Image analyzed by AI]' };
      }
      return part;
    });
    // Simplify if only text parts remain
    const textParts = contentForHistory.filter(p => p.type === 'text');
    if (textParts.length === 1 && contentForHistory.length === 1) {
      contentForHistory = (textParts[0] as { type: 'text'; text: string }).text;
    }
  } else {
    contentForHistory = userContent;
  }

  // ==================== QUEUE TO QSTASH (with optional Redis batching) ====================

  // Check if Redis batching is enabled for this user
  const useRedisBatching = isFeatureEnabled('REDIS_MESSAGE_BATCHING', senderId);

  if (useRedisBatching) {
    console.log(`🔬 [EXPERIMENTAL] Using Redis batching for user ${senderId}`);

    let messageAddedToRedis = false;

    try {
      // Add message to Redis batch
      await addMessageToBatch(senderId, {
        messageId,
        text: messageText,
        attachments: messageAttachments,
        timestamp: Date.now(),
        originalContent: userContent
      });

      messageAddedToRedis = true;

      // Queue processing with delay for batching
      const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });

      // Use a SINGLE deduplication ID for the entire conversation burst
      // This ensures only ONE batch processor runs for ALL rapid messages
      // The batch processor will wait for messages to stop coming before processing
      const conversationId = `batch_${senderId}_conversation`;

      await qstash.publishJSON({
        url: 'https://bebias-venera-chatbot.vercel.app/api/process-batch-redis',
        body: {
          senderId,
          batchKey: `msgbatch:${senderId}`,
          timestamp: Date.now()
        },
        delay: 3, // Wait 3 seconds to collect more messages
        deduplicationId: conversationId, // Same ID for ALL messages in burst
        retries: 0
      });

      console.log(`✅ [REDIS] Message batched with conversation ID: ${conversationId}`);

      console.log(`✅ [REDIS] Message batched and processing scheduled for ${senderId}`);
      return;
    } catch (error) {
      console.error(`❌ [REDIS] Failed to use Redis batching, falling back to normal flow:`, error);

      // CRITICAL: If message was already added to Redis, we can't fall back
      // because it would cause duplicate processing!
      if (messageAddedToRedis) {
        console.error(`⚠️ [REDIS] Message already in Redis, cannot fall back to normal processing to avoid duplicates`);
        return; // Exit to prevent duplicate processing
      }
      // Only fall through if message was NOT added to Redis
    }
  }

  // For non-Redis batching users, save message to conversation immediately
  // (Redis batching will save the combined message later)
  if (!useRedisBatching) {
    // Add user message to history (with placeholder for images)
    conversationData.history.push({
      role: "user",
      content: contentForHistory
    });

    // Trim history if too long
    while (conversationData.history.length > MAX_HISTORY_LENGTH * 2) {
      conversationData.history.shift();
    }

    conversationData.lastActive = new Date().toISOString();

    // Save to Firestore
    await saveConversation(conversationData);
    console.log(`💾 Message saved to Firestore for ${senderId}`);
  } else {
    console.log(`⏸️ Skipping individual message save for Redis batched user ${senderId}`);
  }

  // Log to meta messages (always)
  await logMetaMessage(senderId, senderId, 'user', userTextForProcessing);

  // Only do normal QStash processing if Redis batching wasn't used
  // (If Redis batching was successful, we already returned at line 434)
  if (!useRedisBatching) {
    // Normal QStash processing (existing code)
    if (!process.env.QSTASH_TOKEN) {
      console.error(`❌ QSTASH_TOKEN not configured - message will not be processed`);
      return;
    }

    try {
      const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN });

      // Always use production URL - VERCEL_URL contains deployment-specific URL which breaks after redeploy
      const callbackUrl = 'https://bebias-venera-chatbot.vercel.app/api/process-message';

      await qstash.publishJSON({
      url: callbackUrl,
      body: {
        senderId,
        messageId,
        // Pass original content WITH images so process-message can use it
        // (history has images replaced with placeholders)
        originalContent: userContent
      },
      // Disable retries - prevents duplicate OpenAI API calls if request takes too long
      retries: 0,
      // QStash built-in deduplication - if Facebook sends same webhook twice,
      // QStash will ignore the duplicate within the deduplication window
      deduplicationId: messageId
    });

      console.log(`✅ Message queued to QStash for ${senderId}`);
    } catch (error: any) {
      console.error(`❌ Failed to queue message to QStash:`, error.message);
      // No fallback - message saved to Firestore, can be reprocessed manually if needed
    }
  }
}

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

// Fetch and cache Facebook user profile
async function fetchUserProfile(userId: string): Promise<{ name?: string; profile_pic?: string }> {
  try {
    // Check if profile is cached in Firestore
    try {
      const profileDoc = await db.collection('userProfiles').doc(userId).get();

      if (profileDoc.exists) {
        const cached = profileDoc.data() as { name?: string; profile_pic?: string; cachedAt: string };
        const cacheAge = Date.now() - new Date(cached.cachedAt).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        if (cacheAge < sevenDays) {
          console.log(`✅ Using cached profile for user ${userId}: ${cached.name || 'Unknown'}`);
          return { name: cached.name, profile_pic: cached.profile_pic };
        }
      }
    } catch (fsError) {
      console.warn(`⚠️ Firestore unavailable for profile cache - fetching from Facebook`);
    }

    // Fetch from Facebook Graph API
    const url = `https://graph.facebook.com/v18.0/${userId}?fields=id,name,profile_pic&access_token=${PAGE_ACCESS_TOKEN}`;
    console.log(`📋 Fetching Facebook profile for user ${userId}`);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Facebook API error fetching profile:`, data);
      return {};
    }

    const profile = {
      name: data.name,
      profile_pic: data.profile_pic
    };

    // Cache for 7 days in Firestore
    try {
      await db.collection('userProfiles').doc(userId).set({
        ...profile,
        cachedAt: new Date().toISOString()
      });
      console.log(`✅ Successfully fetched and cached profile: ${profile.name || 'Unknown'}`);
    } catch (fsError) {
      console.log(`✅ Successfully fetched profile (cache unavailable): ${profile.name || 'Unknown'}`);
    }

    return profile;
  } catch (err) {
    console.error(`❌ Error fetching Facebook profile for ${userId}:`, err);
    return {};
  }
}

async function loadConversation(senderId: string): Promise<ConversationData> {
  try {
    // Use Firestore for all conversation storage
    const docRef = db.collection('conversations').doc(senderId);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data() as ConversationData;
      console.log(`📂 Loaded conversation from Firestore for user ${senderId}`);
      return data;
    }
  } catch (err) {
    console.error(`❌ Error loading conversation from Firestore:`, err);
    // Return new conversation if error or not found
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

    // Use Firestore for all conversation storage
    // IMPORTANT: Use merge to preserve fields like manualMode that might be set by operator
    const docRef = db.collection('conversations').doc(data.senderId);
    await docRef.set(data, { merge: true });
    console.log(`💾 Saved conversation to Firestore for user ${data.senderId}`);
  } catch (err) {
    console.error(`❌ Error saving conversation for user ${data.senderId}:`, err);
  }
}

// Store message for Meta review dashboard
async function logMetaMessage(userId: string, senderId: string, senderType: 'user' | 'bot', text: string): Promise<void> {
  try {
    // Use Firestore for meta messages dashboard
    const docRef = db.collection('metaMessages').doc(userId);

    // Get existing conversation
    const doc = await docRef.get();
    const existing = doc.exists ? doc.data() : null;

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

    await docRef.set(conversation);
    console.log(`📋 Logged meta message for dashboard: ${senderType} - "${text.substring(0, 50)}..."`);
  } catch (err) {
    console.error("❌ Error logging meta message:", err);
  }
}

function detectGeorgian(text: string) {
  return /[\u10A0-\u10FF]/.test(text);
}

/**
 * Extract order details (product, phone, address) from conversation history
 */
function extractOrderDetails(history: Message[]): { product: string; telephone: string; address: string; name?: string } | null {
  let product = '';
  let telephone = '';
  let address = '';
  let name = '';

  // Search through recent messages (last 20)
  const recentMessages = history.slice(-20);

  for (const msg of recentMessages) {
    const content = typeof msg.content === 'string' ? msg.content : '';

    // Check for comma-separated format first: "name, phone, address"
    if (msg.role === 'user' && content.includes(',')) {
      const parts = content.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        // Check if second part looks like a phone number
        if (parts[1].match(/\d{9}/)) {
          name = parts[0];
          telephone = parts[1];
          address = parts.slice(2).join(', ');
          console.log(`📋 Extracted from comma-separated: name="${name}", phone="${telephone}", address="${address}"`);
          continue;
        }
      }
    }

    // Extract phone number (Georgian format: 4XXXXXXXX, 5XXXXXXXX, or +9954/5XXXXXXXX)
    if (!telephone) {
      const phoneMatch = content.match(/(?:\+995)?[45]\d{8}/);
      if (phoneMatch) {
        telephone = phoneMatch[0];
      }
    }

    // Extract name (Georgian or Latin full name)
    if (!name && msg.role === 'user') {
      const georgianNameMatch = content.match(/([ა-ჰ]+\s+[ა-ჰ]+)/);
      const latinNameMatch = content.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
      if (georgianNameMatch) {
        name = georgianNameMatch[1];
      } else if (latinNameMatch) {
        name = latinNameMatch[1];
      }
    }

    // Extract address (more flexible patterns)
    if (!address) {
      // Look for messages with address keywords in Georgian
      if (content.match(/მისამართ|ქუჩა|გამზირი|ბინა/i)) {
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.match(/მისამართ|ქუჩა|გამზირი|ბინა/i) && line.length > 10) {
            address = line.replace(/მისამართ[ი]?:?\s*/i, '').trim();
            break;
          }
        }
      }
      // Check if entire user message looks like an address (Georgian text with numbers or known patterns)
      if (msg.role === 'user' && !address && content.length > 5 && content.length < 200) {
        // Match patterns like "აწყურის 19", "რუსთაველის 45", etc.
        if (content.match(/[ა-ჰ]+\s*\d+/)) {
          // Exclude if it's just a phone number
          if (!content.match(/^\d{9}$/)) {
            address = content.trim();
          }
        }
      }
    }

    // Extract product names from bot messages
    if (!product && msg.role === 'assistant') {
      // Look for BEBIAS hat products
      const hatKeywords = [
        'ფირუზისფერი.*ქუდ',
        'სტაფილოსფერი.*ქუდ',
        'თეთრი.*ქუდ',
        'მატყლის.*ქუდ',
        'ბამბის.*ქუდ',
        'პომპონიანი.*ქუდ',
        'ქუდი',
        'შალი'
      ];

      for (const keyword of hatKeywords) {
        const match = content.match(new RegExp(keyword, 'i'));
        if (match) {
          // Extract the full product description (look for the line containing the match)
          const lines = content.split('\n');
          for (const line of lines) {
            if (line.match(new RegExp(keyword, 'i')) && line.length > 5) {
              // Clean up the product name
              product = line
                .replace(/^\d+\.\s*/, '') // Remove numbering like "1. "
                .replace(/\s*-\s*\d+\s*ლარ.*$/, '') // Remove price
                .trim();
              break;
            }
          }
          if (product) break;
        }
      }

      // Also check for VENERA products (backwards compatibility)
      if (!product) {
        const productMatch = content.match(/პროდუქტი:\s*(.+?)(?:\n|$)/i);
        if (productMatch) {
          product = productMatch[1].trim();
        }
        if (!product) {
          const productNames = content.match(/(VENERA[^.\n]*|ვენერა[^.\n]*|კრემი[^.\n]*)/i);
          if (productNames) {
            product = productNames[0].trim();
          }
        }
      }
    }
  }

  // Return null if we're missing critical info
  if (!telephone || !address) {
    console.log(`⚠️ Missing order details - product: ${!!product}, phone: ${!!telephone}, address: ${!!address}, name: ${!!name}`);
    return null;
  }

  // Use generic product name if not found
  if (!product) {
    product = 'BEBIAS პროდუქტი';
  }

  return { product, telephone, address, name };
}

/**
 * Async payment verification - runs in background and sends follow-up message
 */
async function verifyPaymentAsync(expectedAmount: number, name: string, isKa: boolean, senderId: string) {
  console.log(`🔄 Background verification started for ${expectedAmount} GEL from "${name}" (user: ${senderId})`);

  // Wait 10-15 seconds before checking (give bank time to process)
  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    const apiBase = process.env.NEXT_PUBLIC_CHAT_API_BASE || 'https://bebias-venera-chatbot.vercel.app';

    const response = await fetch(`${apiBase}/api/bank/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: expectedAmount, name }),
    });

    if (!response.ok) {
      console.error(`❌ Bank API returned error status: ${response.status}`);
      return;
    }

    const data = await response.json();
    console.log(`🏦 Background verification result:`, data);

    if (data.paymentFound) {
      console.log(`✅ Payment verified in background! ${expectedAmount} GEL from "${name}"`);

      // Get conversation data to extract order details
      const conversationData = await loadConversation(senderId);

      // Extract order details from conversation history
      const orderDetails = extractOrderDetails(conversationData.history);

      // Send email if we have all order details
      if (orderDetails && orderDetails.product && orderDetails.telephone && orderDetails.address) {
        const orderData = {
          product: orderDetails.product,
          quantity: "1",
          clientName: name,
          telephone: orderDetails.telephone,
          address: orderDetails.address,
          total: `${expectedAmount} ლარი`
        };

        // Log order and get order number
        const orderNumber = await logOrder(orderData, 'messenger');
        console.log(`📝 Order logged with number: ${orderNumber}`);

        // Add order to conversation data
        conversationData.orders.push({
          orderNumber,
          timestamp: new Date().toISOString(),
          items: orderData.product
        });
        await saveConversation(conversationData);

        // Send email
        const emailSent = await sendOrderEmail(orderData, orderNumber);
        if (emailSent) {
          console.log('✅ Order email sent successfully');
        } else {
          console.error('❌ Failed to send order email');
        }

        // Send success message with order number
        const successMessage = isKa
          ? `✅ გადახდა დადასტურდა! ❤️\n\n${expectedAmount} ლარი მიღებულია "${name}"-ისგან.\n\n📦 შეკვეთა #${orderNumber} დადასტურებულია!\n\n📧 ელექტრონული ზედნადები გამოგზავნილია ელ-ფოსტაზე.\n🚚 შეკვეთა მალე იქნება გაგზავნილი თქვენს მისამართზე.\n\nმადლობა შეძენისთვის! 🎉`
          : `✅ Payment confirmed! ❤️\n\n${expectedAmount} GEL received from "${name}".\n\n📦 Order #${orderNumber} confirmed!\n\n📧 Invoice sent to your email.\n🚚 Your order will be shipped soon.\n\nThank you for your purchase! 🎉`;

        await sendMessage(senderId, successMessage);
      } else {
        // Missing order details - send generic confirmation
        console.warn('⚠️ Missing order details for email');
        const successMessage = isKa
          ? `✅ გადახდა დადასტურდა! ❤️\n\n${expectedAmount} ლარი მიღებულია "${name}"-ისგან.\n\n📦 თქვენი შეკვეთა დადასტურებულია!\n\n🚚 შეკვეთა მალე იქნება გაგზავნილი თქვენს მისამართზე.\n\nმადლობა შეძენისთვის! 🎉`
          : `✅ Payment confirmed! ❤️\n\n${expectedAmount} GEL received from "${name}".\n\n📦 Your order is confirmed!\n\n🚚 Your order will be shipped soon.\n\nThank you for your purchase! 🎉`;

        await sendMessage(senderId, successMessage);
      }

      // TODO: Reduce stock
    } else {
      console.log(`❌ Payment not found in background verification - retrying in 10s`);

      // Retry once after 10 more seconds
      await new Promise(resolve => setTimeout(resolve, 10000));
      const retryResponse = await fetch(`${apiBase}/api/bank/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: expectedAmount, name }),
      });

      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        if (retryData.paymentFound) {
          console.log(`✅ Payment found on retry!`);
          const successMessage = isKa
            ? `✅ გადახდა დადასტურდა! ❤️\n\n${expectedAmount} ლარი მიღებულია.\n\n📦 თქვენი შეკვეთა დადასტურებულია!`
            : `✅ Payment confirmed! ❤️\n\n${expectedAmount} GEL received.\n\n📦 Your order is confirmed!`;
          await sendMessage(senderId, successMessage);
          return;
        }
      }

      // Still not found - notify user
      const notFoundMessage = isKa
        ? `❌ გადახდა ჯერ ვერ მოიძებნა.\n\nგთხოვთ დარწმუნდით რომ:\n• გადახდა დასრულებულია\n• თანხა: ${expectedAmount} ლარი\n• სახელი: ${name}\n\nთუ გადახდა განახორციელეთ, დაგვიკავშირდით: ${process.env.MANAGER_PHONE || '555-00-00-00'}`
        : `❌ Payment not found yet.\n\nPlease make sure:\n• Payment is complete\n• Amount: ${expectedAmount} GEL\n• Name: ${name}\n\nIf you made the payment, contact us: ${process.env.MANAGER_PHONE || '555-00-00-00'}`;

      await sendMessage(senderId, notFoundMessage);
    }
  } catch (error) {
    console.error('❌ Error in background payment verification:', error);
  }
}

/**
 * Handle automatic payment verification when user provides payment details
 */
// REMOVED: handlePaymentVerification function
// This function has been archived to docs/ARCHIVED_BANK_VERIFICATION.md for future use

/**
 * Handle customer issue escalation
 * Returns a response if escalation is triggered, null otherwise
 */
async function handleIssueEscalation(
  userMessage: string,
  conversationData: ConversationData
): Promise<{ escalated: boolean; response: string | null; updatedData: ConversationData }> {
  const isKa = detectGeorgian(userMessage);
  const issue = detectCustomerIssue(userMessage);

  // If no issue detected, return
  if (!issue.detected) {
    return { escalated: false, response: null, updatedData: conversationData };
  }

  console.log(`🚨 Issue escalation triggered: ${issue.reason}`);

  // Check if we're already in escalation mode
  if (conversationData.needsAttention) {
    // Customer is providing more details - collect them
    const orderInfo = extractOrderInfo(userMessage);

    // If customer provided order details, escalate to manager
    if (orderInfo.orderNumber || orderInfo.orderDate || orderInfo.shippingMethod) {
      const details = `Order #${orderInfo.orderNumber || 'N/A'}, Date: ${orderInfo.orderDate || 'N/A'}, Shipping: ${orderInfo.shippingMethod || 'N/A'}`;

      conversationData.escalationDetails = details;
      conversationData.manualMode = true; // Enable manual mode
      conversationData.manualModeEnabledAt = new Date().toISOString();
      conversationData.managerNotified = false; // Will be notified via Firestore

      // Store escalation notification in Firestore for manager
      await db.collection('managerNotifications').doc(conversationData.senderId).set({
        senderId: conversationData.senderId,
        userName: conversationData.userName || 'Unknown User',
        reason: conversationData.escalationReason,
        details: details,
        message: userMessage,
        timestamp: new Date().toISOString()
      });

      const response = isKa
        ? `✅ გმადლობთ ინფორმაციისთვის. მენეჯერი გადახედავს თქვენს შეკვეთას და უახლოეს დროში დაგიკავშირდებათ.`
        : `✅ Thank you for the information. The manager will review your order and get back to you as soon as possible.`;

      console.log(`📢 Manager notified about ${issue.reason} for user ${conversationData.senderId}`);

      return { escalated: true, response, updatedData: conversationData };
    }
  }

  // First time issue detected - ask for order details
  if (!conversationData.needsAttention) {
    conversationData.needsAttention = true;
    conversationData.escalatedAt = new Date().toISOString();
    conversationData.escalationReason = issue.reason;

    const response = isKa
      ? `გასაგებია, დაგეხმარებით.\n\nგთხოვთ მიუთითოთ:\n- შეკვეთის ნომერი\n- შეკვეთის თარიღი\n- მიწოდების მეთოდი (სტანდარტული/ექსპრესი)`
      : `I understand, I'll help you.\n\nPlease provide:\n- Order number\n- Order date\n- Shipping method (standard/express)`;

    return { escalated: true, response, updatedData: conversationData };
  }

  return { escalated: false, response: null, updatedData: conversationData };
}

/**
 * Check if we should offer manager's phone number
 * Returns phone number message if conditions are met, null otherwise
 */
async function checkPhoneNumberFallback(conversationData: ConversationData, userMessage: string): Promise<string | null> {
  // Don't offer phone if already offered
  if (conversationData.managerPhoneOffered) {
    return null;
  }

  // Must be in manual mode (escalated)
  if (!conversationData.manualMode || !conversationData.escalatedAt) {
    return null;
  }

  // Check if 1 hour has passed since escalation
  const escalatedTime = new Date(conversationData.escalatedAt).getTime();
  const now = Date.now();
  const hoursPassed = (now - escalatedTime) / (1000 * 60 * 60);

  if (hoursPassed < 1) {
    return null; // Not enough time passed
  }

  // Check if it's a workday and working hours (Mon-Fri, 9:00-18:00 Georgian time)
  const georgianTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tbilisi' });
  const date = new Date(georgianTime);
  const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
  const hour = date.getHours();

  const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
  const isWorkingHours = hour >= 9 && hour < 18;

  if (!isWorkday || !isWorkingHours) {
    return null; // Not during working hours
  }

  // Check if customer is persisting (asking again)
  const issue = detectCustomerIssue(userMessage);
  if (!issue.detected) {
    return null; // Customer not asking about their issue anymore
  }

  // All conditions met - offer phone number
  conversationData.managerPhoneOffered = true;

  const isKa = detectGeorgian(userMessage);
  const managerPhone = process.env.MANAGER_PHONE || '+995 XXX XXX XXX';

  return isKa
    ? `ვწუხვართ რომ მენეჯერმა ჯერ ვერ მოახერხა პასუხი. შეგიძლიათ დაუკავშირდეთ პირდაპირ ტელეფონზე: ${managerPhone}`
    : `Sorry the manager hasn't responded yet. You can call directly at: ${managerPhone}`;
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

/**
 * Detect if customer is reporting an issue that needs manager attention
 */
function detectCustomerIssue(text: string): { detected: boolean; reason: string } {
  const lowerText = text.toLowerCase();

  // Georgian issue patterns
  const georgianIssues = [
    { patterns: [/როდის\s+(მოვა|მოვიდა|მოვდა|მოვიღებ|ჩამოდის)/i, /მიწოდების\s+დრო/i, /ჩამოსვლის\s+დრო/i], reason: 'arrival_time' },
    { patterns: [/დაგვიან|დააგვიან|ვერ\s+მოდის|ვერ\s+მოვიდა|არ\s+მომდის|არ\s+მოვიდა/i], reason: 'late_order' },
    { patterns: [/პრობლემა|შეცდომა|ბრალი|უხერხემლობა|ცუდი|დაზიანდა|არასწორი/i], reason: 'problem' },
    { patterns: [/სად\s+არის|სად\s+იყო|ვერ\s+ვიპოვე|ვერ\s+ვიღებ/i], reason: 'tracking' },
    { patterns: [/შეკვეთა.*არ.*მივიღე|არ\s+მოვიდა\s+შეკვეთა/i], reason: 'not_received' },
  ];

  // English issue patterns
  const englishIssues = [
    { patterns: [/when\s+(will|does|is)\s+(it|my\s+order)\s+(arrive|come|get\s+here)/i, /arrival\s+time/i, /delivery\s+time/i], reason: 'arrival_time' },
    { patterns: [/late|delayed|still\s+waiting|hasn't\s+arrived|not\s+arrived/i], reason: 'late_order' },
    { patterns: [/problem|issue|error|wrong|damaged|bad|broken/i], reason: 'problem' },
    { patterns: [/where\s+is\s+my\s+order|track|tracking/i], reason: 'tracking' },
    { patterns: [/didn't\s+receive|haven't\s+received|not\s+received/i], reason: 'not_received' },
  ];

  const allIssues = [...georgianIssues, ...englishIssues];

  for (const issueGroup of allIssues) {
    if (issueGroup.patterns.some(pattern => pattern.test(text))) {
      console.log(`🚨 Customer issue detected: ${issueGroup.reason}`);
      return { detected: true, reason: issueGroup.reason };
    }
  }

  return { detected: false, reason: '' };
}

/**
 * Extract order information from customer message
 */
function extractOrderInfo(text: string): { orderNumber?: string; orderDate?: string; shippingMethod?: string } {
  const info: { orderNumber?: string; orderDate?: string; shippingMethod?: string } = {};

  // Order number patterns (e.g., #12345, order 12345, შეკვეთა 12345)
  const orderNumMatch = text.match(/#?(\d{4,6})|order\s+(\d{4,6})|შეკვეთა\s+(\d{4,6})/i);
  if (orderNumMatch) {
    info.orderNumber = orderNumMatch[1] || orderNumMatch[2] || orderNumMatch[3];
  }

  // Date patterns
  const dateMatch = text.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})|(\d{1,2}\s+(იანვარი|თებერვალი|მარტი|აპრილი|მაისი|ივნისი|ივლისი|აგვისტო|სექტემბერი|ოქტომბერი|ნოემბერი|დეკემბერი))/i);
  if (dateMatch) {
    info.orderDate = dateMatch[0];
  }

  // Shipping method patterns
  if (/სტანდარტ|standard/i.test(text)) {
    info.shippingMethod = 'standard';
  } else if (/ექსპრეს|express/i.test(text)) {
    info.shippingMethod = 'express';
  }

  return info;
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
 * Send a message split into natural chunks with minimal delays
 * Fast delivery without artificial typing simulation
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

    // Minimal delay to ensure messages arrive in order (100ms)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Send the actual message
    await sendMessage(recipientId, chunk);
  }

  console.log(`✅ All ${chunks.length} chunks sent successfully`);
}

async function sendImage(recipientId: string, imageUrl: string) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  // URLs are pre-encoded in products.json with percent-encoding for Georgian characters
  console.log(`📸 Sending pre-encoded image to ${recipientId}:`, imageUrl);

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
              url: imageUrl,
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

async function getAIResponse(userMessage: MessageContent, history: Message[] = [], previousOrders: ConversationData['orders'] = [], storeVisitCount: number = 0, operatorInstruction?: string): Promise<string> {
  const userText = typeof userMessage === 'string' ? userMessage : userMessage.find(c => c.type === 'text')?.text ?? '';
  const isKa = detectGeorgian(userText);

  try {
    const [products, content, contactInfoStr] = await Promise.all([
      loadProducts(),
      loadAllContent(),
      loadContentFile("contact-info.json"),
    ]);

    const contactInfo = contactInfoStr ? JSON.parse(contactInfoStr) : null;

    // OPTIMIZATION: Filter products based on user query AND conversation history to reduce token usage
    // Instead of sending all 76k chars (~50k tokens), send only relevant products
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

**REQUIRED FORMAT FOR EVERY PRODUCT RESPONSE:**

Your Georgian response to customer

SEND_IMAGE: PRODUCT_ID

**EXAMPLES - YOU MUST FOLLOW THIS EXACT PATTERN:**

Example 1:
User: "შავი ქუდი გაქვთ?"
Your response (use NUMERIC ID from catalog):
"შავი ბამბის მოკლე ქუდი - 49 ლარი 💛

აირჩიე მიწოდების მეთოდი: თბილისი 6₾ (1-3 დღე), რეგიონი 10₾ (3-5 დღე), Wolt იმავე დღეს

SEND_IMAGE: 9016"

Example 2:
User: "წითელი?"
Your response (use NUMERIC ID from catalog):
"წითელი ბამბის მოკლე ქუდი - 49 ლარი 💛

აირჩიე მიწოდების მეთოდი: თბილისი 6₾ (1-3 დღე), რეგიონი 10₾ (3-5 დღე), Wolt იმავე დღეს

SEND_IMAGE: [NUMERIC_ID_FROM_CATALOG]"

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

# Product Catalog (Filtered for this query)
${productContext}${productNote}

# Current Date and Time
Georgia Time (GMT+4): ${georgiaTime}

**CRITICAL:** Use the date and time above to calculate PRECISE delivery dates! Never tell customers "1-3 working days" - instead calculate and provide SPECIFIC dates like "Monday", "Tuesday", "Wednesday", etc.

**═══════════════════════════════════════════════════════**
**CRITICAL - PRODUCT MATCHING RULES**
**═══════════════════════════════════════════════════════**

When a customer asks about a product (in Georgian or English), you MUST understand product attributes to match the EXACT product:

**Keywords:**
- Material: "ბამბა/ბამბის" (cotton), "შალი/შალის" (wool)
- Form: "სადა" (plain), "პომპონით/პომპონიანი" (with pompom), "მოკლე" (short)

**MATCHING STRATEGY:**

1. **Exact Match First**: Match products based on ALL specified attributes (color + material + form)

2. **Generic Requests**: When customer asks generically without specifying material or form:
   - Find the SIMPLEST product in that color
   - Prefer "სადა" (plain) over "პომპონით" (with pompom)

3. **Each Product is Unique**: Match based on ALL attributes, not just color

**CONTEXT RETENTION - ABSOLUTELY CRITICAL:**
- ALWAYS check conversation history to understand what product is being discussed
- When user says just a color or "that one", refer to the most recent product discussed
- NEVER contradict yourself - if you offered a product earlier, it's still available
- The Product Catalog shows what's currently relevant to this conversation based on context
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
      console.log(`📋 Operator instruction injected as priority system message: "${operatorInstruction}"`);
    }

    // Add current user message
    messages.push({ role: "user", content: userMessage });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any, // Cast to any to handle MessageContent type flexibility
      temperature: 0.7,
      max_tokens: 1000,
    });

    return completion.choices[0]?.message?.content || (isKa ? "ბოდიში, ვერ გავიგე." : "Sorry, I didn't understand that.");
  } catch (err: any) {
    console.error("❌ OpenAI API error:", err);
    console.error("❌ Error details:", JSON.stringify(err, null, 2));
    console.error("❌ Error message:", err?.message);
    console.error("❌ Error stack:", err?.stack);

    // Log error to Firestore for debugging
    try {
      const errorId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.collection('errors').doc(errorId).set({
        timestamp: new Date().toISOString(),
        userMessage: userText, // Include user message for context
        historyLength: history.length, // Track conversation length
        error: {
          message: err?.message || String(err),
          stack: err?.stack,
          name: err?.name,
          code: err?.code,
          status: err?.status,
          response: err?.response?.data,
        },
      });
      console.log(`✅ Error logged to Firestore with ID: ${errorId}`);
    } catch (fsErr) {
      console.error("Failed to log error to Firestore:", fsErr);
    }

    // Return error message in appropriate language
    return isKa
      ? "ბოდიში, შეცდომა მოხდა თქვენი მოთხოვნის დამუშავებისას. გთხოვთ, სცადოთ ხელახლა."
      : "Sorry, there was an error processing your request. Please try again.";
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

/**
 * Process a single messaging event asynchronously
 * This runs in the background after webhook returns 200 OK
 */
async function processMessagingEvent(event: any) {
  try {
    console.log(`💬 Processing messaging event:`, JSON.stringify(event, null, 2));

    const senderId = event.sender?.id;
    if (!senderId) {
      console.log("⚠️ Event does not contain sender ID, skipping.");
      return;
    }

    const message = event.message; // Get the full message object
    const messageText = message?.text;
    const messageAttachments = message?.attachments;
    const messageId = message?.mid;

    console.log(`🔍 Message details for ${senderId}:`, {
      hasText: !!messageText,
      textLength: messageText?.length,
      hasAttachments: !!messageAttachments,
      attachmentCount: messageAttachments?.length,
      messageId: messageId,
      messageKeys: message ? Object.keys(message) : []
    });

    if (messageText || messageAttachments) {
      let userContent: MessageContent = "";
      const contentParts: ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[] = [];
      let userTextForProcessing = messageText || ""; // Initialize with text if available

      if (messageText) {
        contentParts.push({ type: "text", text: messageText });
      }

      if (messageAttachments) {
        for (const attachment of messageAttachments) {
          console.log(`📎 Attachment type: ${attachment.type}`, JSON.stringify(attachment).substring(0, 200));

          // Handle direct image attachments
          if (attachment.type === "image") {
            console.log(`🖼️ Identified image attachment: ${attachment.payload.url}`);

            // Convert Facebook image URL to base64 for OpenAI compatibility
            const base64Image = await facebookImageToBase64(attachment.payload.url);

            if (base64Image) {
              contentParts.push({ type: "image_url", image_url: { url: base64Image } });
              console.log(`✅ Image converted to base64 and added to message`);
            } else {
              console.warn(`⚠️ Failed to convert image, skipping attachment`);
              // Add a text note about the image if conversion failed
              if (!messageText) {
                contentParts.push({ type: "text", text: "[User sent an image]" });
              }
            }
          }
          // Handle Instagram/Facebook share attachments (shared posts)
          else if (attachment.type === "share" || attachment.type === "fallback") {
            const shareUrl = attachment.payload?.url;
            const shareTitle = attachment.payload?.title;
            const shareImageUrl = attachment.payload?.image_url;

            console.log(`🔗 Share attachment: title="${shareTitle}", hasImage=${!!shareImageUrl}`);

            // If the share has an image_url, try to convert it
            if (shareImageUrl) {
              console.log(`🖼️ Converting share image: ${shareImageUrl.substring(0, 60)}...`);
              const base64Image = await facebookImageToBase64(shareImageUrl);

              if (base64Image) {
                contentParts.push({ type: "image_url", image_url: { url: base64Image } });
                console.log(`✅ Share image converted to base64`);
              } else {
                console.warn(`⚠️ Failed to convert share image`);
              }
            }

            // Also add context about the shared post
            if (shareTitle || shareUrl) {
              const shareContext = `[User shared a post${shareTitle ? `: "${shareTitle}"` : ''}]`;
              contentParts.push({ type: "text", text: shareContext });
            }
          }
          // Other attachment types (video, file, audio) are ignored for now.
        }
      }

      // Determine final userContent based on what was found
      if (contentParts.length > 1) { // Both text and image(s)
        userContent = contentParts;
      } else if (contentParts.length === 1) { // Only text or only image
        if (contentParts[0].type === 'text') {
            userContent = contentParts[0].text;
        } else { // It's an image_url part
            userContent = contentParts;
        }
      } else { // No content - skip
        console.log("⚠️ Message has no processable content (text or image), skipping.");
        return;
      }

      console.log(`👤 User ${senderId} sent content. Text: "${userTextForProcessing}"`, messageAttachments ? `with ${messageAttachments.length} attachments.` : '');

      // Log incoming message for Meta review dashboard
      await logMetaMessage(senderId, senderId, 'user', userTextForProcessing);

      // Load conversation data from file
      const conversationData = await loadConversation(senderId);
      console.log(`📝 Retrieved ${conversationData.history.length} previous messages for user ${senderId}`);

      // Fetch and update user profile if not already present
      if (!conversationData.userName || !conversationData.profilePic) {
        const profile = await fetchUserProfile(senderId);
        if (profile.name) {
          conversationData.userName = profile.name;
          conversationData.profilePic = profile.profile_pic;
          console.log(`👤 Updated conversation with user profile: ${profile.name}`);
        }
      }

      // Show previous orders if any
      if (conversationData.orders.length > 0) {
        console.log(`🛒 Customer has ${conversationData.orders.length} previous orders`);
      }

      // Initialize storeVisitRequests if undefined
      conversationData.storeVisitRequests ??= 0;

      // Detect if user is asking about physical store/warehouse visit
      if (detectStoreVisitRequest(userTextForProcessing)) {
        conversationData.storeVisitRequests++;
        console.log(`🏪 Store visit request detected (count: ${conversationData.storeVisitRequests})`);
      }

      // Add message to history immediately
      conversationData.history.push({ role: "user", content: userContent });
      await saveConversation(conversationData);
      console.log(`📝 Message added to history for ${senderId}`);

      // ═══════════════════════════════════════════════════════
      // GLOBAL BOT PAUSE & MANUAL MODE CHECKS
      // ═══════════════════════════════════════════════════════
      let globalBotPaused = false;
      try {
        const settingsDoc = await db.collection('botSettings').doc('global').get();
        if (settingsDoc.exists) {
          globalBotPaused = settingsDoc.data()?.paused === true;
        }
      } catch (fsError) {
        console.warn(`⚠️ Firestore unavailable for bot pause check - assuming not paused`);
      }

      if (globalBotPaused || conversationData.manualMode === true) {
        console.log(globalBotPaused ? `⏸️ GLOBAL BOT PAUSE ACTIVE` : `🎮 MANUAL MODE ACTIVE`);
        console.log(`   User ${senderId} message: "${userTextForProcessing}"`);
        console.log(`   Message stored but no response sent`);
        return; // Exit early
      }

      // ═══════════════════════════════════════════════════════
      // SCREENSHOT-BASED PAYMENT CONFIRMATION (ASYNC via QStash)
      // If user sends image after bank account was provided, confirm immediately
      // ═══════════════════════════════════════════════════════
      if (messageAttachments && messageAttachments.some(a => a.type === 'image')) {
        // Check if bot just provided bank account in previous message
        const lastBotMsg = [...conversationData.history].reverse().find((m) => m.role === "assistant");
        const lastBotText = typeof lastBotMsg?.content === 'string' ? lastBotMsg.content : '';
        const botProvidedBankAccount = lastBotText.includes('GE09TB') || lastBotText.includes('GE31BG');

        if (botProvidedBankAccount) {
          console.log(`📸 Payment screenshot received - queueing payment processing to QStash`);
          const isKa = detectGeorgian(lastBotText);

          // Extract expected amount from conversation
          let expectedAmount: number | null = null;
          for (let i = conversationData.history.length - 1; i >= 0 && i >= conversationData.history.length - 5; i--) {
            const msg = conversationData.history[i];
            if (msg.role === 'assistant') {
              const msgText = typeof msg.content === 'string' ? msg.content : '';
              const amountMatch = msgText.match(/(\d{1,5}(\.\d{1,2})?)\s*ლარ/);
              if (amountMatch) {
                expectedAmount = parseFloat(amountMatch[1]);
                break;
              }
            }
          }

          // Extract order details from conversation history
          const orderDetails = extractOrderDetails(conversationData.history);

          // Use extracted name if available, otherwise fall back to Facebook username
          const customerName = orderDetails?.name || conversationData.userName || 'Unknown';

          // Prepare payment data and confirmation message
          let orderData;
          let confirmationMessage;
          let hasCompleteOrderDetails = false;

          if (orderDetails && orderDetails.product && orderDetails.telephone && orderDetails.address && expectedAmount) {
            // Complete order with all details
            hasCompleteOrderDetails = true;
            orderData = {
              product: orderDetails.product,
              quantity: "1",
              clientName: customerName,
              telephone: orderDetails.telephone,
              address: orderDetails.address,
              total: `${expectedAmount} ლარი`
            };

            confirmationMessage = isKa
              ? `✅ გადახდა დადასტურდა! ❤️\n\n${expectedAmount} ლარი მიღებულია "${customerName}"-ისგან.\n\n📦 შეკვეთა დადასტურებულია!\n\nპროდუქტი: ${orderDetails.product}\nმისამართი: ${orderDetails.address}\nტელეფონი: ${orderDetails.telephone}\n\n📧 ელექტრონული ზედნადები გამოგზავნილია ელ-ფოსტაზე.\n🚚 შეკვეთა მალე იქნება გაგზავნილი თქვენს მისამართზე.\n\nმადლობა შეძენისთვის! 🎉`
              : `✅ Payment confirmed! ❤️\n\n${expectedAmount} GEL received from "${customerName}".\n\n📦 Your order is confirmed!\n\nProduct: ${orderDetails.product}\nAddress: ${orderDetails.address}\nPhone: ${orderDetails.telephone}\n\n📧 Invoice sent to your email.\n🚚 Your order will be shipped soon.\n\nThank you for your purchase! 🎉`;
          } else {
            // Missing some details - generic confirmation (no order logging)
            hasCompleteOrderDetails = false;
            orderData = {
              product: '',
              quantity: '',
              clientName: customerName,
              telephone: '',
              address: '',
              total: expectedAmount ? `${expectedAmount} ლარი` : ''
            };

            confirmationMessage = isKa
              ? `✅ გადახდა დადასტურდა! ❤️\n\n${expectedAmount ? expectedAmount + ' ლარი მიღებულია' : 'გადახდა მიღებულია'}.\n\n📦 თქვენი შეკვეთა დადასტურებულია!\n\n🚚 შეკვეთა მალე იქნება გაგზავნილი.\n\nმადლობა შეძენისთვის! 🎉`
              : `✅ Payment confirmed! ❤️\n\n${expectedAmount ? expectedAmount + ' GEL received' : 'Payment received'}.\n\n📦 Your order is confirmed!\n\n🚚 Your order will be shipped soon.\n\nThank you for your purchase! 🎉`;
          }

          // Queue payment processing to QStash (async)
          if (!process.env.QSTASH_TOKEN) {
            console.warn(`⚠️ QSTASH_TOKEN not configured - processing synchronously as fallback`);
            // Fallback to synchronous processing if QStash not available
            if (hasCompleteOrderDetails) {
              const orderNumber = await logOrder(orderData, 'messenger');
              conversationData.orders = conversationData.orders || [];
              conversationData.orders.push({
                orderNumber,
                timestamp: new Date().toISOString(),
                items: orderData.product
              });
              await sendOrderEmail(orderData, orderNumber);
              confirmationMessage = confirmationMessage.replace('Your order is confirmed', `Order #${orderNumber} confirmed`);
              confirmationMessage = confirmationMessage.replace('თქვენი შეკვეთა დადასტურებულია', `შეკვეთა #${orderNumber} დადასტურებულია`);
            }
            conversationData.history.push({ role: "assistant", content: confirmationMessage });
            await saveConversation(conversationData);
            await sendMessage(senderId, confirmationMessage);
            return;
          }

          try {
            const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN });
            const callbackUrl = process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}/api/process-payment`
              : 'https://bebias-venera-chatbot.vercel.app/api/process-payment';

            await qstash.publishJSON({
              url: callbackUrl,
              body: {
                senderId,
                orderData,
                confirmationMessage,
                hasCompleteOrderDetails
              }
            });

            console.log(`✅ Payment queued to QStash for ${senderId}`);
            // Return immediately - QStash will process in background
            return;

          } catch (qstashError) {
            console.error(`❌ QStash queue error:`, qstashError);
            console.warn(`⚠️ Falling back to synchronous payment processing`);

            // Fallback to synchronous processing
            if (hasCompleteOrderDetails) {
              const orderNumber = await logOrder(orderData, 'messenger');
              conversationData.orders = conversationData.orders || [];
              conversationData.orders.push({
                orderNumber,
                timestamp: new Date().toISOString(),
                items: orderData.product
              });
              await sendOrderEmail(orderData, orderNumber);
              confirmationMessage = confirmationMessage.replace('Your order is confirmed', `Order #${orderNumber} confirmed`);
              confirmationMessage = confirmationMessage.replace('თქვენი შეკვეთა დადასტურებულია', `შეკვეთა #${orderNumber} დადასტურებულია`);
            }
            conversationData.history.push({ role: "assistant", content: confirmationMessage });
            await saveConversation(conversationData);
            await sendMessage(senderId, confirmationMessage);
            return;
          }
        }
      }

      // REMOVED: Bank API payment verification
      // See docs/ARCHIVED_BANK_VERIFICATION.md for code and restoration instructions

      // ═══════════════════════════════════════════════════════
      // ISSUE ESCALATION SYSTEM
      // ═══════════════════════════════════════════════════════
      // Check for phone number fallback first (1 hour timeout)
      const phoneMessage = await checkPhoneNumberFallback(conversationData, userTextForProcessing);
      if (phoneMessage) {
        console.log(`📞 Offering manager phone number to user ${senderId}`);

        // Add assistant response to history (user message already added above)
        conversationData.history.push({ role: "assistant", content: phoneMessage });

        await saveConversation(conversationData);
        await sendMessage(senderId, phoneMessage);
        return; // Exit after phone message
      }

      // Handle issue escalation
      const escalationResult = await handleIssueEscalation(userTextForProcessing, conversationData);
      if (escalationResult.escalated && escalationResult.response) {
        console.log(`🚨 Issue escalation processed for user ${senderId}`);

        // Update conversation data with escalation info
        Object.assign(conversationData, escalationResult.updatedData);

        // Add assistant response to history (user message already added above)
        conversationData.history.push({ role: "assistant", content: escalationResult.response });

        // Save and send response
        await saveConversation(conversationData);
        await sendMessage(senderId, escalationResult.response);
        return; // Exit after escalation
      }

      // Check if there's a bot instruction from operator
      let operatorInstruction: string | undefined = undefined;
      if (conversationData.botInstruction) {
        operatorInstruction = conversationData.botInstruction;
        console.log(`📋 Operator instruction found: "${conversationData.botInstruction}"`);

        // Clear the instruction after use (one-time use)
        delete conversationData.botInstruction;
        delete conversationData.botInstructionAt;
      }

      // Get AI response with conversation context, order history, store visit count, and operator instruction
      const response = await getAIResponse(userContent, conversationData.history, conversationData.orders, conversationData.storeVisitRequests, operatorInstruction);

      console.log(`🤖 AI Response length: ${response.length} chars`);
      console.log(`🤖 AI Response (first 500 chars):`, response.substring(0, 500));
      console.log(`🤖 AI Response (last 200 chars):`, response.substring(Math.max(0, response.length - 200)));

      // Update conversation history (user message already added above)
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
      console.log("⚠️ Event does not contain message content");
    }
  } catch (err: any) {
    console.error(`❌ Error processing event for ${event.sender?.id}:`, err);
  }
}

// POST handler for incoming messages
export async function POST(req: Request) {
  let body: any;

  // Parse body
  try {
    body = await req.json();
  } catch (parseError: any) {
    console.error("❌ Failed to parse request body:", parseError);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("📩 Incoming Messenger webhook");

  if (body.object !== "page") {
    console.log("⚠️ Unknown webhook event");
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  // Process events synchronously (serverless terminates after response)
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender?.id;
      const messageId = event.message?.mid;
      const webhookId = Math.random().toString(36).substring(2, 8);

      console.log(`📨 [WH:${webhookId}] Received message ${messageId} from ${senderId}`);

      // ═══════════════════════════════════════════════════════
      // SKIP ECHO MESSAGES - These are our own bot responses sent back by Facebook
      // ═══════════════════════════════════════════════════════
      if (event.message?.is_echo) {
        console.log(`⏭️ [WH:${webhookId}] ECHO message (our own response) - skipping`);
        continue;
      }

      // ═══════════════════════════════════════════════════════
      // HANDLE POSTBACKS & REFERRALS FROM ADS
      // When users click "Send Message" on a Facebook ad, we get:
      // - event.postback with ad context, OR
      // - event.referral with ad metadata, OR
      // - event.message.referral attached to first message
      // ═══════════════════════════════════════════════════════
      let adContext = '';

      // Check for postback from ad (user clicked "Send Message" button)
      if (event.postback) {
        console.log(`🎯 [WH:${webhookId}] POSTBACK from ad detected`);
        const payload = event.postback.payload;
        const title = event.postback.title;
        const referral = event.postback.referral;

        if (referral) {
          const adId = referral.ad_id;
          const refSource = referral.source;
          const refType = referral.type;
          console.log(`   Ad ID: ${adId}, Source: ${refSource}, Type: ${refType}`);
          adContext = `[User came from Facebook ad: ${title || 'Unknown'}]`;
        }

        // Create a synthetic message from the postback
        event.message = {
          mid: `postback_${Date.now()}`,
          text: title || payload || 'გამარჯობა',
          referral: referral
        };
        console.log(`   Converted to message: "${event.message.text}"`);
      }

      // Check for referral event (ad context)
      if (event.referral) {
        console.log(`🎯 [WH:${webhookId}] REFERRAL from ad detected`);
        const adId = event.referral.ad_id;
        const refSource = event.referral.source;
        const refType = event.referral.type;
        console.log(`   Ad ID: ${adId}, Source: ${refSource}, Type: ${refType}`);

        // Create a synthetic message from the referral
        event.message = {
          mid: `referral_${Date.now()}`,
          text: 'გამარჯობა',
          referral: event.referral
        };
        adContext = `[User came from Facebook ad: ${adId}]`;
      }

      // Check for referral attached to message (ad context in first message)
      let productIdFromAd: string | null = null;
      if (event.message?.referral) {
        console.log(`🎯 [WH:${webhookId}] Message has AD REFERRAL attached`);
        const adId = event.message.referral.ad_id;
        const refSource = event.message.referral.source;
        const refType = event.message.referral.type;
        const refParam = event.message.referral.ref; // Custom ref parameter (e.g., "PRODUCT_9016")
        const productFromCatalog = event.message.referral.product?.id; // Catalog product ID

        console.log(`   Ad ID: ${adId}, Source: ${refSource}, Type: ${refType}`);
        console.log(`   Ref param: ${refParam}, Catalog product: ${productFromCatalog}`);

        // Extract product ID from various sources (priority order)
        if (productFromCatalog) {
          productIdFromAd = productFromCatalog;
          console.log(`   ✅ Product ID from catalog: ${productIdFromAd}`);
        } else if (refParam?.startsWith('PRODUCT_')) {
          productIdFromAd = refParam.replace('PRODUCT_', '');
          console.log(`   ✅ Product ID from ref param: ${productIdFromAd}`);
        } else if (adId) {
          // Try to load ad-to-product mapping
          try {
            const mappingPath = path.join(process.cwd(), 'data', 'ad-product-mapping.json');
            const mappingData = await fs.readFile(mappingPath, 'utf8');
            const mapping = JSON.parse(mappingData);
            const adMapping = mapping.mappings?.[adId];
            if (adMapping?.productId) {
              productIdFromAd = adMapping.productId;
              console.log(`   ✅ Product ID from ad mapping: ${productIdFromAd} (${adMapping.productName})`);
            }
          } catch (err) {
            console.log(`   ℹ️ No ad mapping found for ad ${adId}`);
          }
        }

        if (productIdFromAd) {
          adContext = `[SHOW_PRODUCT:${productIdFromAd}] გამარჯობა! დაინტერესდი ამ პროდუქტით?`;
        } else {
          adContext = `[User came from Facebook ad: ${adId}]`;
        }
      }

      if (!senderId || (!event.message?.text && !event.message?.attachments)) {
        console.log(`⚠️ [WH:${webhookId}] Event does not contain required data, skipping.`);
        continue;
      }

      // Replace message text with ad context if available (for product ads)
      if (adContext) {
        if (productIdFromAd) {
          // For product ads, replace the message entirely with product inquiry
          event.message.text = adContext;
          console.log(`   🎯 Replaced message with product inquiry: ${productIdFromAd}`);
        } else if (event.message?.text) {
          // For generic ads, prepend context
          event.message.text = `${adContext} ${event.message.text}`;
          console.log(`   Added ad context to message`);
        }
      }

      // ═══════════════════════════════════════════════════════
      // CONTENT-BASED DEDUPLICATION - Catches duplicates across sender IDs
      // Facebook sends same message with different sender IDs for page admins
      // ═══════════════════════════════════════════════════════
      const messageText = event.message?.text || '';
      const hasImage = event.message?.attachments?.some((a: any) => a.type === 'image');
      const contentKey = messageText || (hasImage ? 'IMAGE_ATTACHMENT' : 'EMPTY');

      // Create content hash: first 50 chars + length + 30-second bucket
      const timeBucket = Math.floor(Date.now() / 30000); // 30-second windows
      const contentHash = `content_${contentKey.substring(0, 50).replace(/[^a-zA-Z0-9\u10A0-\u10FF]/g, '')}_${contentKey.length}_${timeBucket}`;

      try {
        const contentDocRef = db.collection('processedMessages').doc(contentHash);
        await contentDocRef.create({
          processedAt: new Date().toISOString(),
          senderId: senderId,
          messageId: messageId,
          webhookId: webhookId,
          content: contentKey.substring(0, 100)
        });
        console.log(`✅ [WH:${webhookId}] Content lock acquired: ${contentHash.substring(0, 40)}...`);
      } catch (error: unknown) {
        const fsError = error as { code?: string | number; message?: string };
        const errorCode = fsError.code;
        const isAlreadyExists = errorCode === 6 || errorCode === 'already-exists' ||
                               (typeof errorCode === 'number' && errorCode === 6) ||
                               fsError.message?.includes('ALREADY_EXISTS');

        if (isAlreadyExists) {
          console.log(`⏭️ [WH:${webhookId}] DUPLICATE CONTENT - same message within 30s, skipping`);
          console.log(`   Content hash: ${contentHash.substring(0, 50)}...`);
          continue;
        }
        console.warn(`⚠️ [WH:${webhookId}] Firestore error:`, fsError.message || fsError);
      }

      // ═══════════════════════════════════════════════════════
      // QUEUE TO QSTASH (Quick - just HTTP POST)
      // ═══════════════════════════════════════════════════════
      console.log(`🚀 [WH:${webhookId}] Queueing ${messageId}`);
      try {
        await saveMessageAndQueue(event);
        console.log(`✅ [WH:${webhookId}] Queued ${messageId}`);
      } catch (err) {
        console.error(`❌ [WH:${webhookId}] Queue error:`, err);
      }
    }
  }

  console.log("✅ Returning 200 OK to Facebook");
  return NextResponse.json({ status: "ok" }, { status: 200 });
}

