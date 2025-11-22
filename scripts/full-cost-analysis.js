/**
 * Full cost analysis - ALL API calls
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

async function analyze() {
  console.log('=== COMPLETE COST ANALYSIS ===\n');

  const usage = await db.collection('qstashUsage')
    .orderBy('timestamp', 'asc')
    .get();

  console.log('Total records in Firestore:', usage.docs.length, '\n');

  // Group by date
  const byDate = {};
  usage.docs.forEach(d => {
    const ts = d.data().timestamp;
    if (!ts) return;
    const date = ts.split('T')[0];
    if (!byDate[date]) byDate[date] = { success: 0, fail: 0, details: [] };
    const data = d.data();
    if (data.success) byDate[date].success++;
    else byDate[date].fail++;
    byDate[date].details.push({
      time: ts.split('T')[1].split('.')[0],
      success: data.success,
      error: data.error ? data.error.substring(0, 60) : null
    });
  });

  console.log('=== PRODUCTION CALLS BY DATE ===\n');
  Object.keys(byDate).sort().forEach(date => {
    const d = byDate[date];
    console.log(`${date}: ${d.success} successful, ${d.fail} failed`);
  });

  console.log('\n=== DETAILED BREAKDOWN ===\n');

  // Count by error type
  let killSwitch = 0;
  let fbError = 0;
  let quotaError = 0;
  let otherError = 0;
  let successful = 0;

  usage.docs.forEach(d => {
    const data = d.data();
    if (data.success) {
      successful++;
    } else if (data.error) {
      if (data.error.includes('Kill switch')) killSwitch++;
      else if (data.error.includes('Facebook')) fbError++;
      else if (data.error.includes('429')) quotaError++;
      else otherError++;
    }
  });

  console.log('Successful calls (billed):', successful);
  console.log('Kill switch (NOT billed - blocked before OpenAI):', killSwitch);
  console.log('Facebook API errors (may be billed - OpenAI succeeded, FB failed):', fbError);
  console.log('429 quota errors (NOT billed - OpenAI rejected):', quotaError);
  console.log('Other errors:', otherError);

  console.log('\n=== COST CALCULATION ===\n');

  // GPT-4-turbo pricing
  const INPUT_PRICE = 10 / 1000000;  // $10 per 1M tokens
  const OUTPUT_PRICE = 30 / 1000000; // $30 per 1M tokens

  // Estimated tokens per call
  const INPUT_PER_CALL = 9500;  // system prompt ~37k chars
  const OUTPUT_PER_CALL = 300;  // average response

  // Production successful calls
  const prodCost = successful * (INPUT_PER_CALL * INPUT_PRICE + OUTPUT_PER_CALL * OUTPUT_PRICE);
  console.log(`1. Production successful calls: ${successful} x ~$0.10 = $${prodCost.toFixed(2)}`);

  // Facebook error calls - these DID hit OpenAI successfully!
  const fbCost = fbError * (INPUT_PER_CALL * INPUT_PRICE + OUTPUT_PER_CALL * OUTPUT_PRICE);
  console.log(`2. Facebook error calls (OpenAI succeeded, FB failed): ${fbError} x ~$0.10 = $${fbCost.toFixed(2)}`);

  // Local test calls (8 successful, not in Firestore)
  const testCalls = 8;
  const testCost = testCalls * (INPUT_PER_CALL * INPUT_PRICE + OUTPUT_PER_CALL * OUTPUT_PRICE);
  console.log(`3. Local test script calls: ${testCalls} x ~$0.10 = $${testCost.toFixed(2)}`);

  console.log('\n--- NOT BILLED ---');
  console.log(`Kill switch blocks: ${killSwitch} (blocked before OpenAI)`);
  console.log(`429 errors: ${quotaError} (rejected by OpenAI)`);

  const total = prodCost + fbCost + testCost;
  console.log(`\n=== ESTIMATED TOTAL COST: $${total.toFixed(2)} ===`);

  console.log('\n=== EXPLANATION ===');
  console.log('- Kill switch = blocked BEFORE calling OpenAI = $0');
  console.log('- 429 errors = OpenAI rejected (quota exceeded) = $0');
  console.log('- Facebook errors = OpenAI SUCCEEDED, then FB failed = BILLED');
  console.log('- Successful = OpenAI + FB both worked = BILLED');
}

analyze().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
