import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { getMessageBatch, clearMessageBatch } from "@/lib/redis";
import OpenAI from "openai";
import { db } from "@/lib/firestore";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

/**
 * Process batched messages from Redis
 * This is a NEW endpoint specifically for Redis-based message batching
 */
async function handler(req: Request) {
  const body = await req.json();
  const { senderId, batchKey } = body;

  console.log(`🔄 [REDIS BATCH] Processing batched messages for user ${senderId}`);

  try {
    // Get all messages from Redis batch
    const messages = await getMessageBatch(senderId);

    if (messages.length === 0) {
      console.log(`⚠️ [REDIS BATCH] No messages found for ${senderId}`);
      return NextResponse.json({ status: 'no_messages' });
    }

    console.log(`📦 [REDIS BATCH] Found ${messages.length} messages to process`);

    // Check if user sent more messages very recently (within last 500ms)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && Date.now() - lastMessage.timestamp < 500) {
      console.log(`⏳ [REDIS BATCH] Very recent message detected, waiting for more...`);

      // Re-queue with a shorter delay
      const { Client: QStashClient } = await import("@upstash/qstash");
      const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });

      await qstash.publishJSON({
        url: 'https://bebias-venera-chatbot.vercel.app/api/process-batch-redis',
        body: { senderId, batchKey },
        delay: 1, // Wait 1 more second
        deduplicationId: `retry_${senderId}_${Date.now()}`
      });

      return NextResponse.json({ status: 'waiting_for_more' });
    }

    // Combine all text messages
    const combinedText = messages
      .map(m => m.text)
      .filter(Boolean)
      .join(' ');

    // Collect all attachments
    const allAttachments = messages.flatMap(m => m.attachments || []);

    console.log(`💬 [REDIS BATCH] Combined text: "${combinedText.substring(0, 100)}..."`);
    console.log(`📎 [REDIS BATCH] Total attachments: ${allAttachments.length}`);

    // Load conversation from Firestore
    const docRef = db.collection('conversations').doc(senderId);
    const doc = await docRef.get();
    const conversationData = doc.exists ? doc.data() : { history: [] };

    // Process with existing AI logic
    // NOTE: This should use your existing getAIResponse function
    // For now, we'll do a simple implementation
    const response = await processWithAI(combinedText, allAttachments, conversationData.history);

    // Send response to user
    await sendMessage(senderId, response);

    // Update conversation history
    conversationData.history.push(
      { role: "user", content: combinedText },
      { role: "assistant", content: response }
    );

    // Save updated conversation
    await docRef.set({
      ...conversationData,
      lastActive: new Date().toISOString()
    });

    // Clear the Redis batch
    await clearMessageBatch(senderId);

    console.log(`✅ [REDIS BATCH] Successfully processed ${messages.length} messages for ${senderId}`);

    return NextResponse.json({
      status: 'processed',
      messageCount: messages.length,
      responseLength: response.length
    });

  } catch (error: any) {
    console.error(`❌ [REDIS BATCH] Error processing batch for ${senderId}:`, error);

    // Clear the batch to prevent stuck messages
    await clearMessageBatch(senderId);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Simple AI processing (replace with your actual implementation)
async function processWithAI(text: string, attachments: any[], history: any[]): Promise<string> {
  try {
    const hasImages = attachments.some(att => att.type === 'image');
    const model = hasImages ? 'gpt-4o' : 'gpt-4o';

    console.log(`🤖 [REDIS BATCH] Using model: ${model}`);

    const messages = [
      {
        role: "system" as const,
        content: "You are a helpful assistant for BEBIAS, a Georgian company selling handmade products."
      },
      ...history.slice(-10), // Last 10 messages for context
      {
        role: "user" as const,
        content: text
      }
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    return completion.choices[0]?.message?.content || "Sorry, I couldn't process your request.";
  } catch (error) {
    console.error(`❌ [REDIS BATCH] AI processing error:`, error);
    return "Sorry, there was an error processing your request. Please try again.";
  }
}

// Simple message sending (replace with your actual implementation)
async function sendMessage(recipientId: string, message: string): Promise<void> {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "";
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ [REDIS BATCH] Facebook API error:`, error);
    } else {
      console.log(`✅ [REDIS BATCH] Message sent to ${recipientId}`);
    }
  } catch (error) {
    console.error(`❌ [REDIS BATCH] Error sending message:`, error);
  }
}

// Export with QStash verification
export const POST = verifySignatureAppRouter(handler);