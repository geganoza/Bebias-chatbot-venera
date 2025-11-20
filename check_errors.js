const { kv } = require('@vercel/kv');

async function checkErrors() {
    try {
        // Try to get recent error logs
        const keys = await kv.keys('error:*');
        console.log('📋 Found error keys:', keys);
        
        for (const key of keys.slice(0, 5)) {
            const error = await kv.get(key);
            console.log(`\n🔍 ${key}:`);
            console.log(JSON.stringify(error, null, 2));
        }
    } catch (err) {
        console.error('Error checking KV:', err.message);
    }
    process.exit(0);
}

checkErrors();
