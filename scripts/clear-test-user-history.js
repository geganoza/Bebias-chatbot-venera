const { kv } = require('@vercel/kv');

async function clearTestUserHistory() {
    try {
        // Get all conversation keys
        const keys = await kv.keys('conversation:*');
        console.log(`📋 Found ${keys.length} conversations`);

        console.log('\n🔍 Conversations with images:\n');

        const conversationsWithImages = [];

        for (const key of keys) {
            const conversation = await kv.get(key);
            const userId = key.replace('conversation:', '');

            // Check if this conversation has images in history
            let hasImages = false;
            if (conversation && conversation.history) {
                for (const msg of conversation.history) {
                    if (Array.isArray(msg.content)) {
                        for (const part of msg.content) {
                            if (part.type === 'image_url') {
                                hasImages = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (hasImages) {
                conversationsWithImages.push({ key, conversation, userId });
                console.log(`User ID: ${userId}`);
                console.log(`  Name: ${conversation.userName || 'Unknown'}`);
                console.log(`  History length: ${conversation.history?.length || 0}`);
                console.log(`  Has images: Yes ⚠️`);
                console.log();
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Found ${conversationsWithImages.length} conversations with images`);
        console.log('Run with --clear flag to clear their history');
        console.log('Example: node scripts/clear-test-user-history.js --clear');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (process.argv.includes('--clear')) {
            console.log('\n🧹 Clearing conversation histories...\n');

            for (const { key, conversation } of conversationsWithImages) {
                // Clear only the history, keep user info
                conversation.history = [];
                await kv.set(key, conversation);
                console.log(`✅ Cleared history for ${key}`);
            }

            console.log(`\n✅ Cleared ${conversationsWithImages.length} conversation histories`);
            console.log('Users can now send fresh images without errors!');
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

clearTestUserHistory();
