/**
 * Check QStash/API usage in Firestore
 */
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load env
const envProdPath = path.join(__dirname, '..', '.env.prod');
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = fs.existsSync(envProdPath) ? envProdPath : envLocalPath;

if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    if (line.startsWith('#') || !line.trim()) return;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1].trim()] = value;
    }
  });
}

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.replace(/\\n/g, '\n').trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n').trim(),
  },
});

async function checkUsage() {
  // Focus on last 20 minutes
  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  console.log('=== Last 20 Minutes ===');
  console.log('Since:', twentyMinsAgo, '\n');

  const usage = await db.collection('qstashUsage')
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();

  // Filter to last 20 mins only
  const recentDocs = usage.docs.filter(doc => {
    const ts = doc.data().timestamp;
    return ts && ts >= twentyMinsAgo;
  });

  console.log('Calls in last 20 mins:', recentDocs.length);

  let successCount = 0;
  let failCount = 0;

  recentDocs.forEach(doc => {
    const data = doc.data();
    const status = data.success ? 'OK' : 'FAIL';
    const err = data.error ? data.error.substring(0, 60) : '';
    console.log(`  ${data.timestamp} ${status} ${err}`);
    if (data.success) successCount++;
    else failCount++;
  });

  console.log('\nSuccessful:', successCount);
  console.log('Failed:', failCount);

  // Check responded messages
  console.log('\n=== Responded Messages ===');
  const responded = await db.collection('respondedMessages').get();
  console.log('Total responded messages:', responded.size);

  // Check rate limits
  console.log('\n=== Rate Limited Users ===');
  const rateLimits = await db.collection('rateLimits').get();
  if (rateLimits.size === 0) {
    console.log('No rate limited users');
  } else {
    rateLimits.docs.forEach(doc => {
      const data = doc.data();
      console.log('User:', doc.id.substring(0, 10) + '...');
      console.log('  Hourly:', (data.hourlyMessages || []).length);
      console.log('  Daily:', (data.dailyMessages || []).length);
    });
  }
}

checkUsage().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
