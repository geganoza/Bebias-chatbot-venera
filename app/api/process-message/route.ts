import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import OpenAI from "openai";
import { db } from "@/lib/firestore";
import fs from "fs";
import path from "path";

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
// AGGRESSIVE LIMITS to prevent cost overruns
const SAFETY_LIMITS = {
  MAX_MESSAGES_PER_USER_PER_HOUR: 20,      // Max 20 messages per user per hour (was 100)
  MAX_MESSAGES_PER_USER_PER_DAY: 50,       // Max 50 messages per user per day (was 300)
  MAX_TOTAL_MESSAGES_PER_HOUR: 100,        // Max 100 total messages per hour (all users, was 500)
  CIRCUIT_BREAKER_THRESHOLD: 30,           // Circuit breaker trips after 30 messages in 10 min (was 100)
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

async function sendMessage(recipientId: string, messageText: string) {
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

// ==================== MAIN HANDLER ====================

async function handler(req: Request) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    const body = await req.json();
    const { senderId, messageId } = body;
    userId = senderId;

    console.log(`🚀 [QStash] Processing message ${messageId} for user ${senderId}`);

    // NOTE: Deduplication is handled by QStash's built-in deduplicationId
    // (set in messenger/route.ts when publishing). No Firestore needed here.

    // ==================== SAFETY CHECKS ====================

    // 1. Check kill switch
    const killSwitch = await checkKillSwitch();
    if (killSwitch.active) {
      console.log(`🛑 Kill switch active: ${killSwitch.reason}`);
      await logQStashUsage(senderId, false, `Kill switch: ${killSwitch.reason}`);
      return NextResponse.json({
        status: 'blocked',
        reason: killSwitch.reason
      }, { status: 503 });
    }

    // 2. Check rate limits
    const rateLimit = await checkRateLimits(senderId);
    if (!rateLimit.allowed) {
      console.log(`⚠️ Rate limit exceeded: ${rateLimit.reason}`);
      await logQStashUsage(senderId, false, `Rate limit: ${rateLimit.reason}`);

      // Send user-friendly message
      await sendMessage(senderId,
        "თქვენ მიაღწიეთ შეტყობინებების ლიმიტს. გთხოვთ, სცადოთ მოგვიანებით. 🙏\n\n" +
        "You've reached the message limit. Please try again later. 🙏"
      );

      return NextResponse.json({
        status: 'rate_limited',
        reason: rateLimit.reason
      }, { status: 429 });
    }

    // 3. Check circuit breaker
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

    // ==================== GLOBAL BOT PAUSE CHECK ====================
    // Check if bot is globally paused (affects all conversations)
    let globalBotPaused = false;
    try {
      const settingsDoc = await db.collection('botSettings').doc('global').get();
      if (settingsDoc.exists) {
        globalBotPaused = settingsDoc.data()?.paused === true;
      }
    } catch (error) {
      console.warn(`⚠️ Could not check bot pause status - continuing anyway`);
    }

    if (globalBotPaused) {
      console.log(`⏸️ GLOBAL BOT PAUSE ACTIVE`);
      console.log(`   Message stored but bot is globally paused`);
      await logQStashUsage(senderId, true, 'Bot globally paused - skipped processing');
      return NextResponse.json({
        status: 'bot_paused',
        message: 'Bot is globally paused'
      });
    }

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
    const lastMessage = conversationData.history[conversationData.history.length - 1];

    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('No user message found to process');
    }

    console.log(`📝 Processing message: "${typeof lastMessage.content === 'string' ? lastMessage.content.substring(0, 50) : 'image'}"...`);

    // Extract user message text for product filtering
    let userMessageText = '';
    if (typeof lastMessage.content === 'string') {
      userMessageText = lastMessage.content;
    } else if (Array.isArray(lastMessage.content)) {
      const textPart = lastMessage.content.find(c => c.type === 'text');
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
    };

    // Always load core files
    const instructions = loadContentFile('bot-instructions.md') || 'You are VENERA, a helpful assistant.';
    const toneStyle = loadContentFile('tone-style.md');

    // Conditionally load topic-specific files
    const imageHandling = hasImage ? loadContentFile('image-handling.md') : '';
    const productRecognition = (topics.product || hasImage) ? loadContentFile('product-recognition.md') : '';
    const purchaseFlow = topics.purchase ? loadContentFile('purchase-flow.md') : '';
    const deliveryCalculation = topics.delivery ? loadContentFile('delivery-calculation.md') : '';
    const contactPolicies = topics.contact ? loadContentFile('contact-policies.md') : '';
    const services = topics.services ? loadContentFile('services.md') : '';
    const faqs = loadContentFile('faqs.md'); // Keep FAQs - small and useful
    const delivery = topics.delivery ? loadContentFile('delivery-info.md') : '';
    const payment = (topics.payment || topics.purchase) ? loadContentFile('payment-info.md') : '';

    // Log which topics were detected
    const detectedTopics = Object.entries(topics).filter(([_, v]) => v).map(([k]) => k);
    console.log(`📚 Topics detected: ${detectedTopics.length > 0 ? detectedTopics.join(', ') : 'general'}, hasImage: ${hasImage}`);

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

## CRITICAL: ALWAYS SEND PRODUCT IMAGES
When you mention or discuss ANY product that has [HAS_IMAGE] marker, you MUST include this at the END of your response:
SEND_IMAGE: PRODUCT_ID_HERE

Example: If discussing "მწვანე ბამბის მოკლე ქუდი (ID: H-SHORT-COT-GREEN)" which has [HAS_IMAGE], end with:
SEND_IMAGE: H-SHORT-COT-GREEN

NEVER skip the image command when discussing a product with an image!
NEVER mention "SEND_IMAGE" text to the customer - it's a hidden command.

## PRODUCT CATALOG (Filtered for this query)
${productContext}${productNote}

REMINDER: End your response with SEND_IMAGE: [product_id] for any product mentioned that has [HAS_IMAGE]!`.trim();

    // Prepare messages for OpenAI - trim history to reduce tokens
    const trimmedHistory = trimConversationHistory(conversationData.history);
    console.log(`📊 History: ${conversationData.history.length} messages -> ${trimmedHistory.length} after trim`);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...trimmedHistory
    ];

    // Determine model based on content
    const hasImages = Array.isArray(lastMessage.content) &&
                     lastMessage.content.some(c => c.type === 'image_url');
    const selectedModel = hasImages ? "gpt-4o" : "gpt-4-turbo";

    console.log(`🤖 Using model: ${selectedModel}`);

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

    // ==================== SEND TEXT RESPONSE ====================

    // Send clean response (without SEND_IMAGE commands) to Facebook
    await sendMessage(senderId, cleanResponse);

    // Mark message as responded to prevent duplicates on retry
    if (messageId) {
      await db.collection('respondedMessages').doc(messageId).set({
        respondedAt: new Date().toISOString(),
        senderId: senderId
      });
      console.log(`✅ [QStash] Marked message ${messageId} as responded`);
    }

    // Add CLEAN response to history (without SEND_IMAGE commands)
    conversationData.history.push({
      role: 'assistant',
      content: cleanResponse,
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
