const { kv } = require('@vercel/kv');

async function checkLatestError() {
    try {
        const keys = await kv.keys('error:*');
        const sorted = keys.sort().reverse(); // Get most recent
        
        console.log(`📋 Total errors: ${keys.length}`);
        console.log(`\n🔍 Latest 3 errors:\n`);
        
        for (const key of sorted.slice(0, 3)) {
            const error = await kv.get(key);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Key: ${key}`);
            console.log(`Time: ${error.timestamp}`);
            console.log(`User message: "${error.userMessage}"`);
            console.log(`Error: ${error.error.message}`);
            console.log(`Code: ${error.error.code}`);
            console.log();
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

checkLatestError();
