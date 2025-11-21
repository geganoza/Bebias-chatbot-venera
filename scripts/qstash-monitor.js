const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load environment variables
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

const db = new Firestore({
  projectId: (process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bebias-wp-db-handler').trim(),
  credentials: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  } : undefined,
});

async function getQStashUsage(days = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const snapshot = await db.collection('qstashUsage')
      .where('date', '>=', startDateStr)
      .get();

    const dailyStats = {};
    const userStats = {};
    let totalSuccess = 0;
    let totalFailed = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const date = data.date;
      const userId = data.userId;

      // Daily stats
      if (!dailyStats[date]) {
        dailyStats[date] = { success: 0, failed: 0 };
      }
      if (data.success) {
        dailyStats[date].success++;
        totalSuccess++;
      } else {
        dailyStats[date].failed++;
        totalFailed++;
      }

      // User stats
      if (!userStats[userId]) {
        userStats[userId] = { success: 0, failed: 0 };
      }
      if (data.success) {
        userStats[userId].success++;
      } else {
        userStats[userId].failed++;
      }
    });

    return { dailyStats, userStats, totalSuccess, totalFailed };
  } catch (error) {
    console.error('❌ Error fetching QStash usage:', error.message);
    return null;
  }
}

async function getRateLimitStatus() {
  try {
    const snapshot = await db.collection('rateLimits').get();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const activeUsers = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const recentMessages = (data.hourlyMessages || []).filter(ts => ts > oneHourAgo);

      if (recentMessages.length > 0) {
        activeUsers.push({
          userId: doc.id,
          messagesLastHour: recentMessages.length,
          lastMessage: new Date(Math.max(...recentMessages)).toLocaleString()
        });
      }
    });

    return activeUsers.sort((a, b) => b.messagesLastHour - a.messagesLastHour);
  } catch (error) {
    console.error('❌ Error fetching rate limits:', error.message);
    return [];
  }
}

async function getCircuitBreakerStatus() {
  try {
    const doc = await db.collection('botSettings').doc('circuitBreaker').get();
    if (!doc.exists) {
      return { status: 'OK', recentCount: 0 };
    }

    const data = doc.data();
    const now = Date.now();
    const windowStart = now - (10 * 60 * 1000); // 10 minutes

    const recentMessages = (data.recentMessages || []).filter(ts => ts > windowStart);

    return {
      status: recentMessages.length >= 50 ? 'TRIPPED' : 'OK',
      recentCount: recentMessages.length,
      threshold: 50
    };
  } catch (error) {
    console.error('❌ Error checking circuit breaker:', error.message);
    return { status: 'UNKNOWN', recentCount: 0 };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const days = parseInt(args[0]) || 7;

  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('   QStash Usage & Safety Monitoring');
  console.log('════════════════════════════════════════════');
  console.log('');

  // QStash Usage
  console.log(`📊 QStash Usage (Last ${days} days)`);
  console.log('────────────────────────────────────────────');
  const usage = await getQStashUsage(days);
  if (usage) {
    console.log(`Total messages processed: ${usage.totalSuccess + usage.totalFailed}`);
    console.log(`  ✅ Successful: ${usage.totalSuccess}`);
    console.log(`  ❌ Failed: ${usage.totalFailed}`);
    console.log('');

    console.log('Daily breakdown:');
    Object.keys(usage.dailyStats).sort().reverse().forEach(date => {
      const stats = usage.dailyStats[date];
      const total = stats.success + stats.failed;
      console.log(`  ${date}: ${total} total (${stats.success} ✅, ${stats.failed} ❌)`);
    });
    console.log('');

    if (Object.keys(usage.userStats).length > 0) {
      console.log('Top users:');
      Object.entries(usage.userStats)
        .sort((a, b) => (b[1].success + b[1].failed) - (a[1].success + a[1].failed))
        .slice(0, 10)
        .forEach(([userId, stats]) => {
          const total = stats.success + stats.failed;
          console.log(`  ${userId}: ${total} messages`);
        });
    }
  }
  console.log('');

  // Circuit Breaker
  console.log('🔥 Circuit Breaker Status');
  console.log('────────────────────────────────────────────');
  const circuitBreaker = await getCircuitBreakerStatus();
  if (circuitBreaker.status === 'TRIPPED') {
    console.log(`🔴 STATUS: TRIPPED`);
    console.log(`   ${circuitBreaker.recentCount} messages in last 10 minutes`);
    console.log(`   Threshold: ${circuitBreaker.threshold}`);
  } else {
    console.log(`🟢 STATUS: OK`);
    console.log(`   ${circuitBreaker.recentCount}/${circuitBreaker.threshold} messages in last 10 minutes`);
  }
  console.log('');

  // Rate Limits
  console.log('⚡ Active Users (Last Hour)');
  console.log('────────────────────────────────────────────');
  const activeUsers = await getRateLimitStatus();
  if (activeUsers.length === 0) {
    console.log('No active users in the last hour');
  } else {
    activeUsers.forEach(user => {
      const warning = user.messagesLastHour >= 25 ? ' ⚠️' : '';
      console.log(`${user.userId}: ${user.messagesLastHour} messages${warning}`);
      console.log(`  Last message: ${user.lastMessage}`);
    });
  }
  console.log('');

  // Recommendations
  if (usage && usage.totalFailed > usage.totalSuccess * 0.1) {
    console.log('⚠️  WARNING: High failure rate detected (>10%)');
    console.log('   Check logs for errors');
    console.log('');
  }

  if (circuitBreaker.recentCount > 30) {
    console.log('⚠️  WARNING: High message volume detected');
    console.log(`   ${circuitBreaker.recentCount} messages in 10 minutes`);
    console.log('');
  }

  process.exit(0);
}

main();
