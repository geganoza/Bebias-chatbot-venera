/**
 * Clear Test User History and Rate Limits
 *
 * This function clears all data for a test user when they send "clear" command
 * Safe to use - only works for users in test-users.json
 */

import { db } from './firestore';
import fs from 'fs';
import path from 'path';

// Load test users config
function getTestUsers(): string[] {
  try {
    const configPath = path.join(process.cwd(), 'config', 'test-users.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.testMode?.enabled) {
      return [];
    }

    return config.testUsers?.facebook?.map((u: any) => u.userId) || [];
  } catch (error) {
    console.error('[CLEAR TEST USER] Error loading config:', error);
    return [];
  }
}

/**
 * Check if user is a test user
 */
export function isTestUser(userId: string): boolean {
  const testUsers = getTestUsers();
  return testUsers.includes(userId);
}

/**
 * Clear all data for a test user
 */
export async function clearTestUserData(userId: string): Promise<boolean> {
  // Safety check: only allow clearing for test users
  if (!isTestUser(userId)) {
    console.log(`[CLEAR TEST USER] User ${userId} is not a test user - skipping`);
    return false;
  }

  console.log(`[CLEAR TEST USER] Clearing data for test user: ${userId}`);

  try {
    // 1. Clear conversation history
    const conversationRef = db.collection('conversations').doc(userId);
    const doc = await conversationRef.get();

    if (doc.exists) {
      const data = doc.data();
      console.log(`  - Clearing ${data?.history?.length || 0} messages from history`);
      console.log(`  - Clearing ${data?.orders?.length || 0} orders`);

      await conversationRef.update({
        history: [],
        orders: [],
        lastActive: new Date().toISOString()
      });
      console.log('  ✅ Conversation cleared');
    }

    // 2. Clear rate limits
    const rateLimitRef = db.collection('rateLimits').doc(userId);
    const rateLimitDoc = await rateLimitRef.get();

    if (rateLimitDoc.exists) {
      await rateLimitRef.delete();
      console.log('  ✅ Rate limits cleared');
    }

    // 3. Clear processed messages
    const processedMsgs = await db.collection('processedMessages')
      .where('senderId', '==', userId)
      .get();

    if (processedMsgs.size > 0) {
      console.log(`  - Clearing ${processedMsgs.size} processed message records`);
      const batch = db.batch();
      processedMsgs.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log('  ✅ Processed messages cleared');
    }

    // 4. Clear processing locks
    const locks = await db.collection('processingLocks')
      .where('senderId', '==', userId)
      .get();

    if (locks.size > 0) {
      console.log(`  - Clearing ${locks.size} processing locks`);
      const batch = db.batch();
      locks.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log('  ✅ Processing locks cleared');
    }

    // 5. Clear Redis batches (if exists)
    // Note: Redis batches expire automatically, but we could add explicit clearing here

    console.log(`[CLEAR TEST USER] ✅ All data cleared for user ${userId}`);
    return true;

  } catch (error) {
    console.error('[CLEAR TEST USER] Error:', error);
    return false;
  }
}

/**
 * Get clear command response message
 */
export function getClearCommandResponse(userId: string, success: boolean): string {
  if (!isTestUser(userId)) {
    return "ბოდიში, ეს ფუნქცია მხოლოდ ტესტ მომხმარებლებისთვისაა 🤖";
  }

  if (success) {
    return "✅ ისტორია და რეიტ-ლიმიტი წაიშალა! შეგიძლია თავიდან დაიწყო ტესტირება 🧹";
  } else {
    return "❌ შეცდომა მონაცემების წაშლისას. სცადე თავიდან.";
  }
}
