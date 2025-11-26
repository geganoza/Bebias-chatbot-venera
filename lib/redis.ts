import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default redis;

// Helper functions for message batching
export async function addMessageToBatch(senderId: string, message: any): Promise<void> {
  const batchKey = `msgbatch:${senderId}`;

  try {
    // Add message to the batch
    await redis.rpush(batchKey, JSON.stringify(message));

    // Set expiry to 60 seconds (auto-cleanup)
    await redis.expire(batchKey, 60);

    console.log(`✅ Message added to Redis batch for ${senderId}`);
  } catch (error) {
    console.error(`❌ Redis error adding message to batch:`, error);
    throw error;
  }
}

export async function getMessageBatch(senderId: string): Promise<any[]> {
  const batchKey = `msgbatch:${senderId}`;

  try {
    // Get all messages from the batch
    const messages = await redis.lrange(batchKey, 0, -1);

    // Parse each message
    return messages.map(msg => JSON.parse(msg as string));
  } catch (error) {
    console.error(`❌ Redis error getting message batch:`, error);
    return [];
  }
}

export async function clearMessageBatch(senderId: string): Promise<void> {
  const batchKey = `msgbatch:${senderId}`;

  try {
    await redis.del(batchKey);
    console.log(`🗑️ Cleared Redis batch for ${senderId}`);
  } catch (error) {
    console.error(`❌ Redis error clearing batch:`, error);
  }
}

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    await redis.set('test:ping', 'pong', { ex: 10 });
    const result = await redis.get('test:ping');
    console.log(`🏓 Redis connection test: ${result === 'pong' ? 'SUCCESS' : 'FAILED'}`);
    return result === 'pong';
  } catch (error) {
    console.error(`❌ Redis connection test failed:`, error);
    return false;
  }
}