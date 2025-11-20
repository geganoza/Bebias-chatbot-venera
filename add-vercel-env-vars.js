#!/usr/bin/env node

// This script adds QStash environment variables to Vercel
// Run with: node add-vercel-env-vars.js

const { execSync } = require('child_process');

const vars = {
  'QSTASH_URL': 'https://qstash.upstash.io',
  'QSTASH_TOKEN': 'eyJVc2VySUQiOiI2YjRlZjA5OS1iMjhhLTQzNTAtOWIzMC1iZWNiZTFiMmU2MDAiLCJQYXNzd29yZCI6ImU1NzZhMTc5OGQzOTRlNzk4NWJhYTM3OTdlMDU5N2RjIn0=',
  'QSTASH_CURRENT_SIGNING_KEY': 'sig_6w41ipmNcokR3w67vZGAg4BwueCU',
  'QSTASH_NEXT_SIGNING_KEY': 'sig_6nWNJnVF9pea9a6xMpgShptzFFtv'
};

console.log('🚀 Adding QStash environment variables to Vercel...\n');

// Use vercel env command interactively
console.log('Please run these commands manually:');
console.log('==========================================\n');

for (const [key, value] of Object.entries(vars)) {
  console.log(`# Add ${key}`);
  console.log(`vercel env add ${key}`);
  console.log(`# When prompted, paste: ${value}`);
  console.log(`# Select: Production, Preview, Development (all three)\n`);
}

console.log('==========================================');
console.log('\nOr use the Vercel Dashboard:');
console.log('https://vercel.com/giorgis-projects-cea59354/bebias-venera-chatbot/settings/environment-variables');
console.log('\nAdd these variables:');
for (const [key, value] of Object.entries(vars)) {
  console.log(`${key}=${value}`);
}
