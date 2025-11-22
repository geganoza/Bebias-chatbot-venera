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

async function listRateLimitedUsers() {
  try {
    console.log('🔍 Checking all users for rate limits...\n');

    const rateLimitsSnapshot = await db.collection('rateLimits').get();

    if (rateLimitsSnapshot.empty) {
      console.log('✅ No rate limit data found. No users are rate limited.\n');
      process.exit(0);
    }

    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    const rateLimitedUsers = [];

    for (const doc of rateLimitsSnapshot.docs) {
      const userId = doc.id;
      const data = doc.data();

      // Filter to recent messages
      const hourlyMessages = (data.hourlyMessages || []).filter(ts => ts > oneHourAgo);
      const dailyMessages = (data.dailyMessages || []).filter(ts => ts > oneDayAgo);

      // Check if user is rate limited
      const isHourlyLimited = hourlyMessages.length >= 200;
      const isDailyLimited = dailyMessages.length >= 500;

      if (isHourlyLimited || isDailyLimited) {
        rateLimitedUsers.push({
          userId,
          hourlyCount: hourlyMessages.length,
          dailyCount: dailyMessages.length,
          isHourlyLimited,
          isDailyLimited,
          lastUpdated: data.lastUpdated
        });
      }
    }

    if (rateLimitedUsers.length === 0) {
      console.log('✅ No users are currently rate limited.\n');
      process.exit(0);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  RATE LIMITED USERS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const user of rateLimitedUsers) {
      console.log(`User ID: ${user.userId}`);
      console.log(`  Hourly: ${user.hourlyCount}/200 ${user.isHourlyLimited ? '❌ LIMITED' : '✅'}`);
      console.log(`  Daily:  ${user.dailyCount}/500 ${user.isDailyLimited ? '❌ LIMITED' : '✅'}`);
      console.log(`  Last Updated: ${user.lastUpdated || 'Unknown'}`);
      console.log();
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total: ${rateLimitedUsers.length} user(s) rate limited\n`);

    console.log('💡 To clear rate limits for a specific user:');
    console.log('   node scripts/check-rate-limits.js <USER_ID> --clear');
    console.log('\n💡 To clear ALL rate limits:');
    console.log('   node scripts/list-rate-limited-users.js --clear-all\n');

    const shouldClearAll = process.argv.includes('--clear-all');

    if (shouldClearAll) {
      console.log('🧹 Clearing rate limits for all users...\n');

      for (const user of rateLimitedUsers) {
        await db.collection('rateLimits').doc(user.userId).delete();
        console.log(`✅ Cleared rate limits for user: ${user.userId}`);
      }

      console.log(`\n✅ Cleared rate limits for ${rateLimitedUsers.length} user(s)\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

listRateLimitedUsers();
