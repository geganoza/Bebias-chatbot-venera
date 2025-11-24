# Order Flow Fixes - November 22, 2025

## Summary
Fixed multiple issues with the Messenger chatbot order confirmation flow where order numbers weren't being generated/displayed correctly and duplicate orders were being created.

---

## Issues Fixed

### 1. `[ORDER_NUMBER]` Placeholder Not Being Replaced
**Problem:** Customer received messages with literal `[ORDER_NUMBER]` instead of actual order number (e.g., 900016).

**Root Cause:** The `finalResponse` variable was being modified AFTER `sendOrderEmail()`, but if email sending threw an error or timed out, the modifications never happened.

**Fix in `app/api/process-message/route.ts`:**
```typescript
// BEFORE (broken):
const orderNumber = await logOrder(orderData, 'messenger');
await sendOrderEmail(orderData, orderNumber);  // If this fails...
finalResponse = cleanResponse.replace(...)     // ...this never runs!

// AFTER (fixed):
const orderNumber = await logOrder(orderData, 'messenger');
// CRITICAL: Update finalResponse FIRST before any other async operations
finalResponse = cleanResponse
  .replace(/ORDER_NOTIFICATION:[\s\S]*?Total:.*ლარი/gi, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
finalResponse = finalResponse.replace(/\[ORDER_NUMBER\]/g, orderNumber);

// Send email wrapped in try-catch (non-blocking)
try {
  await sendOrderEmail(orderData, orderNumber);
} catch (emailErr) {
  console.error(`Email failed (order still valid): ${emailErr.message}`);
}
```

### 2. `ORDER_NOTIFICATION:` Block Visible to Customer
**Problem:** The hidden ORDER_NOTIFICATION block was showing in customer messages.

**Root Cause:** Same as above - the stripping regex wasn't being applied when email sending failed.

**Fix:** Same solution - moved `finalResponse` modifications before email sending.

### 3. Duplicate Orders Being Created
**Problem:** Two orders created for same purchase (e.g., #900009 and #900010), second one with placeholder data like `[YOUR_NAME]`.

**Root Cause:** Race condition - two parallel requests both checking `hasExistingOrder`, both seeing empty orders array, both creating orders.

**Fix in `app/api/process-message/route.ts`:**
```typescript
if (orderData && !hasExistingOrder) {
  try {
    // RACE CONDITION FIX: Re-check conversation for orders before creating
    const freshConversation = await loadConversation(senderId);
    if (freshConversation.orders && freshConversation.orders.length > 0) {
      console.log("Order already exists (race condition prevented)");
      // Use existing order number instead of creating new one
      const existingOrderNumber = freshConversation.orders[...].orderNumber;
      finalResponse = finalResponse.replace(/\[ORDER_NUMBER\]/g, existingOrderNumber);
      conversationData.orders = freshConversation.orders;
    } else {
      // Create new order
      const orderNumber = await logOrder(orderData, 'messenger');
      // ... rest of order creation
    }
  } catch (err) {...}
}
```

### 4. `[ORDER_NUMBER]` Not Replaced When Order Already Exists
**Problem:** When `hasExistingOrder` was true, the code stripped ORDER_NOTIFICATION but didn't replace `[ORDER_NUMBER]`.

**Fix in `app/api/process-message/route.ts`:**
```typescript
} else if (orderData && hasExistingOrder) {
  console.log("Order exists, skipping order creation");
  // Use existing order number for replacement
  const existingOrderNumber = conversationData.orders[...].orderNumber;
  finalResponse = cleanResponse
    .replace(/ORDER_NOTIFICATION:[\s\S]*?Total:.*ლარი/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Replace [ORDER_NUMBER] with existing order number
  if (existingOrderNumber) {
    finalResponse = finalResponse.replace(/\[ORDER_NUMBER\]/g, existingOrderNumber);
  }
}
```

### 5. Test User History Not Fully Cleared
**Problem:** When clearing test user history, old orders remained in the conversation, causing `hasExistingOrder` to be true.

**Fix in `scripts/clear-test-user-history.js`:**
```javascript
// BEFORE:
await docRef.update({
  history: [],
  lastActive: new Date().toISOString()
});

// AFTER:
await docRef.update({
  history: [],
  orders: [],  // Also clear orders for clean testing
  lastActive: new Date().toISOString()
});
```

---

## Purchase Flow Instructions Update

Updated `data/content/purchase-flow.md` to make ORDER_NOTIFICATION instructions more explicit:

```markdown
**═══════════════════════════════════════════════════════**
**CRITICAL: YOU MUST INCLUDE ORDER_NOTIFICATION BLOCK!**
**═══════════════════════════════════════════════════════**

Without ORDER_NOTIFICATION, the order number will NOT be generated!

**EXACT FORMAT - Copy this template:**
```
მადლობა! შეკვეთა მიღებულია.

🎫 შეკვეთის ნომერი: [ORDER_NUMBER]

პროდუქტი: [product]
ჯამი: [total] ლარი
მისამართი: [address]

მალე დაგიკავშირდებით!

ORDER_NOTIFICATION:
Product: [Georgian product name]
Client Name: [name]
Telephone: [phone]
Address: [address]
Total: [amount] ლარი
```

**NEVER forget ORDER_NOTIFICATION: block - it triggers order number generation!**
```

---

## Final Working Flow

1. Customer completes purchase (provides payment screenshot + details)
2. AI generates response with `[ORDER_NUMBER]` placeholder and `ORDER_NOTIFICATION:` block
3. `process-message` route:
   - Parses ORDER_NOTIFICATION using regex
   - Creates order in Firestore, gets order number (e.g., 900016)
   - **Immediately** updates `finalResponse`:
     - Strips ORDER_NOTIFICATION block
     - Replaces `[ORDER_NUMBER]` with actual number
   - Adds order to conversation.orders
   - Sends email (wrapped in try-catch)
4. Sends clean message to customer with real order number
5. Saves conversation to Firestore

---

## Key Files Modified

- `app/api/process-message/route.ts` - Main order processing logic
- `data/content/purchase-flow.md` - AI instructions for order confirmation
- `scripts/clear-test-user-history.js` - Test utility

---

## Regex Used

**Strip ORDER_NOTIFICATION:**
```javascript
/ORDER_NOTIFICATION:[\s\S]*?Total:.*ლარი/gi
```

**Parse ORDER_NOTIFICATION (English format):**
```javascript
/ORDER_NOTIFICATION:[\s\S]*?Product:\s*(.+?)\s*Client Name:\s*(.+?)\s*Telephone:\s*(.+?)\s*Address:\s*(.+?)\s*Total:\s*(.+?)(?:\s|$)/
```
