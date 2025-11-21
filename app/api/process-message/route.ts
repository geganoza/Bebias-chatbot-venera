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

// ==================== SAFETY CONFIGURATION ====================
const SAFETY_LIMITS = {
  MAX_MESSAGES_PER_USER_PER_HOUR: 30,      // Max 30 messages per user per hour
  MAX_MESSAGES_PER_USER_PER_DAY: 100,      // Max 100 messages per user per day
  MAX_TOTAL_MESSAGES_PER_HOUR: 200,        // Max 200 total messages per hour (all users)
  CIRCUIT_BREAKER_THRESHOLD: 50,           // Circuit breaker trips after 50 messages in 10 min
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

    // Load ALL content files (instructions, FAQs, delivery info, etc.)
    const instructions = loadContentFile('bot-instructions.md') || 'You are VENERA, a helpful assistant.';
    const services = loadContentFile('services.md');
    const faqs = loadContentFile('faqs.md');
    const delivery = loadContentFile('delivery-info.md');
    const payment = loadContentFile('payment-info.md');

    // Build comprehensive system prompt with all context
    const systemPrompt = `${instructions}

${services ? `\n## SERVICES\n${services}` : ''}
${faqs ? `\n## FREQUENTLY ASKED QUESTIONS\n${faqs}` : ''}
${delivery ? `\n## DELIVERY INFORMATION\n${delivery}` : ''}
${payment ? `\n## PAYMENT INFORMATION\n${payment}` : ''}`.trim();

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationData.history
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

    // ==================== SEND TEXT RESPONSE ====================

    // Send clean response (without SEND_IMAGE commands) to Facebook
    await sendMessage(senderId, cleanResponse);

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

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Verify QStash signature for security
export const POST = verifySignatureAppRouter(handler);
