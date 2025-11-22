const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Initialize Firestore with same config as lib/firestore.ts
const db = new Firestore({
  projectId: (process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bebias-wp-db-handler').trim(),
  credentials: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  } : undefined,
});

async function checkRateLimits() {
  try {
    const userId = process.argv[2];

    if (!userId) {
      console.log('Usage: node scripts/check-rate-limits.js <USER_ID> [--clear]');
      console.log('Example: node scripts/check-rate-limits.js 1234567890');
      console.log('         node scripts/check-rate-limits.js 1234567890 --clear');
      process.exit(1);
    }

    const shouldClear = process.argv.includes('--clear');

    console.log(`🔍 Checking rate limits for user: ${userId}\n`);

    // Get rate limit data
    const rateLimitDoc = await db.collection('rateLimits').doc(userId).get();

    if (!rateLimitDoc.exists) {
      console.log('✅ No rate limit data found for this user.');
      console.log('   User has not hit any rate limits.\n');
      process.exit(0);
    }

    const data = rateLimitDoc.data();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // Filter to recent messages
    const hourlyMessages = (data.hourlyMessages || []).filter(ts => ts > oneHourAgo);
    const dailyMessages = (data.dailyMessages || []).filter(ts => ts > oneDayAgo);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RATE LIMIT STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`User ID: ${userId}`);
    console.log(`Last Updated: ${data.lastUpdated || 'Unknown'}`);
    console.log();
    console.log(`Hourly Messages: ${hourlyMessages.length}/200 ${hourlyMessages.length >= 200 ? '❌ LIMIT REACHED' : '✅'}`);
    console.log(`Daily Messages:  ${dailyMessages.length}/500 ${dailyMessages.length >= 500 ? '❌ LIMIT REACHED' : '✅'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (hourlyMessages.length >= 200 || dailyMessages.length >= 500) {
      console.log('⚠️  This user is currently rate limited!\n');
    }

    if (shouldClear) {
      console.log('🧹 Clearing rate limit data...');
      await db.collection('rateLimits').doc(userId).delete();
      console.log('✅ Rate limits cleared for user:', userId);
      console.log('   User can now send messages again.\n');
    } else {
      if (hourlyMessages.length >= 200 || dailyMessages.length >= 500) {
        console.log('💡 To clear rate limits for this user, run:');
        console.log(`   node scripts/check-rate-limits.js ${userId} --clear\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

checkRateLimits();
