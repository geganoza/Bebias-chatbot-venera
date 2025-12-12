import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { addMessageToBatch } from "@/lib/redis";
import { Client as QStashClient } from "@upstash/qstash";

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// Use same content path as test bot
const TEST_CONTENT_PATH = "test-bot/data/content";

/**
 * Load content file (same as process-test)
 */
function loadTestContent(filename: string): string {
  try {
    const filePath = path.join(process.cwd(), TEST_CONTENT_PATH, filename);
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`[IG] Error loading ${filename}:`, error);
    return "";
  }
}

/**
 * Load ALL content files (same as process-test)
 */
function loadAllTestContent(): string {
  const files = [
    "bot-instructions-modular.md",
    "purchase-flow.md",
    "delivery-info.md",
    "payment-info.md",
    "tone-style.md",
    "faqs.md",
  ];

  const contents: string[] = [];
  for (const file of files) {
    const content = loadTestContent(file);
    if (content) {
      contents.push(`\n--- ${file} ---\n${content}`);
    }
  }
  return contents.join("\n");
}

/**
 * Load products from Firestore (same as process-test)
 */
async function loadProducts(): Promise<any[]> {
  try {
    const snapshot = await db.collection("products").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("[IG] Error loading products:", error);
    return [];
  }
}

/**
 * Generate AI response using same logic as process-test
 */
async function generateAIResponse(userMessage: string, userId: string): Promise<string> {
  try {
    // Get conversation history from Firestore
    const igUserId = userId.startsWith('IG_') ? userId : `IG_${userId}`;
    const docRef = db.collection('metaMessages').doc(igUserId);
    const doc = await docRef.get();

    // Load system content (same as test bot)
    const systemContent = loadAllTestContent();

    // Load products
    const products = await loadProducts();
    const productList = products
      .filter((p: any) => (p.stock_qty || 0) > 0)
      .map((p: any) => `- ${p.name}: ${p.price}₾ (მარაგშია: ${p.stock_qty})`)
      .join("\n");

    // Build system prompt (same as test bot)
    const systemPrompt = `${systemContent}

--- AVAILABLE PRODUCTS ---
${productList}

IMPORTANT: Respond in the SAME LANGUAGE as the user's message.
CURRENT TIME: ${new Date().toISOString()}
`;

    // Build messages
    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    // Add conversation history if exists
    if (doc.exists) {
      const data = doc.data();
      const history = data?.messages || [];
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        if (msg.senderType === 'user') {
          messages.push({ role: 'user', content: msg.text });
        } else if (msg.senderType === 'bot') {
          const cleanText = msg.text.replace(/^\[Response pending.*?\]\s*/, '');
          messages.push({ role: 'assistant', content: cleanText });
        }
      }
    }

    messages.push({ role: 'user', content: userMessage });

    console.log(`🤖 [IG] Generating AI response for: "${userMessage}"`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || 'მადლობა შეტყობინებისთვის!';
    console.log(`✅ [IG] AI response: "${response.substring(0, 100)}..."`);

    return response;
  } catch (error) {
    console.error('❌ [IG] Error generating AI response:', error);
    return 'გმადლობთ შეტყობინებისთვის! დამატებითი დახმარებისთვის დაგვიკავშირდით.';
  }
}

/**
 * Log Instagram webhook event to Firestore for viewing in control panel
 */
async function logInstagramWebhook(type: string, data: any, status: 'received' | 'processing' | 'completed' | 'error' = 'received') {
  try {
    await db.collection('instagram_webhooks').add({
      type,
      data,
      status,
      timestamp: new Date().toISOString(),
      createdAt: new Date()
    });
  } catch (error) {
    console.error("Failed to log Instagram webhook:", error);
  }
}

/**
 * Save Instagram message to metaMessages collection (appears in Control Panel)
 */
async function saveToControlPanel(userId: string, message: {
  id: string;
  senderId: string;
  senderType: 'user' | 'bot' | 'human';
  text: string;
  timestamp: string;
}) {
  try {
    // Use IG_ prefix to distinguish Instagram users from Facebook users
    const igUserId = userId.startsWith('IG_') ? userId : `IG_${userId}`;
    const docRef = db.collection('metaMessages').doc(igUserId);
    const doc = await docRef.get();

    if (doc.exists) {
      // Add to existing conversation
      const data = doc.data();
      const messages = data?.messages || [];
      messages.push(message);
      await docRef.update({ messages, updatedAt: new Date().toISOString() });
    } else {
      // Create new conversation
      await docRef.set({
        userId: igUserId,
        platform: 'instagram',
        messages: [message],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Update user profile for display in control panel
    await db.collection('userProfiles').doc(igUserId).set({
      name: `Instagram User`,
      profile_pic: null,
      platform: 'instagram',
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`✅ Message saved to Control Panel for ${igUserId}`);
  } catch (error) {
    console.error("Failed to save to Control Panel:", error);
  }
}

// Environment variables
const INSTAGRAM_PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || "";
const INSTAGRAM_VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || "ig_webhook_verify_token";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Instagram API version
const GRAPH_API_VERSION = "v18.0";

/**
 * GET - Webhook Verification
 * Facebook sends this request when setting up the webhook
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("🔍 Instagram webhook verification request:");
  console.log("  Mode:", mode);
  console.log("  Token received:", token);
  console.log("  Token expected:", INSTAGRAM_VERIFY_TOKEN);
  console.log("  Tokens match:", token === INSTAGRAM_VERIFY_TOKEN);
  console.log("  Challenge:", challenge);

  if (mode === "subscribe" && token === INSTAGRAM_VERIFY_TOKEN && challenge) {
    console.log("✅ Instagram webhook verified successfully!");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("❌ Instagram webhook verification failed");
  return NextResponse.json(
    { error: "Verification failed" },
    { status: 403 }
  );
}

/**
 * POST - Receive Instagram Messages
 * Facebook sends webhook events here
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("📨 Instagram webhook received:");
    console.log(JSON.stringify(body, null, 2));

    // Log the raw webhook for the control panel
    await logInstagramWebhook('webhook_received', body, 'received');

    // Verify this is an Instagram webhook
    if (body.object !== "instagram") {
      console.log("⚠️  Not an Instagram webhook, ignoring");
      await logInstagramWebhook('non_instagram', body, 'completed');
      return NextResponse.json({ status: "ok" });
    }

    // Process each entry
    if (body.entry) {
      for (const entry of body.entry) {
        // Instagram sends messaging events in two formats:
        // 1. Real-time messages: entry.messaging[]
        // 2. Test/subscription events: entry.changes[].value

        // Handle real-time messaging format
        if (entry.messaging) {
          for (const event of entry.messaging) {
            await logInstagramWebhook('message_event', {
              senderId: event.sender?.id,
              recipientId: event.recipient?.id,
              messageText: event.message?.text || '[attachment/media]',
              messageType: event.message?.text ? 'text' : 'attachment',
              timestamp: event.timestamp,
              raw: event
            }, 'processing');

            await handleInstagramMessage(event);

            await logInstagramWebhook('message_processed', {
              senderId: event.sender?.id,
              messageText: event.message?.text || '[attachment/media]',
              status: 'Bot response sent'
            }, 'completed');
          }
        }

        // Handle changes format (used by Meta's Test button)
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value) {
              const event = change.value;
              await logInstagramWebhook('message_event_changes', {
                senderId: event.sender?.id,
                recipientId: event.recipient?.id,
                messageText: event.message?.text || '[attachment/media]',
                messageType: event.message?.text ? 'text' : 'attachment',
                timestamp: event.timestamp,
                raw: event
              }, 'processing');

              await handleInstagramMessage(event);

              await logInstagramWebhook('message_processed_changes', {
                senderId: event.sender?.id,
                messageText: event.message?.text || '[attachment/media]',
                status: 'Bot response sent (from changes format)'
              }, 'completed');
            }
          }
        }
      }
    }

    // Always return 200 OK quickly to avoid timeout
    return NextResponse.json({ status: "ok" });

  } catch (error) {
    console.error("❌ Error processing Instagram webhook:", error);
    await logInstagramWebhook('error', { error: String(error) }, 'error');
    // Still return 200 to prevent Facebook from disabling webhook
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}

// Our Page's Instagram Business Account ID (bebias_handcrafted)
const PAGE_INSTAGRAM_ID = "17841424690552638";

/**
 * Handle different types of Instagram messages
 */
async function handleInstagramMessage(event: any) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const message = event.message;

  console.log("📱 Instagram event:");
  console.log("  Sender (IGSID):", senderId);
  console.log("  Recipient:", recipientId);
  console.log("  Message:", message);

  if (!senderId || !message) {
    console.log("⚠️  Missing sender or message, skipping");
    return;
  }

  // Echo detection: Skip messages from our own page (bot responding to itself)
  if (senderId === PAGE_INSTAGRAM_ID) {
    console.log("⚠️ Skipping echo message from page itself (senderId === PAGE_INSTAGRAM_ID)");
    return;
  }

  // Also skip if this is a message we sent (checking is_echo flag)
  if (message.is_echo) {
    console.log("⚠️ Skipping echo message (is_echo flag set)");
    return;
  }

  // Handle different message types
  if (message.text) {
    // Regular text message
    await handleTextMessage(senderId, message.text, message.mid);
  } else if (message.attachments) {
    // Image, video, or other attachment
    await handleAttachment(senderId, message.attachments, message.mid);
  } else if (message.story_mention) {
    // User mentioned you in their story
    await handleStoryMention(senderId, message.story_mention);
  } else if (message.reply_to?.story) {
    // User replied to your story
    await handleStoryReply(senderId, message.text, message.reply_to.story);
  }
}

/**
 * Handle text messages - uses Redis batching like Messenger
 */
async function handleTextMessage(senderId: string, text: string, messageId?: string) {
  console.log(`💬 [IG] Text message from ${senderId}: "${text}"`);

  // Use IG_ prefix for storage/batching to distinguish from Messenger users
  const igSenderId = `IG_${senderId}`;

  // Save user message to Control Panel
  try {
    await saveToControlPanel(senderId, {
      id: messageId || `ig_${Date.now()}_user`,
      senderId: senderId,
      senderType: 'user',
      text: text,
      timestamp: new Date().toISOString()
    });
    console.log(`✅ [IG] User message saved to Control Panel`);
  } catch (saveError) {
    console.error("❌ [IG] Error saving user message to Control Panel:", saveError);
  }

  // Add to Redis batch (same as Messenger)
  try {
    await addMessageToBatch(igSenderId, {
      messageId: messageId || `ig_${Date.now()}`,
      text: text,
      attachments: null,
      timestamp: Date.now(),
      platform: 'instagram',
      originalSenderId: senderId // Keep original for API calls
    });
    console.log(`✅ [IG] Message added to Redis batch for ${igSenderId}`);

    // Queue to QStash for processing (with delay for batching)
    const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });
    const batchWindow = Math.floor(Date.now() / 3000) * 3000;
    const conversationId = `batch_${igSenderId}_${batchWindow}`;

    // All Instagram users go through test processing (same as test users)
    const processingUrl = `${process.env.NEXT_PUBLIC_CHAT_API_BASE || 'https://bebias-venera-chatbot.vercel.app'}/api/process-test`;

    await qstash.publishJSON({
      url: processingUrl,
      body: { senderId: igSenderId, batchKey: conversationId },
      deduplicationId: conversationId,
      delay: 3, // 3 second delay for batching
    });

    console.log(`✅ [IG] Queued to QStash: ${conversationId}`);
  } catch (error) {
    console.error("❌ [IG] Error queueing message:", error);

    // Fallback: process directly if batching fails
    console.log(`⚠️ [IG] Falling back to direct processing`);
    const response = await generateAIResponse(text, senderId);

    try {
      await sendInstagramMessage(senderId, { text: response });
      await saveToControlPanel(senderId, {
        id: `ig_${Date.now()}_bot`,
        senderId: 'bot',
        senderType: 'bot',
        text: response,
        timestamp: new Date().toISOString()
      });
    } catch (sendError) {
      console.error("❌ [IG] Fallback send failed:", sendError);
    }
  }
}

/**
 * Handle attachments (images, videos, etc.)
 */
async function handleAttachment(senderId: string, attachments: any[], messageId?: string) {
  console.log(`📎 Attachment from ${senderId}:`, attachments);

  try {
    for (const attachment of attachments) {
      const attachmentType = attachment.type || 'file';
      const attachmentUrl = attachment.payload?.url || '';
      const messageText = `[${attachmentType.toUpperCase()}] ${attachmentUrl ? attachmentUrl.substring(0, 50) + '...' : 'Media attachment'}`;

      // Save user attachment to Control Panel
      try {
        await saveToControlPanel(senderId, {
          id: messageId || `ig_${Date.now()}_user_attachment`,
          senderId: senderId,
          senderType: 'user',
          text: messageText,
          timestamp: new Date().toISOString()
        });
        console.log(`✅ Attachment saved to Control Panel`);
      } catch (saveError) {
        console.error("❌ Error saving attachment to Control Panel:", saveError);
      }

      let response = "";
      if (attachment.type === "image") {
        const imageUrl = attachment.payload?.url;
        console.log(`🖼️  Image received: ${imageUrl}`);
        response = "მადლობა სურათისთვის! ვამუშავებთ თქვენს მოთხოვნას... 📸";
      } else {
        response = "მივიღეთ თქვენი ფაილი. დამატებითი ინფორმაციისთვის მოგვწერეთ ტექსტური შეტყობინება. 📄";
      }

      // Try to send response
      try {
        await sendInstagramMessage(senderId, { text: response });
        await saveToControlPanel(senderId, {
          id: `ig_${Date.now()}_bot`,
          senderId: 'bot',
          senderType: 'bot',
          text: response,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error("❌ Error sending Instagram message (token may be expired):", error);
        await saveToControlPanel(senderId, {
          id: `ig_${Date.now()}_bot`,
          senderId: 'bot',
          senderType: 'bot',
          text: `[Response pending - token refresh needed] ${response}`,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error("❌ Error handling attachment:", error);
  }
}

/**
 * Handle story mentions
 * When someone mentions your account in their Instagram story
 */
async function handleStoryMention(senderId: string, storyMention: any) {
  console.log(`📖 Story mention from ${senderId}:`, storyMention);

  try {
    // Send a thank you message
    await sendInstagramMessage(senderId, {
      text: "გმადლობთ რომ მოგვიხსენეთ თქვენს story-ში! 🙏❤️"
    });

    // TODO: Optionally, save story mentions to Firestore for marketing analytics
  } catch (error) {
    console.error("❌ Error handling story mention:", error);
  }
}

/**
 * Handle story replies
 * When someone replies to your Instagram story
 */
async function handleStoryReply(senderId: string, text: string, story: any) {
  console.log(`📱 Story reply from ${senderId}: "${text}"`, story);

  try {
    // Respond to the story reply
    await sendInstagramMessage(senderId, {
      text: `მადლობა რეაქციისთვის ჩვენს story-ზე! ${text ? '😊' : '❤️'}`
    });

    // If they included text, process it like a regular message
    if (text && text.length > 0) {
      await handleTextMessage(senderId, text);
    }
  } catch (error) {
    console.error("❌ Error handling story reply:", error);
  }
}

/**
 * Send message to Instagram user
 */
async function sendInstagramMessage(recipientId: string, message: any) {
  console.log(`📤 Sending Instagram message to ${recipientId}:`, message);

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${INSTAGRAM_PAGE_ACCESS_TOKEN}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: message
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Instagram API error:", data);
      throw new Error(`Instagram API error: ${JSON.stringify(data)}`);
    }

    console.log("✅ Instagram message sent successfully:", data);
    return data;

  } catch (error) {
    console.error("❌ Error sending Instagram message:", error);
    throw error;
  }
}

/**
 * Send image to Instagram user
 */
async function sendInstagramImage(recipientId: string, imageUrl: string) {
  console.log(`📤 Sending Instagram image to ${recipientId}: ${imageUrl}`);

  return await sendInstagramMessage(recipientId, {
    attachment: {
      type: "image",
      payload: {
        url: imageUrl,
        is_reusable: true
      }
    }
  });
}

/**
 * Send product template (generic template)
 */
async function sendInstagramProductCard(
  recipientId: string,
  product: {
    name: string;
    price: number;
    currency: string;
    image: string;
    url?: string;
  }
) {
  console.log(`📦 Sending Instagram product card to ${recipientId}:`, product);

  const buttons: any[] = [];

  if (product.url) {
    buttons.push({
      type: "web_url",
      url: product.url,
      title: "ნახე პროდუქტი"
    });
  }

  return await sendInstagramMessage(recipientId, {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [{
          title: product.name,
          image_url: product.image,
          subtitle: `${product.price} ${product.currency}`,
          buttons: buttons.length > 0 ? buttons : undefined
        }]
      }
    }
  });
}

/**
 * Get Instagram user profile
 */
async function getInstagramUserProfile(igsid: string) {
  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${igsid}?fields=name,profile_pic&access_token=${INSTAGRAM_PAGE_ACCESS_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Error fetching Instagram profile:", data);
      return null;
    }

    console.log("✅ Instagram profile:", data);
    return data;

  } catch (error) {
    console.error("❌ Error fetching Instagram profile:", error);
    return null;
  }
}

/**
 * Set Instagram ice breakers (quick reply buttons)
 * Call this once to set up the ice breakers
 *
 * NOTE: This is a utility function, not exported from route.
 * To use: Import this function from a separate utility file.
 */
async function setInstagramIceBreakers() {
  try {
    // Get Instagram account ID first
    const meUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/me?fields=instagram_business_account&access_token=${INSTAGRAM_PAGE_ACCESS_TOKEN}`;
    const meResponse = await fetch(meUrl);
    const meData = await meResponse.json();
    const instagramAccountId = meData.instagram_business_account?.id;

    if (!instagramAccountId) {
      throw new Error("Instagram account ID not found");
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramAccountId}/messenger_profile?access_token=${INSTAGRAM_PAGE_ACCESS_TOKEN}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ice_breakers: [
          {
            question: "🛍️ რა პროდუქცია გაქვთ?",
            payload: "GET_STARTED_PRODUCTS"
          },
          {
            question: "📦 როგორ შევუკვეთო?",
            payload: "HOW_TO_ORDER"
          },
          {
            question: "📍 სად მდებარეობთ?",
            payload: "LOCATION"
          },
          {
            question: "💬 ვისაუბროთ ადამიანთან",
            payload: "TALK_TO_HUMAN"
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Error setting ice breakers:", data);
      throw new Error(`Failed to set ice breakers: ${JSON.stringify(data)}`);
    }

    console.log("✅ Instagram ice breakers set successfully:", data);
    return data;

  } catch (error) {
    console.error("❌ Error setting Instagram ice breakers:", error);
    throw error;
  }
}

// Helper functions available internally to this route
// NOTE: Cannot export from Next.js route handlers
// If you need these elsewhere, move to lib/instagram.ts
