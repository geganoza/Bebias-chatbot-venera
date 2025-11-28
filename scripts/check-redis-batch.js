const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL.trim(),
  token: process.env.UPSTASH_REDIS_REST_TOKEN.trim(),
});

async function checkBatch() {
  const userId = process.argv[2] || '3282789748459241';
  const batchKey = `msgbatch:${userId}`;

  console.log(`🔍 Checking Redis batch for user: ${userId}`);
  console.log(`   Batch key: ${batchKey}\n`);

  const messages = await redis.lrange(batchKey, 0, -1);

  console.log(`📦 Found ${messages.length} messages in Redis batch`);

  if (messages.length > 0) {
    messages.forEach((msg, i) => {
      const parsed = JSON.parse(msg);
      console.log(`\nMessage ${i + 1}:`);
      console.log(`   Text: ${parsed.text || '(no text)'}`);
      console.log(`   Attachments: ${parsed.attachments?.length || 0}`);
      console.log(`   Time: ${new Date(parsed.timestamp).toISOString()}`);
      console.log(`   Age: ${Math.round((Date.now() - parsed.timestamp) / 1000)}s ago`);
    });
  }

  // Check processing lock
  const lockKey = `batch_processing_${userId}`;
  const lock = await redis.get(lockKey);
  console.log(`\n🔒 Processing lock: ${lock || 'None'}`);

  // Check TTL of batch
  const ttl = await redis.ttl(batchKey);
  if (ttl > 0) {
    console.log(`⏰ Batch TTL: ${ttl}s (expires in ${Math.round(ttl / 60)} minutes)`);
  }
}

checkBatch()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
