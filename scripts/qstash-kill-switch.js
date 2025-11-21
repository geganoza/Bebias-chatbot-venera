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

async function getKillSwitchStatus() {
  try {
    const doc = await db.collection('botSettings').doc('qstashKillSwitch').get();
    if (!doc.exists) {
      console.log('🟢 Kill switch: INACTIVE (default state)');
      return false;
    }

    const data = doc.data();
    if (data.active) {
      console.log('🔴 Kill switch: ACTIVE');
      console.log(`   Reason: ${data.reason || 'Not specified'}`);
      console.log(`   Activated at: ${data.triggeredAt || 'Unknown'}`);
      console.log(`   Auto-triggered: ${data.autoTriggered ? 'Yes' : 'No'}`);
      return true;
    } else {
      console.log('🟢 Kill switch: INACTIVE');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking kill switch:', error.message);
    process.exit(1);
  }
}

async function activateKillSwitch(reason) {
  try {
    await db.collection('botSettings').doc('qstashKillSwitch').set({
      active: true,
      reason: reason || 'Manual activation',
      triggeredAt: new Date().toISOString(),
      autoTriggered: false
    });
    console.log('✅ Kill switch ACTIVATED');
    console.log(`   Reason: ${reason || 'Manual activation'}`);
    console.log('');
    console.log('⚠️  All QStash processing is now DISABLED');
    console.log('   Messages will be queued but not processed');
  } catch (error) {
    console.error('❌ Error activating kill switch:', error.message);
    process.exit(1);
  }
}

async function deactivateKillSwitch() {
  try {
    await db.collection('botSettings').doc('qstashKillSwitch').delete();
    console.log('✅ Kill switch DEACTIVATED');
    console.log('   QStash processing is now ENABLED');

    // Reset circuit breaker too
    await db.collection('botSettings').doc('circuitBreaker').set({
      recentMessages: [],
      lastUpdated: new Date().toISOString()
    });
    console.log('   Circuit breaker has been reset');
  } catch (error) {
    console.error('❌ Error deactivating kill switch:', error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('   QStash Kill Switch Management');
  console.log('════════════════════════════════════════════');
  console.log('');

  if (command === 'status') {
    await getKillSwitchStatus();
  } else if (command === 'activate') {
    const reason = args.slice(1).join(' ');
    if (!reason) {
      console.log('❌ Please provide a reason for activation');
      console.log('Usage: node scripts/qstash-kill-switch.js activate "reason here"');
      process.exit(1);
    }
    await activateKillSwitch(reason);
  } else if (command === 'deactivate') {
    await deactivateKillSwitch();
  } else {
    console.log('Usage:');
    console.log('  node scripts/qstash-kill-switch.js status');
    console.log('  node scripts/qstash-kill-switch.js activate "Reason for stopping"');
    console.log('  node scripts/qstash-kill-switch.js deactivate');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/qstash-kill-switch.js activate "High costs detected"');
    console.log('  node scripts/qstash-kill-switch.js activate "Maintenance mode"');
    process.exit(1);
  }

  console.log('');
  process.exit(0);
}

main();
