/**
 * Check conversation history sizes
 */
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

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

async function check() {
  console.log('=== CONVERSATION HISTORY SIZES ===\n');

  const conversations = await db.collection('conversations').get();

  console.log('Total conversations:', conversations.size, '\n');

  const sizes = [];

  conversations.docs.forEach(doc => {
    const data = doc.data();
    const history = data.history || [];

    // Calculate total characters in history
    let totalChars = 0;
    history.forEach(msg => {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      } else if (Array.isArray(msg.content)) {
        // Image messages
        msg.content.forEach(c => {
          if (c.text) totalChars += c.text.length;
        });
      }
    });

    const estimatedTokens = Math.round(totalChars / 4);

    sizes.push({
      id: doc.id.substring(0, 15) + '...',
      messages: history.length,
      chars: totalChars,
      tokens: estimatedTokens
    });
  });

  // Sort by tokens descending
  sizes.sort((a, b) => b.tokens - a.tokens);

  console.log('Top 10 largest conversations:\n');
  sizes.slice(0, 10).forEach((s, i) => {
    console.log(`${i + 1}. ${s.id}: ${s.messages} messages, ${s.chars.toLocaleString()} chars, ~${s.tokens.toLocaleString()} tokens`);
  });

  const totalTokens = sizes.reduce((sum, s) => sum + s.tokens, 0);
  const avgTokens = Math.round(totalTokens / sizes.length);

  console.log('\n=== SUMMARY ===');
  console.log('Total conversations:', sizes.length);
  console.log('Total tokens in all histories:', totalTokens.toLocaleString());
  console.log('Average tokens per conversation:', avgTokens.toLocaleString());
  console.log('Largest conversation:', sizes[0]?.tokens.toLocaleString(), 'tokens');
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
