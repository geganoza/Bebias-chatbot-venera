import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

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
        // Instagram sends messaging events
        if (entry.messaging) {
          for (const event of entry.messaging) {
            // Log each message event
            await logInstagramWebhook('message_event', {
              senderId: event.sender?.id,
              recipientId: event.recipient?.id,
              messageText: event.message?.text || '[attachment/media]',
              messageType: event.message?.text ? 'text' : 'attachment',
              timestamp: event.timestamp,
              raw: event
            }, 'processing');

            await handleInstagramMessage(event);

            // Log completion
            await logInstagramWebhook('message_processed', {
              senderId: event.sender?.id,
              messageText: event.message?.text || '[attachment/media]',
              status: 'Bot response sent'
            }, 'completed');
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

  // Handle different message types
  if (message.text) {
    // Regular text message
    await handleTextMessage(senderId, message.text);
  } else if (message.attachments) {
    // Image, video, or other attachment
    await handleAttachment(senderId, message.attachments);
  } else if (message.story_mention) {
    // User mentioned you in their story
    await handleStoryMention(senderId, message.story_mention);
  } else if (message.reply_to?.story) {
    // User replied to your story
    await handleStoryReply(senderId, message.text, message.reply_to.story);
  }
}

/**
 * Handle text messages
 */
async function handleTextMessage(senderId: string, text: string) {
  console.log(`💬 Text message from ${senderId}: "${text}"`);

  try {
    // TODO: Integrate with existing message processing logic
    // For now, send a simple response

    // Import the message processing logic from Messenger
    // You can reuse the same AI logic here

    // Temporary simple response
    const response = "გამარჯობა! მადლობა შეტყობინებისთვის. ჩვენი Instagram ჩატბოტი მალე იმუშავებს სრულად! 🤖";

    await sendInstagramMessage(senderId, { text: response });

  } catch (error) {
    console.error("❌ Error handling text message:", error);
  }
}

/**
 * Handle attachments (images, videos, etc.)
 */
async function handleAttachment(senderId: string, attachments: any[]) {
  console.log(`📎 Attachment from ${senderId}:`, attachments);

  try {
    for (const attachment of attachments) {
      if (attachment.type === "image") {
        // Handle image
        const imageUrl = attachment.payload?.url;
        console.log(`🖼️  Image received: ${imageUrl}`);

        // TODO: Implement image recognition (like Facebook ads)
        // Can use GPT-4o vision API here

        await sendInstagramMessage(senderId, {
          text: "მადლობა სურათისთვის! ვამუშავებთ თქვენს მოთხოვნას... 📸"
        });
      } else {
        // Other attachment types
        await sendInstagramMessage(senderId, {
          text: "მივიღეთ თქვენი ფაილი. დამატებითი ინფორმაციისთვის მოგვწერეთ ტექსტური შეტყობინება. 📄"
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
