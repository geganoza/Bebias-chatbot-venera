import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { kv } from "@vercel/kv";

export const dynamic = 'force-dynamic';

/**
 * QStash callback endpoint for delayed message burst processing
 * Called after 3 seconds of no new messages from a user
 */
async function handler(req: Request) {
  try {
    const { senderId } = await req.json();

    if (!senderId) {
      return NextResponse.json({ error: "senderId required" }, { status: 400 });
    }

    console.log(`⏱️ [QStash Callback] Delayed response check for ${senderId}`);

    // Check if burst marker still exists
    const burstKey = `msg_burst:${senderId}`;

    interface BurstTracker {
      count: number;
      firstMessageTime: number;
      lastMessageTime: number;
    }

    const tracker = await kv.get<BurstTracker>(burstKey);

    if (!tracker) {
      console.log(`⚠️ No burst marker found for ${senderId} - may have already processed`);
      return NextResponse.json({ status: "no_burst" });
    }

    const timeSinceFirst = Date.now() - tracker.firstMessageTime;
    console.log(`📊 Burst status: ${tracker.count} messages, ${timeSinceFirst}ms since first`);

    // Check if enough time passed (10 seconds)
    if (timeSinceFirst < 10000) {
      console.log(`⏳ Only ${timeSinceFirst}ms passed - need 10 seconds`);
      return NextResponse.json({ status: "too_soon" });
    }

    // Clear burst marker
    await kv.del(burstKey);

    console.log(`✅ Burst period ended for ${senderId} - user messages in history ready to process`);

    // Trigger one final message to webhook to process accumulated history
    // This simulates receiving one more message which will trigger normal processing
    const webhookUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/messenger`
      : 'https://bebias-venera-chatbot.vercel.app/api/messenger';

    const triggerPayload = {
      object: 'page',
      entry: [{
        messaging: [{
          sender: { id: senderId },
          recipient: { id: 'page' },
          timestamp: Date.now(),
          message: {
            mid: `trigger_${Date.now()}`,
            text: '' // Empty text - will trigger processing of history
          },
          __trigger_only: true // Special flag - don't add this to history
        }]
      }]
    };

    console.log(`📤 Sending processing trigger for ${senderId}`);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(triggerPayload)
    });

    if (!response.ok) {
      console.error(`❌ Processing trigger failed: ${response.status}`);
      return NextResponse.json({ error: "trigger_failed" }, { status: 500 });
    }

    console.log(`✅ Processing triggered for ${senderId}`);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("❌ Error in delayed response handler:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Verify QStash signature for security
export const POST = verifySignatureAppRouter(handler);
