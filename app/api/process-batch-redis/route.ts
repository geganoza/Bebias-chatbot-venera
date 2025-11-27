import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { getMessageBatch, clearMessageBatch } from "@/lib/redis";
import {
  loadConversation,
  saveConversation,
  getAIResponse,
  sendMessage,
  facebookImageToBase64,
  type MessageContent,
  type ConversationData,
} from "@/lib/bot-core";

/**
 * Process batched messages from Redis
 * This endpoint processes multiple messages that were batched together
 */
async function handler(req: Request) {
  const body = await req.json();
  const { senderId, batchKey } = body;

  const processingId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`🔄 [REDIS BATCH] Processing batched messages for user ${senderId} - ID: ${processingId}`);

  try {
    // CRITICAL: Acquire a processing lock to prevent multiple batch processors
    // This prevents race conditions where multiple processors run for the same user
    const lockKey = `batch_processing_${senderId}`;
    const lockExpiry = Date.now() + 30000; // 30 second lock expiry

    // Try to acquire lock in Redis
    const { Redis } = require('@upstash/redis');
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

    if (!url || !token) {
      console.warn('⚠️ [REDIS BATCH] Redis not configured, cannot acquire lock');
      return NextResponse.json({ status: 'redis_not_configured' });
    }

    const redis = new Redis({ url, token });

    // Use SET NX (set if not exists) with expiry
    const lockAcquired = await redis.set(lockKey, processingId, {
      nx: true,  // Only set if doesn't exist
      px: 30000  // Expire after 30 seconds
    });

    if (!lockAcquired) {
      console.log(`⏭️ [REDIS BATCH] Another processor is already handling user ${senderId}, skipping`);
      return NextResponse.json({ status: 'already_processing' });
    }

    console.log(`🔐 [REDIS BATCH] Lock acquired for ${senderId} - Processing ID: ${processingId}`);

    // Get all messages from Redis batch
    const messages = await getMessageBatch(senderId);

    if (messages.length === 0) {
      console.log(`⚠️ [REDIS BATCH] No messages found for ${senderId}`);

      // Release the lock since we're not processing anything
      try {
        await redis.del(lockKey);
        console.log(`🔓 [REDIS BATCH] Lock released (no messages) for ${senderId}`);
      } catch (lockError) {
        console.error(`⚠️ [REDIS BATCH] Failed to release lock:`, lockError);
      }

      return NextResponse.json({ status: 'no_messages' });
    }

    console.log(`📦 [REDIS BATCH] Found ${messages.length} messages to process`);

    // Check if user is still sending messages (within last 1.5 seconds)
    const lastMessage = messages[messages.length - 1];
    const timeSinceLastMessage = Date.now() - lastMessage.timestamp;

    if (lastMessage && timeSinceLastMessage < 1500) {
      console.log(`⏳ [REDIS BATCH] Recent message detected (${timeSinceLastMessage}ms ago), waiting for more...`);

      // Release the lock before re-queueing (so the new processor can acquire it)
      try {
        await redis.del(lockKey);
        console.log(`🔓 [REDIS BATCH] Lock released before re-queue for ${senderId}`);
      } catch (lockError) {
        console.error(`⚠️ [REDIS BATCH] Failed to release lock before re-queue:`, lockError);
      }

      // Re-queue with the SAME conversation ID to ensure single processing
      const { Client: QStashClient } = await import("@upstash/qstash");
      const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });

      await qstash.publishJSON({
        url: 'https://bebias-venera-chatbot.vercel.app/api/process-batch-redis',
        body: { senderId, batchKey },
        delay: 2, // Wait 2 more seconds
        deduplicationId: `batch_${senderId}_conversation` // Use same conversation ID
      });

      return NextResponse.json({ status: 'waiting_for_more' });
    }

    // Load conversation from Firestore
    const conversationData = await loadConversation(senderId);

    // Build the combined message content
    let userContent: MessageContent = "";
    const contentParts: ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[] = [];

    // Combine all text messages
    const combinedText = messages
      .map(m => m.text)
      .filter(Boolean)
      .join(' ');

    if (combinedText) {
      contentParts.push({ type: "text", text: combinedText });
    }

    // Process all attachments
    const allAttachments = messages.flatMap(m => m.attachments || []);

    for (const attachment of allAttachments) {
      if (attachment.type === "image" && attachment.url) {
        console.log(`🖼️ Processing image attachment: ${attachment.url}`);

        // Convert Facebook image to base64 for OpenAI
        const base64Image = await facebookImageToBase64(attachment.url);

        if (base64Image) {
          contentParts.push({ type: "image_url", image_url: { url: base64Image } });
          console.log(`✅ Image converted and added to message`);
        } else {
          console.warn(`⚠️ Failed to convert image`);
          if (!combinedText) {
            contentParts.push({ type: "text", text: "[User sent an image]" });
          }
        }
      }
    }

    // Set userContent based on content parts
    if (contentParts.length === 1 && contentParts[0].type === "text") {
      userContent = contentParts[0].text;
    } else if (contentParts.length > 0) {
      userContent = contentParts;
    } else {
      userContent = combinedText || "[No text content]";
    }

    console.log(`💬 [REDIS BATCH] Combined text: "${combinedText.substring(0, 100)}..."`);
    console.log(`📎 [REDIS BATCH] Total attachments: ${allAttachments.length}`);

    // Process with actual AI logic using the bot-core functions
    const response = await getAIResponse(
      userContent,
      conversationData.history,
      conversationData.orders || [],
      conversationData.storeVisitCount || 0,
      conversationData.operatorInstruction
    );

    // Extract and send any images mentioned in the response
    const imageMatch = response.match(/SEND_IMAGE:\s*([^\s]+)/);
    if (imageMatch) {
      const productId = imageMatch[1];
      const responseWithoutImages = response.replace(/SEND_IMAGE:\s*[^\s]+/g, '').trim();

      // Send text response first
      await sendMessage(senderId, responseWithoutImages);

      // Then send the image
      console.log(`🖼️ Sending product image for ID: ${productId}`);
      // Note: You'll need to implement sendProductImage function or import it
      // For now, we'll just log it
      console.log(`TODO: Send product image ${productId} to ${senderId}`);
    } else {
      // Send response without images
      await sendMessage(senderId, response);
    }

    // Update conversation history
    conversationData.history.push(
      { role: "user", content: userContent },
      { role: "assistant", content: response }
    );

    // Keep only last 20 exchanges (40 messages)
    if (conversationData.history.length > 40) {
      conversationData.history = conversationData.history.slice(-40);
    }

    // Save updated conversation
    await saveConversation(conversationData);

    // Clear the Redis batch
    await clearMessageBatch(senderId);

    // Release the processing lock
    try {
      await redis.del(lockKey);
      console.log(`🔓 [REDIS BATCH] Lock released for ${senderId}`);
    } catch (lockError) {
      console.error(`⚠️ [REDIS BATCH] Failed to release lock:`, lockError);
    }

    console.log(`✅ [REDIS BATCH] Successfully processed ${messages.length} messages for ${senderId} - ID: ${processingId}`);

    return NextResponse.json({
      status: 'processed',
      messageCount: messages.length,
      responseLength: response.length
    });

  } catch (error: any) {
    console.error(`❌ [REDIS BATCH] Error processing batch for ${senderId}:`, error);

    // Clear the batch to prevent stuck messages
    await clearMessageBatch(senderId);

    // Try to release the lock on error
    try {
      const { Redis } = require('@upstash/redis');
      const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
      const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
      if (url && token) {
        const redis = new Redis({ url, token });
        await redis.del(`batch_processing_${senderId}`);
        console.log(`🔓 [REDIS BATCH] Lock released after error for ${senderId}`);
      }
    } catch (lockError) {
      console.error(`⚠️ [REDIS BATCH] Failed to release lock after error:`, lockError);
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Export with QStash verification
// Temporarily add logging to debug verification issues
const wrappedHandler = async (req: Request) => {
  console.log(`🔐 [REDIS BATCH] Attempting QStash verification`);

  try {
    // Try to verify the signature
    const verifiedHandler = verifySignatureAppRouter(handler);
    return await verifiedHandler(req);
  } catch (error: any) {
    console.error(`❌ [REDIS BATCH] QStash verification failed:`, error.message);

    // For debugging: if verification fails, check if this is from QStash
    const headers = Object.fromEntries(req.headers.entries());
    const hasQstashHeaders = headers['upstash-signature'] || headers['upstash-forward-signature'];

    if (hasQstashHeaders) {
      console.log(`⚠️ [REDIS BATCH] Request has QStash headers but verification failed`);
      // DO NOT process if verification fails - this causes duplicate processing!
      return NextResponse.json(
        { error: 'QStash signature verification failed' },
        { status: 401 }
      );
    }

    throw error;
  }
};

export const POST = wrappedHandler;