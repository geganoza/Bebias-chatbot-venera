# Tracking Code Search Feature

## Overview
Customers can look up their order by providing just a tracking code (15 digits from trackings.ge).

## How It Works

### 1. Topic Detection (`route.ts:821`)
```javascript
orderInquiry: /...|თრექინგ|tracking|\d{15}/.test(msg)
```
- Detects 15-digit tracking numbers in messages
- Triggers order lookup flow

### 2. Search Term Extraction (`route.ts:190-194`)
```javascript
const trackingMatches = message.match(/\d{15}/g);
if (trackingMatches) {
  terms.push(...trackingMatches);
}
```

### 3. Order Search (`route.ts:86-91`)
```javascript
if (trackingNumber.includes(normalizedQuery) ||
    normalizedQuery.includes(trackingNumber)) {
  // Match found
}
```

## Key Fix (2025-11-23)
**Problem:** Orders with tracking numbers weren't being found.

**Root Cause:** The query used `.orderBy('timestamp', 'desc')` which:
- Excludes documents without `timestamp` field
- May have issues with mixed timestamp formats (strings vs Firestore Timestamps)

**Solution:** Removed `orderBy` clause:
```javascript
// Before (broken)
const snapshot = await db.collection('orders')
  .orderBy('timestamp', 'desc')
  .limit(50)
  .get();

// After (working)
const snapshot = await db.collection('orders')
  .limit(100)
  .get();
```

## Testing
1. Clear test user history: `node scripts/clear-test-user-history.js <USER_ID>`
2. Send tracking code to chatbot: `301088149155740`
3. Bot should find order 900034

## Related Files
- `app/api/process-message/route.ts` - Main logic
- `data/content/bot-instructions.md` - Documents tracking lookup for bot
- `scripts/find-by-tracking.js` - Debug script to search by tracking
- `scripts/get-order.js` - View order details

## Order Search Criteria
Bot can find orders by:
- სახელი (name)
- ტელეფონი (9-digit phone)
- შეკვეთის ნომერი (#900034)
- თრექინგ კოდი (15-digit tracking code)
