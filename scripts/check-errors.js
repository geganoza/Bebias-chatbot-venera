/**
 * Check QStash error logs
 */
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

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
  console.log('\n=== RECENT QSTASH ERRORS ===\n');

  // Get most recent qstash usage logs with errors
  const snapshot = await db.collection('qstashUsage')
    .orderBy('timestamp', 'desc')
    .limit(30)
    .get();

  const errors = snapshot.docs
    .map(d => d.data())
    .filter(d => d.error);

  if (errors.length === 0) {
    console.log('No errors found in recent logs');
    return;
  }

  console.log(`Found ${errors.length} errors in last 30 logs:\n`);

  // Group by error type
  const errorTypes = {};
  errors.forEach(e => {
    const key = e.error.substring(0, 80);
    errorTypes[key] = (errorTypes[key] || 0) + 1;
  });

  console.log('Error breakdown:');
  Object.entries(errorTypes).forEach(([err, count]) => {
    console.log(`  ${count}x: ${err}...`);
  });

  console.log('\nMost recent errors:');
  errors.slice(0, 10).forEach(e => {
    console.log(`  [${e.timestamp}] ${e.userId}: ${e.error.substring(0, 60)}...`);
  });
}

check().then(() => process.exit(0)).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
