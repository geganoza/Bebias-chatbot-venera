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
import { logOrder } from "@/lib/orderLoggerWithFirestore";
import { sendOrderEmail } from "@/lib/sendOrderEmail";
import { db } from "@/lib/firestore";

/**
 * Parse order confirmation from Georgian format
 * Detects order confirmations by looking for:
 * - "შეკვეთა მიღებულია" + order number placeholder
 * - Emoji-prefixed fields: 👤, 📞, 📍, 📦, 💰
 */
function parseGeorgianOrderConfirmation(text: string): {
  product: string;
  quantity: string;
  clientName: string;
  telephone: string;
  address: string;
  total: string;
  needsOrderNumber: boolean;
} | null {
  console.log(`🔍 [REDIS BATCH] parseGeorgianOrderConfirmation called, text length: ${text.length}`);
  console.log(`🔍 [REDIS BATCH] Text preview: ${text.substring(0, 200)}`);

  // Check for order confirmation indicator
  const hasOrderConfirmation = text.includes('შეკვეთა მიღებულია');
  if (!hasOrderConfirmation) {
    console.log('❌ [REDIS BATCH] No "შეკვეთა მიღებულია" found');
    return null;
  }

  // Check for order number placeholder
  const hasOrderNumberPlaceholder =
    text.includes('[ORDER_NUMBER]') ||
    text.includes('[შეკვეთის ნომერი მალე]') ||
    text.includes('შეკვეთის ნომერი:') ||
    text.includes('🎫');

  if (!hasOrderNumberPlaceholder) {
    console.log('❌ [REDIS BATCH] No order number placeholder found');
    return null;
  }

  console.log('✅ [REDIS BATCH] Order confirmation pattern detected');

  // Extract fields using emoji prefixes
  const nameMatch = text.match(/👤[^:]*:\s*(.+?)(?=[\r\n]|📞|📍|📦|💰|🎫|$)/);
  const phoneMatch = text.match(/📞[^:]*:\s*(.+?)(?=[\r\n]|👤|📍|📦|💰|🎫|$)/);
  const addressMatch = text.match(/📍[^:]*:\s*(.+?)(?=[\r\n]|👤|📞|📦|💰|🎫|$)/);
  const productMatch = text.match(/📦[^:]*:\s*(.+?)(?=[\r\n]|👤|📞|📍|💰|🎫|$)/);
  const totalMatch = text.match(/💰[^:]*:\s*(.+?)(?=[\r\n]|👤|📞|📍|📦|🎫|$)/);

  console.log(`🔍 [REDIS BATCH] Field extraction results:`);
  console.log(`   👤 Name: ${nameMatch ? 'FOUND - ' + nameMatch[1] : 'MISSING'}`);
  console.log(`   📞 Phone: ${phoneMatch ? 'FOUND - ' + phoneMatch[1] : 'MISSING'}`);
  console.log(`   📍 Address: ${addressMatch ? 'FOUND - ' + addressMatch[1].substring(0, 50) : 'MISSING'}`);
  console.log(`   📦 Product: ${productMatch ? 'FOUND - ' + productMatch[1].substring(0, 50) : 'MISSING'}`);
  console.log(`   💰 Total: ${totalMatch ? 'FOUND - ' + totalMatch[1] : 'MISSING'}`);

  if (nameMatch && phoneMatch && addressMatch && productMatch && totalMatch) {
    const result = {
      product: productMatch[1].trim(),
      quantity: '1',
      clientName: nameMatch[1].trim(),
      telephone: phoneMatch[1].trim().replace(/\s/g, ''),
      address: addressMatch[1].trim(),
      total: totalMatch[1].trim(),
      needsOrderNumber: true,
    };
    console.log('✅ [REDIS BATCH] Parsed Georgian order confirmation successfully');
    return result;
  }

  console.log('❌ [REDIS BATCH] Could not parse Georgian order - missing required fields');
  return null;
}

/**
 * Replace all order number placeholder variants with actual order number
 */
function replaceOrderNumberPlaceholders(text: string, orderNumber: string): string {
  return text
    .replace(/\[ORDER_NUMBER\]/g, orderNumber)
    .replace(/\[შეკვეთის ნომერი მალე\]/g, orderNumber);
}

/**
 * Check if text contains any order number placeholder
 */
function hasOrderNumberPlaceholder(text: string): boolean {
  return text.includes('[ORDER_NUMBER]') || text.includes('[შეკვეთის ნომერი მალე]');
}

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

    // Combine all text messages with better formatting
    // If multiple messages, join them more clearly
    const combinedText = messages
      .map(m => m.text)
      .filter(Boolean)
      .join('. '); // Use period-space to make it clearer these are complete thoughts

    if (combinedText) {
      contentParts.push({ type: "text", text: combinedText });
    }

    // Process all attachments
    const allAttachments = messages.flatMap(m => m.attachments || []);

    for (const attachment of allAttachments) {
      // CRITICAL FIX: Facebook sends attachment.payload.url, NOT attachment.url
      const imageUrl = attachment.payload?.url;

      if (attachment.type === "image" && imageUrl) {
        console.log(`🖼️ Processing image attachment: ${imageUrl}`);

        // Convert Facebook image to base64 for OpenAI
        const base64Image = await facebookImageToBase64(imageUrl);

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

    console.log(`💬 [REDIS BATCH] Combined text: "${combinedText}"`);
    console.log(`📎 [REDIS BATCH] Total attachments: ${allAttachments.length}`);
    console.log(`🔍 [REDIS BATCH] Message count: ${messages.length}`);
    console.log(`📝 [REDIS BATCH] Individual messages:`, messages.map(m => m.text));

    // Process with actual AI logic using the bot-core functions
    const response = await getAIResponse(
      userContent,
      conversationData.history,
      conversationData.orders || [],
      conversationData.storeVisitCount || 0,
      conversationData.operatorInstruction
    );

    // Parse and handle SEND_IMAGE commands
    const imageRegex = /SEND_IMAGE:\s*(.+?)(?:\n|$)/gi;
    const imageMatches = [...response.matchAll(imageRegex)];
    const productIds = imageMatches.map(match => match[1].trim());
    const cleanResponse = response.replace(imageRegex, '').trim();

    console.log(`[REDIS BATCH] Found ${productIds.length} image command(s)`);

    // DON'T send message yet - need to process orders first and replace [ORDER_NUMBER]!
    // Message will be sent after order processing

    // Send product images if requested
    if (productIds.length > 0) {
      console.log(`🖼️ [REDIS BATCH] Sending ${productIds.length} product image(s):`, productIds);

      // Load products for image lookup
      const { loadProducts } = await import('@/lib/bot-core');
      const allProducts = await loadProducts();
      const productMap = new Map(allProducts.map((p: any) => [p.id, p]));

      for (const productId of productIds) {
        const product = productMap.get(productId);
        if (product && product.image &&
            product.image !== "IMAGE_URL_HERE" &&
            !product.image.includes('facebook.com') &&
            product.image.startsWith('http')) {

          // Send image using Facebook Send API
          const imageUrl = `https://graph.facebook.com/v21.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`;
          const imageResponse = await fetch(imageUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: senderId },
              message: {
                attachment: {
                  type: 'image',
                  payload: {
                    url: product.image,
                    is_reusable: true
                  }
                }
              },
            }),
          });

          if (imageResponse.ok) {
            console.log(`✅ [REDIS BATCH] Sent image for ${productId}`);
          } else {
            const error = await imageResponse.json();
            console.error(`❌ [REDIS BATCH] Failed to send image for ${productId}:`, error);
          }
        } else {
          console.warn(`⚠️ [REDIS BATCH] No valid image found for product ${productId}`);
        }
      }
    }

    // ==================== ORDER PROCESSING ====================
    // CRITICAL: Must process orders and replace [ORDER_NUMBER] before saving to history!

    let finalResponse = cleanResponse;

    console.log(`🔍 [REDIS BATCH ORDER] Checking for order confirmation in response`);
    const orderData = parseGeorgianOrderConfirmation(cleanResponse);

    if (orderData) {
      console.log("📦 [REDIS BATCH ORDER] ORDER DETECTED! Processing order...");
      console.log("📦 [REDIS BATCH ORDER] Order data:", JSON.stringify(orderData));

      // Check for duplicate order (same product + phone within 2 minutes)
      let isDuplicateOrder = false;
      let duplicateOrderNumber: string | null = null;

      if (conversationData.orders && conversationData.orders.length > 0) {
        const lastOrder = conversationData.orders[conversationData.orders.length - 1];
        const lastOrderTime = new Date(lastOrder.timestamp).getTime();
        const now = Date.now();
        const twoMinutes = 2 * 60 * 1000;

        if (lastOrder.items === orderData.product && (now - lastOrderTime) < twoMinutes) {
          isDuplicateOrder = true;
          duplicateOrderNumber = lastOrder.orderNumber;
          console.log(`⚠️ [REDIS BATCH ORDER] Duplicate order detected: ${duplicateOrderNumber}`);
        }
      }

      if (!isDuplicateOrder) {
        try {
          // ATOMIC RACE CONDITION FIX: Use Firestore create() to claim order creation slot
          const minuteBucket = Math.floor(Date.now() / 60000);
          const phoneKey = orderData.telephone?.replace(/\D/g, '') || senderId;
          const orderLockRef = db.collection('orderCreationLocks').doc(`order_phone_${phoneKey}_${minuteBucket}`);
          let gotOrderLock = false;
          let existingOrderNumber: string | null = null;

          try {
            await orderLockRef.create({
              createdAt: new Date().toISOString(),
              senderId,
              product: orderData.product
            });
            gotOrderLock = true;
            console.log(`🔒 [REDIS BATCH ORDER] Acquired order creation lock`);
          } catch (lockError: any) {
            // Another request already has the lock - check for existing order
            if (lockError.code === 6 || lockError.message?.includes('ALREADY_EXISTS')) {
              console.log(`⏭️ [REDIS BATCH ORDER] Order lock exists - checking for existing order`);
              const freshConversation = await loadConversation(senderId);
              if (freshConversation.orders && freshConversation.orders.length > 0) {
                existingOrderNumber = freshConversation.orders[freshConversation.orders.length - 1].orderNumber;
                console.log(`✅ [REDIS BATCH ORDER] Found existing order: ${existingOrderNumber}`);
              }
            } else {
              throw lockError;
            }
          }

          if (existingOrderNumber) {
            // Use existing order number (race condition - another request created it)
            finalResponse = replaceOrderNumberPlaceholders(cleanResponse, existingOrderNumber);
            const freshConversation = await loadConversation(senderId);
            conversationData.orders = freshConversation.orders;
            console.log(`✅ [REDIS BATCH ORDER] Used existing order number: ${existingOrderNumber}`);
          } else if (gotOrderLock) {
            // We got the lock - create the order
            const orderNumber = await logOrder(orderData, 'messenger');
            console.log(`✅ [REDIS BATCH ORDER] Order logged: ${orderNumber}`);

            // Replace order number placeholder with actual order number
            finalResponse = replaceOrderNumberPlaceholders(cleanResponse, orderNumber);
            console.log(`✅ [REDIS BATCH ORDER] Replaced [ORDER_NUMBER] with ${orderNumber}`);

            // Add order to conversation
            if (!conversationData.orders) conversationData.orders = [];
            conversationData.orders.push({
              orderNumber,
              timestamp: new Date().toISOString(),
              items: orderData.product
            });

            // Send email (non-blocking - don't let failure affect message)
            try {
              await sendOrderEmail(orderData, orderNumber);
              console.log(`📧 [REDIS BATCH ORDER] Email sent`);
            } catch (emailErr: any) {
              console.error(`⚠️ [REDIS BATCH ORDER] Email failed (order still valid): ${emailErr.message}`);
            }
          }
        } catch (err: any) {
          console.error("❌ [REDIS BATCH ORDER] Error:", err.message);

          // FALLBACK: If lock mechanism failed, still try to create order
          if (orderData && hasOrderNumberPlaceholder(finalResponse)) {
            console.log("🔄 [REDIS BATCH ORDER] Attempting fallback order creation...");
            try {
              const orderNumber = await logOrder(orderData, 'messenger');
              finalResponse = replaceOrderNumberPlaceholders(cleanResponse, orderNumber);
              console.log(`✅ [REDIS BATCH ORDER] Fallback order created: ${orderNumber}`);

              if (!conversationData.orders) conversationData.orders = [];
              conversationData.orders.push({
                orderNumber,
                timestamp: new Date().toISOString(),
                items: orderData.product
              });
            } catch (fallbackErr: any) {
              console.error("❌ [REDIS BATCH ORDER] Fallback also failed:", fallbackErr.message);
            }
          }
        }
      } else if (duplicateOrderNumber) {
        // Duplicate order - use existing order number
        console.log("⚠️ [REDIS BATCH ORDER] Duplicate order, using existing number");
        finalResponse = replaceOrderNumberPlaceholders(cleanResponse, duplicateOrderNumber);
        console.log(`✅ [REDIS BATCH ORDER] Using existing order number: ${duplicateOrderNumber}`);
      }
    } else {
      console.log(`ℹ️ [REDIS BATCH ORDER] No order detected in response`);
    }

    // SAFETY: If any order placeholder still exists, it means order creation failed
    if (hasOrderNumberPlaceholder(finalResponse)) {
      console.log('⚠️ [REDIS BATCH ORDER] Order placeholder still exists - order creation may have failed');
    }

    // ==================== SEND TEXT RESPONSE ====================
    // Send the FINAL response (with order number replaced) to the user
    if (finalResponse) {
      await sendMessage(senderId, finalResponse);
      console.log(`✅ [REDIS BATCH] Sent message to user (length: ${finalResponse.length})`);
    }

    // Update conversation history with the FINAL response (with order number replaced)
    conversationData.history.push(
      { role: "user", content: userContent },
      { role: "assistant", content: finalResponse }
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
// IMPORTANT: QStash automatically adds signatures when publishing
export const POST = verifySignatureAppRouter(handler);