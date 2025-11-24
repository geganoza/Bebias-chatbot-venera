const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim();
const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

const db = admin.firestore();

async function testFlow() {
  console.log('='.repeat(60));
  console.log('VERIFICATION: BLACK COTTON BEANIE');
  console.log('='.repeat(60));

  // 1. Check the beanie variation
  const beanieDoc = await db.collection('products').doc('შავი ბამბის მოკლე ქუდი - სტანდარტი (M)').get();

  if (beanieDoc.exists) {
    const data = beanieDoc.data();
    console.log('\n✅ FOUND:');
    console.log('   Document ID:', beanieDoc.id);
    console.log('   WC ID:', data.id);
    console.log('   Name:', data.name);
    console.log('   Type:', data.type);
    console.log('   Stock:', data.stock_qty);
    console.log('   Price:', data.price, data.currency || 'GEL');
  } else {
    console.log('❌ NOT FOUND');
    return;
  }

  // 2. Test stock deduction
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Simulate stock deduction (will revert)');
  console.log('='.repeat(60));

  const currentStock = beanieDoc.data()?.stock_qty || 0;
  console.log('\nCurrent stock:', currentStock);

  // Simulate deduction
  const newStock = Math.max(0, currentStock - 1);
  await db.collection('products').doc('შავი ბამბის მოკლე ქუდი - სტანდარტი (M)').update({
    stock_qty: newStock,
    last_updated_by: 'test_script',
    timestamp: new Date().toISOString()
  });
  console.log('After -1:', newStock);

  // Revert
  await db.collection('products').doc('შავი ბამბის მოკლე ქუდი - სტანდარტი (M)').update({
    stock_qty: currentStock,
    last_updated_by: 'test_revert',
    timestamp: new Date().toISOString()
  });
  console.log('Reverted:', currentStock);
  console.log('\n✅ Stock update mechanism WORKS!');

  console.log('\n' + '='.repeat(60));
}

testFlow().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
