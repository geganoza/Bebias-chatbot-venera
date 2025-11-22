/**
 * Detailed cost investigation
 */
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load env
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

async function investigate() {
  console.log('=== DETAILED COST INVESTIGATION ===\n');

  // Get ALL usage
  const usage = await db.collection('qstashUsage')
    .orderBy('timestamp', 'asc')
    .get();

  // Filter to Nov 22 only
  const todayCalls = usage.docs.filter(d => {
    const ts = d.data().timestamp;
    return ts && ts.startsWith('2025-11-22');
  });

  console.log('PRODUCTION CALLS ON NOV 22 (from Firestore):\n');
  console.log('Total production calls logged:', todayCalls.length);

  todayCalls.forEach((doc, i) => {
    const d = doc.data();
    const status = d.success ? 'SUCCESS' : 'FAIL';
    const err = d.error ? d.error.substring(0, 60) : '';
    console.log(`${i+1}. ${d.timestamp} | ${status} | ${err}`);
  });

  const success = todayCalls.filter(d => d.data().success).length;
  const fail = todayCalls.filter(d => !d.data().success).length;
  console.log(`\nProduction: ${success} success, ${fail} failed\n`);

  console.log('=== IMPORTANT NOTE ===');
  console.log('The test-ai-compliance.js script runs LOCALLY.');
  console.log('It calls OpenAI DIRECTLY, NOT through production.');
  console.log('Those calls are NOT logged in Firestore.\n');

  console.log('=== TEST SCRIPT ANALYSIS ===');
  console.log('The test script ran: 9 test scenarios');
  console.log('First call failed (429 before top-up): 1 call');
  console.log('Successful calls after top-up: 8 calls');
  console.log('Model used: gpt-4-turbo');
  console.log('System prompt size: 37,978 characters (~9,500 tokens)\n');

  console.log('=== COST CALCULATION ===');
  console.log('GPT-4 Turbo pricing:');
  console.log('  Input:  $10.00 / 1M tokens');
  console.log('  Output: $30.00 / 1M tokens\n');

  const inputTokensPerCall = 9500;
  const outputTokensPerCall = 300;
  const successfulCalls = 8;

  const totalInput = successfulCalls * inputTokensPerCall;
  const totalOutput = successfulCalls * outputTokensPerCall;

  const inputCost = (totalInput / 1000000) * 10;
  const outputCost = (totalOutput / 1000000) * 30;
  const totalCost = inputCost + outputCost;

  console.log(`8 successful test calls:`);
  console.log(`  Input:  ${totalInput.toLocaleString()} tokens = $${inputCost.toFixed(3)}`);
  console.log(`  Output: ${totalOutput.toLocaleString()} tokens = $${outputCost.toFixed(3)}`);
  console.log(`  TOTAL:  $${totalCost.toFixed(2)}\n`);

  console.log('=== WHERE DID THE REST GO? ===');
  console.log('If you spent $3 total but test was ~$0.84:');
  console.log('  - 429 errors BEFORE quota exceeded = $0 (rejected before processing)');
  console.log('  - But calls that START processing before 429 = still charged');
  console.log('  - Production calls (logged above) = additional costs');
}

investigate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
