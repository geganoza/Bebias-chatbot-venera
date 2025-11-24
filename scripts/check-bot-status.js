/**
 * Check bot status - pause state and kill switch
 */
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load env from .env.prod
const envPath = path.join(__dirname, '..', '.env.prod');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    if (!line.trim() || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx > 0) {
      let key = line.substring(0, idx).trim();
      let val = line.substring(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || '';
privateKey = privateKey.replace(/\\n/g, '\n').trim();

let clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '';
clientEmail = clientEmail.replace(/\\n/g, '').trim();

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
});

async function check() {
  console.log('\n=== BOT STATUS ===\n');

  const globalDoc = await db.collection('botSettings').doc('global').get();
  const killDoc = await db.collection('botSettings').doc('qstashKillSwitch').get();

  console.log('Global paused:', globalDoc.exists ? globalDoc.data().paused : 'not set');
  if (globalDoc.exists) {
    console.log('  Updated at:', globalDoc.data().updatedAt || 'unknown');
  }

  console.log('\nKill switch:');
  if (killDoc.exists) {
    const data = killDoc.data();
    console.log('  Active:', data.active);
    console.log('  Reason:', data.reason || 'none');
    console.log('  Time:', data.disabledAt || data.triggeredAt || 'unknown');
  } else {
    console.log('  Not set');
  }

  // Also check for pending messages
  console.log('\n=== PENDING MESSAGES ===\n');
  const convSnapshot = await db.collection('conversations').get();
  let pendingCount = 0;

  for (const doc of convSnapshot.docs) {
    const data = doc.data();
    const history = data.history || [];
    if (history.length > 0) {
      const lastMsg = history[history.length - 1];
      if (lastMsg.role === 'user') {
        pendingCount++;
        const msgPreview = typeof lastMsg.content === 'string'
          ? lastMsg.content.substring(0, 40)
          : '[Image]';
        console.log(`  - ${data.userName || doc.id}: "${msgPreview}..."`);
      }
    }
  }

  console.log(`\nTotal pending: ${pendingCount} conversations need response`);
}

check().then(() => process.exit(0)).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
