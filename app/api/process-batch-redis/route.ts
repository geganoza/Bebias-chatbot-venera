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

// ==================== WOLT API INTEGRATION ====================
const SHIPPING_MANAGER_URL = "https://shipping-manager-standalone.vercel.app";

interface WoltEstimateResponse {
  available: boolean;
  price?: number;
  currency?: string;
  eta_minutes?: number;
  provider?: string;
  formatted_address?: string;
  error?: string;
  error_code?: string;
}

interface WoltValidateResponse {
  valid: boolean;
  scheduledTime?: string;
  displayTime?: string;
  error?: string;
  error_code?: string;
}

/**
 * Call Wolt estimate API to get delivery price
 */
async function getWoltEstimate(address: string, city: string = "თბილისი"): Promise<WoltEstimateResponse> {
  try {
    console.log(`🚚 [WOLT] Getting estimate for address: ${address}`);
    const response = await fetch(`${SHIPPING_MANAGER_URL}/api/wolt/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, city }),
    });

    const data = await response.json();
    console.log(`🚚 [WOLT] Estimate response:`, data);
    return data;
  } catch (error: any) {
    console.error(`❌ [WOLT] Estimate error:`, error);
    return { available: false, error: "API error", error_code: "API_ERROR" };
  }
}

/**
 * Call Wolt validate-schedule API to check delivery time
 */
async function validateWoltSchedule(scheduledTime: string): Promise<WoltValidateResponse> {
  try {
    console.log(`🕐 [WOLT] Validating schedule: ${scheduledTime}`);
    const response = await fetch(`${SHIPPING_MANAGER_URL}/api/wolt/validate-schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledTime }),
    });

    const data = await response.json();
    console.log(`🕐 [WOLT] Validate response:`, data);
    return data;
  } catch (error: any) {
    console.error(`❌ [WOLT] Validate error:`, error);
    return { valid: false, error: "API error", error_code: "API_ERROR" };
  }
}

/**
 * Detect Wolt flow state from conversation history
 * Returns context to inject into the AI prompt
 */
async function detectWoltFlowAndGetContext(
  history: Array<{ role: string; content: any }>,
  currentMessage: string
): Promise<string | null> {
  // Look for Wolt selection in recent history (last 10 messages)
  const recentHistory = history.slice(-10);

  // Check if user selected Wolt (option 2) in recent messages
  let woltSelected = false;
  let woltAddressProvided = false;
  let woltAddress = "";
  let woltPriceShown = false;
  let woltTimeRequested = false;

  for (const msg of recentHistory) {
    const content = typeof msg.content === "string" ? msg.content :
      (Array.isArray(msg.content) ? msg.content.find((c: any) => c.type === "text")?.text || "" : "");

    // Check if bot offered Wolt option
    if (msg.role === "assistant" && content.includes("Wolt იმავე დღეს")) {
      woltSelected = false; // Reset - waiting for selection
    }

    // Check if user selected option 2 (Wolt)
    if (msg.role === "user" && /^2$|ვოლთ|wolt/i.test(content.trim())) {
      woltSelected = true;
    }

    // Check if bot asked for address
    if (msg.role === "assistant" && woltSelected && content.includes("მისამართი")) {
      woltAddressProvided = false; // Waiting for address
    }

    // Check if bot showed price (means address was already provided)
    if (msg.role === "assistant" && content.includes("მიტანის ფასი:") && content.includes("₾")) {
      woltPriceShown = true;
    }

    // Check if bot asked for time
    if (msg.role === "assistant" && content.includes("როდის გინდა მიიღო")) {
      woltTimeRequested = true;
    }
  }

  // Now analyze current message in context
  if (!woltSelected) {
    // Check if current message is selecting Wolt
    if (/^2$|ვოლთ|wolt/i.test(currentMessage.trim())) {
      console.log(`🚚 [WOLT FLOW] User selected Wolt delivery`);
      // No context needed - bot will ask for address
      return null;
    }
    return null;
  }

  // Wolt is selected - check what step we're at

  // Step 1: User might be providing address
  if (!woltPriceShown) {
    // Current message might be the address
    const possibleAddress = currentMessage.trim();

    // Skip if it looks like a number selection or very short
    if (possibleAddress.length >= 5 && !/^[0-9]$/.test(possibleAddress)) {
      console.log(`🚚 [WOLT FLOW] Detected possible address: ${possibleAddress}`);

      // Call Wolt estimate API
      const estimate = await getWoltEstimate(possibleAddress);

      if (estimate.available && estimate.price) {
        // Store the estimate in context for the bot
        return `[WOLT_PRICE: ${estimate.price}]\n[WOLT_ADDRESS: ${estimate.formatted_address || possibleAddress}]`;
      } else {
        return `[WOLT_UNAVAILABLE]\n[WOLT_ERROR: ${estimate.error || "მისამართი არ არის ხელმისაწვდომი"}]`;
      }
    }
  }

  // Step 2: User might be providing delivery time
  if (woltPriceShown && woltTimeRequested) {
    const possibleTime = currentMessage.trim().toLowerCase();

    // Parse time from Georgian/English
    let scheduledTime = "now";

    if (possibleTime === "ახლა" || possibleTime === "now" || possibleTime === "ახლავე") {
      scheduledTime = "now";
    } else {
      // Try to parse time like "ხვალ 15:00", "დღეს 16:00", "15:00", etc.
      const timeMatch = possibleTime.match(/(\d{1,2})[:\s]?(\d{2})?/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;

        // Determine date
        const now = new Date();
        const tbilisiOffset = 4 * 60; // GMT+4
        const localOffset = now.getTimezoneOffset();
        const tbilisiTime = new Date(now.getTime() + (tbilisiOffset + localOffset) * 60000);

        let targetDate = new Date(tbilisiTime);

        if (possibleTime.includes("ხვალ") || possibleTime.includes("tomorrow")) {
          targetDate.setDate(targetDate.getDate() + 1);
        }

        targetDate.setHours(hour, minute, 0, 0);

        // Format as ISO with Tbilisi timezone
        scheduledTime = targetDate.toISOString().replace("Z", "+04:00");
      }
    }

    console.log(`🕐 [WOLT FLOW] Validating time: ${scheduledTime}`);

    const validation = await validateWoltSchedule(scheduledTime);

    if (validation.valid) {
      return `[WOLT_TIME_VALID: ${validation.displayTime}]\n[WOLT_SCHEDULED: ${validation.scheduledTime}]`;
    } else {
      return `[WOLT_TIME_INVALID: ${validation.error || "არასწორი დრო"}]`;
    }
  }

  return null;
}

// ==================== END WOLT INTEGRATION ====================

/**
 * Parse order confirmation from Georgian format
 * Detects order confirmations by looking for:
 * - "შეკვეთა მიღებულია" + order number placeholder
 * - Emoji-prefixed fields: 👤, 📞, 📍, 📦, 💰
 * - Wolt-specific fields: 🚚 (delivery), ⏰ (time), WOLT_ORDER: true
 */
function parseGeorgianOrderConfirmation(text: string): {
  product: string;
  quantity: string;
  clientName: string;
  telephone: string;
  address: string;
  total: string;
  needsOrderNumber: boolean;
  // Wolt-specific fields (match OrderData interface)
  isWoltOrder?: boolean;
  deliveryPrice?: number;
  woltScheduledTime?: string;
  deliveryMethod?: 'wolt' | 'trackings_ge' | 'standard' | 'pickup';
} | null {
  console.log(`🔍 [REDIS BATCH] parseGeorgianOrderConfirmation called, text length: ${text.length}`);
  console.log(`🔍 [REDIS BATCH] Text preview: ${text.substring(0, 200)}`);

  // Check for order confirmation indicator (multiple possible phrases)
  const hasOrderConfirmation =
    text.includes('შეკვეთა მიღებულია') ||
    text.includes('შეკვეთა დადასტურებულია') ||
    text.includes('შეკვეთა მიღებული') ||
    text.includes('შეკვეთა დადასტურებული');
  if (!hasOrderConfirmation) {
    console.log('❌ [REDIS BATCH] No order confirmation phrase found');
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

  // Check if this is a Wolt order
  const isWoltOrder = text.includes('WOLT_ORDER: true') ||
                      text.includes('WOLT_ORDER:true') ||
                      (text.includes('🚚') && text.toLowerCase().includes('wolt'));

  console.log(`🚚 [REDIS BATCH] Is Wolt order: ${isWoltOrder}`);

  // Extract fields using emoji prefixes
  const nameMatch = text.match(/👤[^:]*:\s*(.+?)(?=[\r\n]|📞|📍|📦|💰|🎫|🚚|⏰|$)/);
  const phoneMatch = text.match(/📞[^:]*:\s*(.+?)(?=[\r\n]|👤|📍|📦|💰|🎫|🚚|⏰|$)/);
  const addressMatch = text.match(/📍[^:]*:\s*(.+?)(?=[\r\n]|👤|📞|📦|💰|🎫|🚚|⏰|$)/);
  const productMatch = text.match(/📦[^:]*:\s*(.+?)(?=[\r\n]|👤|📞|📍|💰|🎫|🚚|⏰|$)/);
  const totalMatch = text.match(/💰[^:]*:\s*(.+?)(?=[\r\n]|👤|📞|📍|📦|🎫|🚚|⏰|WOLT_ORDER|$)/);

  // Extract Wolt-specific fields
  let woltDeliveryPrice: number | undefined;
  let woltScheduledTime: string | undefined;

  if (isWoltOrder) {
    // Extract Wolt delivery price: "🚚 მიტანა: Wolt - 8.35₾" or "🚚 Wolt მიტანა: 8.35₾"
    const woltPriceMatch = text.match(/🚚[^:]*:.*?(\d+(?:\.\d+)?)\s*₾/);
    if (woltPriceMatch) {
      woltDeliveryPrice = parseFloat(woltPriceMatch[1]);
      console.log(`🚚 [REDIS BATCH] Wolt delivery price: ${woltDeliveryPrice}`);
    }

    // Extract scheduled time: "⏰ დრო: ხვალ, 15:00" or similar
    const timeMatch = text.match(/⏰[^:]*:\s*(.+?)(?=[\r\n]|👤|📞|📍|📦|💰|🎫|🚚|WOLT_ORDER|$)/);
    if (timeMatch) {
      woltScheduledTime = timeMatch[1].trim();
      // If it says "ახლა" or similar, set to "now"
      if (/ახლა|now/i.test(woltScheduledTime)) {
        woltScheduledTime = "now";
      }
      console.log(`⏰ [REDIS BATCH] Wolt scheduled time: ${woltScheduledTime}`);
    }
  }

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
      // Wolt fields (field names match OrderData interface)
      isWoltOrder,
      deliveryPrice: woltDeliveryPrice,  // Maps to OrderData.deliveryPrice
      woltScheduledTime,
      deliveryMethod: isWoltOrder ? 'wolt' as const : undefined,
    };
    console.log('✅ [REDIS BATCH] Parsed Georgian order confirmation successfully');
    if (isWoltOrder) {
      console.log(`🚚 [REDIS BATCH] WOLT ORDER - Price: ${woltDeliveryPrice}, Time: ${woltScheduledTime}`);
    }
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

    // ⛔ CHECK CONVERSATION MODE - If conversation is in manual mode, silently drop messages
    // CRITICAL: This check MUST succeed. If Firestore fails, we wait and retry rather than proceeding.
    let manualModeActive = false;
    for (let checkAttempt = 1; checkAttempt <= 2; checkAttempt++) {
      try {
        console.log(`🔍 [REDIS BATCH] Manual mode check attempt ${checkAttempt} for ${senderId}`);
        const conversationDoc = await db.collection('conversations').doc(senderId).get();

        if (conversationDoc.exists) {
          const conversationData = conversationDoc.data();
          console.log(`🔍 [REDIS BATCH] Conversation data: manualMode=${conversationData?.manualMode}, enabledAt=${conversationData?.manualModeEnabledAt || 'N/A'}`);

          if (conversationData?.manualMode === true) {
            console.log(`👤 [REDIS BATCH] Conversation in MANUAL mode - manager handling ${senderId}`);
            console.log(`👤 Escalation reason: ${conversationData.escalationReason || 'Not specified'}`);
            console.log(`👤 Manual mode enabled at: ${conversationData.manualModeEnabledAt || 'Unknown'}`);

            manualModeActive = true;
            break; // Exit loop - we confirmed manual mode
          } else {
            console.log(`🟢 [REDIS BATCH] Manual mode is OFF for ${senderId} - proceeding with AI response`);
            break; // Exit loop - confirmed not in manual mode
          }
        } else {
          console.log(`ℹ️ [REDIS BATCH] No conversation document for ${senderId} - new user, proceeding`);
          break; // Exit loop - new user
        }
      } catch (conversationModeError) {
        console.error(`⚠️ [REDIS BATCH] Error checking conversation mode (attempt ${checkAttempt}):`, conversationModeError);
        if (checkAttempt < 2) {
          console.log(`🔄 [REDIS BATCH] Retrying manual mode check...`);
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          // After 2 failures, fail-safe: assume NOT in manual mode but log warning
          console.error(`🚨 [REDIS BATCH] Manual mode check failed after 2 attempts - proceeding with caution`);
        }
      }
    }

    if (manualModeActive) {
      // Clear messages from Redis to prevent buildup
      await clearMessageBatch(senderId);

      return NextResponse.json({
        status: 'manual_mode',
        message: 'Manager is handling this conversation'
      });
    }

    // ⛔ CHECK GLOBAL KILL SWITCH - If bot is globally paused, silently drop all messages
    try {
      const killSwitchDoc = await db.collection('botSettings').doc('botKillSwitch').get();
      if (killSwitchDoc.exists) {
        const killSwitchData = killSwitchDoc.data();
        if (killSwitchData?.active === true) {
          console.log(`⛔ [REDIS BATCH] Bot is GLOBALLY PAUSED - dropping messages for ${senderId}`);
          console.log(`⛔ Reason: ${killSwitchData.reason || 'Not specified'}`);

          // Clear messages from Redis to prevent buildup
          await clearMessageBatch(senderId);

          return NextResponse.json({
            status: 'bot_paused',
            reason: killSwitchData.reason
          });
        }
      }
    } catch (killSwitchError) {
      console.error(`⚠️ [REDIS BATCH] Error checking kill switch:`, killSwitchError);
      // Continue processing if kill switch check fails (fail-open for availability)
    }

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

    // ═══════════════════════════════════════════════════════
    // MANUAL MODE CHECK (SECONDARY): Safety net check after loading conversation
    // This is redundant with the earlier check but provides extra safety
    // ═══════════════════════════════════════════════════════
    if (conversationData.manualMode === true) {
      console.log(`🎮 [MANUAL MODE] (Secondary check) Active for ${senderId} - skipping AI response`);
      console.log(`   Reason: ${conversationData.escalationReason || 'Not specified'}`);
      console.log(`   Enabled at: ${conversationData.manualModeEnabledAt || 'Unknown'}`);
      await clearMessageBatch(senderId);
      return NextResponse.json({ status: 'manual_mode_active', skipped: true });
    }

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

    // ═══════════════════════════════════════════════════════
    // WOLT FLOW DETECTION - Check if we need to call Wolt APIs
    // and inject context for the bot
    // ═══════════════════════════════════════════════════════
    let woltContext: string | null = null;
    try {
      woltContext = await detectWoltFlowAndGetContext(conversationData.history, combinedText);
      if (woltContext) {
        console.log(`🚚 [WOLT FLOW] Injecting context: ${woltContext}`);
      }
    } catch (woltError: any) {
      console.error(`⚠️ [WOLT FLOW] Error detecting Wolt flow:`, woltError);
    }

    // Combine operator instruction with Wolt context if available
    let enhancedOperatorInstruction = conversationData.operatorInstruction || "";
    if (woltContext) {
      enhancedOperatorInstruction = `${enhancedOperatorInstruction}\n\n[WOLT SYSTEM CONTEXT - USE THIS INFO IN YOUR RESPONSE]\n${woltContext}`;
    }

    // Process with actual AI logic using the bot-core functions
    let response = await getAIResponse(
      userContent,
      conversationData.history,
      conversationData.orders || [],
      conversationData.storeVisitCount || 0,
      enhancedOperatorInstruction,
      senderId  // Pass senderId for dynamic instruction loading
    );

    // ═══════════════════════════════════════════════════════
    // EXPLICIT AUTO-ESCALATION CHECK (Belt and Suspenders)
    // If bot mentions manager, enable manual mode immediately
    // This is a safety check in case bot-core escalation didn't fire
    // ═══════════════════════════════════════════════════════
    const mentionsManagerExplicit = response.includes('მენეჯერ') || response.toLowerCase().includes('manager');
    console.log(`🔍 [REDIS BATCH ESCALATION] Response mentions manager: ${mentionsManagerExplicit}`);
    console.log(`🔍 [REDIS BATCH ESCALATION] Current manualMode: ${conversationData.manualMode}`);

    if (mentionsManagerExplicit && !conversationData.manualMode) {
      console.log(`⚠️ [REDIS BATCH] AUTO-ESCALATION TRIGGERED - Bot mentioned manager!`);

      try {
        const { enableManualMode } = await import('@/lib/bot-core');
        const { notifyManagerTelegram, parseEscalationCommand, cleanEscalationFromResponse } = await import('@/lib/telegramNotify');

        // Determine escalation reason
        let escalationReason = parseEscalationCommand(response);
        if (!escalationReason) {
          escalationReason = 'Bot mentioned manager - auto-escalation triggered';
        }

        console.log(`🚨 [REDIS BATCH] Sending Telegram notification...`);

        // Send Telegram notification
        await notifyManagerTelegram({
          senderId: senderId,
          reason: escalationReason,
          customerMessage: combinedText,
          conversationHistory: conversationData.history.slice(-5).map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '[complex content]'
          })),
        });

        console.log(`✅ [REDIS BATCH] Telegram sent, now enabling manual mode...`);

        // Enable manual mode
        await enableManualMode(senderId, escalationReason);

        // Update local data to reflect manual mode
        conversationData.manualMode = true;
        conversationData.escalatedAt = new Date().toISOString();
        conversationData.escalationReason = escalationReason;
        conversationData.needsAttention = true;

        // Clean ESCALATE command from response
        response = cleanEscalationFromResponse(response);

        console.log(`🚨 [REDIS BATCH] ESCALATION COMPLETE - manualMode enabled for ${senderId}`);
      } catch (escalationError) {
        console.error(`❌ [REDIS BATCH] Escalation error:`, escalationError);
      }
    }

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
            console.log(`🔵 [REDIS BATCH ORDER] Calling logOrder() for product: ${orderData.product}`);
            let orderNumber: string;
            try {
              orderNumber = await logOrder(orderData, 'messenger');
              console.log(`✅ [REDIS BATCH ORDER] Order logged successfully: ${orderNumber}`);

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
              console.log(`✅ [REDIS BATCH ORDER] Order added to conversation data`);

              // Send email (non-blocking - don't let failure affect message)
              try {
                await sendOrderEmail(orderData, orderNumber);
                console.log(`📧 [REDIS BATCH ORDER] Email sent`);
              } catch (emailErr: any) {
                console.error(`⚠️ [REDIS BATCH ORDER] Email failed (order still valid): ${emailErr.message}`);
              }
            } catch (logOrderError: any) {
              console.error(`❌ [REDIS BATCH ORDER] logOrder() FAILED:`, logOrderError);
              console.error(`❌ [REDIS BATCH ORDER] Error message:`, logOrderError?.message);
              console.error(`❌ [REDIS BATCH ORDER] Error stack:`, logOrderError?.stack);
              // Don't throw - we'll handle it in the outer catch
              throw logOrderError;
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