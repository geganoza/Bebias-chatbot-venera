/**
 * Telegram Manager Notification System
 *
 * Sends alerts to manager when bot needs human intervention.
 * Used when bot detects ESCALATE_TO_MANAGER command in response.
 */

export interface EscalationContext {
  senderId: string;
  senderName?: string;
  reason: string;
  customerMessage: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

// Environment variables for Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Send escalation notification to manager via Telegram
 */
export async function notifyManagerTelegram(context: EscalationContext): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[TELEGRAM] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    console.log('[TELEGRAM] Escalation would be sent:', context);
    return false;
  }

  try {
    // Build message
    const message = formatTelegramMessage(context);

    // Send via Telegram Bot API
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[TELEGRAM] Failed to send:', error);
      return false;
    }

    console.log(`[TELEGRAM] ✅ Escalation sent for user ${context.senderId}`);
    return true;

  } catch (error) {
    console.error('[TELEGRAM] Error sending notification:', error);
    return false;
  }
}

/**
 * Format message for Telegram
 */
function formatTelegramMessage(context: EscalationContext): string {
  const timestamp = new Date().toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi' });

  let message = `🔔 <b>BEBIAS BOT - საჭიროა დახმარება!</b>\n\n`;
  message += `⏰ <b>დრო:</b> ${timestamp}\n`;
  message += `👤 <b>მომხმარებელი:</b> ${context.senderName || 'Unknown'}\n`;
  message += `🆔 <b>ID:</b> <code>${context.senderId}</code>\n\n`;
  message += `❓ <b>მიზეზი:</b>\n${context.reason}\n\n`;
  message += `💬 <b>მომხმარებლის შეტყობინება:</b>\n${context.customerMessage}\n`;

  // Add last 3 messages from history if available
  if (context.conversationHistory && context.conversationHistory.length > 0) {
    const lastMessages = context.conversationHistory.slice(-3);
    message += `\n📝 <b>ბოლო საუბარი:</b>\n`;
    for (const msg of lastMessages) {
      const role = msg.role === 'user' ? '👤' : '🤖';
      const content = typeof msg.content === 'string' ? msg.content : '[complex content]';
      const truncated = content.length > 100 ? content.substring(0, 100) + '...' : content;
      message += `${role} ${truncated}\n`;
    }
  }

  // Add link to Facebook conversation
  message += `\n🔗 <a href="https://www.facebook.com/messages/t/${context.senderId}">Facebook Chat</a>`;

  return message;
}

/**
 * Parse ESCALATE_TO_MANAGER command from bot response
 * Returns the reason if found, null otherwise
 */
export function parseEscalationCommand(botResponse: string): string | null {
  // Match: ESCALATE_TO_MANAGER: [reason]
  const match = botResponse.match(/ESCALATE_TO_MANAGER:\s*(.+?)(?:\n|$)/);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Remove ESCALATE_TO_MANAGER command from response before sending to customer
 */
export function cleanEscalationFromResponse(botResponse: string): string {
  return botResponse.replace(/ESCALATE_TO_MANAGER:\s*.+?(?:\n|$)/g, '').trim();
}
