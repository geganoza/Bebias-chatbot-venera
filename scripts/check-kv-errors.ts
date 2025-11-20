/**
 * Script to check for OpenAI errors logged in KV store
 */

import { kv } from '@vercel/kv';

async function main() {
  console.log('\n🔍 Checking KV store for OpenAI errors...\n');

  try {
    // Get all keys matching error pattern
    const keys = await kv.keys('error:openai:*');

    if (keys.length === 0) {
      console.log('✅ No errors found in KV store');
      return;
    }

    console.log(`Found ${keys.length} error(s):\n`);

    // Get all error details
    for (const key of keys.slice(0, 10)) { // Show last 10 errors
      const error = await kv.get(key);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Key: ${key}`);
      console.log(`${'='.repeat(80)}`);
      console.log(JSON.stringify(error, null, 2));
    }

    if (keys.length > 10) {
      console.log(`\n... and ${keys.length - 10} more errors`);
    }

  } catch (error: any) {
    console.error('❌ Error accessing KV store:', error.message);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

main();
