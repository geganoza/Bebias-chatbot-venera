/**
 * Process pending messages that were received while bot was paused
 *
 * This script finds conversations where the last message is from a user
 * (not responded to) and re-queues them for processing via QStash.
 *
 * Usage: node scripts/process-pending-messages.js
 */

const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load env from .env.prod
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
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
});

async function processPendingMessages() {
  console.log('🔍 Finding conversations with pending messages...\n');

  try {
    // Get all conversations
    const conversationsSnapshot = await db.collection('conversations').get();

    const pendingConversations = [];

    for (const doc of conversationsSnapshot.docs) {
      const data = doc.data();
      const history = data.history || [];

      if (history.length === 0) continue;

      // Check if last message is from user (meaning bot hasn't responded)
      const lastMessage = history[history.length - 1];
      if (lastMessage.role === 'user') {
        // Check how old the message is
        const lastActive = new Date(data.lastActive);
        const hoursSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60);

        pendingConversations.push({
          senderId: doc.id,
          userName: data.userName || 'Unknown',
          lastMessage: typeof lastMessage.content === 'string'
            ? lastMessage.content.substring(0, 50) + '...'
            : '[Image/Media]',
          lastActive: data.lastActive,
          hoursSinceActive: hoursSinceActive.toFixed(1),
          manualMode: data.manualMode || false
        });
      }
    }

    if (pendingConversations.length === 0) {
      console.log('✅ No pending messages found. All conversations have been responded to.');
      return;
    }

    console.log(`📬 Found ${pendingConversations.length} conversations with pending messages:\n`);

    for (const conv of pendingConversations) {
      console.log(`  User: ${conv.userName} (${conv.senderId})`);
      console.log(`  Last message: "${conv.lastMessage}"`);
      console.log(`  Hours ago: ${conv.hoursSinceActive}`);
      console.log(`  Manual mode: ${conv.manualMode}`);
      console.log('');
    }

    // Check if we should process them
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('Do you want to re-queue these messages for processing? (yes/no): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log('❌ Aborted. No messages re-queued.');
      return;
    }

    // Re-queue messages via QStash
    const qstashToken = process.env.QSTASH_TOKEN;
    if (!qstashToken) {
      console.error('❌ QSTASH_TOKEN not found in environment');
      process.exit(1);
    }

    const callbackUrl = 'https://bebias-venera-chatbot.vercel.app/api/process-message';
    let successCount = 0;
    let skipCount = 0;

    for (const conv of pendingConversations) {
      // Skip if in manual mode
      if (conv.manualMode) {
        console.log(`⏭️ Skipping ${conv.userName} (manual mode)`);
        skipCount++;
        continue;
      }

      // Skip if message is too old (> 24 hours)
      if (parseFloat(conv.hoursSinceActive) > 24) {
        console.log(`⏭️ Skipping ${conv.userName} (message too old: ${conv.hoursSinceActive}h)`);
        skipCount++;
        continue;
      }

      try {
        const response = await fetch(`https://qstash.upstash.io/v2/publish/${callbackUrl}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${qstashToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            senderId: conv.senderId,
            messageId: `recovery-${Date.now()}-${conv.senderId}`
          })
        });

        if (response.ok) {
          console.log(`✅ Re-queued message for ${conv.userName}`);
          successCount++;
        } else {
          const error = await response.text();
          console.error(`❌ Failed to queue ${conv.userName}: ${error}`);
        }
      } catch (error) {
        console.error(`❌ Error queuing ${conv.userName}:`, error.message);
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n✅ Done! Queued: ${successCount}, Skipped: ${skipCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

processPendingMessages().then(() => process.exit(0));
