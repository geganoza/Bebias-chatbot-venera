/**
 * Get full conversation history (not truncated)
 * Usage: node scripts/get-full-conversation.js <senderId>
 */
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const senderId = process.argv[2] || '3282789748459241';

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

async function main() {
  const doc = await db.collection('conversations').doc(senderId).get();

  if (!doc.exists) {
    console.log('Not found');
    return;
  }

  const data = doc.data();
  const history = data.history || [];

  // Get last N messages in full (not truncated)
  const count = parseInt(process.argv[3]) || 5;
  const lastMessages = history.slice(-count);
  lastMessages.forEach((msg, i) => {
    console.log('='.repeat(80));
    console.log('MSG ' + (history.length - 5 + i + 1) + ' [' + msg.role + ']:');
    console.log(msg.content);
  });
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
