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
    const doc = await db.collection('botSettings').doc('botKillSwitch').get();
    if (!doc.exists) {
      console.log('🟢 Bot Status: ACTIVE (running normally)');
      return false;
    }

    const data = doc.data();
    if (data.active) {
      console.log('🔴 Bot Status: PAUSED');
      console.log(`   Reason: ${data.reason || 'Not specified'}`);
      console.log(`   Paused at: ${data.pausedAt || 'Unknown'}`);
      console.log(`   Paused by: ${data.pausedBy || 'Manual'}`);
      console.log('');
      console.log('   ⚠️  Bot is NOT responding to messages');
      console.log('   ⚠️  Manager must handle customers manually');
      return true;
    } else {
      console.log('🟢 Bot Status: ACTIVE (running normally)');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking bot status:', error.message);
    process.exit(1);
  }
}

async function pauseBot(reason) {
  try {
    await db.collection('botSettings').doc('botKillSwitch').set({
      active: true,
      reason: reason || 'Manual pause',
      pausedAt: new Date().toISOString(),
      pausedBy: 'Manual'
    });
    console.log('✅ Bot PAUSED');
    console.log(`   Reason: ${reason || 'Manual pause'}`);
    console.log('');
    console.log('⚠️  Bot will NOT respond to any messages');
    console.log('⚠️  Messages will be silently dropped');
    console.log('⚠️  Manager must handle all customers manually');
    console.log('');
    console.log('To resume: node scripts/bot-kill-switch.js resume');
  } catch (error) {
    console.error('❌ Error pausing bot:', error.message);
    process.exit(1);
  }
}

async function resumeBot() {
  try {
    await db.collection('botSettings').doc('botKillSwitch').delete();
    console.log('✅ Bot RESUMED');
    console.log('   Bot is now responding to messages normally');
  } catch (error) {
    console.error('❌ Error resuming bot:', error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('   BEBIAS Bot Kill Switch');
  console.log('════════════════════════════════════════════');
  console.log('');

  if (command === 'status') {
    await getKillSwitchStatus();
  } else if (command === 'pause') {
    const reason = args.slice(1).join(' ');
    if (!reason) {
      console.log('❌ Please provide a reason for pausing');
      console.log('Usage: node scripts/bot-kill-switch.js pause "reason here"');
      process.exit(1);
    }
    await pauseBot(reason);
  } else if (command === 'resume') {
    await resumeBot();
  } else {
    console.log('Usage:');
    console.log('  node scripts/bot-kill-switch.js status');
    console.log('  node scripts/bot-kill-switch.js pause "Reason for pausing"');
    console.log('  node scripts/bot-kill-switch.js resume');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/bot-kill-switch.js pause "Maintenance - updating products"');
    console.log('  node scripts/bot-kill-switch.js pause "Testing new features"');
    console.log('  node scripts/bot-kill-switch.js pause "Emergency - handling issue manually"');
    process.exit(1);
  }

  console.log('');
  process.exit(0);
}

main();
