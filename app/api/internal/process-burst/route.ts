import { NextResponse } from "next/server";
import { shouldProcessNow, clearBurst } from "@/lib/cloudTasks";

export const dynamic = 'force-dynamic';

/**
 * Cloud Tasks callback endpoint for delayed message burst processing
 * Called after 10 seconds of no new messages from a user
 */
export async function POST(req: Request) {
  try {
    const { senderId } = await req.json();

    if (!senderId) {
      return NextResponse.json({ error: "senderId required" }, { status: 400 });
    }

    console.log(`⏱️ [Cloud Task Callback] Delayed response check for ${senderId}`);

    // Check if we should still process (task might be stale)
    const shouldProcess = await shouldProcessNow(senderId);

    if (!shouldProcess) {
      console.log(`⚠️ Processing conditions not met for ${senderId} - task may be stale`);
      return NextResponse.json({ status: "conditions_not_met" });
    }

    // Clear burst tracker
    await clearBurst(senderId);

    console.log(`✅ Burst period ended for ${senderId} - triggering processing`);

    // Trigger processing by calling messenger webhook
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
    console.error("❌ Error in Cloud Task handler:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
