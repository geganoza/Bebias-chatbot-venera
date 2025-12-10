const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const snapshot = await db.collection('products').get();
  const products = snapshot.docs.map(doc => ({
    docId: doc.id,
    name: doc.data().name,
    price: doc.data().price,
    stock_qty: doc.data().stock_qty,
    type: doc.data().type
  }));
  
  // Find black beanie products
  const beanies = products.filter(p => 
    p.docId.toLowerCase().includes('შავ') || 
    (p.name && p.name.toLowerCase().includes('შავ')) ||
    p.docId.toLowerCase().includes('ქუდ')
  );
  
  console.log('Black beanie products found:');
  beanies.forEach(p => {
    console.log('  - DocID: "' + p.docId + '"');
    console.log('    Name: "' + p.name + '"');
    console.log('    Stock: ' + p.stock_qty + ', Price: ' + p.price + ', Type: ' + p.type);
    console.log('');
  });
}

check().then(() => process.exit(0));
