# Critical Fixes - December 2025

## 1. BATCHING ERROR FIX

### Problem
Redis batching was completely broken - bot wouldn't respond at all.

### Root Cause
Environment variable `ENABLE_REDIS_BATCHING` had a newline character:
- Actual value: `"true\n"` (with newline)
- Expected: `"true"` (without newline)
- This caused the feature flag check to fail: `"true\n" !== "true"`

### Solution (Fixed December 2, 2025)
1. Removed and re-added the environment variable on Vercel:
```bash
vercel env rm ENABLE_REDIS_BATCHING production
vercel env add ENABLE_REDIS_BATCHING production
# Entered: true (without quotes or newline)
```

2. Verified fix with debug endpoint that checked the actual value

### Files Involved
- `/lib/featureFlags.ts` - Checks ENABLE_REDIS_BATCHING === "true"
- `/app/api/messenger/route.ts` - Uses feature flag to enable batching

---

## 2. IMAGE SENDING ERROR FIX

### Problem
Bot wasn't sending product photos even though:
- Image sending code existed in process-batch-redis/route.ts
- SEND_IMAGE instructions existed in image-handling.md
- Everything else worked correctly

### Root Cause
The AI model didn't know about SEND_IMAGE commands because:
- `bot-instructions.md` told AI to refer to `image-handling.md` for image commands
- BUT `image-handling.md` was NOT being loaded into the system prompt
- So the AI never saw the SEND_IMAGE instruction

### Solution (Fixed December 3, 2025 - Commit 14f4032)

Modified `/lib/bot-core.ts`:

1. **Load image-handling.md file:**
```typescript
// Added imageHandling to the list of files to load
const [instructions, services, faqs, delivery, payment, imageHandling] = await Promise.all([
  loadContentFile(instructionFile, baseDir),
  loadContentFile("services.md", baseDir),
  loadContentFile("faqs.md", baseDir),
  loadContentFile("delivery-info.md", baseDir),
  loadContentFile("payment-info.md", baseDir),
  loadContentFile("image-handling.md", baseDir),  // ADDED THIS
]);
```

2. **Include in system prompt:**
```typescript
const systemPrompt = isKa
  ? `${content.instructions}

# Image Handling Instructions
${content.imageHandling}  // ADDED THIS SECTION

# Our Services
${content.services}
...
```

### Files Modified
- `/lib/bot-core.ts` - Lines 178-184, 207, 469-470, 540-541

---

## HOW IT ALL WORKS NOW

### Batching Flow (Working)
1. Facebook sends message → `/api/messenger` webhook
2. Feature flag check: `ENABLE_REDIS_BATCHING === "true"` ✅
3. Message saved to Redis with time-windowed deduplication ID
4. QStash queues batch processor with 3-second delay
5. `/api/process-batch-redis` processes all messages together
6. Single API call to OpenAI, single response to user

### Image Sending Flow (Working)
1. AI sees product in conversation
2. AI reads SEND_IMAGE instruction from system prompt ✅
3. AI generates: `SEND_IMAGE: 9016` at end of response
4. Batch processor parses SEND_IMAGE commands
5. Sends image via Facebook Send API
6. User receives both text and image

---

## TESTING CHECKLIST

### ✅ Batching Test
```javascript
// Send multiple messages quickly
"message 1"
"message 2"
"message 3"
// Bot should respond ONCE after 3 seconds with combined response
```

### ✅ Image Test
```
User: "შავი ქუდი მაჩვენე"
Bot: [Shows product details]
     [Sends product image]
     SEND_IMAGE: 9016  // This line is removed before sending
```

---

## IMPORTANT NOTES

1. **Never modify environment variables directly on Vercel UI** - Use CLI to avoid hidden characters
2. **Always include all instruction files in system prompt** - AI can't see files that aren't loaded
3. **Test both batching AND images after any changes** - They're interconnected through the batch processor

## Status
✅ Both issues fixed and deployed to production
- Batching fix: December 2, 2025
- Image fix: December 3, 2025 (Commit 14f4032)