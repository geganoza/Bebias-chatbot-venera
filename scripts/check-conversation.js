/**
 * Check a specific conversation's history
 * Usage: node scripts/check-conversation.js <senderId>
 */
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const senderId = process.argv[2] || '3282789748459241'; // Default to Giorgi

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
  credentials: { client_email: clientEmail, private_key: privateKey },
});

async function check() {
  console.log(`\n=== Conversation ${senderId} ===\n`);

  const doc = await db.collection('conversations').doc(senderId).get();
  if (!doc.exists) {
    console.log('Conversation not found');
    return;
  }

  const data = doc.data();
  console.log('User:', data.userName || 'Unknown');
  console.log('Last active:', data.lastActive);
  console.log('Manual mode:', data.manualMode || false);
  console.log('\nLast 8 messages:');

  const last8 = (data.history || []).slice(-8);
  last8.forEach((m, i) => {
    const text = typeof m.content === 'string' ? m.content.substring(0, 100) : '[Media/Image]';
    const role = m.role === 'user' ? '👤 USER' : '🤖 BOT';
    console.log(`${i + 1}. ${role}: ${text}...`);
  });
}

check().then(() => process.exit(0)).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
