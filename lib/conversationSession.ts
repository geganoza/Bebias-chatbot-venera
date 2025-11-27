/**
 * Conversation session tracker using Redis
 * Prevents multiple batch processors for the same conversation
 */

import { redis } from './redis';

const SESSION_TTL = 30; // Session expires after 30 seconds

/**
 * Check if a conversation session is already being processed
 */
export async function isSessionActive(userId: string): Promise<boolean> {
  try {
    const sessionKey = `session:${userId}`;
    const session = await redis.get(sessionKey);
    return session === 'active';
  } catch (error) {
    console.error('Error checking session:', error);
    return false;
  }
}

/**
 * Mark a conversation session as active (being processed)
 */
export async function setSessionActive(userId: string): Promise<void> {
  try {
    const sessionKey = `session:${userId}`;
    await redis.set(sessionKey, 'active', { ex: SESSION_TTL });
    console.log(`🔒 [SESSION] Locked session for ${userId}`);
  } catch (error) {
    console.error('Error setting session active:', error);
  }
}

/**
 * Clear a conversation session after processing
 */
export async function clearSession(userId: string): Promise<void> {
  try {
    const sessionKey = `session:${userId}`;
    await redis.del(sessionKey);
    console.log(`🔓 [SESSION] Cleared session for ${userId}`);
  } catch (error) {
    console.error('Error clearing session:', error);
  }
}

/**
 * Extend session TTL if still processing
 */
export async function extendSession(userId: string): Promise<void> {
  try {
    const sessionKey = `session:${userId}`;
    await redis.expire(sessionKey, SESSION_TTL);
  } catch (error) {
    console.error('Error extending session:', error);
  }
}