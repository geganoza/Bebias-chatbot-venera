/**
 * Typing tracker for Facebook Messenger
 * Helps batch messages better by tracking when users are typing
 */

// Store last typing indicator timestamp per user
const typingStatus = new Map<string, number>();

/**
 * Record that a user is typing
 */
export function setUserTyping(userId: string) {
  typingStatus.set(userId, Date.now());
  console.log(`⌨️ [TYPING] User ${userId} is typing...`);
}

/**
 * Check if user is currently typing (within last 3 seconds)
 */
export function isUserTyping(userId: string): boolean {
  const lastTyping = typingStatus.get(userId);
  if (!lastTyping) return false;

  const timeSinceTyping = Date.now() - lastTyping;
  const isTyping = timeSinceTyping < 3000; // Consider typing if within 3 seconds

  if (isTyping) {
    console.log(`⌨️ [TYPING] User ${userId} typed ${timeSinceTyping}ms ago - still typing`);
  }

  return isTyping;
}

/**
 * Clear typing status for a user
 */
export function clearUserTyping(userId: string) {
  typingStatus.delete(userId);
}

/**
 * Get time since last typing indicator
 */
export function getTimeSinceLastTyping(userId: string): number | null {
  const lastTyping = typingStatus.get(userId);
  if (!lastTyping) return null;
  return Date.now() - lastTyping;
}