# Bug #5: [ORDER_NUMBER] Placeholder Not Replaced in Redis Batch Processing

**Date:** 2025-11-29  
**Severity:** CRITICAL  
**Status:** ✅ RESOLVED  
**Related:** Bug #4 (Image Recognition with Redis Batching)

## Problem Summary

Order confirmations sent through Facebook Messenger showed `[ORDER_NUMBER]` placeholder instead of actual order numbers when Redis batching was enabled. Orders were not being created in Firestore, and users received incomplete confirmation messages.

**User Impact:**
- No order numbers displayed in confirmation messages
- No orders saved to Firestore database
- No confirmation emails sent
- Stock not reserved/updated

## Root Cause Analysis

### Primary Issue: Missing Order Processing in Batch Processor

The Redis batch processor (`app/api/process-batch-redis/route.ts`) was completely missing ALL order processing logic (230+ lines of critical code). When batching was enabled, the system had:

✅ **Normal flow** (`app/api/process-message/route.ts`): Complete order processing  
❌ **Batch flow** (`app/api/process-batch-redis/route.ts`): NO order processing at all

This was a **feature parity gap** introduced when implementing Redis batching for message aggregation.

### Secondary Issue: Firestore Undefined Values

After adding order processing to the batch flow, a second bug emerged:

```typescript
// ❌ WRONG - Firestore rejects undefined values
const orderLog: OrderLog = {
    ...orderData,
    productSku: productSku || undefined,  // Firestore error!
    productId: productId || undefined     // Firestore error!
};
```

**Error:** `Cannot use "undefined" as a Firestore value (found in field "productId")`

Firestore requires either a valid value OR the field must not exist. Setting a field to `undefined` causes validation errors.

## Investigation Process

### Phase 1: Initial Discovery (Comprehensive Logging)

Added detailed step-by-step logging to `logOrder()` function to track execution:

```typescript
console.log(`🔵 [logOrder] STARTED for source: ${source}, product: ${orderData.product}`);
console.log(`🔵 [logOrder] Step 1: Generating order number...`);
console.log(`✅ [logOrder] Step 1 complete: ${orderNumber} (${Date.now() - startTime}ms)`);
console.log(`🔵 [logOrder] Step 2: Extracting product info...`);
console.log(`✅ [logOrder] Step 2 complete (${Date.now() - startTime}ms)`);
console.log(`🔵 [logOrder] Step 3: Handling stock (method: ${paymentMethod})...`);
console.log(`✅ [logOrder] Step 3 complete: reserved=${reserved} (${Date.now() - startTime}ms)`);
console.log(`🔵 [logOrder] Step 4: Saving to Firestore...`);
console.log(`✅ [logOrder] Step 4 complete (${Date.now() - startTime}ms)`);
console.log(`✅ [logOrder] COMPLETED: ${orderNumber} (total: ${Date.now() - startTime}ms)`);
```

### Phase 2: Real-Time Monitoring

Created monitoring script to watch production logs:

```bash
vercel logs bebias-venera-chatbot.vercel.app --follow 2>&1 | \
  grep --line-buffered -E "logOrder|REDIS BATCH ORDER|Step [1-4]|COMPLETED|FAILED"
```

### Phase 3: Error Discovery

Logs revealed:
```
🔒 [REDIS BATCH ORDER] Acquired order creation lock
🔵 [logOrder] STARTED for source: messenger, product: მწვანე ბამბის მოკლე ქუდი x 1
❌ [logOrder] FAILED after 770ms: Error: Value for argument "data" is not a valid Firestore document. 
   Cannot use "undefined" as a Firestore value (found in field "productId").
```

## Solution

### Fix 1: Add Complete Order Processing to Batch Flow

Added missing functionality to `app/api/process-batch-redis/route.ts`:

1. **Imports:**
```typescript
import { logOrder } from "@/lib/orderLoggerWithFirestore";
import { sendOrderEmail } from "@/lib/sendOrderEmail";
import { db } from "@/lib/firestore";
```

2. **Helper Functions (85 lines):**
   - `parseGeorgianOrderConfirmation()` - Extract order data from Georgian text
   - `replaceOrderNumberPlaceholders()` - Replace `[ORDER_NUMBER]` with actual number
   - `hasOrderNumberPlaceholder()` - Check if replacement needed

3. **Order Processing Block (127 lines):**
```typescript
// Check if response contains order confirmation
const orderData = parseGeorgianOrderConfirmation(cleanResponse);

if (orderData && orderData.needsOrderNumber) {
    // Atomic locking to prevent duplicate orders
    const orderLock = `order_lock_${senderId}`;
    const lockRef = db.collection('locks').doc(orderLock);
    
    let gotOrderLock = false;
    try {
        await lockRef.create({ timestamp: new Date() });
        gotOrderLock = true;
        console.log(`🔒 [REDIS BATCH ORDER] Acquired order creation lock`);
    } catch (error: any) {
        if (error.code === 6) { // ALREADY_EXISTS
            console.log(`🔒 [REDIS BATCH ORDER] Lock exists - order already being processed`);
        }
    }

    if (gotOrderLock) {
        console.log(`🔵 [REDIS BATCH ORDER] Calling logOrder() for product: ${orderData.product}`);
        let orderNumber: string;
        try {
            orderNumber = await logOrder(orderData, 'messenger');
            console.log(`✅ [REDIS BATCH ORDER] Order logged successfully: ${orderNumber}`);

            // Replace placeholder with actual order number
            finalResponse = replaceOrderNumberPlaceholders(cleanResponse, orderNumber);

            // Add to conversation history
            if (!conversationData.orders) conversationData.orders = [];
            conversationData.orders.push({
                orderNumber,
                timestamp: new Date().toISOString(),
                items: orderData.product
            });

            // Send email (non-blocking)
            try {
                await sendOrderEmail(orderData, orderNumber);
                console.log(`📧 [REDIS BATCH ORDER] Email sent`);
            } catch (emailErr: any) {
                console.error(`⚠️ [REDIS BATCH ORDER] Email failed: ${emailErr.message}`);
            }
        } catch (logOrderError: any) {
            console.error(`❌ [REDIS BATCH ORDER] logOrder() FAILED:`, logOrderError);
            throw logOrderError;
        }
    }
}
```

### Fix 2: Handle Firestore Undefined Values

Modified `lib/orderLoggerWithFirestore.ts` to conditionally add optional fields:

**Before (❌):**
```typescript
const orderLog: OrderLog = {
    ...orderData,
    orderNumber,
    timestamp,
    source,
    paymentMethod,
    paymentStatus,
    firestoreUpdated,
    productSku: productSku || undefined,  // ❌ Firestore error
    productId: productId || undefined      // ❌ Firestore error
};
```

**After (✅):**
```typescript
// Build base order log
const orderLog: OrderLog = {
    ...orderData,
    orderNumber,
    timestamp,
    source,
    paymentMethod,
    paymentStatus,
    firestoreUpdated,
};

// Only add optional fields if they have actual values
if (productSku) {
    orderLog.productSku = productSku;
}
if (productId) {
    orderLog.productId = productId;
}
```

## Testing & Verification

### Test Results

**Order Created Successfully:**
- Order Number: `900105`
- Product: `წითელი ბამბის მოკლე ქუდი M x 1`
- Client: `გიორგი ნოზაძე`
- Phone: `577273090`
- Source: `messenger`
- Timestamp: `2025-11-29T18:30:20.561Z`
- ProductSku: `წითელი ბამბის მოკლე ქუდი M`
- ✅ Saved to Firestore successfully

### Logs Showing Success

```
🔒 [REDIS BATCH ORDER] Acquired order creation lock
🔵 [logOrder] STARTED for source: messenger, product: წითელი ბამბის მოკლე ქუდი M x 1
🔵 [logOrder] Step 1: Generating order number...
✅ [logOrder] Step 1 complete: 900105 (45ms)
🔵 [logOrder] Step 2: Extracting product info...
✅ Found product: "წითელი ბამბის მოკლე ქუდი M"
✅ [logOrder] Step 2 complete (120ms)
🔵 [logOrder] Step 3: Handling stock (method: bank_transfer)...
📦 Stock reserved for order 900105 (awaiting payment)
✅ [logOrder] Step 3 complete: reserved=true (280ms)
🔵 [logOrder] Step 4: Saving to Firestore...
✅ [logOrder] Step 4 complete (450ms)
✅ [logOrder] COMPLETED: 900105 (total: 470ms)
✅ [REDIS BATCH ORDER] Order logged successfully: 900105
✅ [REDIS BATCH ORDER] Replaced [ORDER_NUMBER] with 900105
📧 [REDIS BATCH ORDER] Email sent
```

## Files Modified

### 1. `/app/api/process-batch-redis/route.ts`
**Changes:**
- Added imports for `logOrder`, `sendOrderEmail`, `db`
- Added `parseGeorgianOrderConfirmation()` function (85 lines)
- Added `replaceOrderNumberPlaceholders()` function
- Added `hasOrderNumberPlaceholder()` function
- Added complete order processing block (127 lines)
- Added atomic locking for duplicate prevention
- Added email sending (non-blocking)

**Lines Added:** ~230 lines

### 2. `/lib/orderLoggerWithFirestore.ts`
**Changes:**
- Modified order log creation to conditionally add optional fields
- Added comprehensive step-by-step logging with timing
- Added detailed error logging with stack traces
- Changed from `productSku: productSku || undefined` to conditional assignment

**Lines Modified:** ~20 lines

## Key Learnings

### 1. Feature Parity is Critical

When implementing new features (like Redis batching), ensure ALL critical functionality is replicated:
- ✅ Image processing was added to batch flow (Bug #4)
- ❌ Order processing was forgotten (Bug #5)

**Prevention:** Create checklists when adding new processing paths.

### 2. Firestore Field Validation

Firestore has strict validation:
- ✅ Valid values: strings, numbers, booleans, null, etc.
- ❌ Invalid: `undefined`
- ✅ Solution: Conditional assignment or use `null`

### 3. Serverless Debugging Best Practices

**Comprehensive logging saved hours of debugging:**
- Log start/end of async operations
- Log timing for performance analysis
- Log all parameters and results
- Use emojis for visual parsing (🔵, ✅, ❌)

### 4. Real-Time Monitoring

Production log monitoring during testing is essential:
```bash
vercel logs --follow | grep --line-buffered "pattern"
```

Allows immediate identification of issues without waiting for error reports.

## Related Bugs

- **Bug #4:** Image Recognition Not Working with Redis Batching (2025-11-29)
  - Similar root cause: Missing functionality in batch processor
  - Pattern: Redis batching introduces feature parity gaps

## Prevention Measures

1. **Checklist for New Processing Paths:**
   - [ ] Image handling
   - [ ] Order processing
   - [ ] Payment processing
   - [ ] Email notifications
   - [ ] Conversation history
   - [ ] Error handling

2. **Automated Testing:**
   - Add integration tests comparing batch vs. normal flow
   - Verify order creation in both paths
   - Check [ORDER_NUMBER] replacement

3. **Code Review:**
   - Compare new processing paths with existing ones
   - Ensure feature parity
   - Check for undefined field values in Firestore writes

## Status

✅ **RESOLVED** - 2025-11-29

- Order processing added to batch flow
- Firestore undefined values fixed
- [ORDER_NUMBER] placeholder replacement working
- Orders saving to database
- Emails sending successfully
- Comprehensive logging in place

## Next Steps

1. **Payment Status Issue:** Messenger orders showing `pending` instead of `confirmed`
   - Messenger orders are paid upfront via bank transfer
   - Should be marked as `confirmed` immediately

2. **Monitor Production:**
   - Watch for any edge cases
   - Verify [ORDER_NUMBER] replacement in all scenarios
   - Check email delivery rates

3. **Documentation:**
   - Update architecture docs with batch processing flow
   - Add order processing flowchart
   - Document Redis batching patterns
