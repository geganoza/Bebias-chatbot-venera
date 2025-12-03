/**
 * Turn bot on - disable kill switch and global pause
 */
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Try .env.prod first (has correct credentials), then .env.local
const envPaths = [
  path.join(__dirname, '..', '.env.prod'),
  path.join(__dirname, '..', '.env.local')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log('Loading env from:', envPath);
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
    break;
  }
}

// Fix private key format and client email
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

async function turnOn() {
  console.log('\n=== TURNING BOT ON ===\n');

  // Disable the main kill switch (used by bot-status API)
  await db.collection('botSettings').doc('botKillSwitch').delete();
  console.log('✅ Main kill switch (botKillSwitch): OFF');

  // Also disable qstashKillSwitch for compatibility
  await db.collection('botSettings').doc('qstashKillSwitch').set({
    active: false,
    reason: 'Manually disabled for testing',
    disabledAt: new Date().toISOString()
  });
  console.log('✅ QStash kill switch: OFF');

  // Disable global pause
  await db.collection('botSettings').doc('global').set({
    paused: false,
    updatedAt: new Date().toISOString()
  });
  console.log('✅ Global pause: OFF');

  console.log('\n🤖 Bot is now ACTIVE and ready for testing!');
}

turnOn().then(() => process.exit(0)).catch(e => { console.error('Error:', e.message); process.exit(1); });
