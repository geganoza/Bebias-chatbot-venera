import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// Helper functions for AI response generation
async function loadProducts(): Promise<any[]> {
  try {
    const file = path.join(process.cwd(), "data", "products.json");
    const txt = await fs.readFile(file, "utf8");
    return JSON.parse(txt);
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

function detectGeorgian(text: string) {
  return /[\u10A0-\u10FF]/.test(text);
}

// Parse SEND_IMAGE commands from response
function parseImageCommands(response: string): { productIds: string[]; cleanResponse: string } {
  console.log(`🔍 parseImageCommands called with response length: ${response.length}`);

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

// Send image via Facebook API
async function sendImage(recipientId: string, imageUrl: string) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

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
    } else {
      console.log("✅ Image sent successfully:", data);
    }

    return { success: response.ok, data };
  } catch (err) {
    console.error("❌ Error sending image:", err);
    return { success: false, error: err };
  }
}

// Generate AI response with operator instruction
async function generateInstructedResponse(
  operatorInstruction: string,
  conversationHistory: any[] = [],
  previousOrders: any[] = [],
  storeVisitCount: number = 0
): Promise<string> {
  try {
    const [products, content] = await Promise.all([
      loadProducts(),
      loadAllContent(),
    ]);

    // Detect language from instruction
    const isKa = detectGeorgian(operatorInstruction);

    // Build product catalog for AI context
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

    // Build system prompt
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

Respond in Georgian, concisely and clearly (max 200 words).`
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

Respond in English, concisely and clearly (max 200 words).`;

    // Build messages array with conversation history
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
    ];

    // Inject operator instruction as highest priority system message
    messages.push({
      role: "system",
      content: `**URGENT INSTRUCTION FROM HUMAN OPERATOR - HIGHEST PRIORITY:**\n\n${operatorInstruction}\n\n**Follow this instruction for your next response. This overrides any other guidance if there's a conflict.**`,
    });

    // Add a placeholder user message to trigger response
    const lastUserMessage = conversationHistory.filter(m => m.role === 'user').pop();
    const contextMessage = lastUserMessage
      ? lastUserMessage.content
      : "[Continue the conversation based on the operator's instruction]";

    messages.push({ role: "user", content: contextMessage });

    console.log(`🤖 Generating instructed AI response with ${conversationHistory.length} history messages`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    return completion.choices[0]?.message?.content || (isKa ? "ბოდიში, ვერ გავიგე." : "Sorry, I didn't understand that.");
  } catch (err) {
    console.error("❌ OpenAI API error in generateInstructedResponse:", err);
    return "Sorry, there was an error processing the instruction.";
  }
}

// Send message via Facebook API
async function sendMessageToUser(recipientId: string, text: string) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Facebook API error:", data);
      return { success: false, error: data };
    }

    console.log("✅ Manual message sent successfully");
    return { success: true, data };
  } catch (err) {
    console.error("❌ Error sending manual message:", err);
    return { success: false, error: err };
  }
}

// Log message to meta-messages for display
async function logMetaMessage(userId: string, senderId: string, senderType: 'user' | 'bot' | 'human', text: string) {
  try {
    if (!process.env.KV_REST_API_URL) {
      return;
    }

    const key = `meta-messages:${userId}`;
    const existing = await kv.get<{ userId: string; messages: any[] }>(key);

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId,
      senderType,
      text,
      timestamp: new Date().toISOString()
    };

    if (existing) {
      existing.messages.push(message);
      await kv.set(key, existing, { ex: 60 * 60 * 24 * 7 });
    } else {
      await kv.set(key, { userId, messages: [message] }, { ex: 60 * 60 * 24 * 7 });
    }
  } catch (err) {
    console.error("❌ Error logging meta message:", err);
  }
}

// POST /api/manual-control
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId, message, instruction } = body;

    console.log(`🎮 Manual control action: ${action} for user ${userId}`);

    // Get conversation data
    const conversationKey = `conversation:${userId}`;
    const conversation = await kv.get<any>(conversationKey);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    switch (action) {
      case "enable_manual_mode":
        // Enable manual mode - bot will not auto-respond
        conversation.manualMode = true;
        conversation.manualModeEnabledAt = new Date().toISOString();
        await kv.set(conversationKey, conversation, { ex: 60 * 60 * 24 * 30 });

        console.log(`✅ Manual mode ENABLED for user ${userId}`);
        return NextResponse.json({ success: true, manualMode: true });

      case "disable_manual_mode":
        // Disable manual mode - resume auto responses
        conversation.manualMode = false;
        conversation.manualModeDisabledAt = new Date().toISOString();
        await kv.set(conversationKey, conversation, { ex: 60 * 60 * 24 * 30 });

        console.log(`✅ Manual mode DISABLED for user ${userId}`);
        return NextResponse.json({ success: true, manualMode: false });

      case "send_direct_message":
        // Send message directly from human operator
        if (!message) {
          return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const directResult = await sendMessageToUser(userId, message);

        if (directResult.success) {
          // Log to meta-messages as human message
          await logMetaMessage(userId, 'HUMAN_OPERATOR', 'human', message);

          // Add to conversation history
          conversation.history.push({
            role: "assistant",
            content: `[HUMAN OPERATOR]: ${message}`
          });
          await kv.set(conversationKey, conversation, { ex: 60 * 60 * 24 * 30 });

          console.log(`✅ Direct message sent by human operator to user ${userId}`);
          return NextResponse.json({ success: true, message: "Message sent" });
        } else {
          return NextResponse.json({ error: "Failed to send message", details: directResult.error }, { status: 500 });
        }

      case "instruct_bot":
        // Give bot specific instructions and generate immediate response
        if (!instruction) {
          return NextResponse.json({ error: "Instruction is required" }, { status: 400 });
        }

        console.log(`📋 Bot instruction received for user ${userId}: "${instruction}"`);
        console.log(`🤖 Generating and sending immediate AI response...`);

        // Generate AI response with the operator instruction
        const aiResponse = await generateInstructedResponse(
          instruction,
          conversation.history || [],
          conversation.orders || [],
          conversation.storeVisitRequests || 0
        );

        console.log(`💬 AI Response generated: "${aiResponse.substring(0, 100)}..."`);

        // Parse image commands from response
        const { productIds, cleanResponse } = parseImageCommands(aiResponse);

        // Send the text response to the user (without SEND_IMAGE commands)
        const sendResult = await sendMessageToUser(userId, cleanResponse);

        if (sendResult.success) {
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
                await sendImage(userId, product.image);
                console.log(`✅ Sent image for ${productId}`);
              } else {
                console.warn(`⚠️ No valid image found for product ${productId}`);
              }
            }
          }

          // Log to meta-messages as bot message (with operator instruction tag)
          await logMetaMessage(userId, 'BOT_OPERATOR_INSTRUCTED', 'bot', cleanResponse);

          // Add to conversation history
          conversation.history.push({
            role: "assistant",
            content: `[BOT - OPERATOR INSTRUCTED]: ${cleanResponse}`
          });
          await kv.set(conversationKey, conversation, { ex: 60 * 60 * 24 * 30 });

          console.log(`✅ Bot instruction executed and response sent to user ${userId}`);
          return NextResponse.json({
            success: true,
            message: "Instruction executed and response sent",
            response: cleanResponse,
            imagesSent: productIds.length
          });
        } else {
          console.error(`❌ Failed to send instructed response to user ${userId}`);
          return NextResponse.json({
            error: "Failed to send instructed response",
            details: sendResult.error
          }, { status: 500 });
        }

      case "clear_instruction":
        // Clear bot instruction
        delete conversation.botInstruction;
        delete conversation.botInstructionAt;
        await kv.set(conversationKey, conversation, { ex: 60 * 60 * 24 * 30 });

        console.log(`✅ Bot instruction cleared for user ${userId}`);
        return NextResponse.json({ success: true, message: "Instruction cleared" });

      case "get_status":
        // Get current manual mode status
        return NextResponse.json({
          success: true,
          manualMode: conversation.manualMode || false,
          botInstruction: conversation.botInstruction || null,
          lastActive: conversation.lastActive
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("❌ Manual control error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/manual-control?userId=xxx
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const conversationKey = `conversation:${userId}`;
    const conversation = await kv.get<any>(conversationKey);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      userId,
      manualMode: conversation.manualMode || false,
      botInstruction: conversation.botInstruction || null,
      lastActive: conversation.lastActive,
      messageCount: conversation.history?.length || 0,
      needsAttention: conversation.needsAttention || false,
      escalationReason: conversation.escalationReason || null,
      escalationDetails: conversation.escalationDetails || null,
      escalatedAt: conversation.escalatedAt || null
    });
  } catch (error: any) {
    console.error("❌ Error getting manual control status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
