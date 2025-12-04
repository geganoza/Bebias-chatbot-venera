const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load service account from file
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'bebias-chatbot-key.json'), 'utf8')
);

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: serviceAccount
});

async function checkMetaMessages() {
  console.log('\n=== CHECKING META MESSAGES ===\n');

  try {
    // Check metaMessages collection
    const metaSnapshot = await db.collection('metaMessages').limit(10).get();

    console.log(`Found ${metaSnapshot.size} documents in metaMessages collection:\n`);

    metaSnapshot.forEach(doc => {
      const data = doc.data();
      const messages = data.messages || [];
      console.log(`User ID: ${doc.id}`);
      console.log(`  Message Count: ${messages.length}`);
      console.log(`  Last Updated: ${data.lastUpdated}`);

      // Show last message preview
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        const preview = lastMsg.text?.substring(0, 100) || '[No text]';
        console.log(`  Last Message: ${preview}...`);
      }
      console.log('');
    });

    // Also check conversations collection for comparison
    console.log('\n=== CHECKING CONVERSATIONS ===\n');
    const convSnapshot = await db.collection('conversations').limit(10).get();

    console.log(`Found ${convSnapshot.size} documents in conversations collection:\n`);

    convSnapshot.forEach(doc => {
      const data = doc.data();
      const history = data.history || [];
      console.log(`User ID: ${doc.id}`);
      console.log(`  User Name: ${data.userName || 'Unknown'}`);
      console.log(`  Message Count: ${history.length}`);
      console.log(`  Last Active: ${data.lastActive}`);
      console.log(`  Manual Mode: ${data.manualMode || false}`);
      console.log('');
    });

    // Check for mismatches
    console.log('\n=== CHECKING FOR MISMATCHES ===\n');

    const convIds = new Set();
    const metaIds = new Set();

    const allConvs = await db.collection('conversations').get();
    const allMetas = await db.collection('metaMessages').get();

    allConvs.forEach(doc => convIds.add(doc.id));
    allMetas.forEach(doc => metaIds.add(doc.id));

    const inConvsNotMetas = [...convIds].filter(id => !metaIds.has(id));
    const inMetasNotConvs = [...metaIds].filter(id => !convIds.has(id));

    if (inConvsNotMetas.length > 0) {
      console.log(`❌ ${inConvsNotMetas.length} users in conversations but NOT in metaMessages:`);
      inConvsNotMetas.slice(0, 5).forEach(id => console.log(`   - ${id}`));
      if (inConvsNotMetas.length > 5) {
        console.log(`   ... and ${inConvsNotMetas.length - 5} more`);
      }
    } else {
      console.log('✅ All conversations are synced to metaMessages');
    }

    if (inMetasNotConvs.length > 0) {
      console.log(`\n⚠️ ${inMetasNotConvs.length} users in metaMessages but NOT in conversations:`);
      inMetasNotConvs.slice(0, 5).forEach(id => console.log(`   - ${id}`));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkMetaMessages().then(() => process.exit(0)).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});