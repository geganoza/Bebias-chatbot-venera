/**
 * Fetch OpenAI usage with date parameter
 */
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

async function getUsage() {
  const apiKey = process.env.OPENAI_API_KEY;

  console.log('=== OpenAI Usage API ===\n');

  // Try with date parameter
  const today = '2025-11-22';

  const response = await fetch(`https://api.openai.com/v1/usage?date=${today}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (data.data && data.data.length > 0) {
    console.log('\n=== ACTUAL USAGE DATA ===');
    data.data.forEach(item => {
      console.log(`Model: ${item.snapshot_id || item.aggregation_timestamp}`);
      console.log(`  Requests: ${item.n_requests}`);
      console.log(`  Context tokens: ${item.n_context_tokens_total}`);
      console.log(`  Generated tokens: ${item.n_generated_tokens_total}`);
    });
  }
}

getUsage().catch(e => console.error(e));
