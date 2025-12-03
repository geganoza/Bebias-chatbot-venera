import { db } from "@/lib/firestore";

/**
 * Manager Detection System
 *
 * This module detects when a manager/page admin responds to a customer
 * and automatically enables manual mode to prevent the bot from responding.
 *
 * How it works:
 * 1. When webhook receives a message with is_echo=true, it's from the Page
 * 2. If the message has a recipient.id (the customer), check if it's from a human
 * 3. Bot messages have specific patterns (e.g., order confirmations, SEND_IMAGE commands)
 * 4. If it's a human message from the Page, enable manual mode for that conversation
 */

/**
 * Check if a message is from a human manager (not the bot)
 * Bot messages have specific patterns we can detect
 */
export function isHumanManagerMessage(messageText: string): boolean {
  if (!messageText) return false;

  // Bot messages contain these patterns
  const botPatterns = [
    // Order confirmation patterns
    /შეკვეთა #BEB\d+/,  // Order number in Georgian
    /Order #BEB\d+/,    // Order number in English
    /\[ORDER_NUMBER\]/,  // Placeholder
    /🎫 შეკვეთის ნომერი:/,

    // Bot response patterns
    /SEND_IMAGE:/,      // Image commands (shouldn't be in final message but just in case)
    /✅ შეკვეთა მიღებულია/,
    /✅ Order confirmed/,

    // Automated responses
    /📦 პროდუქტი:/,
    /💰 ფასი:/,
    /🚚 მიწოდება:/,

    // System messages
    /⏰ გთხოვთ დაიცადოთ/,
    /⏰ Please wait/,
    /❌ შეცდომა/,
    /❌ Error/,
  ];

  // If message matches any bot pattern, it's not a human manager
  for (const pattern of botPatterns) {
    if (pattern.test(messageText)) {
      return false;
    }
  }

  // Additional checks for bot-like content
  // Bot responses are usually longer and structured
  const lines = messageText.split('\n').filter(l => l.trim());

  // Bot messages often have emoji prefixes on multiple lines
  const emojiPrefixCount = lines.filter(line => /^[📦💰🚚📍👤📞🎫✅❌⏰🔍]/.test(line)).length;
  if (emojiPrefixCount >= 3) {
    return false; // Likely a bot message
  }

  // If we reach here, it's likely a human message
  return true;
}

/**
 * Enable manual mode for a conversation when manager intervenes
 */
export async function enableManualModeForConversation(
  userId: string,
  reason: string = "Manager intervention detected"
): Promise<boolean> {
  try {
    console.log(`🔄 Enabling manual mode for ${userId}: ${reason}`);

    // Get or create conversation
    const conversationRef = db.collection('conversations').doc(userId);
    const conversationDoc = await conversationRef.get();

    let conversationData;
    if (conversationDoc.exists) {
      conversationData = conversationDoc.data();
    } else {
      // Create new conversation if doesn't exist
      conversationData = {
        userId,
        history: [],
        lastActive: new Date().toISOString(),
        created: new Date().toISOString()
      };
    }

    // Set manual mode
    conversationData.manualMode = true;
    conversationData.manualModeEnabledAt = new Date().toISOString();
    conversationData.manualModeReason = reason;
    conversationData.lastActive = new Date().toISOString();

    // Save to Firestore
    await conversationRef.set(conversationData);

    // Clear any pending messages from Redis to prevent bot from processing
    try {
      const { clearMessageBatch } = await import('@/lib/redis');
      await clearMessageBatch(userId);
      console.log(`🗑️ Cleared Redis queue for ${userId}`);
    } catch (err) {
      console.warn(`⚠️ Could not clear Redis cache:`, err);
    }

    console.log(`✅ Manual mode enabled for ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error enabling manual mode for ${userId}:`, error);
    return false;
  }
}

/**
 * Check if manual mode is already enabled for a user
 */
export async function isManualModeEnabled(userId: string): Promise<boolean> {
  try {
    const conversationDoc = await db.collection('conversations').doc(userId).get();

    if (!conversationDoc.exists) {
      return false;
    }

    const data = conversationDoc.data();
    return data?.manualMode === true;
  } catch (error) {
    console.error(`❌ Error checking manual mode for ${userId}:`, error);
    return false;
  }
}

/**
 * Process echo messages from the Page to detect manager intervention
 * Echo messages are sent when the Page sends a message (either bot or human)
 */
export async function processPageEchoMessage(event: any): Promise<void> {
  const message = event.message;
  const recipientId = event.recipient?.id; // The customer who received the message
  const messageText = message?.text;
  const appId = message?.app_id;

  console.log(`🔍 Processing echo message:`);
  console.log(`   To customer: ${recipientId}`);
  console.log(`   App ID: ${appId || 'NONE (likely human)'}`);
  console.log(`   Text: "${messageText?.substring(0, 100)}..."`);

  if (!recipientId || !messageText) {
    console.log(`⚠️ Missing recipient or text in echo message`);
    return;
  }

  // If there's no app_id, it's likely from a human (Facebook Business Suite)
  // If there's an app_id, it's from our bot
  const isLikelyHuman = !appId;

  console.log(`🔍 Echo analysis: ${isLikelyHuman ? 'Likely HUMAN (no app_id)' : 'Likely BOT (has app_id)'}`);

  // Check if this is a human manager message
  // Use both app_id check and content analysis
  if (isLikelyHuman || isHumanManagerMessage(messageText)) {
    console.log(`👨‍💼 Manager intervention detected for customer ${recipientId}`);

    // Save manager message to conversation history
    try {
      const conversationRef = db.collection('conversations').doc(recipientId);
      const conversationDoc = await conversationRef.get();

      let conversationData;
      if (conversationDoc.exists) {
        conversationData = conversationDoc.data();
      } else {
        conversationData = {
          userId: recipientId,
          history: [],
          created: new Date().toISOString()
        };
      }

      // Add manager message to history
      conversationData.history.push({
        role: "assistant",
        content: `[MANAGER]: ${messageText}`
      });
      conversationData.lastActive = new Date().toISOString();

      await conversationRef.set(conversationData);
      console.log(`📝 Manager message saved to history for ${recipientId}`);
    } catch (err) {
      console.error(`❌ Error saving manager message to history:`, err);
    }

    // Check if manual mode is already enabled
    const alreadyEnabled = await isManualModeEnabled(recipientId);

    if (!alreadyEnabled) {
      // Enable manual mode for this conversation
      await enableManualModeForConversation(
        recipientId,
        "Manager sent message to customer"
      );

      // Log the manager intervention
      try {
        const metaMessageRef = db.collection('metaMessages').doc(recipientId);
        const metaMessageDoc = await metaMessageRef.get();

        const metaMessage = {
          id: `${Date.now()}-manager-intervention`,
          senderId: 'SYSTEM',
          senderType: 'system',
          text: `[System: Manager intervention detected - Bot paused]`,
          timestamp: new Date().toISOString()
        };

        if (metaMessageDoc.exists) {
          const data = metaMessageDoc.data() as { messages: any[] };
          data.messages.push(metaMessage);
          await metaMessageRef.set(data);
        } else {
          await metaMessageRef.set({
            userId: recipientId,
            messages: [metaMessage]
          });
        }
      } catch (err) {
        console.warn(`⚠️ Could not log manager intervention:`, err);
      }
    } else {
      console.log(`ℹ️ Manual mode already enabled for ${recipientId}`);
    }
  } else {
    console.log(`🤖 Bot message detected (not manager) to ${recipientId}`);
  }
}

/**
 * Disable manual mode for a conversation (for when manager is done)
 * This can be called from the control panel or automatically after a period
 */
export async function disableManualMode(userId: string): Promise<boolean> {
  try {
    console.log(`🔄 Disabling manual mode for ${userId}`);

    const conversationRef = db.collection('conversations').doc(userId);
    const conversationDoc = await conversationRef.get();

    if (!conversationDoc.exists) {
      console.log(`⚠️ No conversation found for ${userId}`);
      return false;
    }

    const conversationData = conversationDoc.data();
    conversationData.manualMode = false;
    conversationData.manualModeDisabledAt = new Date().toISOString();
    conversationData.lastActive = new Date().toISOString();

    await conversationRef.set(conversationData);

    console.log(`✅ Manual mode disabled for ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error disabling manual mode for ${userId}:`, error);
    return false;
  }
}