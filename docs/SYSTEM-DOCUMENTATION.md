# BEBIAS VENERA Chatbot - System Documentation

> **Status**: First Draft - All Systems Operational (2025-11-23)
> **Version**: 1.0 - Production Ready with Fine-tuning Needed

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Message Flow](#message-flow)
4. [Order Processing](#order-processing)
5. [Stock Synchronization](#stock-synchronization)
6. [Deduplication Systems](#deduplication-systems)
7. [Safety Mechanisms](#safety-mechanisms)
8. [Helper Scripts](#helper-scripts)
9. [Problematic Areas & Fixes](#problematic-areas--fixes)
10. [Environment Configuration](#environment-configuration)
11. [Deployment](#deployment)

---

## System Overview

BEBIAS VENERA is a Facebook Messenger chatbot for an e-commerce store selling handmade knitted products (hats, socks, scarves, gloves). The bot handles:

- **Product inquiries** - Answering questions about products, prices, availability
- **Image recognition** - Identifying products from customer photos
- **Order processing** - Collecting order details, processing payments
- **Stock management** - Real-time sync between chatbot and WooCommerce
- **Email notifications** - Sending order confirmations to staff

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend/API | Next.js 14 (Vercel) |
| AI/LLM | OpenAI GPT-4o-mini (text) / GPT-4o (images) |
| Database | Google Firestore |
| E-commerce | WooCommerce (WordPress) |
| Message Queue | Upstash QStash |
| Stock Sync | GCP Cloud Functions (Python) |
| Email | Nodemailer (Gmail SMTP) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FACEBOOK MESSENGER                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VERCEL (Next.js Application)                         │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐  │
│  │  /api/messenger     │───▶│  /api/process-msg   │───▶│  OpenAI API     │  │
│  │  (Webhook Handler)  │    │  (QStash Consumer)  │    │  GPT-4o/mini    │  │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────┘  │
│           │                          │                                       │
│           ▼                          ▼                                       │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │  Upstash QStash     │    │  Email Service      │                         │
│  │  (Message Queue)    │    │  (Nodemailer)       │                         │
│  └─────────────────────┘    └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GOOGLE CLOUD PLATFORM                               │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │  Firestore          │◀──▶│  Cloud Functions    │                         │
│  │  - conversations    │    │  (Stock Sync)       │                         │
│  │  - orders           │    │  - on_order_create  │                         │
│  │  - products         │    │  - on_stock_update  │                         │
│  │  - rateLimits       │    └─────────────────────┘                         │
│  │  - processedMessages│              │                                     │
│  └─────────────────────┘              │                                     │
└───────────────────────────────────────┼─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            WOOCOMMERCE (WordPress)                           │
│                         - Product Catalog                                    │
│                         - Stock Management                                   │
│                         - Order Creation                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Message Flow

### Step-by-Step Process

```
1. USER SENDS MESSAGE
   └──▶ Facebook Messenger
        └──▶ Facebook Webhook POST to /api/messenger

2. WEBHOOK HANDLER (/api/messenger/route.ts)
   ├── Verify Facebook signature
   ├── Skip echo messages (is_echo check) ⚠️ CRITICAL FIX
   ├── Content-based deduplication (30-second windows)
   ├── Message ID deduplication (Firestore atomic create)
   ├── Download & convert images to base64
   ├── Save message to conversation history
   └── Queue to QStash for async processing

3. QSTASH PROCESSING (/api/process-message/route.ts)
   ├── Verify QStash signature
   ├── Acquire processing lock (atomic)
   ├── Safety checks:
   │   ├── Kill switch check
   │   ├── Rate limit check (20/hour, 50/day per user)
   │   ├── Circuit breaker check (30 messages/10min global)
   │   └── Global bot pause check
   ├── Manual mode check (skip if operator handling)
   ├── Load conversation from Firestore
   ├── Filter products based on query (token optimization)
   ├── Build dynamic system prompt (topic-based)
   ├── Call OpenAI (GPT-4o-mini for text, GPT-4o for images)
   ├── Parse response:
   │   ├── SEND_IMAGE commands → Send product images
   │   └── ORDER_NOTIFICATION → Create order, send email
   ├── Send response to Facebook
   └── Save updated conversation

4. ORDER CREATION (when ORDER_NOTIFICATION detected)
   ├── Acquire phone-based order lock (prevents duplicates)
   ├── Generate order number (atomic counter)
   ├── Save order to Firestore
   ├── Update product stock in Firestore
   ├── Send order email to staff
   └── Replace [ORDER_NUMBER] placeholder in response
```

### Key Files

| File | Purpose |
|------|---------|
| `app/api/messenger/route.ts` | Facebook webhook handler, message intake |
| `app/api/process-message/route.ts` | QStash consumer, AI processing, order creation |
| `lib/firestore.ts` | Firestore database connection |
| `lib/sendOrderEmail.ts` | Email sending, ORDER_NOTIFICATION parsing |
| `lib/orderLoggerWithFirestore.ts` | Order creation, stock updates |
| `lib/firestoreSync.ts` | Stock synchronization utilities |

---

## Order Processing

### Order Flow Diagram

```
CUSTOMER                    BOT                         SYSTEM
   │                         │                            │
   │ "მინდა შავი ქუდი"       │                            │
   │────────────────────────▶│                            │
   │                         │ Product lookup             │
   │                         │ + image if available       │
   │ ◀────────────────────────│                            │
   │                         │                            │
   │ სახელი: გიორგი          │                            │
   │ ტელეფონი: 555123456     │                            │
   │ მისამართი: თბილისი      │                            │
   │────────────────────────▶│                            │
   │                         │ Confirm order details      │
   │                         │ Request payment            │
   │ ◀────────────────────────│                            │
   │                         │                            │
   │ [Payment screenshot]    │                            │
   │────────────────────────▶│                            │
   │                         │ GPT-4o analyzes image      │
   │                         │ Confirms payment receipt   │
   │                         │                            │
   │                         │──────ORDER_NOTIFICATION───▶│
   │                         │                            │ Create order
   │                         │                            │ Update stock
   │                         │                            │ Send email
   │                         │◀──────Order #900032────────│
   │                         │                            │
   │ ◀───Order confirmed──────│                            │
   │     #900032              │                            │
```

### ORDER_NOTIFICATION Format

The AI must include this block to trigger order creation:

```
ORDER_NOTIFICATION:
Product: შავი ბამბის მოკლე ქუდი
Client Name: გიორგი ნოზაძე
Telephone: 555123456
Address: თბილისი, რუსთაველის 1
Total: 55 ლარი
```

### Order Storage (Firestore)

**Collection**: `orders`
**Document ID**: Order number (e.g., "900032")

```json
{
  "product": "შავი ბამბის მოკლე ქუდი",
  "quantity": "1",
  "clientName": "გიორგი ნოზაძე",
  "telephone": "555123456",
  "address": "თბილისი, რუსთაველის 1",
  "total": "55",
  "orderNumber": "900032",
  "timestamp": "2025-11-23T06:33:40.553Z",
  "source": "messenger",
  "paymentMethod": "cash_on_delivery",
  "paymentStatus": "confirmed",
  "firestoreUpdated": true,
  "productSku": "შავი ბამბის მოკლე ქუდი - სტანდარტი (M)",
  "productId": "9016"
}
```

---

## Stock Synchronization

### Two-Way Sync Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  WooCommerce │◀───────▶│  Firestore   │◀───────▶│   Chatbot    │
│   (Source)   │         │  (Bridge)    │         │  (Consumer)  │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │                        │
       │ on_wc_stock_change     │ on_order_create        │
       │───────────────────────▶│◀───────────────────────│
       │                        │                        │
       │◀──on_firestore_update──│                        │
       │    (Cloud Function)    │                        │
```

### Cloud Functions (GCP)

**Location**: `/gcp-cloud-functions/main.py`

| Function | Trigger | Purpose |
|----------|---------|---------|
| `on_order_create` | Firestore `orders` document create | Decrements stock in Firestore products, syncs to WooCommerce |
| `on_stock_update` | Firestore `products` update | Syncs stock changes to WooCommerce |
| `sync_wc_to_firestore` | HTTP / Scheduler | Full sync from WooCommerce to Firestore |

### Stock Update Flow (Order Placed)

1. Order created in Firestore (`orders` collection)
2. Cloud Function `on_order_create` triggered
3. Function finds matching product by name/SKU
4. Decrements stock in Firestore `products` collection
5. Calls WooCommerce API to update stock
6. Marks order as `firestoreUpdated: true`

### Products Collection Structure

**Collection**: `products`
**Document ID**: Variation ID (e.g., "9016")

```json
{
  "name": "შავი ბამბის მოკლე ქუდი - სტანდარტი (M)",
  "parent_name": "შავი ბამბის მოკლე ქუდი",
  "sku": "H-SHORT-COT-BLACK-M",
  "stock": 16,
  "price": "55",
  "category": "ქუდები",
  "image": "https://bebias.ge/wp-content/uploads/...",
  "lastUpdatedBy": "chatbot",
  "lastOrderNumber": "900032",
  "updatedAt": "2025-11-23T06:33:41.000Z"
}
```

---

## Deduplication Systems

### Problem: Facebook Sends Multiple Webhooks

Facebook can send the same message multiple times due to:
- Network retries
- `message_echoes` feature (bot responses sent back as webhooks)
- Multiple sender IDs for the same user

### Solution: Multi-Layer Deduplication

#### Layer 1: Echo Message Skip
```typescript
// /api/messenger/route.ts - Line ~1915
if (event.message?.is_echo) {
  console.log(`⏭️ ECHO message (our own response) - skipping`);
  continue;
}
```

#### Layer 2: Content-Based Deduplication
```typescript
// /api/messenger/route.ts - Line ~1928
// Same message text within 30-second window = duplicate
const timeBucket = Math.floor(Date.now() / 30000);
const contentHash = `content_${messageText.substring(0, 50)}_${messageText.length}_${timeBucket}`;

// Atomic create - fails if already exists
await db.collection('processedMessages').doc(contentHash).create({...});
```

#### Layer 3: Message ID Deduplication
```typescript
// /api/messenger/route.ts - Line ~1960
const msgDocRef = db.collection('processedMessages').doc(messageId);
await msgDocRef.create({
  processedAt: new Date().toISOString(),
  senderId,
  webhookId
});
```

#### Layer 4: Processing Lock (QStash)
```typescript
// /api/process-message/route.ts - Line ~455
const lockRef = db.collection('processingLocks').doc(messageId);
await lockRef.create({
  lockedAt: new Date().toISOString(),
  senderId,
});
```

#### Layer 5: Order Creation Lock (Phone-Based)
```typescript
// /api/process-message/route.ts - Line ~792
// Prevents duplicate orders even from different sender IDs
const phoneKey = orderData.telephone?.replace(/\D/g, '') || senderId;
const orderLockRef = db.collection('orderCreationLocks')
  .doc(`order_phone_${phoneKey}_${minuteBucket}`);
await orderLockRef.create({...});
```

### Firestore Collections for Deduplication

| Collection | Purpose | TTL |
|------------|---------|-----|
| `processedMessages` | Message + content deduplication | Manual cleanup |
| `processingLocks` | QStash processing locks | Manual cleanup |
| `orderCreationLocks` | Order creation race condition prevention | 1 minute buckets |
| `respondedMessages` | Tracks messages that got responses | Manual cleanup |

---

## Safety Mechanisms

### Rate Limiting

**Configuration** (`/api/process-message/route.ts`):

```typescript
const SAFETY_LIMITS = {
  MAX_MESSAGES_PER_USER_PER_HOUR: 20,   // Per user hourly limit
  MAX_MESSAGES_PER_USER_PER_DAY: 50,    // Per user daily limit
  MAX_TOTAL_MESSAGES_PER_HOUR: 100,     // Global hourly limit
  CIRCUIT_BREAKER_THRESHOLD: 30,         // Messages in 10 min before trip
  CIRCUIT_BREAKER_WINDOW_MS: 10 * 60 * 1000
};
```

### Kill Switch

**Manual Emergency Stop**:
```bash
node scripts/qstash-kill-switch.js on "Emergency: too many requests"
node scripts/qstash-kill-switch.js off
```

**Firestore Document**: `botSettings/qstashKillSwitch`
```json
{
  "active": true,
  "reason": "Manual kill switch activated",
  "triggeredAt": "2025-11-23T06:00:00.000Z"
}
```

### Circuit Breaker

Auto-activates kill switch if message volume exceeds threshold:
- **Threshold**: 30 messages in 10 minutes
- **Action**: Activates kill switch automatically
- **Recovery**: Manual reset required

### Global Bot Pause

**Control Scripts**:
```bash
node scripts/turn-bot-on.js   # Resume bot
node scripts/turn-bot-off.js  # Pause bot (stores messages, no responses)
```

### Manual Mode (Per Conversation)

When an operator needs to handle a specific customer:
```bash
node scripts/set-manual-mode.js <senderId> on
node scripts/set-manual-mode.js <senderId> off
```

---

## Helper Scripts

### Monitoring & Debugging

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/check-bot-status.js` | Check kill switch, pause status, pending messages | `node scripts/check-bot-status.js` |
| `scripts/check-orders-quick.js` | List recent orders | `node scripts/check-orders-quick.js` |
| `scripts/get-order-details.js` | Get specific order details | `node scripts/get-order-details.js 900032` |
| `scripts/check-product-stock.js` | Check product stock and order history | `node scripts/check-product-stock.js 9016` |
| `scripts/check-conversation.js` | View conversation history | `node scripts/check-conversation.js <senderId>` |
| `scripts/check-processed-msgs.js` | View processed message dedup entries | `node scripts/check-processed-msgs.js` |
| `scripts/check-order-locks.js` | View order creation locks | `node scripts/check-order-locks.js` |
| `scripts/list-users.js` | List all users with conversations | `node scripts/list-users.js` |
| `scripts/check-errors.js` | Check for logged errors | `node scripts/check-errors.js` |

### Control Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/turn-bot-on.js` | Enable bot (kill switch OFF, pause OFF) | `node scripts/turn-bot-on.js` |
| `scripts/turn-bot-off.js` | Disable bot responses | `node scripts/turn-bot-off.js` |
| `scripts/qstash-kill-switch.js` | Control kill switch | `node scripts/qstash-kill-switch.js on/off` |
| `scripts/qstash-monitor.js` | Monitor QStash queue | `node scripts/qstash-monitor.js` |
| `scripts/reset-circuit-breaker.js` | Reset tripped circuit breaker | `node scripts/reset-circuit-breaker.js` |
| `scripts/clear-rate-limits.js` | Clear user rate limits | `node scripts/clear-rate-limits.js <senderId>` |
| `scripts/set-manual-mode.js` | Enable/disable manual mode | `node scripts/set-manual-mode.js <senderId> on` |

### Cleanup Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/clear-test-user-history.js` | Clear test user conversation | `node scripts/clear-test-user-history.js <senderId>` |
| `scripts/delete-conversation.js` | Delete entire conversation | `node scripts/delete-conversation.js <senderId>` |
| `scripts/clear-all.js` | Clear all test data (DANGEROUS) | `node scripts/clear-all.js` |

### Sync Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/sync-products-to-firestore.js` | Sync local products.json to Firestore | `node scripts/sync-products-to-firestore.js` |
| `scripts/sync-variations-only.js` | Sync only product variations | `node scripts/sync-variations-only.js` |
| `scripts/test-stock-update.js` | Test stock sync | `node scripts/test-stock-update.js` |

---

## Problematic Areas & Fixes

### Issue 1: Duplicate OpenAI Calls (FIXED)

**Symptom**: Same message processed twice, double API costs

**Root Cause**: Facebook `message_echoes` was enabled, sending bot's own responses back as webhooks with different sender ID (page ID instead of user ID)

**Fix**:
1. Added `is_echo` check in webhook handler:
   ```typescript
   if (event.message?.is_echo) {
     console.log(`⏭️ ECHO message - skipping`);
     continue;
   }
   ```
2. Disabled `message_echoes` in Facebook Developer Console

**File**: `app/api/messenger/route.ts` (Line ~1915)

---

### Issue 2: Duplicate Orders (FIXED)

**Symptom**: Two orders created seconds apart for same customer

**Root Cause**:
1. Same message arrived with different sender IDs
2. Lock was based on sender ID, not phone number
3. Both requests created separate orders

**Fix**: Changed order lock key from sender ID to phone number:
```typescript
// Before (broken)
const orderLockRef = db.collection('orderCreationLocks')
  .doc(`order_${senderId}_${minuteBucket}`);

// After (fixed)
const phoneKey = orderData.telephone?.replace(/\D/g, '') || senderId;
const orderLockRef = db.collection('orderCreationLocks')
  .doc(`order_phone_${phoneKey}_${minuteBucket}`);
```

**File**: `app/api/process-message/route.ts` (Line ~792)

---

### Issue 3: Old Order Numbers Displayed (FIXED)

**Symptom**: After first order, all subsequent orders showed the first order number

**Root Cause**: `hasExistingOrder` check blocked ALL new orders if conversation had any order history

**Fix**: Changed from blocking all orders to only blocking duplicates (same product within 2 minutes):
```typescript
// Before (broken)
if (hasExistingOrder) { /* block */ }

// After (fixed)
if (lastOrder.items === orderData.product && (now - lastOrderTime) < twoMinutes) {
  isDuplicateOrder = true;
}
```

**File**: `app/api/process-message/route.ts` (Line ~768)

---

### Issue 4: Bot Not Responding (FIXED)

**Symptom**: Messages processed but no response sent

**Root Cause**: Global bot pause was active (`botSettings/global.paused = true`)

**Fix**:
```bash
node scripts/turn-bot-on.js
```

**Prevention**: Added `check-bot-status.js` script to quickly diagnose

---

### Issue 5: Stock Not Syncing to WooCommerce (FIXED)

**Symptom**: Orders created but WooCommerce stock unchanged

**Root Cause**: Cloud Function product matching logic was too strict

**Fix**: Improved fuzzy matching in `on_order_create` function:
- Match by exact name
- Match by parent name
- Match by SKU
- Fallback to partial name match

**File**: `gcp-cloud-functions/main.py`

---

## Environment Configuration

### Required Environment Variables

**Vercel (.env.local / .env.prod)**:
```env
# Facebook
PAGE_ACCESS_TOKEN=EAA...
VERIFY_TOKEN=your_webhook_verify_token
FACEBOOK_APP_SECRET=your_app_secret

# OpenAI
OPENAI_API_KEY=sk-...

# Google Cloud (Firestore)
GOOGLE_CLOUD_PROJECT_ID=bebias-wp-db-handler
GOOGLE_CLOUD_CLIENT_EMAIL=firebase-adminsdk-...@...iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# QStash
QSTASH_URL=https://qstash.upstash.io/v2/publish
QSTASH_TOKEN=ey...
QSTASH_CURRENT_SIGNING_KEY=sig_...
QSTASH_NEXT_SIGNING_KEY=sig_...

# Email
GMAIL_USER=orders.bebias@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
ORDER_EMAIL_TO=orders.bebias@gmail.com
```

**GCP Cloud Functions**:
```env
WC_URL=https://bebias.ge
WC_CONSUMER_KEY=ck_...
WC_CONSUMER_SECRET=cs_...
```

---

## Deployment

### Vercel Deployment

```bash
# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs <deployment-url>
```

### GCP Cloud Functions Deployment

```bash
cd gcp-cloud-functions

gcloud functions deploy on_order_create \
  --runtime python311 \
  --trigger-event providers/cloud.firestore/eventTypes/document.create \
  --trigger-resource "projects/bebias-wp-db-handler/databases/(default)/documents/orders/{orderId}" \
  --set-env-vars WC_URL=...,WC_CONSUMER_KEY=...,WC_CONSUMER_SECRET=...
```

---

## Monitoring Checklist

### Daily Checks

- [ ] `node scripts/check-bot-status.js` - Verify bot is active
- [ ] `node scripts/check-orders-quick.js` - Review recent orders
- [ ] Check Gmail for order notifications
- [ ] WooCommerce dashboard - Verify stock levels

### After Issues

- [ ] `vercel logs <url>` - Check for errors
- [ ] `node scripts/check-errors.js` - Review logged errors
- [ ] `node scripts/check-processed-msgs.js` - Check deduplication
- [ ] `gcloud functions logs read on_order_create` - Check sync logs

---

## Quick Reference

### Start/Stop Bot
```bash
node scripts/turn-bot-on.js   # Enable
node scripts/turn-bot-off.js  # Disable
```

### Check Status
```bash
node scripts/check-bot-status.js
```

### Debug Order
```bash
node scripts/get-order-details.js <order-number>
node scripts/check-product-stock.js <product-id>
```

### View Logs
```bash
vercel logs bebias-chatbot-venera
```

---

## Contact

For issues or questions about this system, refer to the helper scripts or check Vercel/GCP logs for debugging.

---

*Last Updated: 2025-11-23*
*Status: Production - First Draft Complete*
