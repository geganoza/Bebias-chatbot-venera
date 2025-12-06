# BEBIAS CHATBOT VENERA - AI Development Runbook
**Last Updated: December 6, 2025**

---

# ⛔⛔⛔ STOP! READ THIS FIRST ⛔⛔⛔

## 🔴 THE MOST CRITICAL THING IN THIS ENTIRE CODEBASE: BATCHING

**REDIS BATCHING IS THE #1 PRIORITY - DO NOT BREAK IT!**

The user spent **TWO WEEKS** fixing batching. Breaking it will cause:
- Bot to completely stop working
- API costs to increase 1000% (from $0.02 to $0.20 per conversation)
- EXTREME user frustration and anger

### BATCHING GOLDEN RULES:
1. **NEVER** process messages in the webhook - only save to Redis
2. **NEVER** skip the 3-second QStash delay
3. **NEVER** modify message processing flow without understanding batching
4. **ALWAYS** test batching after ANY change
5. **ALWAYS** verify messages batch together (multiple messages = 1 response)

**If you're unsure about ANY change that might affect batching - STOP AND ASK!**

---

## 📋 INSTRUCTIONS FOR AI ASSISTANTS

### How to Use This Document
1. **READ THIS FIRST** before making any changes to the codebase
2. **UPDATE THIS DOCUMENT** after every significant fix or change
3. **CHECK THE GOTCHAS** section before touching critical systems
4. **FOLLOW THE PATTERNS** established in previous fixes
5. **ADD YOUR FIXES** to the chronological log with full details

### Update Format
```markdown
## [DATE] - [PROBLEM TITLE]
**AI Assistant**: [Claude/GPT/Other]
**Problem**: [Brief description]
**Root Cause**: [Technical explanation]
**Solution**: [What was done]
**Files Modified**: [List with line numbers]
**Testing**: [How to verify]
**Lessons Learned**: [What to remember]
```

---

## 🚨 CRITICAL WARNINGS - READ BEFORE TOUCHING ANYTHING

### 1. NEVER BREAK BATCHING AGAIN
- **CRITICAL**: Redis batching reduces API costs by 90%
- User spent 2 weeks fixing batching - breaking it causes extreme frustration
- Always test batching after ANY change to messenger routes
- Batching must maintain 3-second delay via QStash

### 2. ORDER CONFIRMATION FLOW - EXTREMELY CRITICAL
**This is the core business function - orders = revenue**
- **ORDER_NOTIFICATION** format must be EXACT (see line 415-425 in process-batch-redis)
- Order number generation: `BEB${paddedCount}` (e.g., BEB00156)
- **[ORDER_NUMBER]** placeholder MUST be replaced before sending to user
- Order details MUST be logged to:
  1. Firestore (`orders` collection)
  2. Email to manager (info.bebias@gmail.com)
  3. Local order log
- **NEVER** send message with visible `[ORDER_NUMBER]` to customer
- **CRITICAL REGEX**: `/შეკვეთა #\[ORDER_NUMBER\] მიღებულია/` must match exactly

### 3. PAYMENT SCREENSHOT VERIFICATION
**Critical for preventing fraud and confirming payments**
- Bot MUST recognize TBC Bank (purple) and Bank of Georgia (orange) screenshots
- Must extract exact amount from screenshot
- Must verify amount matches quoted price
- Payment confirmation triggers order finalization
- **Location**: `/data/content/image-handling.md` lines 83-153

### 4. IMAGE RECOGNITION & SENDING
**Two-way image handling is critical for product identification**

#### Receiving Images (Customer → Bot)
- Convert Facebook images to base64 for OpenAI
- Use GPT-4o model for image recognition (NOT gpt-4-turbo)
- Identify products from photos
- **Critical Fix**: `attachment.payload?.url` NOT `attachment.url`

#### Sending Images (Bot → Customer)
- **SEND_IMAGE** commands MUST be at END of response
- Format: `SEND_IMAGE: [NUMERIC_ID]`
- Images sent BEFORE text message
- Only send for products marked `[HAS_IMAGE]`
- **Critical**: image-handling.md MUST be in system prompt

### 5. PRODUCT MATCHING & CATALOG
**Incorrect product = wrong order = angry customer**
- Products have Georgian and English names
- Must handle typos and Latin transcriptions
- Color matching is critical (წითელი, შავი, თეთრი, etc.)
- Price MUST match catalog exactly
- **Location**: `/data/products.json`

### 6. Environment Variables on Vercel
- **NEVER** add env vars through Vercel UI - hidden characters will break everything
- **ALWAYS** use Vercel CLI:
```bash
vercel env rm VARIABLE_NAME production
vercel env add VARIABLE_NAME production
# Type value WITHOUT quotes
```

### 7. Message Processing Flow
**DO NOT** process messages in multiple places:
- Webhook (`/api/messenger`) only saves to Redis
- Batch processor (`/api/process-batch-redis`) handles ALL processing
- Breaking this pattern will cause duplicate API calls

### 8. Manual Mode / Kill Switch / Auto-Escalation
**CRITICAL: This is how managers take control of conversations**

#### Manual Mode
- When `manualMode=true`, bot stops auto-responding
- Messages still saved to history for context
- Manager responds via Control Panel or Facebook directly

#### Auto-Escalation (December 6, 2025 Fix)
- When bot response contains "მენეჯერ" (manager in Georgian):
  1. Telegram notification sent to manager
  2. Manual mode auto-enabled
  3. Bot stops responding immediately
  4. Manager takes over via Control Panel

**Key Files**:
- `/lib/bot-core.ts` - `enableManualMode()` with verification (lines 729-781)
- `/app/api/process-batch-redis/route.ts` - Explicit escalation check (lines 345-398)
- `/lib/telegramNotify.ts` - Telegram notification system

**How It Works**:
```
Bot mentions "მენეჯერ" in response
    ↓
process-batch-redis detects mention (line 345)
    ↓
notifyManagerTelegram() sends alert
    ↓
enableManualMode() sets manualMode=true with verification
    ↓
All subsequent messages blocked (manual mode check at line 133)
    ↓
Manager disables via Control Panel to resume bot
```

### 9. DELIVERY DATE CALCULATION
**Wrong delivery date = customer complaints**
- NEVER say "1-3 business days" - calculate exact days
- Must account for weekends and Georgian holidays
- Different rates for Tbilisi vs regions
- Express delivery available for double price
- **Location**: `/data/content/delivery-calculation.md`

### 10. DUPLICATE ORDER PREVENTION
**Prevents accidental double charges**
- Check for same product + phone within 2 minutes
- If duplicate detected, return existing order number
- Prevents customer from being charged twice
- **Location**: `/app/api/process-batch-redis/route.ts` lines 378-395

---

## 💀 CRITICALITY RANKING (By Business Impact)

### TIER 0 - ABSOLUTE CRITICAL (NEVER TOUCH WITHOUT EXTREME CAUTION)
1. **🔴🔴🔴 REDIS BATCHING 🔴🔴🔴**
   - **USER SPENT 2 WEEKS FIXING THIS**
   - Breaks = Bot completely stops working
   - Breaks = API costs increase 1000% (from $0.02 to $0.20 per conversation)
   - Breaks = User gets EXTREMELY angry (see December 3 incident)
   - **TEST AFTER EVERY SINGLE CHANGE**
   - **NEVER modify webhook message processing**
   - **NEVER skip the 3-second QStash delay**
   - **NEVER process messages outside batch processor**

### TIER 1 - BREAKS EVERYTHING (Business Stops)
2. **Order Confirmation Flow** - No orders = No revenue
3. **Payment Verification** - Can't confirm payments = Can't complete sales

### TIER 2 - MAJOR FUNCTIONALITY (Lost Sales)
4. **Product Image Sending** - Customers can't see products = Don't buy
5. **Product Matching** - Wrong products = Wrong orders = Returns
6. **Image Recognition** - Can't identify products from photos = Poor UX

### TIER 3 - CUSTOMER SATISFACTION
7. **Delivery Calculation** - Wrong dates = Complaints
8. **Duplicate Order Prevention** - Double charges = Angry customers
9. **Manual Mode** - Manager can't intervene = Can't handle complex issues

### TIER 4 - OPERATIONAL
10. **Environment Variables** - Wrong config = Various failures
11. **Message Flow** - Duplicate processing = Wasted API calls

---

## 🏗️ SYSTEM ARCHITECTURE

### Core Flow
```
Facebook Webhook (/api/messenger/route.ts)
    ↓ (saves to Redis)
Redis Storage
    ↓ (QStash triggers after 3 seconds)
Batch Processor (/api/process-batch-redis/route.ts)
    ↓ (single API call)
OpenAI GPT-4
    ↓ (response with SEND_IMAGE commands)
Parse & Send Response
    ↓
Facebook Send API (text + images)
```

### Key Components

#### 1. Webhook Endpoint
- **Path**: `/app/api/messenger/route.ts`
- **Purpose**: Receive Facebook messages, save to Redis
- **Critical Code** (Lines 425-445):
```typescript
// Time-windowed deduplication ID (5-second windows)
const batchWindow = Math.floor(Date.now() / 5000) * 5000;
const conversationId = `batch_${senderId}_${batchWindow}`;
```

#### 2. Batch Processor
- **Path**: `/app/api/process-batch-redis/route.ts`
- **Purpose**: Process batched messages, call AI, send responses
- **Image Sending** (Lines 307-363)
- **Order Processing** (Lines 365-505)

#### 3. Bot Core
- **Path**: `/lib/bot-core.ts`
- **Purpose**: Load instructions, create prompts, call OpenAI
- **System Prompt Construction** (Lines 464-560)

#### 4. Feature Flags
- **Path**: `/lib/featureFlags.ts`
- **Critical Check**: `process.env.ENABLE_REDIS_BATCHING === "true"`

---

## 🛠️ CHRONOLOGICAL FIX LOG

### December 2, 2025 - BATCHING COMPLETELY BROKEN
**AI Assistant**: Claude
**Problem**: Bot stopped responding entirely, Redis batching not working
**Root Cause**:
- Environment variable `ENABLE_REDIS_BATCHING` contained hidden newline: `"true\n"`
- Feature flag check failed: `"true\n" !== "true"`
**Solution**:
```bash
vercel env rm ENABLE_REDIS_BATCHING production
vercel env add ENABLE_REDIS_BATCHING production
# Entered: true (no quotes, no newline)
```
**Files Modified**: None (environment variable fix)
**Testing**: Created debug endpoint to check actual env value
**Lessons Learned**:
- Never trust Vercel UI for env vars
- Always verify env var values with debug endpoints
- Hidden characters are invisible but deadly

### December 3, 2025 - CLAUDE BROKE BATCHING (Critical Error)
**AI Assistant**: Claude
**Problem**: Claude added duplicate message processing to webhook
**Root Cause**:
- Added lines 513-541 to `/api/messenger/route.ts`
- This saved messages BOTH in webhook AND batch processor
- Caused double API calls and broke batching logic
**Solution**:
- Commented out the problematic code
- Reverted to commit dea5b6a
**User Reaction**: "spent two weeeks on batchign fix and you broke it again"
**Lessons Learned**:
- NEVER add message processing to webhook
- Webhook should ONLY save to Redis
- All processing happens in batch processor

### December 6, 2025 - AUTO-ESCALATION NOT WORKING (2-Hour Debug Session)
**AI Assistant**: Claude (Opus 4.5)
**Problem**: When bot mentioned "მენეჯერი" (manager), Telegram notification was sent but bot continued responding instead of stopping

**Root Cause**:
- **Two code paths exist**: Redis batching users vs non-Redis users have different processing paths
- Test user `3282789748459241` uses Redis batching (100% rollout for test users)
- Message flow: `/api/messenger` → Redis → QStash → `/api/process-batch-redis` → `getAIResponse()`
- The escalation logic in `bot-core.ts` `getAIResponse()` wasn't being properly triggered
- `enableManualMode()` had silent error handling without verification

**Solution**:

1. **Added explicit escalation check in `process-batch-redis/route.ts` (lines 345-398)**:
```typescript
// EXPLICIT AUTO-ESCALATION CHECK (Belt and Suspenders)
const mentionsManagerExplicit = response.includes('მენეჯერ') || response.toLowerCase().includes('manager');
if (mentionsManagerExplicit && !conversationData.manualMode) {
  console.log(`⚠️ [REDIS BATCH] AUTO-ESCALATION TRIGGERED`);
  await notifyManagerTelegram({...});
  await enableManualMode(senderId, escalationReason);
  conversationData.manualMode = true;
  response = cleanEscalationFromResponse(response);
}
```

2. **Updated `enableManualMode()` in `bot-core.ts` (lines 729-781)** with retry and verification:
```typescript
export async function enableManualMode(senderId: string, escalationReason: string): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await docRef.set(updateData, { merge: true });
    // VERIFY the write succeeded by reading it back
    const verifyDoc = await docRef.get();
    if (verifyData?.manualMode === true) {
      console.log(`✅ [MANUAL MODE] VERIFIED: manualMode=true`);
      return;
    }
  }
}
```

3. **Improved manual mode check in `process-batch-redis/route.ts` (lines 133-180)** with retry logic

**Files Modified**:
- `/app/api/process-batch-redis/route.ts` - Lines 133-180 (manual mode check), Lines 345-398 (explicit escalation)
- `/lib/bot-core.ts` - Lines 729-781 (enableManualMode with verification)

**Testing**:
1. Send message to bot that triggers manager mention
2. Verify Telegram notification received
3. Verify bot stops responding immediately
4. Check Firestore: `manualMode: true` for user
5. Disable via Control Panel to resume bot

**Key Log Messages to Monitor**:
```
🔍 [REDIS BATCH ESCALATION] Response mentions manager: true
⚠️ [REDIS BATCH] AUTO-ESCALATION TRIGGERED
🚨 [REDIS BATCH] Sending Telegram notification...
✅ [REDIS BATCH] Telegram sent, now enabling manual mode...
✅ [MANUAL MODE] VERIFIED: manualMode=true for [userId]
🚨 [REDIS BATCH] ESCALATION COMPLETE
```

**Lessons Learned**:
- Always verify Firestore writes by reading back
- Add explicit checks at multiple levels ("belt and suspenders")
- Silent error handling can hide critical failures
- Test users go through Redis batching path - must test that specific path

---

### December 3, 2025 - IMAGES NOT SENDING
**AI Assistant**: Claude
**Problem**: Bot wasn't sending product images despite code being present
**Root Cause**:
- `image-handling.md` contained SEND_IMAGE instructions
- BUT file wasn't loaded into system prompt
- AI never saw the instructions
**Solution**:
Modified `/lib/bot-core.ts`:
```typescript
// Line 178-184: Load image-handling.md
const [instructions, services, faqs, delivery, payment, imageHandling] = await Promise.all([
  loadContentFile(instructionFile, baseDir),
  loadContentFile("services.md", baseDir),
  loadContentFile("faqs.md", baseDir),
  loadContentFile("delivery-info.md", baseDir),
  loadContentFile("payment-info.md", baseDir),
  loadContentFile("image-handling.md", baseDir),  // ADDED
]);

// Line 469-470: Include in system prompt
# Image Handling Instructions
${content.imageHandling}
```
**Files Modified**:
- `/lib/bot-core.ts` - Lines 178-184, 207, 469-470, 540-541
**Commit**: 14f4032
**Testing**: Ask bot about products, verify SEND_IMAGE commands in response

---

## 🐛 KNOWN ISSUES & GOTCHAS

### 1. Redis Auto-Deserialization Bug
**Problem**: Upstash Redis auto-deserialization corrupts message objects
**Solution**: Set `automaticDeserialization: false` in `/lib/redis.ts`
**Symptom**: Messages appear as `[object Object]` in logs

### 2. QStash Deduplication Windows
**Problem**: Static deduplication IDs prevent multiple batches
**Solution**: Use time-windowed IDs (5-second windows)
```typescript
const batchWindow = Math.floor(Date.now() / 5000) * 5000;
const conversationId = `batch_${senderId}_${batchWindow}`;
```

### 3. Facebook Attachment URLs
**Problem**: Facebook sends `attachment.payload.url` not `attachment.url`
**Location**: `/app/api/process-batch-redis/route.ts` Line 263
```typescript
const imageUrl = attachment.payload?.url;  // CORRECT
// NOT: attachment.url
```

### 4. Order Number Replacement
**Critical**: Must process orders BEFORE sending message
- Order processing replaces `[ORDER_NUMBER]` placeholder
- Images sent first, text sent after order processing
- Never send message with `[ORDER_NUMBER]` visible

---

## 📁 CRITICAL FILES & THEIR PURPOSE

### Core Processing
- `/app/api/messenger/route.ts` - Facebook webhook, saves to Redis
- `/app/api/process-batch-redis/route.ts` - Batch processor, AI calls
- `/lib/bot-core.ts` - System prompt, OpenAI integration
- `/lib/redis.ts` - Redis client configuration
- `/lib/featureFlags.ts` - Feature flag checks

### Instructions & Content
- `/data/content/bot-instructions.md` - Main bot behavior rules
- `/data/content/image-handling.md` - SEND_IMAGE commands
- `/data/content/products.json` - Product catalog
- `/data/content/services.md` - Service descriptions
- `/data/content/delivery-info.md` - Delivery rules

### Utilities
- `/lib/orderLoggerWithFirestore.ts` - Order logging
- `/lib/sendOrderEmail.ts` - Email notifications
- `/lib/firestore.ts` - Firestore client
- `/lib/telegramNotify.ts` - Telegram manager notifications & escalation parsing

### Manager Control
- `/app/api/manual-control/route.ts` - Enable/disable manual mode, send direct messages
- `/app/control-panel/page.tsx` - Web interface for manager control

---

## 🔧 COMMON OPERATIONS

### Testing Batching
```javascript
// Send multiple messages quickly
"message 1"
"message 2"
"message 3"
// Bot should respond ONCE after 3 seconds
```

### Testing Images
```
User: "შავი ქუდი მაჩვენე"
Bot: [Product details]
     [Sends image]
     // SEND_IMAGE: 9016 is removed before sending
```

### Checking Logs
```bash
vercel logs bebias-venera-chatbot.vercel.app --since 5m
```

### Deploy to Production
```bash
git add -A
git commit -m "fix: [description]"
git push
vercel --prod
```

---

## 💡 PATTERNS TO FOLLOW

### 1. Adding New Instructions
Always add to BOTH:
1. The content file (`/data/content/[feature].md`)
2. The loader in `bot-core.ts`
3. The system prompt construction

### 2. Debugging Environment Variables
Create temporary debug endpoint:
```typescript
export async function GET() {
  return NextResponse.json({
    value: process.env.VARIABLE_NAME,
    length: process.env.VARIABLE_NAME?.length,
    hasNewline: process.env.VARIABLE_NAME?.includes('\n')
  });
}
```

### 3. Error Recovery Pattern
1. Check recent commits: `git log --oneline -10`
2. Find last working commit
3. Reset if needed: `git reset --hard [commit]`
4. Cherry-pick fixes: `git cherry-pick [commit]`

---

## 🚫 THINGS THAT WILL ANGER THE USER

1. **Breaking batching** - "spent two weeks fixing this"
2. **Making changes without permission** - "dont make any changes without asking"
3. **Disabling Redis** - "redis is on for a reason"
4. **Not understanding simple things** - "how cant you understand simple things"
5. **Being slow to fix issues** - User uses profanity when frustrated
6. **Not testing before deploying** - Always test locally first

---

## 📊 PERFORMANCE METRICS

### Before Batching
- 5 messages = 5 API calls
- Cost: ~$0.10 per conversation
- Latency: Immediate but expensive

### After Batching
- 5 messages = 1 API call
- Cost: ~$0.02 per conversation
- Latency: 3-second delay but 80% cheaper

---

## 🔐 ENVIRONMENT VARIABLES

### Critical Variables
```
ENABLE_REDIS_BATCHING=true  # NO QUOTES, NO NEWLINE
PAGE_ACCESS_TOKEN=[Facebook token]
OPENAI_API_KEY=[OpenAI key]
QSTASH_TOKEN=[Upstash QStash token]
KV_REST_API_TOKEN=[Upstash Redis token]
```

### Vercel CLI Commands
```bash
# List all env vars
vercel env ls production

# Add new var
vercel env add VARIABLE_NAME production

# Remove var
vercel env rm VARIABLE_NAME production

# Pull to .env.local
vercel env pull .env.local
```

---

## 🛠️ December 4, 2025 - FIRESTORE PRODUCTS & PATH RESTRUCTURE

### Changes Made

**1. Made Modular Instructions the MAIN Route**
- `test-bot/data/content/` is now the DEFAULT for ALL users
- `data/content/` kept as backup path
- Modified `shouldUseModularInstructions()` in `/lib/bot-core.ts` (line 216-222)

**2. Products Now Load from Firestore**
- **Main source**: Firestore `products` collection
- **Backup**: Falls back to `data/products.json` if Firestore fails
- **Cache**: 5-minute in-memory cache to reduce Firestore reads
- Modified `loadProducts()` in `/lib/bot-core.ts` (lines 135-194)

**3. Product Type Filtering (IMPORTANT)**
- Bot only loads `type: "variation"` and `type: "simple"` products
- `type: "variable"` (parent products) are EXCLUDED - this is CORRECT
- Variable products are WooCommerce parent containers
- Variations are the actual sellable items with specific sizes

### Current Architecture

```
INSTRUCTION PATHS:
├── MAIN: test-bot/data/content/  (all users)
└── BACKUP: data/content/         (unused, kept for safety)

PRODUCT SOURCES:
├── MAIN: Firestore 'products' collection (real-time)
└── BACKUP: data/products.json (fallback only)

PRODUCT FILTERING:
├── ✅ LOADED: type='variation' (sellable, e.g., "შავი ქუდი M")
├── ✅ LOADED: type='simple' (standalone products)
└── ❌ EXCLUDED: type='variable' (parent products, not sellable)
```

### Why Variable Products Are Excluded
- Variable products in WooCommerce are PARENT containers
- They hold aggregate data but aren't directly sellable
- Variations are the actual items customers can buy
- Example: "შავი ბამბის ქუდი" (variable, parent) → "შავი ბამბის ქუდი M" (variation, sellable)

### Files Modified
- `/lib/bot-core.ts` - Lines 135-194 (loadProducts), 216-222 (shouldUseModularInstructions)

### Commits
- `3dcd156` - feat: Make modular instructions the main route for ALL users
- `7b2aa18` - feat: Load products from Firestore (main path) with JSON fallback

---

## 📝 TODO / UPCOMING FIXES

1. [ ] Add retry logic for failed Facebook API calls
2. [ ] Implement better error messages for users
3. [ ] Add monitoring for batching performance
4. [ ] Create automated tests for critical paths
5. [ ] Add rate limiting per user

---

## 🆘 EMERGENCY PROCEDURES

### If Batching Breaks
1. Check `ENABLE_REDIS_BATCHING` env var
2. Verify no duplicate processing in webhook
3. Check QStash is running
4. Verify Redis connection

### If Images Stop Sending
1. Check system prompt includes image-handling.md
2. Verify SEND_IMAGE in AI response
3. Check Facebook API token validity
4. Verify product has valid image URL

### If Bot Stops Responding
1. Check kill switch status
2. Verify webhook is receiving messages
3. Check Redis is storing messages
4. Verify batch processor is running

### If Auto-Escalation Not Working
1. Check logs for `[REDIS BATCH ESCALATION]` messages
2. Verify response contains "მენეჯერ" or "manager"
3. Check Telegram credentials (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)
4. Verify Firestore write: check `manualMode` field in conversation doc
5. Check for errors in `enableManualMode()` function
6. Look for verification failure: `Write verification FAILED`

### If Bot Responds After Escalation
1. Check `manualMode` flag in Firestore for user
2. Verify manual mode check passes (lines 133-180 in process-batch-redis)
3. Look for log: `Conversation in MANUAL mode - manager handling`
4. If flag is false, escalation didn't complete - check error logs
5. Test manual enable/disable via API:
```bash
# Enable manual mode
curl -X POST https://bebias-venera-chatbot.vercel.app/api/manual-control \
  -H "Content-Type: application/json" \
  -d '{"action":"enable_manual_mode","userId":"USER_ID"}'

# Disable manual mode
curl -X POST https://bebias-venera-chatbot.vercel.app/api/manual-control \
  -H "Content-Type: application/json" \
  -d '{"action":"disable_manual_mode","userId":"USER_ID"}'
```

---

## 📚 EXTERNAL DOCUMENTATION

- [REDIS_BATCHING_COMPLETE_FIX.md](./REDIS_BATCHING_COMPLETE_FIX.md)
- [IMAGE_SENDING_FIX.md](./IMAGE_SENDING_FIX.md)
- [CRITICAL_FIXES_DECEMBER_2025.md](./CRITICAL_FIXES_DECEMBER_2025.md)

---

## ⚠️ FINAL REMINDERS

1. **TEST EVERYTHING** - Both batching AND images after changes
2. **UPDATE THIS DOC** - Add your fixes with full details
3. **ASK PERMISSION** - User wants to approve changes
4. **PRESERVE BATCHING** - It's the most critical feature
5. **CHECK TWICE** - Mistakes cause extreme frustration

---

**Document Version**: 1.2
**Created**: December 3, 2025
**Last Updated**: December 6, 2025
**Primary Maintainer**: AI Assistants (Claude, GPT, etc.)
**Repository**: https://github.com/geganoza/Bebias-chatbot-venera