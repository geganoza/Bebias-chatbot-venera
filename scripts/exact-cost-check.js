/**
 * Exact cost check - verify all billed calls
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

async function check() {
  console.log('=== EXACT COST VERIFICATION ===\n');
  console.log('User topped up $5, now has $2.58');
  console.log('SPENT: $2.42\n');

  const usage = await db.collection('qstashUsage')
    .orderBy('timestamp', 'asc')
    .get();

  // Filter to Nov 22 only
  const nov22 = usage.docs.filter(d => {
    const ts = d.data().timestamp;
    return ts && ts.startsWith('2025-11-22');
  });

  console.log('=== ALL NOV 22 CALLS (PRODUCTION) ===\n');

  let billedCount = 0;
  let notBilledCount = 0;

  nov22.forEach((doc, i) => {
    const d = doc.data();
    const err = d.error || '';

    // Determine if this was billed
    let billed = false;
    let reason = '';

    if (d.success) {
      billed = true;
      reason = 'SUCCESS - OpenAI called';
    } else if (err.includes('Facebook')) {
      billed = true;
      reason = 'FB ERROR - but OpenAI was called first';
    } else if (err.includes('Kill switch')) {
      billed = false;
      reason = 'BLOCKED before OpenAI';
    } else if (err.includes('429')) {
      billed = false;
      reason = 'REJECTED by OpenAI (quota)';
    } else {
      billed = false;
      reason = 'OTHER error (check if before/after OpenAI)';
    }

    const status = billed ? 'BILLED' : 'NOT BILLED';
    console.log(`${i+1}. ${d.timestamp.split('T')[1].split('.')[0]} | ${status} | ${reason}`);

    if (billed) billedCount++;
    else notBilledCount++;
  });

  console.log(`\n=== PRODUCTION SUMMARY ===`);
  console.log(`Billed calls: ${billedCount}`);
  console.log(`Not billed: ${notBilledCount}`);

  // Cost calculation with more accurate estimates
  const INPUT_TOKENS = 9500;
  const OUTPUT_TOKENS = 500; // More realistic estimate
  const INPUT_COST = INPUT_TOKENS * 0.00001;  // $10/1M
  const OUTPUT_COST = OUTPUT_TOKENS * 0.00003; // $30/1M
  const COST_PER_CALL = INPUT_COST + OUTPUT_COST;

  console.log(`\n=== COST CALCULATION ===`);
  console.log(`Per call: ${INPUT_TOKENS} input + ${OUTPUT_TOKENS} output tokens`);
  console.log(`Per call cost: $${COST_PER_CALL.toFixed(3)}`);

  const prodCost = billedCount * COST_PER_CALL;
  console.log(`\nProduction billed calls: ${billedCount} x $${COST_PER_CALL.toFixed(3)} = $${prodCost.toFixed(2)}`);

  // Test script
  const testCalls = 8;
  const testCost = testCalls * COST_PER_CALL;
  console.log(`Test script calls: ${testCalls} x $${COST_PER_CALL.toFixed(3)} = $${testCost.toFixed(2)}`);

  const total = prodCost + testCost;
  console.log(`\n=== CALCULATED TOTAL: $${total.toFixed(2)} ===`);
  console.log(`=== ACTUAL SPENT: $2.42 ===`);
  console.log(`=== DIFFERENCE: $${(2.42 - total).toFixed(2)} ===`);

  if (total < 2.42) {
    console.log('\n*** POSSIBLE EXPLANATIONS FOR DIFFERENCE ***');
    console.log('1. Output tokens were higher than 500 per call');
    console.log('2. Some calls not logged in Firestore');
    console.log('3. Test script ran more than 8 calls');
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
