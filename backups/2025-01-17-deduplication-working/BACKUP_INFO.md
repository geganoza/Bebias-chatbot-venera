# BEBIAS Venera Chatbot - Working Backup
**Date:** 2025-01-17
**Status:** Fully Working - Production Ready
**Deployment:** https://bebias-venera-chatbot.vercel.app

---

## What's Fixed in This Version

### 1. Image Sending (Facebook Messenger API)
- ✅ **Georgian Unicode URLs properly encoded** using percent-encoding
- ✅ All 101 products with Georgian filenames working
- ✅ URLs pre-encoded in `data/products.json` (no runtime encoding)
- ✅ Format: `სტაფილოსფერი-ქუდი.jpg` → `%E1%83%A1%E1%83%A2%E1%83%90%E1%83%A4%E1%83%98%E1%83%9A...`

### 2. Message Deduplication (CRITICAL FIX)
- ✅ **Prevents duplicate webhook processing**
- ✅ Uses Facebook message ID (`mid`) to track processed messages
- ✅ Stores in Vercel KV with 1-hour TTL
- ✅ Fixes issue where bot sent "tens of messages" for one request

### 3. AI Product Matching
- ✅ **Georgian keyword understanding**
- ✅ Keywords (user-approved ONLY):
  - Materials: ბამბა (cotton), შალი (wool)
  - Form: სადა (plain), პომპონით (pompom), მოკლე (short)
- ✅ NO color list (prevents bias)
- ✅ NO acrylic or other unauthorized keywords

### 4. Tools & Scripts
- ✅ **Fast log viewer:** `./check-logs.sh` and `./check-logs.sh fetch`
- ✅ **URL encoder:** `encode_product_urls.py` (batch encodes products.json)
- ✅ **WooCommerce converter:** `/Users/giorginozadze/Downloads/convert_wc_to_chatbot.py`

---

## Key Files Modified

### `/app/api/messenger/route.ts`
- Lines 681-708: Message deduplication logic
- Lines 343-381: Simplified `sendImage()` function (uses pre-encoded URLs)
- Lines 464-506 & 590-629: Georgian keyword matching in AI system prompt

### `/data/products.json`
- All 119 products
- 101 URLs converted to percent-encoding
- Pre-encoded format (no runtime encoding needed)

---

## Critical Configuration

### Environment Variables Required
```bash
# Vercel Environment Variables
PAGE_ACCESS_TOKEN=<Facebook Page Access Token>
OPENAI_API_KEY=<OpenAI API Key>
KV_URL=<Vercel KV URL>
KV_REST_API_URL=<Vercel KV REST API URL>
KV_REST_API_TOKEN=<Vercel KV REST API Token>
KV_REST_API_READ_ONLY_TOKEN=<Vercel KV Read Only Token>
```

### Deployment
```bash
# Deploy to production
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA"
vercel --prod --yes
```

---

## How Deduplication Works

```typescript
// Extract Facebook message ID
const messageId = event.message?.mid;

if (messageId) {
  const dedupeKey = `msg_processed:${messageId}`;

  // Check if already processed
  const alreadyProcessed = await kv.get(dedupeKey);

  if (alreadyProcessed) {
    console.log(`⏭️ Skipping duplicate message ${messageId}`);
    continue; // Skip to next event
  }

  // Mark as processed (1-hour TTL)
  await kv.set(dedupeKey, '1', { ex: 3600 });
  console.log(`✅ Message ${messageId} marked as processed`);
}
```

**Result:** One user message = ONE bot response (no more duplicates)

---

## Testing Commands

```bash
# Check logs quickly (cached)
./check-logs.sh

# Fetch fresh logs (slower)
./check-logs.sh fetch

# Check git status
git status

# View recent commits
git log --oneline -5
```

---

## Git Commits for This Version

```
0b87eec - Add message deduplication to prevent duplicate webhook processing
<previous commits for URL encoding, AI matching improvements>
```

---

## Known Working URLs Format

**Working:** https://bebias.ge/wp-content/uploads/%E1%83%A1%E1%83%A2%E1%83%90%E1%83%A4%E1%83%98%E1%83%9A...
**Not Working:** https://bebias.ge/wp-content/uploads/სტაფილოსფერი-ქუდი.jpg

All products in `data/products.json` use the working format (pre-encoded).

---

## User-Approved Keywords ONLY

**IMPORTANT:** Do NOT add keywords without user approval. Previous unauthorized additions caused issues.

**Current Approved List:**
- ბამბა / ბამბის (cotton)
- შალი / შალის (wool)
- სადა (plain)
- პომპონით / პომპონიანი (pompom)
- მოკლე (short)

**Explicitly Rejected:**
- Color lists (causes bias)
- Acrylic materials (not in inventory)
- Any other keywords

---

## Backup Location

**Primary Backup:** `/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA/backups/2025-01-17-deduplication-working/`

**Git Repository:** `/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA/.git`

---

## Restore Instructions

1. Copy entire backup folder to working directory
2. Run `npm install` to restore node_modules
3. Set environment variables in Vercel dashboard
4. Deploy with `vercel --prod --yes`

---

## Issues Fixed

1. ❌ **BEFORE:** Images with Georgian filenames failed (Facebook API error 2018047)
   ✅ **AFTER:** All 101 products with Georgian filenames work

2. ❌ **BEFORE:** Bot sent "tens of messages and images" for one request
   ✅ **AFTER:** Bot sends exactly ONE response per user message

3. ❌ **BEFORE:** AI didn't understand Georgian keywords
   ✅ **AFTER:** AI matches products using Georgian material/form keywords

---

## Production URLs

- **Main:** https://bebias-venera-chatbot.vercel.app
- **Webhook:** https://bebias-venera-chatbot.vercel.app/api/messenger
- **Facebook Page:** Connected via webhook verification

---

**Status:** This backup represents a fully working, production-ready state with all critical issues resolved.
