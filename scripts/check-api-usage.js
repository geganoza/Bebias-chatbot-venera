const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

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

const db = new Firestore({
  projectId: (process.env.GOOGLE_CLOUD_PROJECT_ID || 'bebias-wp-db-handler').trim(),
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  },
});

async function checkAPIUsage() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log('🔍 Checking OpenAI API usage...\n');

  // Check processed messages in last hour
  const processedHour = await db.collection('processedMessages')
    .where('processedAt', '>', oneHourAgo.toISOString())
    .get();

  console.log(`📊 Last Hour:`);
  console.log(`  Messages processed: ${processedHour.size}`);

  // Check processed messages in last 24h
  const processedDay = await db.collection('processedMessages')
    .where('processedAt', '>', oneDayAgo.toISOString())
    .get();

  console.log(`\n📊 Last 24 Hours:`);
  console.log(`  Messages processed: ${processedDay.size}`);

  // Check active conversations in last hour
  const convosHour = await db.collection('conversations')
    .where('lastActive', '>', oneHourAgo.toISOString())
    .get();

  console.log(`\n👥 Active Users (Last Hour):`);
  console.log(`  Total users: ${convosHour.size}`);

  let totalMessages = 0;
  if (convosHour.size > 0) {
    console.log(`\n  User Details:`);
    convosHour.docs.forEach(doc => {
      const data = doc.data();
      const messageCount = data.history?.length || 0;
      totalMessages += messageCount;
      console.log(`    ${doc.id}: ${messageCount} msgs in history, Last: ${data.lastActive}`);
    });
  }

  console.log(`\n  Total messages in history: ${totalMessages}`);

  // Check active conversations in last 24h
  const convosDay = await db.collection('conversations')
    .where('lastActive', '>', oneDayAgo.toISOString())
    .get();

  console.log(`\n👥 Active Users (Last 24 Hours):`);
  console.log(`  Total users: ${convosDay.size}`);

  // Estimate API costs
  console.log(`\n💰 Estimated OpenAI Usage:`);
  console.log(`  Messages processed (1h): ${processedHour.size} messages`);
  console.log(`  Messages processed (24h): ${processedDay.size} messages`);
  console.log(`  Avg context size: ~${Math.round(totalMessages / Math.max(convosHour.size, 1))} msgs/user`);

  // Rough cost estimate (assuming GPT-4 pricing)
  const avgTokensPerMessage = 500; // Conservative estimate
  const costPerMillionTokens = 30; // GPT-4 turbo approximate
  const estimatedTokens = processedDay.size * avgTokensPerMessage;
  const estimatedCost = (estimatedTokens / 1000000) * costPerMillionTokens;

  console.log(`  Estimated tokens (24h): ~${estimatedTokens.toLocaleString()}`);
  console.log(`  Estimated cost (24h): ~$${estimatedCost.toFixed(2)}`);

  // Check for any suspiciously high activity
  if (processedHour.size > 100) {
    console.log(`\n⚠️  WARNING: High activity detected in last hour (${processedHour.size} messages)`);
  }

  if (convosHour.size > 0) {
    const avgMsgsPerUser = totalMessages / convosHour.size;
    if (avgMsgsPerUser > 50) {
      console.log(`\n⚠️  WARNING: Very long conversations detected (avg ${Math.round(avgMsgsPerUser)} msgs/user)`);
      console.log(`   This increases token usage significantly!`);
    }
  }
}

checkAPIUsage()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
