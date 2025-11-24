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

let privateKey = (process.env.GOOGLE_CLOUD_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
let clientEmail = (process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '').replace(/\\n/g, '').trim();

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: { client_email: clientEmail, private_key: privateKey },
});

(async () => {
  // Check for products updated by wordpress or woocommerce
  const allProducts = await db.collection('products').get();

  const wpUpdated = [];
  const chatbotUpdated = [];

  allProducts.docs.forEach(d => {
    const p = d.data();
    const updater = p.last_updated_by || 'unknown';
    const ts = p.timestamp;

    if (updater.includes('wordpress') || updater.includes('woocommerce')) {
      wpUpdated.push({ name: d.id.substring(0, 35), updater, ts });
    } else if (updater === 'chatbot') {
      chatbotUpdated.push({ name: d.id.substring(0, 35), updater, ts });
    }
  });

  console.log('Products by update source:');
  console.log('  WordPress/WooCommerce:', wpUpdated.length);
  console.log('  Chatbot:', chatbotUpdated.length);

  // Sort by timestamp and show most recent
  wpUpdated.sort((a, b) => {
    const aTime = a.ts?.toDate?.()?.getTime?.() || 0;
    const bTime = b.ts?.toDate?.()?.getTime?.() || 0;
    return bTime - aTime;
  });

  console.log('\nMost recent WP/WC updates:');
  wpUpdated.slice(0, 5).forEach(p => {
    const ts = p.ts?.toDate?.() || p.ts;
    console.log(' ', p.name, '| by:', p.updater, '| ts:', ts);
  });

  chatbotUpdated.sort((a, b) => {
    const aTime = a.ts?.toDate?.()?.getTime?.() || 0;
    const bTime = b.ts?.toDate?.()?.getTime?.() || 0;
    return bTime - aTime;
  });

  console.log('\nMost recent Chatbot updates:');
  chatbotUpdated.slice(0, 5).forEach(p => {
    const ts = p.ts?.toDate?.() || p.ts;
    console.log(' ', p.name, '| by:', p.updater, '| ts:', ts);
  });

  // Check orders with WP source
  console.log('\n--- Orders ---');
  const orders = await db.collection('orders').orderBy('timestamp', 'desc').limit(20).get();

  let wpOrders = 0;
  let chatbotOrders = 0;

  orders.docs.forEach(d => {
    const o = d.data();
    if (o.action === 'new_order' || o.source === 'wordpress') {
      wpOrders++;
      console.log('WP Order:', d.id, '| timestamp:', o.timestamp);
    } else if (o.source === 'messenger' || o.source === 'chat') {
      chatbotOrders++;
    }
  });

  console.log('\nOrder sources (last 20):');
  console.log('  WordPress orders:', wpOrders);
  console.log('  Chatbot orders:', chatbotOrders);
})();
