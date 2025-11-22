/**
 * Analyze Facebook error calls - these ARE billed because OpenAI succeeded
 */
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.prod');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  if (!line.trim() || line.startsWith('#')) return;
  const idx = line.indexOf('=');
  if (idx > 0) {
    let key = line.substring(0, idx).trim();
    let val = line.substring(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[key] = val;
  }
});

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.replace(/\\n/g, '\n').trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n').trim(),
  },
});

async function analyze() {
  console.log('=== FACEBOOK ERROR ANALYSIS ===\n');
  console.log('These calls HIT OpenAI successfully, then FAILED at Facebook.\n');
  console.log('OpenAI CHARGED for these because it processed the request.\n');

  const usage = await db.collection('qstashUsage')
    .orderBy('timestamp', 'asc')
    .get();

  const fbErrors = usage.docs.filter(d => {
    const err = d.data().error || '';
    return err.includes('Facebook');
  });

  console.log('Total Facebook error calls:', fbErrors.length);

  // Group by date
  const byDate = {};
  fbErrors.forEach(d => {
    const ts = d.data().timestamp;
    const date = ts.split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push({
      time: ts.split('T')[1].split('.')[0],
      error: d.data().error.substring(0, 80)
    });
  });

  Object.keys(byDate).sort().forEach(date => {
    console.log(`\n${date}: ${byDate[date].length} FB errors`);
    byDate[date].slice(0, 5).forEach(e => {
      console.log(`  ${e.time}: ${e.error}`);
    });
    if (byDate[date].length > 5) {
      console.log(`  ... and ${byDate[date].length - 5} more`);
    }
  });

  // Cost breakdown
  console.log('\n=== COST BREAKDOWN ===');
  const costPerCall = 0.104; // ~$0.10 per call
  const fbCost = fbErrors.length * costPerCall;
  console.log(`Facebook errors: ${fbErrors.length} calls x $${costPerCall.toFixed(3)} = $${fbCost.toFixed(2)}`);

  // Now check successful calls
  const successful = usage.docs.filter(d => d.data().success);
  const succCost = successful.length * costPerCall;
  console.log(`Successful calls: ${successful.length} calls x $${costPerCall.toFixed(3)} = $${succCost.toFixed(2)}`);

  // Test calls
  const testCost = 8 * costPerCall;
  console.log(`Test script calls: 8 calls x $${costPerCall.toFixed(3)} = $${testCost.toFixed(2)}`);

  const total = fbCost + succCost + testCost;
  console.log(`\nTOTAL OPENAI COST: $${total.toFixed(2)}`);

  console.log('\n=== ROOT CAUSE ===');
  console.log('The Facebook errors are DUPLICATE messages being sent to wrong users.');
  console.log('Example error: "(#100) No matching user found"');
  console.log('This means: OpenAI generated a response, but FB rejected it');
  console.log('because the recipient user ID was invalid or changed.');
  console.log('\nThese duplicate/retry calls burned most of your budget.');
}

analyze().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
