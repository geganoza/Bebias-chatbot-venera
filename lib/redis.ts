import { Redis } from '@upstash/redis';

// Initialize Redis client with proper error handling
let redis: Redis;

try {
  // Clean up environment variables in case they have extra whitespace
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    console.warn('⚠️ Redis credentials not configured, Redis features disabled');
    // Create a dummy redis client that does nothing
    redis = {} as Redis;
  } else {
    redis = new Redis({
      url: url,
      token: token,
    });
  }
} catch (error) {
  console.error('❌ Failed to initialize Redis client:', error);
  redis = {} as Redis;
}

export default redis;

// Helper functions for message batching
export async function addMessageToBatch(senderId: string, message: any): Promise<void> {
  const batchKey = `msgbatch:${senderId}`;

  try {
    // Check if Redis is properly initialized
    if (!redis.rpush) {
      throw new Error('Redis client not initialized');
    }

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

    // Parse each message - handle potential double-stringification
    return messages.map(msg => {
      // Log the type of data we're getting
      console.log(`[DEBUG] Message type from Redis: ${typeof msg}`);

      // If msg is already an object, return it
      if (typeof msg === 'object' && msg !== null) {
        console.log(`[DEBUG] Message is already an object, returning as-is`);
        return msg;
      }

      // If it's a string, try to parse it
      if (typeof msg === 'string') {
        // Check if it's the "[object Object]" issue
        if (msg === '[object Object]') {
          console.error(`⚠️ Message was stored as '[object Object]' - data lost`);
          return { text: '', timestamp: Date.now() };
        }

        try {
          const parsed = JSON.parse(msg);
          console.log(`[DEBUG] Successfully parsed message from JSON`);
          return parsed;
        } catch (e) {
          console.error(`⚠️ Failed to parse message from Redis:`, msg);
          // If parsing fails, return the raw message
          return { text: String(msg), timestamp: Date.now() };
        }
      }

      // Fallback - shouldn't reach here
      console.warn(`⚠️ Unexpected message type: ${typeof msg}`);
      return { text: '', timestamp: Date.now() };
    });
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
    // Check if Redis is properly initialized
    if (!redis.set || !redis.get) {
      console.log('❌ Redis client not initialized');
      return false;
    }

    await redis.set('test:ping', 'pong', { ex: 10 });
    const result = await redis.get('test:ping');
    console.log(`🏓 Redis connection test: ${result === 'pong' ? 'SUCCESS' : 'FAILED'}`);
    return result === 'pong';
  } catch (error) {
    console.error(`❌ Redis connection test failed:`, error);
    return false;
  }
}