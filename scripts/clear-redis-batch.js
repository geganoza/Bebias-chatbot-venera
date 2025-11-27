require('dotenv').config({ path: '.env.local' });
const { Redis } = require('@upstash/redis');

async function clearBatch() {
  const userId = process.argv[2] || '3282789748459241';
  const batchKey = `msgbatch:${userId}`;

  console.log(`Clearing Redis batch for user: ${userId}`);

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

    if (!url || !token) {
      console.warn('⚠️ Redis credentials not configured');
      return;
    }

    const redis = new Redis({ url, token });
    await redis.del(batchKey);
    console.log(`✅ Redis batch cleared for key: ${batchKey}`);
  } catch (error) {
    console.error('❌ Error clearing Redis batch:', error.message);
  }
}

clearBatch();