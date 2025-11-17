import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

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
        // Give bot specific instructions for next response
        if (!instruction) {
          return NextResponse.json({ error: "Instruction is required" }, { status: 400 });
        }

        // Store instruction in conversation data
        conversation.botInstruction = instruction;
        conversation.botInstructionAt = new Date().toISOString();
        await kv.set(conversationKey, conversation, { ex: 60 * 60 * 24 * 30 });

        console.log(`✅ Bot instruction set for user ${userId}: "${instruction}"`);
        return NextResponse.json({ success: true, message: "Instruction saved" });

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
      messageCount: conversation.history?.length || 0
    });
  } catch (error: any) {
    console.error("❌ Error getting manual control status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
