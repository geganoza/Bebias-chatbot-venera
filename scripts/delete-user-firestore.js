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

// Initialize Firestore with same config as lib/firestore.ts
const db = new Firestore({
  projectId: (process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bebias-wp-db-handler').trim(),
  credentials: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  } : undefined,
});

async function deleteUserConversation(userName) {
  try {
    console.log(`🔍 Searching for user: "${userName}"`);

    // Get all conversations
    const conversationsSnapshot = await db.collection('conversations').get();

    console.log(`📋 Found ${conversationsSnapshot.size} total conversations`);

    let found = false;
    const matches = [];

    // Search through all conversations
    for (const doc of conversationsSnapshot.docs) {
      const data = doc.data();
      if (data.userName && data.userName.toLowerCase().includes(userName.toLowerCase())) {
        matches.push({
          userId: doc.id,
          userName: data.userName,
          historyLength: data.history?.length || 0,
          orders: data.orders?.length || 0
        });
      }
    }

    if (matches.length === 0) {
      console.log(`❌ No user found matching: "${userName}"`);
      return;
    }

    console.log(`\n✅ Found ${matches.length} matching user(s):\n`);

    matches.forEach((match, index) => {
      console.log(`${index + 1}. User ID: ${match.userId}`);
      console.log(`   Name: ${match.userName}`);
      console.log(`   History: ${match.historyLength} messages`);
      console.log(`   Orders: ${match.orders}`);
      console.log();
    });

    // If --delete flag is provided, delete all matches
    if (process.argv.includes('--delete')) {
      console.log('🗑️  Deleting conversations...\n');

      for (const match of matches) {
        // Delete from conversations
        await db.collection('conversations').doc(match.userId).delete();
        console.log(`✅ Deleted conversation: ${match.userId} (${match.userName})`);

        // Delete from metaMessages if exists
        const metaDoc = await db.collection('metaMessages').doc(match.userId).get();
        if (metaDoc.exists) {
          await db.collection('metaMessages').doc(match.userId).delete();
          console.log(`✅ Deleted metaMessages: ${match.userId}`);
        }
      }

      console.log(`\n✅ Deleted ${matches.length} user conversation(s)`);
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Run with --delete flag to delete these conversations');
      console.log(`Example: node scripts/delete-user-firestore.js "${userName}" --delete`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  process.exit(0);
}

// Get user name from command line argument
const userName = process.argv[2];

if (!userName) {
  console.log('❌ Please provide a user name');
  console.log('Usage: node scripts/delete-user-firestore.js "User Name" [--delete]');
  process.exit(1);
}

deleteUserConversation(userName);
