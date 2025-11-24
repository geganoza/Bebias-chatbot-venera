# BEBIAS VENERA CHATBOT - VERSION BETA 3

**Release Date:** November 24, 2025
**Version Code:** `BETA_3_NOV24`

---

## VERSION HISTORY

### Beta 3 (Current) - November 24, 2025

**Key Fixes:**

#### Fix #1: Order Parsing Regex - Flexible Line Endings
```typescript
// BEFORE (Beta 2) - Only matched \n
const nameMatch = text.match(/👤[^:]*:\s*(.+?)(?:\n|$)/);

// AFTER (Beta 3) - Matches \r\n, \n, or stops at next emoji
const nameMatch = text.match(/👤[^:]*:\s*(.+?)(?=[\r\n]|📞|📍|📦|💰|🎫|$)/);
```
**Problem:** Order fields weren't being extracted when line breaks were `\r\n` or different formats.
**Solution:** Use lookahead `(?=...)` to stop at any line break OR next emoji field.

#### Fix #2: Fallback Order Creation Null Check
```typescript
// BEFORE - BUG
if (hasOrderNumberPlaceholder(finalResponse)) {
  const orderNumber = await logOrder(orderData, 'messenger');
}

// AFTER - FIXED
if (orderData && hasOrderNumberPlaceholder(finalResponse)) {
  const orderNumber = await logOrder(orderData, 'messenger');
}
```
**Problem:** Fallback was calling `logOrder(null)` creating broken orders.
**Solution:** Added `orderData &&` check.

#### Fix #3: Default Payment Method
```typescript
// BEFORE
const paymentMethod = options?.paymentMethod || 'cash_on_delivery';

// AFTER
const paymentMethod = options?.paymentMethod || 'bank_transfer';
```
**Reason:** Messenger orders are paid upfront via bank transfer.

#### Fix #4: Warehouse Payload Cleanup
Removed `notes` field from warehouse webhook payload (will implement later).

#### Fix #5: Vercel Environment Variable Issue
**Problem:** OpenAI API key showed "not a legal HTTP header value" error.
**Cause:** Hidden characters (newlines) when using `echo` to add env vars.
**Solution:** Use `printf` instead of `echo`:
```bash
# WRONG
echo 'sk-proj-xxx' | vercel env add OPENAI_API_KEY production

# CORRECT
printf 'sk-proj-xxx' | vercel env add OPENAI_API_KEY production
```

---

### Beta 2 - November 24, 2025
- Order number detection includes ticket emoji `🎫` check

### Beta 1 - November 23, 2025
- Initial Georgian emoji-based order parsing
- GPT-4o for all messages
- QStash async processing
- Atomic order creation locks

---

## FILES CHANGED (Beta 3)

| File | Change |
|------|--------|
| `app/api/process-message/route.ts` | Regex fix for order parsing, fallback null check |
| `lib/orderLoggerWithFirestore.ts` | Default payment to bank_transfer, removed notes |
| `docs/TROUBLESHOOTING.md` | New comprehensive troubleshooting guide |

---

## KNOWN WORKING SCENARIOS (Beta 3)

1. Customer asks about products -> Bot shows products with images
2. Customer wants to buy -> Bot guides through 5-step flow
3. Customer sends payment screenshot -> Bot asks for details
4. Customer provides all info -> Order created with ACTUAL order number
5. Single product orders -> Working
6. Multi-product orders -> Working
7. Customer asks about order status -> Bot searches orders
8. Operator enables manual mode -> Bot stops responding
9. Rate limit exceeded -> Friendly message sent
10. Circuit breaker trips -> Kill switch auto-activated

---

## DEPLOYMENT

**Platform:** Vercel
**Runtime:** Node.js (not Edge)
**Max Duration:** 60 seconds
**Domain:** bebias-venera-chatbot.vercel.app

### Environment Variables (Critical)
When adding env vars to Vercel, ALWAYS use `printf`:
```bash
printf 'value' | vercel env add VAR_NAME production
vercel --prod  # Must redeploy after!
```

---

## TESTED ORDER NUMBERS (Beta 3)

- 900082 - Single product - Working
- 900085 - Single product - Working
- Multi-product orders - Working after regex fix

---

**Last Updated:** November 24, 2025
**Maintained By:** BEBIAS Development Team
