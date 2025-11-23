import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import OpenAI from "openai";
import { db } from "@/lib/firestore";
import fs from "fs";
import path from "path";
import { sendOrderEmail, parseOrderNotification } from "@/lib/sendOrderEmail";
import { logOrder } from "@/lib/orderLoggerWithFirestore";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ==================== TYPES ====================

interface Product {
  id: string;
  name: string;
  image?: string;
  [key: string]: any;
}

// ==================== HELPER FUNCTIONS ====================

// Load content files
function loadContentFile(filename: string): string {
  try {
    const filePath = path.join(process.cwd(), 'data', 'content', filename);
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return '';
  }
}

// Load products from JSON file
async function loadProducts(): Promise<Product[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'products.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent) as Product[];
  } catch (error) {
    console.error('❌ Error loading products:', error);
    return [];
  }
}

/**
 * Search orders by name, phone, or order number
 * Returns matching orders for order inquiry context
 */
async function searchOrders(query: string): Promise<string> {
  try {
    const normalizedQuery = query.toLowerCase().trim();
    console.log('🔍 searchOrders called with:', query, '(normalized:', normalizedQuery, ')');

    // Get all orders (no orderBy to avoid issues with missing/mixed timestamp formats)
    const snapshot = await db.collection('orders')
      .limit(100)
      .get();

    if (snapshot.empty) {
      return 'ბოლო შეკვეთები ვერ მოიძებნა.';
    }

    // Search for matches
    const matches: any[] = [];
    console.log(`📊 Checking ${snapshot.size} orders for matches...`);
    snapshot.forEach(doc => {
      const order = doc.data();
      const clientName = (order.clientName || '').toLowerCase();
      const telephone = order.telephone || '';
      const orderNumber = doc.id;
      const trackingNumber = order.trackingNumber || '';

      // Debug: log orders with tracking numbers
      if (trackingNumber) {
        console.log(`  Order ${orderNumber} has tracking: ${trackingNumber}`);
      }

      // Match by name, phone, order number, or tracking number
      if (clientName.includes(normalizedQuery) ||
          telephone.includes(normalizedQuery) ||
          orderNumber.includes(normalizedQuery) ||
          trackingNumber.includes(normalizedQuery) ||
          normalizedQuery.includes(clientName) ||
          normalizedQuery.includes(telephone) ||
          normalizedQuery.includes(trackingNumber)) {
        matches.push({
          orderNumber,
          clientName: order.clientName,
          telephone: order.telephone,
          product: order.product,
          total: order.total,
          address: order.address,
          timestamp: order.timestamp,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          // Shipping fields from warehouse app
          shippingStatus: order.shippingStatus,
          trackingNumber: order.trackingNumber,
          trackingsOrderId: order.trackingsOrderId,
          shippingCompany: order.shippingCompany,
          trackingsStatusCode: order.trackingsStatusCode,
          trackingsStatusText: order.trackingsStatusText,
          shippingUpdatedAt: order.shippingUpdatedAt
        });
      }
    });

    if (matches.length === 0) {
      return `"${query}" სახელით ან ნომრით შეკვეთა ვერ მოიძებნა ბოლო 50 შეკვეთაში.`;
    }

    // Format matches for bot context - read status from DB only (synced from warehouse app)
    const formattedOrders = matches.map((o) => {
      const paymentStatus = o.paymentStatus === 'confirmed' ? '✅ დადასტურებული' :
                            o.paymentStatus === 'pending' ? '⏳ მოლოდინში' : '❌ გაუქმებული';

      // Trackings.ge status codes translated to Georgian
      const trackingsStatusMap: Record<string, string> = {
        'CREATE': '📋 შეკვეთა შექმნილია',
        'ASSIGN_TO_PICKUP': '📦 მიენიჭა კურიერს',
        'Pickup in Progress': '🚗 კურიერი მიდის ასაღებად',
        'Shipment Picked Up': '✅ აიღო კურიერმა',
        'Label Created': '🏷️ ლეიბლი შექმნილია',
        'OFD': '🚚 კურიერი გამოსულია ჩასაბარებლად',
        'DELIVERED': '✅ ჩაბარებულია',
        'CANCELLED': '❌ გაუქმებულია',
        'RETURNED': '↩️ დაბრუნებულია'
      };

      // Basic shipping status (before trackings.ge)
      const basicStatusMap: Record<string, string> = {
        'pending': '📋 მზადდება',
        'processing': '🔄 მუშავდება',
        'packed': '📦 შეფუთულია',
        'shipped': '🚚 გაგზავნილია კურიერთან',
        'delivered': '✅ ჩაბარებულია',
        'cancelled': '❌ გაუქმებულია'
      };

      // Get shipping status - prefer trackings.ge status if available
      let shippingStatus = '📋 მზადდება';
      if (o.trackingsStatusCode) {
        shippingStatus = trackingsStatusMap[o.trackingsStatusCode] || o.trackingsStatusText || o.trackingsStatusCode;
      } else if (o.shippingStatus) {
        shippingStatus = basicStatusMap[o.shippingStatus] || o.shippingStatus;
      }

      // Tracking info
      let trackingInfo = '';
      if (o.trackingNumber) {
        trackingInfo = `\n  ტრეკინგი: ${o.trackingNumber}`;
        if (o.shippingCompany) {
          trackingInfo += ` (${o.shippingCompany})`;
        }
      }

      const date = new Date(o.timestamp).toLocaleDateString('ka-GE');

      return `შეკვეთა #${o.orderNumber} (${date})
  სახელი: ${o.clientName}
  ტელეფონი: ${o.telephone}
  პროდუქტი: ${o.product}
  ჯამი: ${o.total}
  მისამართი: ${o.address}
  გადახდა: ${paymentStatus}
  მიწოდება: ${shippingStatus}${trackingInfo}`;
    });

    return formattedOrders.join('\n\n');
  } catch (error) {
    console.error('Error searching orders:', error);
    return 'შეკვეთების ძებნა ვერ მოხერხდა.';
  }
}

/**
 * Extract potential search terms from user message (names, phones, order numbers, tracking codes)
 */
function extractSearchTerms(message: string): string[] {
  const terms: string[] = [];

  // Extract Georgian names (capitalized words)
  const nameMatches = message.match(/[ა-ჰ][ა-ჰ]+/g);
  if (nameMatches) {
    terms.push(...nameMatches.filter(n => n.length > 2));
  }

  // Extract tracking numbers (15 digits - trackings.ge format)
  const trackingMatches = message.match(/\d{15}/g);
  if (trackingMatches) {
    terms.push(...trackingMatches);
  }

  // Extract phone numbers (9 digits)
  const phoneMatches = message.match(/\d{9}/g);
  if (phoneMatches) {
    // Don't add if it's part of a tracking number
    const filteredPhones = phoneMatches.filter(p => !trackingMatches?.some(t => t.includes(p)));
    terms.push(...filteredPhones);
  }

  // Extract order numbers (900XXX pattern)
  const orderMatches = message.match(/9\d{5}/g);
  if (orderMatches) {
    // Don't add if it's part of a tracking number
    const filteredOrders = orderMatches.filter(o => !trackingMatches?.some(t => t.includes(o)));
    terms.push(...filteredOrders);
  }

  return [...new Set(terms)]; // Remove duplicates
}

/**
 * OPTIMIZATION: Filter products based on user query to reduce token usage
 * Instead of sending all 76k chars of products, send only relevant ones
 */
function filterProductsByQuery(products: Product[], userMessage: string): Product[] {
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
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'orange',
    'turquoise', 'purple', 'brown', 'gray', 'grey'
  ];

  // Material keywords (Georgian and English)
  const materialKeywords: string[] = [
    'ბამბა', 'ბამბის', 'შალ', 'შალის', 'მატყლ',
    'cotton', 'wool', 'cashmere', 'knit'
  ];

  // Check if user is asking about specific product types
  let matchedProducts: Product[] = [];

  // First, check for category matches
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => message.includes(kw))) {
      // Filter products by this category
      const categoryProducts = products.filter(p =>
        p.category?.toLowerCase().includes(category) ||
        p.name.toLowerCase().includes(category) ||
        keywords.some(kw => p.name.toLowerCase().includes(kw))
      );
      matchedProducts.push(...categoryProducts);
    }
  }

  // Then check for color matches
  const matchedColors = colorKeywords.filter(c => message.includes(c.toLowerCase()));
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
  }

  // Check for material matches
  const matchedMaterials = materialKeywords.filter(m => message.includes(m.toLowerCase()));
  if (matchedMaterials.length > 0) {
    const materialProducts = products.filter(p =>
      matchedMaterials.some(m => p.name.toLowerCase().includes(m.toLowerCase()))
    );
    if (matchedProducts.length === 0) {
      matchedProducts = materialProducts;
    }
  }

  // Remove duplicates
  const uniqueProducts = Array.from(new Map(matchedProducts.map(p => [p.id, p])).values());

  // If we found matches, return them (max 30 products)
  if (uniqueProducts.length > 0) {
    console.log(`📦 Product filter: Found ${uniqueProducts.length} matching products for query`);
    return uniqueProducts.slice(0, 30);
  }

  // If no specific matches, return top products with images (bestsellers fallback)
  const productsWithImages = products.filter(p =>
    p.image && p.image !== 'IMAGE_URL_HERE' && !p.image.includes('facebook.com') && p.image.startsWith('http')
  );

  console.log(`📦 Product filter: No specific match, returning ${Math.min(productsWithImages.length, 20)} bestsellers`);
  return productsWithImages.slice(0, 20);
}

// Parse SEND_IMAGE commands from AI response
function parseImageCommands(response: string): { productIds: string[]; cleanResponse: string } {
  console.log(`🔍 parseImageCommands called with response length: ${response.length}`);
  console.log(`🔍 Response preview (first 300 chars):`, response.substring(0, 300));

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

// Send image to Facebook Messenger
async function sendImage(recipientId: string, imageUrl: string) {
  const url = `https://graph.facebook.com/v17.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`;

  console.log(`📸 Sending image to ${recipientId}:`, imageUrl);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'image',
            payload: {
              url: imageUrl,
              is_reusable: true
            }
          }
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Facebook API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('✅ Image sent successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Error sending image:', error);
    throw error;
  }
}

// ==================== CONVERSATION HISTORY LIMITS ====================
// Keep only recent messages to reduce token usage
const MAX_HISTORY_MESSAGES = 10; // Keep last 10 messages (5 user + 5 assistant)

/**
 * Trim conversation history to reduce token usage
 * - Keeps only the most recent messages
 * - Removes base64 image data from old messages (keeps only text)
 */
function trimConversationHistory(history: any[]): any[] {
  if (history.length <= MAX_HISTORY_MESSAGES) {
    return history;
  }

  // Keep only the last N messages
  const trimmed = history.slice(-MAX_HISTORY_MESSAGES);

  // Also strip base64 image data from all but the most recent message
  // to prevent huge token usage from old images
  return trimmed.map((msg, index) => {
    // Keep the last message intact (most recent)
    if (index === trimmed.length - 1) {
      return msg;
    }

    // For older messages, strip image data but keep text
    if (Array.isArray(msg.content)) {
      const textOnly = msg.content.filter((c: any) => c.type === 'text');
      if (textOnly.length > 0) {
        return {
          ...msg,
          content: textOnly.map((c: any) => c.text).join('\n')
        };
      }
    }
    return msg;
  });
}

// ==================== SAFETY CONFIGURATION ====================
// Relaxed limits for production use
const SAFETY_LIMITS = {
  MAX_MESSAGES_PER_USER_PER_HOUR: 100,     // Max 100 messages per user per hour
  MAX_MESSAGES_PER_USER_PER_DAY: 300,      // Max 300 messages per user per day
  MAX_TOTAL_MESSAGES_PER_HOUR: 500,        // Max 500 total messages per hour (all users)
  CIRCUIT_BREAKER_THRESHOLD: 100,          // Circuit breaker trips after 100 messages in 10 min
  CIRCUIT_BREAKER_WINDOW_MS: 10 * 60 * 1000, // 10 minutes
};

// ==================== SAFETY MECHANISMS ====================

/**
 * Check if emergency kill switch is active
 */
async function checkKillSwitch(): Promise<{ active: boolean; reason?: string }> {
  try {
    const killSwitchDoc = await db.collection('botSettings').doc('qstashKillSwitch').get();
    if (killSwitchDoc.exists) {
      const data = killSwitchDoc.data();
      if (data?.active === true) {
        return { active: true, reason: data.reason || 'Manual kill switch activated' };
      }
    }
    return { active: false };
  } catch (error) {
    console.error('❌ Error checking kill switch:', error);
    return { active: false };
  }
}

/**
 * Check rate limits for a user
 */
async function checkRateLimits(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // Get user's message count from Firestore
    const userLimitDoc = await db.collection('rateLimits').doc(userId).get();
    const userLimitData = userLimitDoc.exists ? userLimitDoc.data() : { hourlyMessages: [], dailyMessages: [] };

    // Filter to recent messages
    const hourlyMessages = (userLimitData.hourlyMessages || []).filter((ts: number) => ts > oneHourAgo);
    const dailyMessages = (userLimitData.dailyMessages || []).filter((ts: number) => ts > oneDayAgo);

    // Check limits
    if (hourlyMessages.length >= SAFETY_LIMITS.MAX_MESSAGES_PER_USER_PER_HOUR) {
      return {
        allowed: false,
        reason: `User ${userId} exceeded hourly limit (${hourlyMessages.length}/${SAFETY_LIMITS.MAX_MESSAGES_PER_USER_PER_HOUR})`
      };
    }

    if (dailyMessages.length >= SAFETY_LIMITS.MAX_MESSAGES_PER_USER_PER_DAY) {
      return {
        allowed: false,
        reason: `User ${userId} exceeded daily limit (${dailyMessages.length}/${SAFETY_LIMITS.MAX_MESSAGES_PER_USER_PER_DAY})`
      };
    }

    // Update counters
    hourlyMessages.push(now);
    dailyMessages.push(now);

    await db.collection('rateLimits').doc(userId).set({
      hourlyMessages,
      dailyMessages,
      lastUpdated: new Date().toISOString()
    });

    return { allowed: true };
  } catch (error) {
    console.error('❌ Error checking rate limits:', error);
    // Fail open (allow message) to avoid blocking legitimate users
    return { allowed: true };
  }
}

/**
 * Check circuit breaker (detects abnormal usage patterns)
 */
async function checkCircuitBreaker(): Promise<{ tripped: boolean; reason?: string }> {
  try {
    const now = Date.now();
    const windowStart = now - SAFETY_LIMITS.CIRCUIT_BREAKER_WINDOW_MS;

    // Get recent message count
    const circuitDoc = await db.collection('botSettings').doc('circuitBreaker').get();
    const circuitData = circuitDoc.exists ? circuitDoc.data() : { recentMessages: [] };

    // Filter to recent messages
    const recentMessages = (circuitData.recentMessages || []).filter((ts: number) => ts > windowStart);

    if (recentMessages.length >= SAFETY_LIMITS.CIRCUIT_BREAKER_THRESHOLD) {
      // Auto-activate kill switch
      await db.collection('botSettings').doc('qstashKillSwitch').set({
        active: true,
        reason: `Circuit breaker tripped: ${recentMessages.length} messages in 10 minutes`,
        triggeredAt: new Date().toISOString(),
        autoTriggered: true
      });

      return {
        tripped: true,
        reason: `Circuit breaker tripped: ${recentMessages.length} messages in ${SAFETY_LIMITS.CIRCUIT_BREAKER_WINDOW_MS / 60000} minutes`
      };
    }

    // Update counter
    recentMessages.push(now);
    await db.collection('botSettings').doc('circuitBreaker').set({
      recentMessages,
      lastUpdated: new Date().toISOString()
    });

    return { tripped: false };
  } catch (error) {
    console.error('❌ Error checking circuit breaker:', error);
    return { tripped: false };
  }
}

/**
 * Log QStash usage for monitoring
 */
async function logQStashUsage(userId: string, success: boolean, error?: string) {
  try {
    const logId = `qstash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('qstashUsage').doc(logId).set({
      userId,
      timestamp: new Date().toISOString(),
      success,
      error: error || null,
      date: new Date().toISOString().split('T')[0] // For daily aggregation
    });
  } catch (error) {
    console.error('❌ Error logging QStash usage:', error);
  }
}

// ==================== MESSAGE PROCESSING ====================

async function loadConversation(userId: string) {
  try {
    const docRef = db.collection('conversations').doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        senderId: userId,
        userName: 'Unknown',
        history: [],
        orders: [],
        createdAt: new Date().toISOString()
      };
    }

    return doc.data();
  } catch (error: any) {
    console.error('Error loading conversation:', error);
    throw error;
  }
}

async function saveConversation(userId: string, data: any) {
  try {
    const docRef = db.collection('conversations').doc(userId);
    await docRef.set(data);
  } catch (error: any) {
    console.error('Error saving conversation:', error);
    throw error;
  }
}

async function sendSingleMessage(recipientId: string, messageText: string) {
  const url = `https://graph.facebook.com/v17.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: messageText },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Facebook API error: ${JSON.stringify(errorData)}`);
  }

  return response.json();
}

/**
 * Split message into natural chunks for human-like conversation
 * - Splits on double newlines (paragraphs)
 * - Each paragraph becomes its own message (more human-like)
 * - Adds small delay between chunks for natural feel
 */
function splitIntoChunks(text: string): string[] {
  // Don't chunk very short messages
  if (text.length < 80) {
    return [text];
  }

  // Split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

  // If only 1 paragraph, no chunking
  if (paragraphs.length <= 1) {
    return [text];
  }

  // Each paragraph becomes its own chunk (more natural)
  const chunks = paragraphs.map(p => p.trim()).filter(p => p.length > 0);

  console.log(`📝 Split message into ${chunks.length} chunks`);
  return chunks;
}

/**
 * Send message with chunking - splits long messages into multiple parts
 * for more natural conversation flow
 */
async function sendMessage(recipientId: string, messageText: string) {
  const chunks = splitIntoChunks(messageText);

  for (let i = 0; i < chunks.length; i++) {
    await sendSingleMessage(recipientId, chunks[i]);

    // Add small delay between chunks (except after last one)
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 800)); // 800ms delay
    }
  }

  return { chunked: chunks.length > 1, chunks: chunks.length };
}

// Log bot message to metaMessages collection for Control Panel display
async function logMetaMessage(userId: string, senderType: 'bot' | 'human', text: string): Promise<void> {
  try {
    const docRef = db.collection('metaMessages').doc(userId);
    const doc = await docRef.get();

    const message = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      senderId: 'VENERA_BOT',
      senderType,
      text,
      timestamp: new Date().toISOString()
    };

    if (doc.exists) {
      const data = doc.data();
      const messages = data?.messages || [];
      messages.push(message);
      // Keep last 100 messages
      const trimmedMessages = messages.slice(-100);
      await docRef.update({ messages: trimmedMessages });
    } else {
      await docRef.set({
        userId,
        messages: [message]
      });
    }
  } catch (error) {
    console.error(`⚠️ Failed to log meta message for ${userId}:`, error);
    // Don't throw - this is non-critical
  }
}

// ==================== MAIN HANDLER ====================

async function handler(req: Request) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    const body = await req.json();
    const { senderId, messageId, originalContent } = body;
    userId = senderId;

    // originalContent contains the actual message with images (not placeholders)
    // This is passed from messenger route because history stores image placeholders

    console.log(`🚀 [QStash] Processing message ${messageId} for user ${senderId}`);

    // ==================== ATOMIC DEDUPLICATION LOCK ====================
    // Use Firestore create() to atomically acquire a processing lock.
    // If another request already created the doc, create() throws an error.
    // This prevents race conditions where two requests check simultaneously.
    if (messageId) {
      try {
        const lockRef = db.collection('processingLocks').doc(messageId);
        await lockRef.create({
          lockedAt: new Date().toISOString(),
          senderId,
        });
        console.log(`🔒 [QStash] Acquired lock for message ${messageId}`);
      } catch (error: unknown) {
        // If create() fails, another request already has the lock
        const firestoreError = error as { code?: number };
        if (firestoreError.code === 6) { // ALREADY_EXISTS
          console.log(`⏭️ [QStash] Message ${messageId} already being processed - skipping`);
          return NextResponse.json({
            status: 'already_processing',
            messageId
          }, { status: 200 });
        }
        // For other errors, log and continue (fail open)
        console.warn(`⚠️ Lock acquisition failed with unexpected error - continuing anyway:`, error);
      }
    }

    // ==================== SAFETY CHECKS ====================

    // 1. Check kill switch FIRST (no messages sent when active)
    const killSwitch = await checkKillSwitch();
    if (killSwitch.active) {
      console.log(`🛑 Kill switch active: ${killSwitch.reason}`);
      await logQStashUsage(senderId, false, `Kill switch: ${killSwitch.reason}`);
      return NextResponse.json({
        status: 'blocked',
        reason: killSwitch.reason
      }, { status: 503 });
    }

    // 2. Check KILL SWITCH and GLOBAL BOT PAUSE (no messages sent when stopped)
    let globalBotPaused = false;
    let killSwitchActive = false;
    try {
      const settingsDoc = await db.collection('botSettings').doc('global').get();
      if (settingsDoc.exists) {
        const data = settingsDoc.data();
        globalBotPaused = data?.paused === true;
        killSwitchActive = data?.killSwitch === true;
      }
    } catch (error) {
      console.warn(`Could not check bot status - continuing anyway`);
    }

    // Kill switch takes priority - emergency stop
    if (killSwitchActive) {
      console.log(`KILL SWITCH ACTIVE - All processing halted`);
      await logQStashUsage(senderId, true, 'Kill switch active - emergency stop');
      return NextResponse.json({
        status: 'kill_switch',
        message: 'Kill switch is active - emergency stop'
      });
    }

    if (globalBotPaused) {
      console.log(`GLOBAL BOT PAUSE ACTIVE`);
      console.log(`   Message stored but bot is globally paused - NO response sent`);
      await logQStashUsage(senderId, true, 'Bot globally paused - skipped processing');
      return NextResponse.json({
        status: 'bot_paused',
        message: 'Bot is globally paused'
      });
    }

    // 3. Check rate limits (only checked if bot is NOT paused)
    const rateLimit = await checkRateLimits(senderId);
    if (!rateLimit.allowed) {
      console.log(`⚠️ Rate limit exceeded: ${rateLimit.reason}`);
      await logQStashUsage(senderId, false, `Rate limit: ${rateLimit.reason}`);

      // Send user-friendly message
      const rateLimitMsg = "თქვენ მიაღწიეთ შეტყობინებების ლიმიტს. გთხოვთ, სცადოთ მოგვიანებით. 🙏\n\n" +
        "You've reached the message limit. Please try again later. 🙏";
      await sendMessage(senderId, rateLimitMsg);
      await logMetaMessage(senderId, 'bot', rateLimitMsg);

      return NextResponse.json({
        status: 'rate_limited',
        reason: rateLimit.reason
      }, { status: 429 });
    }

    // 4. Check circuit breaker
    const circuitBreaker = await checkCircuitBreaker();
    if (circuitBreaker.tripped) {
      console.log(`🔥 Circuit breaker tripped: ${circuitBreaker.reason}`);
      await logQStashUsage(senderId, false, `Circuit breaker: ${circuitBreaker.reason}`);
      return NextResponse.json({
        status: 'circuit_breaker_tripped',
        reason: circuitBreaker.reason
      }, { status: 503 });
    }

    console.log(`✅ All safety checks passed for ${senderId}`);

    // ==================== PROCESS MESSAGE ====================

    // Load conversation
    const conversationData = await loadConversation(senderId);

    // ==================== MANUAL MODE CHECK ====================
    // If conversation is in manual mode, operator is handling responses
    // Do not send automated bot response
    if (conversationData.manualMode === true) {
      console.log(`🎮 MANUAL MODE ACTIVE for ${senderId}`);
      console.log(`   Message stored but operator will respond manually`);
      await logQStashUsage(senderId, true, 'Manual mode - skipped processing');
      return NextResponse.json({
        status: 'manual_mode',
        message: 'Conversation in manual mode, operator will respond'
      });
    }

    // Get last message from history (the one that triggered this processing)
    const lastMessageFromHistory = conversationData.history[conversationData.history.length - 1];

    if (!lastMessageFromHistory || lastMessageFromHistory.role !== 'user') {
      throw new Error('No user message found to process');
    }

    // Use originalContent if provided (has actual images), otherwise fall back to history
    // History has images replaced with placeholders to save tokens on future calls
    const lastMessageContent = originalContent || lastMessageFromHistory.content;
    const lastMessage = { ...lastMessageFromHistory, content: lastMessageContent };

    console.log(`📝 Processing message: "${typeof lastMessage.content === 'string' ? lastMessage.content.substring(0, 50) : 'image/multipart'}"...`);

    // Extract user message text for product filtering
    let userMessageText = '';
    if (typeof lastMessage.content === 'string') {
      userMessageText = lastMessage.content;
    } else if (Array.isArray(lastMessage.content)) {
      const textPart = lastMessage.content.find((c: any) => c.type === 'text');
      userMessageText = textPart?.text || '';
    }

    // Load and filter products based on user query (OPTIMIZATION: reduces ~50k tokens to ~2k)
    const allProducts = await loadProducts();
    const filteredProducts = filterProductsByQuery(allProducts, userMessageText);

    // Build product context for AI
    const productContext = filteredProducts
      .map((p) => {
        const hasImage = p.image && p.image !== 'IMAGE_URL_HERE' && !p.image.includes('facebook.com') && p.image.startsWith('http');
        return `${p.name} (ID: ${p.id}) - Price: ${p.price} ${p.currency || ""}, Stock: ${p.stock}, Category: ${p.category || "N/A"}${hasImage ? ' [HAS_IMAGE]' : ''}`;
      })
      .join("\n");

    const productNote = filteredProducts.length < allProducts.length
      ? `\n\n(Showing ${filteredProducts.length} relevant products. Ask customer to specify if they need something else.)`
      : '';

    // ==================== TOPIC-BASED CONTENT SELECTION ====================
    // Only load relevant content files based on user's message to reduce tokens
    const msg = userMessageText.toLowerCase();
    const hasImage = Array.isArray(lastMessage.content) && lastMessage.content.some((c: any) => c.type === 'image_url');

    // Topic detection
    const topics = {
      delivery: /მიწოდება|მიტანა|delivery|shipping|როდის მოვა|როდის მოიტან|ჩამოტან/.test(msg),
      payment: /გადახდა|payment|ბარათ|card|თანხა|ფულ|pay|გადაიხად/.test(msg),
      purchase: /ვიყიდო|შევუკვეთ|order|buy|შეკვეთ|ყიდვ|მინდა.*ვიყიდო|შევიძინ/.test(msg),
      contact: /კონტაქტ|მისამართ|address|phone|ტელეფონ|სად ხართ|location|საათ|სამუშაო/.test(msg),
      services: /სერვის|მომსახურება|service|რემონტ|შეკეთება/.test(msg),
      product: /ქუდ|წინდ|შარფ|ხელთათმან|პროდუქტ|product|price|ფას|რა ღირს|რამდენ/.test(msg),
      orderInquiry: /შეკვეთა.*გაკეთებ|შეკვეთა.*აქვს|შეკვეთა.*ჰქონდ|გაგზავნეთ|გაუგზავნეთ|გაიგზავნა|order.*status|my order|ჩემი შეკვეთა|შეკვეთის სტატუს|შეკვეთა.*შემოწმ|შეკვეთა.*სად არის|თრექინგ|tracking|\d{15}/.test(msg),
    };

    // Always load core files
    const instructions = loadContentFile('bot-instructions.md') || 'You are VENERA, a helpful assistant.';
    const toneStyle = loadContentFile('tone-style.md');

    // Conditionally load topic-specific files
    const imageHandling = hasImage ? loadContentFile('image-handling.md') : '';
    const productRecognition = (topics.product || hasImage) ? loadContentFile('product-recognition.md') : '';
    // ALWAYS load purchase-flow.md - needed throughout purchase conversation (has bank accounts, steps)
    const purchaseFlow = loadContentFile('purchase-flow.md');
    const deliveryCalculation = topics.delivery ? loadContentFile('delivery-calculation.md') : '';
    const contactPolicies = topics.contact ? loadContentFile('contact-policies.md') : '';
    const services = topics.services ? loadContentFile('services.md') : '';
    const faqs = loadContentFile('faqs.md'); // Keep FAQs - small and useful
    const delivery = topics.delivery ? loadContentFile('delivery-info.md') : '';
    const payment = (topics.payment || topics.purchase) ? loadContentFile('payment-info.md') : '';

    // Log which topics were detected
    const detectedTopics = Object.entries(topics).filter(([_, v]) => v).map(([k]) => k);
    console.log(`📚 Topics detected: ${detectedTopics.length > 0 ? detectedTopics.join(', ') : 'general'}, hasImage: ${hasImage}`);

    // Order lookup when customer asks about existing orders
    let orderContext = '';
    if (topics.orderInquiry) {
      console.log('🔍 Order inquiry detected, searching orders...');
      console.log('📝 User message:', userMessageText);
      const searchTerms = extractSearchTerms(userMessageText);
      console.log('🔎 Extracted search terms:', searchTerms);

      if (searchTerms.length > 0) {
        // Search for each extracted term
        const searchResults: string[] = [];
        for (const term of searchTerms.slice(0, 3)) { // Limit to 3 terms
          const result = await searchOrders(term);
          if (!result.includes('ვერ მოიძებნა')) {
            searchResults.push(result);
          }
        }
        if (searchResults.length > 0) {
          orderContext = `\n## 📦 ORDER LOOKUP RESULTS\nCustomer is asking about existing order(s). Here's what I found:\n\n${searchResults.join('\n\n---\n\n')}\n\nUse this information to help the customer. You can confirm order status, what was ordered, if it was shipped, etc.`;
          console.log(`✅ Found ${searchResults.length} order matches`);
        } else {
          orderContext = `\n## 📦 ORDER LOOKUP RESULTS\nCustomer asked about orders but no matches found for: ${searchTerms.join(', ')}\nAsk customer for more details: order number, name, or phone number to look up their order.`;
          console.log('❌ No orders found for search terms:', searchTerms);
        }
      } else {
        orderContext = `\n## 📦 ORDER INQUIRY DETECTED\nCustomer seems to be asking about an existing order but didn't provide specific details.\nAsk them for: order number (like #900032), name (სახელი), or phone number (ტელეფონი) to look up their order.`;
        console.log('⚠️ Order inquiry but no search terms extracted');
      }
    }

    // Build system prompt with only relevant context
    const systemPrompt = `${instructions}

${toneStyle ? `\n## TONE & STYLE GUIDELINES\n${toneStyle}` : ''}
${imageHandling ? `\n## IMAGE HANDLING\n${imageHandling}` : ''}
${productRecognition ? `\n## PRODUCT RECOGNITION\n${productRecognition}` : ''}
${purchaseFlow ? `\n## PURCHASE FLOW\n${purchaseFlow}` : ''}
${deliveryCalculation ? `\n## DELIVERY DATE CALCULATION\n${deliveryCalculation}` : ''}
${contactPolicies ? `\n## CONTACT & STORE POLICIES\n${contactPolicies}` : ''}
${services ? `\n## SERVICES\n${services}` : ''}
${faqs ? `\n## FREQUENTLY ASKED QUESTIONS\n${faqs}` : ''}
${delivery ? `\n## DELIVERY PRICING\n${delivery}` : ''}
${payment ? `\n## PAYMENT INFORMATION\n${payment}` : ''}
${orderContext}

## CRITICAL: ALWAYS SEND PRODUCT IMAGES
When you mention or discuss ANY product that has [HAS_IMAGE] marker, you MUST include this at the END of your response:
SEND_IMAGE: PRODUCT_ID

Example: If the catalog shows "შავი ბამბის მოკლე ქუდი (ID: 9016) [HAS_IMAGE]", end with:
SEND_IMAGE: 9016

IMPORTANT: Use the EXACT numeric ID shown in parentheses (ID: XXXX) from the product catalog!

NEVER skip the image command when discussing a product with an image!
NEVER mention "SEND_IMAGE" text to the customer - it's a hidden command.

## PRODUCT CATALOG (Filtered for this query)
${productContext}${productNote}

REMINDER: End your response with SEND_IMAGE: [product_id] for any product mentioned that has [HAS_IMAGE]!

## ⚠️ CRITICAL: ORDER CONFIRMATION RULES ⚠️
When confirming an order after payment is received:
1. NEVER make up order numbers like "900001", "900004" etc.
2. ALWAYS use the placeholder [ORDER_NUMBER] - the system will replace it automatically
3. ALWAYS include the ORDER_NOTIFICATION: block at the END of your response

**REQUIRED FORMAT for order confirmation:**
\`\`\`
მადლობა! შეკვეთა მიღებულია.

🎫 შეკვეთის ნომერი: [ORDER_NUMBER]

პროდუქტი: [product name]
ჯამი: [amount] ლარი
მისამართი: [address]

მალე დაგიკავშირდებით!

ORDER_NOTIFICATION:
Product: [Georgian product name]
Client Name: [customer name]
Telephone: [phone]
Address: [address]
Total: [amount] ლარი
\`\`\`

WITHOUT ORDER_NOTIFICATION: block, no order will be saved and no email will be sent!`.trim();

    // Prepare messages for OpenAI - trim history to reduce tokens
    const trimmedHistory = trimConversationHistory(conversationData.history);
    console.log(`📊 History: ${conversationData.history.length} messages -> ${trimmedHistory.length} after trim`);

    // Replace the last message in history with originalContent (has actual images, not placeholders)
    // This is critical for image recognition to work
    if (trimmedHistory.length > 0 && originalContent) {
      trimmedHistory[trimmedHistory.length - 1] = {
        ...trimmedHistory[trimmedHistory.length - 1],
        content: originalContent
      };
      console.log(`🖼️ Replaced last message with originalContent (has actual image data)`);
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...trimmedHistory
    ];

    // Using gpt-4o for ALL messages (better instruction following for ORDER_NOTIFICATION)
    const hasImages = Array.isArray(lastMessage.content) &&
                     lastMessage.content.some(c => c.type === 'image_url');
    const selectedModel = "gpt-4o"; // Always use gpt-4o for reliable ORDER_NOTIFICATION handling

    // Generate unique request ID for tracing duplicates
    const requestId = Math.random().toString(36).substring(2, 8);
    console.log(`🤖 [REQ:${requestId}] Using model: ${selectedModel} for message ${messageId}`);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const botResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    console.log(`✅ OpenAI response: "${botResponse.substring(0, 50)}..."`);

    // ==================== EXTRACT AND SEND IMAGES ====================

    // Parse response for SEND_IMAGE commands
    const { productIds, cleanResponse } = parseImageCommands(botResponse);

    // Send product images if requested
    if (productIds.length > 0) {
      console.log(`🖼️ Found ${productIds.length} image(s) to send:`, productIds);

      // Use already loaded products (from earlier) for image lookup
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

    // ==================== STEP 7: ORDER NOTIFICATION HANDLING ====================
    // When AI sends ORDER_NOTIFICATION, system automatically:
    // - Generates order number
    // - Updates Firestore database
    // - Sends email to orders.bebias@gmail.com
    // - Sends confirmation message to customer

    let finalResponse = cleanResponse;

    // DEBUG: Log ORDER_NOTIFICATION detection
    const hasOrderNotification = cleanResponse.includes('ORDER_NOTIFICATION');
    console.log(`🔍 [Step 7] ORDER_NOTIFICATION present in response: ${hasOrderNotification}`);
    if (hasOrderNotification) {
      const orderNotifIndex = cleanResponse.indexOf('ORDER_NOTIFICATION');
      const orderNotifBlock = cleanResponse.substring(orderNotifIndex, orderNotifIndex + 500);
      console.log(`🔍 [Step 7] ORDER_NOTIFICATION block (first 500 chars):`);
      console.log(orderNotifBlock);
      // Log field presence
      console.log(`🔍 [Step 7] Has "Product:": ${cleanResponse.includes('Product:')}`);
      console.log(`🔍 [Step 7] Has "Client Name:": ${cleanResponse.includes('Client Name:')}`);
      console.log(`🔍 [Step 7] Has "Telephone:": ${cleanResponse.includes('Telephone:')}`);
      console.log(`🔍 [Step 7] Has "Address:": ${cleanResponse.includes('Address:')}`);
      console.log(`🔍 [Step 7] Has "Total:": ${cleanResponse.includes('Total:')}`);
      console.log(`🔍 [Step 7] Has "ლარი": ${cleanResponse.includes('ლარი')}`);
    }

    const orderData = parseOrderNotification(cleanResponse);
    console.log(`🔍 [Step 7] parseOrderNotification returned: ${orderData ? 'ORDER DATA' : 'NULL'}`);

    // Check for duplicate order (same product + phone within 2 minutes)
    let isDuplicateOrder = false;
    let duplicateOrderNumber: string | null = null;
    if (orderData && conversationData.orders && conversationData.orders.length > 0) {
      const lastOrder = conversationData.orders[conversationData.orders.length - 1];
      const lastOrderTime = new Date(lastOrder.timestamp).getTime();
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;

      // Check if same product was ordered within last 2 minutes
      if (lastOrder.items === orderData.product && (now - lastOrderTime) < twoMinutes) {
        isDuplicateOrder = true;
        duplicateOrderNumber = lastOrder.orderNumber;
        console.log(`⚠️ [Step 7] Duplicate order detected (same product within 2 min): ${duplicateOrderNumber}`);
      }
    }

    if (orderData && !isDuplicateOrder) {
      console.log("📦 [Step 7] ORDER_NOTIFICATION detected, processing NEW order...");
      console.log("📦 [Step 7] Order data:", JSON.stringify(orderData));

      try {
        // ATOMIC RACE CONDITION FIX: Use Firestore create() to claim order creation slot
        // Lock by PHONE NUMBER (not sender ID) to catch duplicates across different FB sender IDs
        const minuteBucket = Math.floor(Date.now() / 60000);
        const phoneKey = orderData.telephone?.replace(/\D/g, '') || senderId; // Use phone, fallback to sender
        const orderLockRef = db.collection('orderCreationLocks').doc(`order_phone_${phoneKey}_${minuteBucket}`);
        let gotOrderLock = false;
        let existingOrderNumber: string | null = null;

        try {
          await orderLockRef.create({
            createdAt: new Date().toISOString(),
            senderId,
            product: orderData.product
          });
          gotOrderLock = true;
          console.log(`🔒 [Step 7] Acquired order creation lock for phone_${phoneKey}_${minuteBucket}`);
        } catch (lockError: any) {
          // Another request already has the lock - check for existing order from this minute
          if (lockError.code === 6 || lockError.message?.includes('ALREADY_EXISTS')) {
            console.log(`⏭️ [Step 7] Order creation lock exists - checking for order`);
            const freshConversation = await loadConversation(senderId);
            if (freshConversation.orders && freshConversation.orders.length > 0) {
              existingOrderNumber = freshConversation.orders[freshConversation.orders.length - 1].orderNumber;
              console.log(`✅ [Step 7] Found existing order: ${existingOrderNumber}`);
            }
          } else {
            throw lockError;
          }
        }

        if (existingOrderNumber) {
          // Use existing order number (race condition - another request created it)
          finalResponse = cleanResponse
            .replace(/ORDER_NOTIFICATION:[\s\S]*?Total:.*ლარი/gi, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          finalResponse = finalResponse.replace(/\[ORDER_NUMBER\]/g, existingOrderNumber);
          const freshConversation = await loadConversation(senderId);
          conversationData.orders = freshConversation.orders;
        } else if (gotOrderLock) {
          // We got the lock - create the order
          const orderNumber = await logOrder(orderData, 'messenger');
          console.log(`✅ [Step 7] Order logged: ${orderNumber}`);

          // CRITICAL: Update finalResponse FIRST before any other async operations
          // This ensures the message is correct even if email sending fails
          finalResponse = cleanResponse
            .replace(/ORDER_NOTIFICATION:[\s\S]*?Total:.*ლარი/gi, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          finalResponse = finalResponse.replace(/\[ORDER_NUMBER\]/g, orderNumber);
          console.log(`✅ [Step 7] Replaced [ORDER_NUMBER] with ${orderNumber}`);

          // Add order to conversation
          if (!conversationData.orders) conversationData.orders = [];
          conversationData.orders.push({
            orderNumber,
            timestamp: new Date().toISOString(),
            items: orderData.product
          });

          // Send email (non-blocking - don't let failure affect message)
          try {
            await sendOrderEmail(orderData, orderNumber);
            console.log(`📧 [Step 7] Email sent`);
          } catch (emailErr: any) {
            console.error(`⚠️ [Step 7] Email failed (order still valid): ${emailErr.message}`);
          }
        }
      } catch (err: any) {
        console.error("❌ [Step 7] Error:", err.message);
        console.error("❌ [Step 7] Full error:", err.stack || err);
      }
    } else if (orderData && isDuplicateOrder && duplicateOrderNumber) {
      console.log("⚠️ [Step 7] Duplicate order, using existing order number");
      // Use existing order number for the duplicate
      finalResponse = cleanResponse
        .replace(/ORDER_NOTIFICATION:[\s\S]*?Total:.*ლარი/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      finalResponse = finalResponse.replace(/\[ORDER_NUMBER\]/g, duplicateOrderNumber);
      console.log(`✅ [Step 7] Using existing order number: ${duplicateOrderNumber}`);
    }

    // ==================== SEND TEXT RESPONSE ====================

    // SAFETY: Always strip ORDER_NOTIFICATION and [ORDER_NUMBER] before sending
    // This is a fallback in case parsing failed but AI still included these
    if (finalResponse.includes('ORDER_NOTIFICATION') || finalResponse.includes('[ORDER_NUMBER]')) {
      console.log('⚠️ [Safety] Stripping unprocessed ORDER_NOTIFICATION/[ORDER_NUMBER] from response');
      finalResponse = finalResponse
        .replace(/ORDER_NOTIFICATION:[\s\S]*$/gi, '') // Remove ORDER_NOTIFICATION and everything after
        .replace(/\[ORDER_NUMBER\]/g, '[შეკვეთის ნომერი მალე]') // Replace with placeholder text
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    // Send response to Facebook
    await sendMessage(senderId, finalResponse);
    // Log bot response for Control Panel display
    await logMetaMessage(senderId, 'bot', finalResponse);

    // Send order confirmation as SECOND message if pending
    if (conversationData.pendingOrderConfirmation) {
      await sendMessage(senderId, conversationData.pendingOrderConfirmation);
      // Log order confirmation for Control Panel display
      await logMetaMessage(senderId, 'bot', conversationData.pendingOrderConfirmation);
      delete conversationData.pendingOrderConfirmation;
      console.log("✅ [Step 7] Order confirmation sent");
    }

    // Mark message as responded to prevent duplicates on retry
    if (messageId) {
      await db.collection('respondedMessages').doc(messageId).set({
        respondedAt: new Date().toISOString(),
        senderId: senderId
      });
      console.log(`✅ [QStash] Marked message ${messageId} as responded`);
    }

    // Add response to history (without SEND_IMAGE and ORDER_NOTIFICATION)
    conversationData.history.push({
      role: 'assistant',
      content: finalResponse,
      timestamp: new Date().toISOString()
    });

    // Save conversation
    await saveConversation(senderId, conversationData);

    const processingTime = Date.now() - startTime;
    console.log(`✅ [QStash] Message processed in ${processingTime}ms`);

    // Log successful processing
    await logQStashUsage(senderId, true);

    return NextResponse.json({
      success: true,
      processingTime
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ [QStash] Error processing message (${processingTime}ms):`, error);

    // Log failed processing
    if (userId) {
      await logQStashUsage(userId, false, error.message);
    }

    // Check if this is a non-retryable error (return 200 so QStash doesn't retry)
    // ALL 429 errors should NOT be retried - they just burn more money
    const is429Error = error?.status === 429 ||
                       error?.statusCode === 429 ||
                       String(error?.status) === '429' ||
                       error?.message?.includes('429');

    const isRateLimitError = error?.message?.toLowerCase().includes('rate limit') ||
                             error?.message?.toLowerCase().includes('quota') ||
                             error?.message?.toLowerCase().includes('exceeded') ||
                             error?.code === 'insufficient_quota' ||
                             error?.code === 'rate_limit_exceeded';

    const isAuthError = error?.code === 'invalid_api_key' ||
                        error?.status === 401 ||
                        error?.status === 403;

    const isNonRetryable = is429Error || isRateLimitError || isAuthError;

    console.log(`🔍 Error analysis: status=${error?.status}, code=${error?.code}, is429=${is429Error}, isRateLimit=${isRateLimitError}, isNonRetryable=${isNonRetryable}`);

    if (isNonRetryable) {
      console.log(`🛑 Non-retryable error detected, returning 200 to prevent QStash retries`);
      return NextResponse.json({
        success: false,
        error: error.message,
        nonRetryable: true
      }, { status: 200 }); // Return 200 so QStash doesn't retry
    }

    // For other errors, return 500 (QStash will retry)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Verify QStash signature for security
export const POST = verifySignatureAppRouter(handler);
