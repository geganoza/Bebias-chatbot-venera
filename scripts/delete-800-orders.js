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

const db = new Firestore({
  projectId: (process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bebias-wp-db-handler').trim(),
  credentials: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  } : undefined,
});

async function deleteOrders() {
  console.log('🔍 Finding all orders starting with 800...\n');

  const snapshot = await db.collection('orders').get();
  const orders = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(o => o.id.startsWith('800'))
    .sort((a, b) => a.id.localeCompare(b.id));

  console.log(`Found ${orders.length} orders:\n`);
  orders.forEach(o => {
    console.log(`  - ${o.id}: ${o.product} (${o.clientName})`);
  });

  // Filter out 800004 - delete all others
  const toDelete = orders.filter(o => o.id !== '800004');

  console.log(`\n🗑️  Deleting ${toDelete.length} orders (keeping 800004)...\n`);

  for (const order of toDelete) {
    try {
      await db.collection('orders').doc(order.id).delete();
      console.log(`  ✅ Deleted ${order.id}`);
    } catch (error) {
      console.error(`  ❌ Failed to delete ${order.id}:`, error.message);
    }
  }

  console.log('\n✅ Done!');
}

deleteOrders().then(() => process.exit(0)).catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
