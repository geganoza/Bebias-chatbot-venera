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
      const value = match[2].trim();
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

async function clearAll() {
  // Clear rate limits
  const rateLimits = await db.collection('rateLimits').get();
  console.log('Deleting', rateLimits.size, 'rate limit records...');
  for (const doc of rateLimits.docs) {
    await db.collection('rateLimits').doc(doc.id).delete();
    console.log('Deleted rateLimits:', doc.id);
  }

  // Clear circuit breaker
  const circuitBreaker = await db.collection('botSettings').doc('circuitBreaker').get();
  if (circuitBreaker.exists) {
    await db.collection('botSettings').doc('circuitBreaker').delete();
    console.log('Deleted circuit breaker');
  }

  // Clear processing locks
  const locks = await db.collection('processingLocks').get();
  console.log('Deleting', locks.size, 'processing locks...');
  for (const doc of locks.docs) {
    await db.collection('processingLocks').doc(doc.id).delete();
  }
  console.log('Deleted processing locks');

  console.log('Done!');
  process.exit(0);
}
clearAll();
