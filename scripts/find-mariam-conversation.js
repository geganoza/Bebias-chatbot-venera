const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.prod');
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
}

// Fix private key format
let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || '';
privateKey = privateKey.replace(/\\n/g, '\n').trim();

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: privateKey,
  },
});

async function findMariam() {
  console.log('\n=== SEARCHING FOR MARIAM TABAGARI ===\n');

  // Check conversations collection
  console.log('Checking conversations collection...');
  const convSnapshot = await db.collection('conversations').get();

  let found = false;
  convSnapshot.forEach(doc => {
    const data = doc.data();
    const history = data.history || [];

    // Check if any message mentions Mariam or the conversation content
    const hasMariam = history.some(msg => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      return content.includes('Mariam') || content.includes('მარიამ') ||
             content.includes('ტაბაგარი') || content.includes('Tabagari') ||
             content.includes('ჯერბარ') || content.includes('კურიერის');
    });

    if (hasMariam || data.userName?.includes('Mariam') || data.userName?.includes('Tabagari')) {
      found = true;
      console.log(`\n✅ FOUND in conversations:`);
      console.log(`   User ID: ${doc.id}`);
      console.log(`   User Name: ${data.userName || 'Unknown'}`);
      console.log(`   Last Active: ${data.lastActive}`);
      console.log(`   Message Count: ${history.length}`);

      // Show last few messages
      console.log(`   Last messages:`);
      history.slice(-3).forEach(msg => {
        const preview = typeof msg.content === 'string' ?
          msg.content.substring(0, 100) : JSON.stringify(msg.content).substring(0, 100);
        console.log(`      ${msg.role}: ${preview}...`);
      });
    }
  });

  // Check metaMessages collection
  console.log('\nChecking metaMessages collection...');
  const metaSnapshot = await db.collection('metaMessages').get();

  metaSnapshot.forEach(doc => {
    const data = doc.data();
    const messages = data.messages || [];

    const hasMariam = messages.some(msg =>
      msg.text?.includes('Mariam') || msg.text?.includes('მარიამ') ||
      msg.text?.includes('კურიერის') || msg.text?.includes('ჯერბარ')
    );

    if (hasMariam) {
      found = true;
      console.log(`\n✅ FOUND in metaMessages:`);
      console.log(`   User ID: ${doc.id}`);
      console.log(`   Message Count: ${messages.length}`);
      console.log(`   Last Update: ${data.lastUpdated}`);
    }
  });

  if (!found) {
    console.log('\n❌ No conversation found for Mariam Tabagari');
    console.log('   This means the conversation might not be saved properly');
  }

  // List all conversation IDs to check
  console.log('\n📋 All conversation IDs in system:');
  convSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}: ${data.userName || 'Unknown'} (${data.history?.length || 0} messages)`);
  });
}

findMariam().then(() => process.exit(0)).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});