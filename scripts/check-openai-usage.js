/**
 * Try to fetch OpenAI usage via API
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

async function checkUsage() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log('No OPENAI_API_KEY found');
    return;
  }

  console.log('Checking OpenAI usage...\n');
  console.log('API Key prefix:', apiKey.substring(0, 20) + '...');

  // Try different endpoints
  const endpoints = [
    'https://api.openai.com/v1/usage',
    'https://api.openai.com/dashboard/billing/usage',
    'https://api.openai.com/v1/organization/usage'
  ];

  for (const url of endpoints) {
    try {
      console.log(`\nTrying: ${url}`);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const text = await response.text();
      console.log('Status:', response.status);
      console.log('Response:', text.substring(0, 500));
    } catch (error) {
      console.log('Error:', error.message);
    }
  }

  console.log('\n=== CONCLUSION ===');
  console.log('OpenAI usage data requires dashboard access (browser login).');
  console.log('The API key alone cannot access billing/usage information.');
  console.log('\nYou need to check manually at:');
  console.log('https://platform.openai.com/usage');
}

checkUsage();
