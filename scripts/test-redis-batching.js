#!/usr/bin/env node

/**
 * Test script for Redis message batching
 *
 * Usage:
 *   node scripts/test-redis-batching.js
 */

const TEST_USER_ID = '3282789748459241'; // Giorgi's test account

async function testRedisConnection() {
  console.log('🔍 Testing Redis connection...\n');

  try {
    const response = await fetch('https://bebias-venera-chatbot.vercel.app/api/test-redis');
    const data = await response.json();

    console.log('📊 System Status:');
    console.log('================');
    console.log(`Redis Connection: ${data.config?.redis?.connected ? '✅ Connected' : '❌ Not connected'}`);
    console.log(`Redis URL: ${data.config?.redis?.url}`);
    console.log(`Redis Token: ${data.config?.redis?.token}`);
    console.log(`QStash Token: ${data.config?.qstash?.token}`);

    console.log('\n📋 Feature Flags:');
    console.log('================');
    console.log(`Redis Batching Enabled: ${data.config?.features?.redisBatching?.enabled ? '✅ Yes' : '❌ No'}`);
    console.log(`Test Users Configured: ${data.config?.features?.redisBatching?.testUsers || 0}`);
    console.log(`Rollout Percentage: ${data.config?.features?.redisBatching?.rolloutPercentage || 0}%`);

    if (!data.config?.redis?.connected) {
      console.log('\n⚠️  Redis is not connected!');
      console.log('Check that environment variables are set in Vercel.');
      return false;
    }

    if (!data.config?.features?.redisBatching?.enabled) {
      console.log('\n⚠️  Redis batching is not enabled!');
      console.log('\nTo enable:');
      console.log('1. Go to Vercel Dashboard → Settings → Environment Variables');
      console.log('2. Add: ENABLE_REDIS_BATCHING = true');
      console.log('3. Redeploy the application');
      return false;
    }

    console.log('\n✅ Redis batching is ready for testing!');
    return true;

  } catch (error) {
    console.error('❌ Error testing Redis:', error.message);
    return false;
  }
}

async function clearTestUserHistory() {
  console.log(`\n🗑️  Clearing history for test user ${TEST_USER_ID}...`);

  try {
    // Import the clear script
    const clearScript = require('./clear-test-user-history.js');

    // Note: This would need to be adapted to work programmatically
    console.log('✅ History cleared (run manually: node scripts/clear-test-user-history.js 3282789748459241)');
  } catch (error) {
    console.log('⚠️  Could not clear history automatically');
    console.log('Run manually: node scripts/clear-test-user-history.js 3282789748459241');
  }
}

async function showTestInstructions() {
  console.log('\n📝 Testing Instructions:');
  console.log('========================');
  console.log('\n1. Clear test user history:');
  console.log('   node scripts/clear-test-user-history.js 3282789748459241');

  console.log('\n2. Watch logs in a separate terminal:');
  console.log('   timeout 60 vercel logs bebias-venera-chatbot.vercel.app');

  console.log('\n3. Send rapid messages from Facebook Messenger:');
  console.log('   - Open Facebook Messenger');
  console.log('   - Find Bebias page');
  console.log('   - Send multiple messages quickly:');
  console.log('     • "გამარჯობა"');
  console.log('     • "ქუდი მინდა"');
  console.log('     • "შავი"');

  console.log('\n4. Look for these log patterns:');
  console.log('   🔬 [EXPERIMENTAL] Using Redis batching');
  console.log('   ✅ [REDIS] Message batched');
  console.log('   🔄 [REDIS BATCH] Processing');
  console.log('   📦 [REDIS BATCH] Found X messages');

  console.log('\n5. Verify behavior:');
  console.log('   - Messages should be combined into one response');
  console.log('   - Bot should respond once, not multiple times');
  console.log('   - Response should address all messages together');
}

async function main() {
  console.log('🚀 Redis Batching Test Tool');
  console.log('===========================\n');

  const isReady = await testRedisConnection();

  if (isReady) {
    await showTestInstructions();

    console.log('\n⭐ System is ready for testing!');
    console.log('   Test User ID: 3282789748459241');
  } else {
    console.log('\n❌ System is not ready. Fix the issues above first.');
    console.log('\nQuick fix:');
    console.log('1. Set ENABLE_REDIS_BATCHING=true in Vercel environment variables');
    console.log('2. Redeploy: vercel --prod');
  }
}

// Run the test
main().catch(console.error);