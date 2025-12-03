#!/usr/bin/env node

const https = require('https');

console.log('🔍 Checking if ENABLE_REDIS_BATCHING is set on Vercel...\n');

// Check the debug endpoint
https.get('https://bebias-venera-chatbot.vercel.app/api/debug-batching', (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);

      console.log('Environment Variable Status:');
      console.log('----------------------------');
      console.log(`ENABLE_REDIS_BATCHING = "${result.env_var}"`);
      console.log(`Equals "true"? ${result.equals_true ? '✅ YES' : '❌ NO'}`);
      console.log(`Feature enabled for test user? ${result.feature_enabled_for_giorgi ? '✅ YES' : '❌ NO'}`);

      if (!result.equals_true) {
        console.log('\n❌ PROBLEM FOUND!');
        console.log('ENABLE_REDIS_BATCHING is not set to "true" on Vercel.');
        console.log('\nTO FIX:');
        console.log('1. Go to vercel.com');
        console.log('2. Open project settings');
        console.log('3. Add environment variable:');
        console.log('   Key: ENABLE_REDIS_BATCHING');
        console.log('   Value: true');
        console.log('4. Redeploy the project');
      } else {
        console.log('\n✅ Environment variable is set correctly!');
        console.log('Batching should be working now.');
      }
    } catch (err) {
      console.log('Response:', data);
      console.log('\n⏳ Debug endpoint not deployed yet.');
      console.log('Wait a few minutes for deployment to complete.');
    }
  });
}).on('error', (err) => {
  console.error('Error checking endpoint:', err.message);
});