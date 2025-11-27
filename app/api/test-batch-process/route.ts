import { NextResponse } from "next/server";
import { getMessageBatch, clearMessageBatch } from "@/lib/redis";

/**
 * Test endpoint for debugging Redis batch processing
 * This bypasses QStash verification to test the functionality directly
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { senderId } = body;

    console.log(`🧪 [TEST] Processing batch for ${senderId}`);

    // Get messages from Redis
    const messages = await getMessageBatch(senderId);

    console.log(`🧪 [TEST] Found ${messages.length} messages in batch`);

    if (messages.length === 0) {
      return NextResponse.json({
        status: 'no_messages',
        senderId
      });
    }

    // Return the messages found
    return NextResponse.json({
      status: 'ok',
      senderId,
      messageCount: messages.length,
      messages: messages.map(m => ({
        text: m.text,
        timestamp: m.timestamp
      }))
    });
  } catch (error: any) {
    console.error(`❌ [TEST] Error:`, error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Test batch process endpoint - use POST with {senderId}'
  });
}