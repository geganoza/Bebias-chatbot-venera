# BEBIAS VENERA CHATBOT - VERSION BETA 2

**Release Date:** November 24, 2025
**Version Code:** `ORDER_DETECTION_FIX_V2_NOV24`

---

## VERSION HISTORY

### Beta 2 (Current) - November 24, 2025
**Key Fix:** Order number detection now includes ticket emoji check

```typescript
const hasOrderNumberPlaceholder =
  text.includes('[ORDER_NUMBER]') ||
  text.includes('[შეკვეთის ნომერი მალე]') ||
  text.includes('შეკვეთის ნომერი:') ||
  text.includes('🎫'); // NEW: Ticket emoji = order number field present
```

**Problem Solved:** Orders were showing `[ORDER_NUMBER]` placeholder instead of actual order numbers because the emoji prefix `🎫` wasn't being detected.

### Beta 1 - November 23, 2025
- Initial Georgian emoji-based order parsing
- GPT-4o for all messages
- QStash async processing
- Atomic order creation locks

---

## COMPLETE FEATURE LIST

### 1. MESSAGING SYSTEM

| Feature | Status | Description |
|---------|--------|-------------|
| Facebook Messenger Integration | ✅ Working | Full webhook integration |
| QStash Async Queue | ✅ Working | Reliable message processing |
| Message Deduplication | ✅ Working | 30-second windows, content hash |
| Image Handling | ✅ Working | Facebook CDN → base64 for OpenAI |
| Message Chunking | ✅ Working | Natural paragraph splits |
| Conversation History | ✅ Working | Last 20 exchanges stored |
| Georgian + English | ✅ Working | Auto language detection |

### 2. AI RESPONSE ENGINE

| Feature | Status | Description |
|---------|--------|-------------|
| GPT-4o Model | ✅ Working | Always used for reliability |
| Smart Product Filtering | ✅ Working | 76k → 2k token reduction |
| Topic-Based Content Loading | ✅ Working | Only loads relevant files |
| Dynamic Delivery Dates | ✅ Working | Georgia timezone (GMT+4) |
| Product Image Sending | ✅ Working | SEND_IMAGE commands parsed |

### 3. ORDER PROCESSING

| Feature | Status | Description |
|---------|--------|-------------|
| Georgian Format Detection | ✅ Working | Emoji fields: 👤📞📍📦💰🎫 |
| Atomic Order Creation | ✅ Working | Firestore create() locks |
| Phone-Based Lock Key | ✅ Working | Prevents duplicates across FB IDs |
| Order Number Generation | ✅ Working | 9XXXXX format, auto-increment |
| Email Notifications | ✅ Working | Gmail SMTP to orders.bebias@gmail.com |
| Duplicate Detection | ✅ Working | Same product within 2 min |

### 4. PURCHASE FLOW

| Step | Description |
|------|-------------|
| 0 | Product selection (if multiple options) |
| 0.5 | Size selection (if variations exist) |
| 1 | Delivery method: Tbilisi standard / Wolt / Regional |
| 1.5 | Wolt handoff to manager |
| 2 | Bank selection: TBC / Bank of Georgia |
| 3 | Bank account + info request |
| 4 | Detail verification |
| 5 | Order confirmation with emoji format |

### 5. SAFETY MECHANISMS

| Mechanism | Threshold | Action |
|-----------|-----------|--------|
| Per-User Hourly Limit | 100 messages | Blocks + friendly message |
| Per-User Daily Limit | 300 messages | Blocks + friendly message |
| Global Hourly Limit | 500 messages | Rate limit response |
| Circuit Breaker | 100 in 10 min | Auto kill switch |
| Kill Switch | Manual | Blocks ALL processing |
| Global Pause | Manual | Saves but no response |
| Manual Mode | Per-conversation | Operator takes over |

### 6. ADMIN FEATURES

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Bot Status | GET/POST /api/bot-status | Pause/kill switch control |
| Manual Control | POST /api/manual-control | Enable/disable manual mode |
| Direct Message | POST /api/manual-control | Operator sends message |
| Bot Instructions | POST /api/manual-control | One-time AI instruction |
| Dashboard | /api/meta-messages | All conversations view |

### 7. INTEGRATIONS

| Service | Purpose | Status |
|---------|---------|--------|
| Facebook Messenger | Customer messaging | ✅ Active |
| OpenAI GPT-4o | AI responses | ✅ Active |
| Upstash QStash | Async queue | ✅ Active |
| Google Firestore | Database | ✅ Active |
| Gmail SMTP | Order emails | ✅ Active |
| TBC Bank | Payment verification | ✅ Active |
| Bank of Georgia | Payment verification | ✅ Active |
| WooCommerce | Product sync | ✅ Active |

---

## ORDER CONFIRMATION FORMAT

The bot uses this exact format for order confirmations:

```
მადლობა [name] ❤️ შენი შეკვეთა მიღებულია ✅
🎫 შეკვეთის ნომერი: [ORDER_NUMBER]
👤 მიმღები: [full name]
📞 ტელეფონი: [phone]
📍 მისამართი: [address]
📦 პროდუქტი: [product] x [quantity]
💰 ჯამი: [amount] ლარი
თბილად ჩაიცვი, არ გაცივდე 🧡
```

**Detection Logic:**
1. Contains `შეკვეთა მიღებულია` (order received)
2. Contains order number indicator: `[ORDER_NUMBER]`, `შეკვეთის ნომერი:`, or `🎫`
3. Has all emoji fields: 👤 📞 📍 📦 💰

---

## FILE STRUCTURE

```
/app
  /api
    /messenger/route.ts      # Facebook webhook
    /process-message/route.ts # AI processing (VERSION: ORDER_DETECTION_FIX_V2_NOV24)
    /bot-status/route.ts     # Pause/kill switch
    /manual-control/route.ts # Operator controls
    /meta-messages/route.ts  # Dashboard API
    /products/route.ts       # Product search

/data
  /content
    bot-instructions.md      # Core bot role
    tone-style.md           # Response style
    purchase-flow.md        # Step-by-step flow
    delivery-info.md        # Shipping prices
    payment-info.md         # Bank accounts
    faqs.md                 # Common questions
  products.json             # Product catalog
  orders.log               # Order backup

/lib
  firestore.ts             # Firebase client
  orderLoggerWithFirestore.ts # Order creation
  sendOrderEmail.ts        # Email notifications
  firestoreSync.ts         # Stock sync

/scripts
  clear-all.js             # Clear conversations
  clear-rate-limits.js     # Clear limits
  list-users.js            # List conversations
  search-orders.js         # Search orders
  get-order.js             # Order details
```

---

## FIRESTORE COLLECTIONS

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| conversations | Chat history | senderId, history[], orders[], manualMode |
| orders | Order records | orderNumber, clientName, telephone, product, total |
| metaMessages | Dashboard view | messages[], userId |
| userProfiles | FB profiles | name, profilePicture, cachedAt |
| rateLimits | Rate tracking | hourlyMessages[], dailyMessages[] |
| botSettings | Global config | paused, killSwitch |
| processingLocks | Dedup locks | lockedAt, senderId |
| orderCreationLocks | Order locks | phone, timestamp |

---

## DEPLOYMENT

**Platform:** Vercel
**Runtime:** Node.js (not Edge)
**Max Duration:** 60 seconds
**Domain:** bebias-venera-chatbot.vercel.app

### Environment Variables Required:
```
GOOGLE_CLOUD_PROJECT_ID
GOOGLE_CLOUD_CLIENT_EMAIL
GOOGLE_CLOUD_PRIVATE_KEY
PAGE_ACCESS_TOKEN
VERIFY_TOKEN
OPENAI_API_KEY
QSTASH_TOKEN
QSTASH_CURRENT_SIGNING_KEY
QSTASH_NEXT_SIGNING_KEY
EMAIL_USER
EMAIL_PASSWORD
```

---

## FIXES LOG

### Fix #1: Order Number Detection (Beta 2)
**Date:** November 24, 2025
**File:** `app/api/process-message/route.ts`
**Lines:** 39-43
**Issue:** `[ORDER_NUMBER]` placeholder not replaced with actual number
**Cause:** Ticket emoji `🎫` prefix not detected by order parser
**Solution:** Added `text.includes('🎫')` to detection logic

```typescript
// BEFORE (Beta 1)
const hasOrderNumberPlaceholder =
  text.includes('[ORDER_NUMBER]') ||
  text.includes('[შეკვეთის ნომერი მალე]') ||
  text.includes('შეკვეთის ნომერი:');

// AFTER (Beta 2)
const hasOrderNumberPlaceholder =
  text.includes('[ORDER_NUMBER]') ||
  text.includes('[შეკვეთის ნომერი მალე]') ||
  text.includes('შეკვეთის ნომერი:') ||
  text.includes('🎫'); // Ticket emoji = order number field present
```

---

## MONITORING

### Key Logs to Watch:
```
🚀 [QStash] Processing message...     # Message received
✅ All safety checks passed           # Limits OK
🔍 [Step 7] Attempting to parse...    # Order detection
✅ [Step 7] Order logged: 9XXXXX      # Order created
📧 [Step 7] Email sent                # Notification sent
✅ [QStash] Message processed in Xms  # Complete
```

### Error Patterns:
```
❌ No "შეკვეთა მიღებულია" found       # Not an order message
❌ No order number placeholder found   # Missing emoji fields
⏭️ [QStash] Message already processing # Duplicate blocked
🛑 Kill switch active                  # Emergency stop
```

---

## KNOWN WORKING SCENARIOS

1. ✅ Customer asks about products → Bot shows products with images
2. ✅ Customer wants to buy → Bot guides through 5-step flow
3. ✅ Customer sends payment screenshot → Bot asks for details
4. ✅ Customer provides all info → Order created with number
5. ✅ Customer asks about order status → Bot searches orders
6. ✅ Operator enables manual mode → Bot stops responding
7. ✅ Operator sends direct message → Customer receives it
8. ✅ Rate limit exceeded → Friendly message sent
9. ✅ Circuit breaker trips → Kill switch auto-activated

---

## NEXT STEPS (Planned for Beta 3)

- [ ] Automatic stock reduction on order confirmation
- [ ] Receipt OCR for payment verification
- [ ] Warehouse app shipping status sync
- [ ] Multi-product order improvements
- [ ] Analytics dashboard

---

**Last Updated:** November 24, 2025
**Maintained By:** BEBIAS Development Team
