import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { db } from "@/lib/firestore";
import { sendOrderEmail } from "@/lib/sendOrderEmail";
import { logOrder } from "@/lib/orderLogger";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type MessageContent = string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
type Message = { role: "system" | "user" | "assistant"; content: MessageContent };

interface ConversationData {
  senderId: string;
  userName?: string;
  history: Message[];
  orders?: Array<{ orderNumber: string; timestamp: string; items: string }>;
  manualMode?: boolean;
  escalatedAt?: string;
  managerPhoneOffered?: boolean;
  createdAt?: string;
}

interface PaymentData {
  senderId: string;
  orderData: {
    product: string;
    quantity: string;
    clientName: string;
    telephone: string;
    address: string;
    total: string;
  };
  confirmationMessage: string;
  hasCompleteOrderDetails: boolean;
}

// ==================== HELPER FUNCTIONS ====================

async function loadConversation(userId: string): Promise<ConversationData> {
  try {
    const docRef = db.collection('conversations').doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        senderId: userId,
        userName: 'Unknown',
        history: [],
        orders: [],
        createdAt: new Date().toISOString()
      };
    }

    return doc.data() as ConversationData;
  } catch (error: any) {
    console.error('Error loading conversation:', error);
    throw error;
  }
}

async function saveConversation(data: ConversationData) {
  try {
    const docRef = db.collection('conversations').doc(data.senderId);
    await docRef.set(data);
  } catch (error: any) {
    console.error('Error saving conversation:', error);
    throw error;
  }
}

async function sendMessage(recipientId: string, messageText: string) {
  const url = `https://graph.facebook.com/v17.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: messageText },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Facebook API error: ${JSON.stringify(errorData)}`);
  }

  return response.json();
}

// ==================== MAIN HANDLER ====================

async function handler(req: Request) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    const body: PaymentData = await req.json();
    const { senderId, orderData, confirmationMessage, hasCompleteOrderDetails } = body;
    userId = senderId;

    console.log(`🚀 [QStash Payment] Processing payment for user ${senderId}`);

    // Load conversation
    const conversationData = await loadConversation(senderId);

    // Check if bot is globally paused
    let globalBotPaused = false;
    try {
      const settingsDoc = await db.collection('botSettings').doc('global').get();
      if (settingsDoc.exists) {
        globalBotPaused = settingsDoc.data()?.paused === true;
      }
    } catch (error) {
      console.warn(`⚠️ Could not check bot pause status - continuing anyway`);
    }

    if (globalBotPaused) {
      console.log(`⏸️ GLOBAL BOT PAUSE ACTIVE`);
      return NextResponse.json({
        status: 'bot_paused',
        message: 'Bot is globally paused'
      });
    }

    // Check if conversation is in manual mode
    if (conversationData.manualMode === true) {
      console.log(`🎮 MANUAL MODE ACTIVE for ${senderId}`);
      return NextResponse.json({
        status: 'manual_mode',
        message: 'Conversation in manual mode, operator will respond'
      });
    }

    // ==================== PROCESS PAYMENT ====================

    let orderNumber: string | undefined;

    // If we have complete order details, log order and send email
    if (hasCompleteOrderDetails && orderData.product && orderData.telephone && orderData.address) {
      // Log order and get order number
      orderNumber = await logOrder(orderData, 'messenger');
      console.log(`📝 Order logged with number: ${orderNumber}`);

      // Add order to conversation data
      if (!conversationData.orders) {
        conversationData.orders = [];
      }
      conversationData.orders.push({
        orderNumber,
        timestamp: new Date().toISOString(),
        items: orderData.product
      });

      // Send email
      const emailSent = await sendOrderEmail(orderData, orderNumber);
      if (emailSent) {
        console.log('✅ Order email sent successfully');
      } else {
        console.warn('⚠️ Order email failed to send');
      }
    } else {
      console.log('ℹ️ Incomplete order details - skipping order logging and email');
    }

    // Update confirmation message with order number if available
    let finalConfirmationMessage = confirmationMessage;
    if (orderNumber && !confirmationMessage.includes('#')) {
      // Replace placeholder with actual order number if needed
      finalConfirmationMessage = confirmationMessage.replace('Your order is confirmed', `Order #${orderNumber} confirmed`);
      finalConfirmationMessage = finalConfirmationMessage.replace('თქვენი შეკვეთა დადასტურებულია', `შეკვეთა #${orderNumber} დადასტურებულია`);
    }

    // Add confirmation to conversation history
    conversationData.history.push({
      role: "assistant",
      content: finalConfirmationMessage
    });

    // Save conversation
    await saveConversation(conversationData);

    // Send confirmation message to Facebook
    await sendMessage(senderId, finalConfirmationMessage);

    const processingTime = Date.now() - startTime;
    console.log(`✅ [QStash Payment] Payment processed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      processingTime,
      orderNumber
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ [QStash Payment] Error processing payment (${processingTime}ms):`, error);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Verify QStash signature for security
export const POST = verifySignatureAppRouter(handler);
