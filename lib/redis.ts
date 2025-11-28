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
      // CRITICAL FIX: Disable automatic deserialization to have full control
      // over JSON serialization. This prevents "[object Object]" corruption.
      // Reference: https://github.com/upstash/upstash-redis/issues/49
      automaticDeserialization: false,
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

    // Serialize to JSON string
    // With automaticDeserialization: false, we must manually stringify
    const serialized = JSON.stringify(message);

    console.log(`[DEBUG BATCH] Storing message for ${senderId}: ${serialized.substring(0, 100)}...`);

    // Store in Redis (will be stored as raw string with automaticDeserialization: false)
    await redis.rpush(batchKey, serialized);

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
    // With automaticDeserialization: false, these will be raw strings
    const messages = await redis.lrange(batchKey, 0, -1);

    console.log(`[DEBUG BATCH] Retrieved ${messages.length} messages from Redis for ${senderId}`);

    // Parse each JSON string back to objects
    return messages.map((msg, index) => {
      // With automaticDeserialization: false, msg should ALWAYS be a string
      if (typeof msg !== 'string') {
        console.error(`⚠️ [BATCH] Message ${index} is not a string (type: ${typeof msg}). This shouldn't happen with automaticDeserialization: false`);
        // Try to handle gracefully
        if (typeof msg === 'object' && msg !== null) {
          return msg; // Already an object somehow
        }
        return { text: '', timestamp: Date.now() };
      }

      // Check for the "[object Object]" corruption
      if (msg === '[object Object]') {
        console.error(`⚠️ [BATCH] Message ${index} corrupted as '[object Object]' - data lost`);
        return { text: '', timestamp: Date.now() };
      }

      // Parse the JSON string
      try {
        const parsed = JSON.parse(msg);
        console.log(`[DEBUG BATCH] Parsed message ${index}: text="${parsed.text?.substring(0, 50) || '(no text)'}"`);
        return parsed;
      } catch (e) {
        console.error(`⚠️ [BATCH] Failed to parse message ${index}:`, msg.substring(0, 100));
        // Return as text if parsing fails
        return { text: String(msg), timestamp: Date.now() };
      }
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

    // With automaticDeserialization: false, we store and get raw strings
    await redis.set('test:ping', 'pong', { ex: 10 });
    const result = await redis.get('test:ping');

    console.log(`🏓 Redis connection test: ${result === 'pong' ? 'SUCCESS' : 'FAILED'} (got: ${result})`);
    return result === 'pong';
  } catch (error) {
    console.error(`❌ Redis connection test failed:`, error);
    return false;
  }
}