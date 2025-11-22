/**
 * Deep check of conversation history content
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
  console.log('=== DEEP CONVERSATION HISTORY CHECK ===\n');

  const conversations = await db.collection('conversations').get();

  let totalMessages = 0;
  let totalChars = 0;
  let imageCount = 0;

  conversations.docs.forEach(doc => {
    const data = doc.data();
    const history = data.history || [];
    const id = doc.id.substring(0, 15);

    console.log(`\n--- ${id}... (${history.length} messages) ---`);

    history.forEach((msg, i) => {
      totalMessages++;
      let chars = 0;
      let type = 'text';

      if (typeof msg.content === 'string') {
        chars = msg.content.length;
        console.log(`  ${i+1}. ${msg.role}: ${chars} chars - "${msg.content.substring(0, 50)}..."`);
      } else if (Array.isArray(msg.content)) {
        // Check for images
        msg.content.forEach(c => {
          if (c.type === 'image_url') {
            imageCount++;
            type = 'IMAGE';
            // Check if it's base64 (huge!) or URL
            const url = c.image_url?.url || '';
            if (url.startsWith('data:')) {
              chars += url.length;
              console.log(`  ${i+1}. ${msg.role}: IMAGE (base64) - ${url.length.toLocaleString()} chars!!!`);
            } else {
              chars += url.length;
              console.log(`  ${i+1}. ${msg.role}: IMAGE (url) - ${url.length} chars`);
            }
          } else if (c.type === 'text') {
            chars += (c.text || '').length;
          }
        });
        if (type === 'text') {
          console.log(`  ${i+1}. ${msg.role}: ${chars} chars (array)`);
        }
      }

      totalChars += chars;
    });
  });

  console.log('\n=== SUMMARY ===');
  console.log('Total messages:', totalMessages);
  console.log('Total characters:', totalChars.toLocaleString());
  console.log('Images found:', imageCount);
  console.log('Est. tokens (English):', Math.round(totalChars / 4).toLocaleString());
  console.log('Est. tokens (Georgian):', Math.round(totalChars / 1.5).toLocaleString());

  // Now check the ACTUAL system prompt size
  console.log('\n=== SYSTEM PROMPT CHECK ===');

  const files = [
    'bot-instructions.md', 'tone-style.md', 'image-handling.md',
    'product-recognition.md', 'purchase-flow.md', 'delivery-calculation.md',
    'contact-policies.md', 'services.md', 'faqs.md', 'delivery-info.md', 'payment-info.md'
  ];

  let totalPromptChars = 0;
  files.forEach(f => {
    try {
      const content = fs.readFileSync(path.join(__dirname, '..', 'data', 'content', f), 'utf8');
      const georgianChars = (content.match(/[\u10A0-\u10FF]/g) || []).length;
      const pct = Math.round(georgianChars / content.length * 100);
      console.log(`${f}: ${content.length.toLocaleString()} chars (${pct}% Georgian)`);
      totalPromptChars += content.length;
    } catch (e) {
      console.log(`${f}: not found`);
    }
  });

  // Products
  try {
    const products = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8'));
    const productStr = JSON.stringify(products);
    console.log(`products.json: ${productStr.length.toLocaleString()} chars`);
    totalPromptChars += productStr.length;
  } catch (e) {}

  console.log('\nTotal system prompt chars:', totalPromptChars.toLocaleString());
  console.log('Est. tokens if English:', Math.round(totalPromptChars / 4).toLocaleString());
  console.log('Est. tokens if Georgian:', Math.round(totalPromptChars / 1.5).toLocaleString());
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
