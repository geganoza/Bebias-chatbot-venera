# Order Tracking Feature Documentation

**Created:** November 24, 2025
**Status:** ✅ Working

---

## Overview

Customers can ask about their order status by providing:
- Name (Georgian or Latin)
- Phone number (9 digits)
- Order number (900XXX)
- Tracking code (15 digits)

The bot searches Firestore, handles multiple matches intelligently, and displays order info in a structured format.

---

## How It Works

### 1. Topic Detection (`route.ts:929`)

The bot detects order inquiries when the message contains:
- Order keywords: "შეკვეთა", "ჩემი შეკვეთა", "order", "my order"
- Tracking keywords: "თრექინგ", "tracking", "ტრექინგ კოდი"
- **Phone numbers: 9-digit numbers** (`\b\d{9}\b`)
- Tracking codes: 15-digit numbers

```typescript
orderInquiry: /შეკვეთა.*გაკეთებ|შეკვეთა.*აქვს|...|tracking|\d{15}|\b\d{9}\b/.test(msg)
```

### 2. Search Term Extraction (`route.ts:969-986`)

Extracts search terms from:
- **Current message** (the phone/name customer just sent)
- **Recent conversation history** (last 5 messages)

This allows multi-turn conversations:
```
User: "შეკვეთა ბიძინა არაბულის სახელზეა"
Bot: "რა არის ტელეფონი?"
User: "599095220"  ← Bot remembers "ბიძინა არაბული" from history
```

### 3. Order Search with Scoring (`route.ts:154-249`)

#### Match Types & Scores:
- **Name match**: 100 points (most specific)
- **Order number**: 50 points
- **Tracking code**: 50 points
- **Phone number**: 10 points (least specific - multiple people may share)

#### Search Logic:
```typescript
const nameMatch = queryWords.length > 0 && queryWords.every(qw => clientName.includes(qw));
const phoneMatch = telephone.endsWith(normalizedQueryAsPhone) ||
                   normalizedQueryAsPhone.endsWith(telephone);
```

Orders are sorted by score, highest first.

### 4. Multiple Match Handling (`route.ts:233-240`)

If multiple orders have the same phone number (only phone match, no name match):
```typescript
if (matches.length > 1 && matches[0]._phoneMatch && !matches[0]._nameMatch) {
  return {
    multipleMatches: true,
    orders: matches.slice(0, 5).map(formatOrder)
  };
}
```

AI receives ALL matching orders and picks the correct one based on conversation context.

Example JSON sent to AI:
```json
{
  "multipleMatches": true,
  "orders": [
    {
      "orderNumber": "900095",
      "clientName": "ბიძინა არაბული",
      "trackingNumber": "232510750912897"
    },
    {
      "orderNumber": "900034",
      "clientName": "Davit Arabuli",
      "trackingNumber": "301088149155740"
    }
  ]
}
```

---

## Status Priority Logic (`route.ts:207-214`)

**Priority order:**
1. `shippingStatus` (from warehouse app/order manager) ← **HIGHEST PRIORITY**
2. `warehouseStatus` (legacy field)
3. `trackingsStatusCode` (from trackings.ge API)

```typescript
if (o.shippingStatus) {
  shippingStatus = basicStatusMap[o.shippingStatus] || o.shippingStatus;
} else if (o.warehouseStatus) {
  shippingStatus = basicStatusMap[o.warehouseStatus] || o.warehouseStatus;
} else if (o.trackingsStatusCode) {
  shippingStatus = trackingsStatusMap[o.trackingsStatusCode] || o.trackingsStatusText;
}
```

### Status Mappings:

**Basic Status (warehouse app):**
- `pending` → 📋 Preparing
- `processing` → 🔄 Processing
- `packed` → 📦 Packed
- `shipped` → 🚚 Shipped
- `delivered` → ✅ Delivered
- `cancelled` → ❌ Cancelled

**Trackings.ge Status:**
- `CREATE` → 📋 Order Created
- `ASSIGN_TO_PICKUP` → 📦 Assigned to Courier
- `Pickup in Progress` → 🚗 Courier In-Transit
- `OFD` → 🚚 Out for Delivery
- `DELIVERED` → ✅ Delivered

---

## Display Format

### The Format Override Problem

The bot has **tone-style.md** rules that say:
- "Warm, caring sentences (not cold or robotic)"
- "No numbered lists - speak naturally, not like a robot"

This caused the AI to avoid bullet format and write paragraphs instead.

### The Solution (`route.ts:1022-1040`)

Added explicit format override:
```typescript
🚨 OVERRIDE ALL TONE RULES - Use EXACT technical format below (bullets are REQUIRED for order tracking):

Start with: "ბებია, შენი შეკვეთა გადაგზავნილია! 💛"

Then add these 4 bullet lines EXACTLY:
• 🎫 შეკვეთის ნომერი: [orderNumber]
• 👤 სახელი: [clientName]
• 📦 სტატუსი: [shippingStatus]
• 🚚 ტრექინგ კოდი: [trackingNumber as clickable link]
```

### Expected Output:
```
ბებია, შენი შეკვეთა გადაგზავნილია! 💛

• 🎫 შეკვეთის ნომერი: 900095
• 👤 სახელი: ბიძინა არაბული
• 📦 სტატუსი: 🚚 Shipped
• 🚚 ტრექინგ კოდი: [232510750912897](https://trackings.ge/track?track_num=232510750912897)
```

---

## Tracking URL Format (`route.ts:215-218`)

**Correct format:**
```typescript
trackingUrl = `https://trackings.ge/track?track_num=${o.trackingNumber}`;
```

**NOT:**
```typescript
❌ https://trackings.ge/?id=232510750912897  // Old format
✅ https://trackings.ge/track?track_num=232510750912897  // Correct
```

---

## Testing

### Test Order Data
```
Order #900095:
- Name: ბიძინა არაბული
- Phone: 599095220
- Tracking: 232510750912897
- Status: shipped → 🚚 Shipped

Order #900034:
- Name: Davit Arabuli
- Phone: 599095220 (same as above!)
- Tracking: 301088149155740
- Status: shipped
```

### Test Scenarios

**1. Name + Phone (best case):**
```
User: "ჩემი შეკვეთის ტრექინგ კოდი მაინტერესევს, შეკვეთა ბიძინა არაბულის სახელზეა"
Bot: "რა არის ტელეფონი?"
User: "599095220"
Bot: Returns order #900095 (name match = 110 points)
```

**2. Phone only (multiple matches):**
```
User: "599095220"
Bot: Sees 2 orders, checks conversation history for name
Bot: Finds "ბიძინა არაბული" in history
Bot: Returns order #900095 (correct one)
```

**3. Order number (direct):**
```
User: "900095"
Bot: Returns order #900095 immediately (order match = 50 points)
```

**4. Tracking code (direct):**
```
User: "232510750912897"
Bot: Returns order #900095 immediately (tracking match = 50 points)
```

### Clear Test User Before Testing
```bash
node scripts/clear-test-user-history.js 3282789748459241
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/api/process-message/route.ts:154-249` | Search logic with scoring |
| `app/api/process-message/route.ts:929` | Topic detection regex |
| `app/api/process-message/route.ts:964-1044` | Order context generation |
| `app/api/process-message/route.ts:207-214` | Status priority logic |
| `data/content/tone-style.md` | Tone rules (overridden for tracking) |

---

## Troubleshooting

### Issue: Wrong order returned
**Cause:** Multiple orders with same phone
**Fix:** Implemented scoring + conversation history search

### Issue: Format not using bullets
**Cause:** tone-style.md says "no lists, be natural"
**Fix:** Added `🚨 OVERRIDE ALL TONE RULES` instruction

### Issue: Wrong status showing
**Cause:** trackingsStatusCode prioritized over shippingStatus
**Fix:** Reversed priority - shippingStatus (warehouse) now first

### Issue: Wrong tracking URL
**Cause:** Used `?id=` parameter
**Fix:** Changed to `/track?track_num=`

---

## Database Fields Reference

**Order document in Firestore (`orders` collection):**
```javascript
{
  orderNumber: "900095",          // Document ID
  clientName: "ბიძინა არაბული",   // Customer name
  telephone: "599095220",         // 9-digit phone
  trackingNumber: "232510750912897", // 15-digit tracking
  shippingCompany: "trackings.ge",

  // Status fields (priority order):
  shippingStatus: "shipped",      // ← 1st priority (warehouse app)
  warehouseStatus: undefined,     // ← 2nd priority (legacy)
  trackingsStatusCode: "CREATE",  // ← 3rd priority (trackings.ge)
  trackingsStatusText: "Awaiting Pickup",

  product: "შავი ბამბის ქუდი x 1",
  address: "...",
  paymentStatus: "confirmed",
  timestamp: "2025-11-23T..."
}
```

---

**Last Updated:** November 24, 2025
