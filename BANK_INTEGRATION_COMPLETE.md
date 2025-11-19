# Bank of Georgia (BOG) API Integration - Complete Guide

## 🎯 Overview

This integration enables **AUTOMATIC** bank transfer payment verification using the Bank of Georgia Business Online API. Payments are detected in **REAL-TIME** (within seconds) and verified by customer name.

---

## ✅ What's Implemented

- ✅ **Real-time transaction detection** (via `/api/documents/todayactivities`)
- ✅ **Historical transaction search** (via `/api/statement` for older payments)
- ✅ **Smart name matching** with surname priority
- ✅ **Georgian name parsing** (60+ common first names database)
- ✅ **First-name-only rejection** (prevents false positives)
- ✅ **Account balance checking**
- ✅ **Payment verification by customer name**

---

## 📋 Prerequisites

### 1. BOG API Credentials

You need a Bank of Georgia Business Online API account:

1. **Log in** to https://bonline.bog.ge/admin/api
2. **Register your application** (or use existing)
3. **Get credentials:**
   - Client ID
   - Client Secret
4. **Link your bank account** to the API application
5. **Note your account IBAN** (e.g., `GE31BG0000000101465259`)

### 2. Environment Variables

Add to `.env.local`:

```bash
# BOG (Bank of Georgia) API Credentials
BOG_CLIENT_ID="eb3a9bd0-b771-4bc5-93b3-963a90ef743a"
BOG_CLIENT_SECRET="7a965d52-d537-4959-bbbb-5e8f84dba2b5"
BOG_ENVIRONMENT="production"  # or "sandbox" for testing
BOG_ACCOUNT_ID="GE31BG0000000101465259GEL"  # Your business account IBAN + currency
```

### 3. Files Installed

The integration consists of these files:

```
lib/
├── bogClient.ts              # Main BOG API client
├── georgianNames.ts          # Georgian first names database (60+ names)
└── nameMatching.ts           # Smart surname-based matching logic
```

---

## 🚀 Quick Start

### Test the Integration

```bash
# Test authentication and account access
npx --yes dotenv-cli -e .env.local -- npx tsx test-bog-api.js

# Expected output:
# ✅ Authentication successful!
# ✅ Account info retrieved:
#    Account Number: GE31BG0000000101465259
#    Balance: 7517.4 GEL
```

### Verify a Payment

```typescript
import { getBOGClient } from './lib/bogClient';

const bog = getBOGClient();

// Customer says: "I paid 59 GEL, my name is გიორგი ნოზაძე"
const result = await bog.verifyPaymentByName('გიორგი ნოზაძე', 59);

if (result.verified) {
  console.log('✅ Payment verified!');
  console.log(`Sender: ${result.transaction.counterpartyName}`);
  console.log(`Amount: ${result.transaction.amount} GEL`);
  console.log(`Confidence: ${result.confidence}`);
  // → Auto-confirm order
} else {
  console.log('❌ Payment not found');
}
```

---

## 📖 API Reference

### `getBOGClient()`

Returns a singleton BOG API client instance.

```typescript
import { getBOGClient } from './lib/bogClient';

const bog = getBOGClient();
```

### `bog.authenticate()`

Authenticates with BOG API and retrieves access token.

```typescript
const authenticated = await bog.authenticate();
// Returns: true if successful, false otherwise
```

### `bog.getAccountInfo(accountId?: string)`

Get account balance and information.

```typescript
const accountInfo = await bog.getAccountInfo();

console.log(accountInfo.balance);        // 7517.4
console.log(accountInfo.currency);       // "GEL"
console.log(accountInfo.accountNumber);  // "GE31BG0000000101465259"
```

### `bog.getTodayActivities(accountId?: string)` ⚡ REAL-TIME

Get today's transactions (updates in real-time).

```typescript
const transactions = await bog.getTodayActivities();

transactions.forEach(tx => {
  console.log(`${tx.type}: ${tx.amount} GEL from ${tx.counterpartyName}`);
});
```

**Response Format:**
```typescript
interface BOGTransaction {
  id: string;
  amount: number;
  currency: string;
  description: string;
  date: string;  // ISO date
  type: 'credit' | 'debit';
  counterpartyName: string;  // Sender/recipient name
  counterpartyAccount: string;
}
```

### `bog.getTransactions(accountId?, options?)` 📊 HISTORICAL

Get historical transactions (has delay, use for past days).

```typescript
const transactions = await bog.getTransactions(undefined, {
  fromDate: '2025-11-01',
  toDate: '2025-11-19',
  limit: 100,
});
```

### `bog.verifyPaymentByName(customerName, amount, orderNumber?, options?)` 🎯 MAIN METHOD

**Verify payment by customer name with smart matching.**

```typescript
const result = await bog.verifyPaymentByName(
  'გიორგი ნოზაძე',  // Customer name
  59,                 // Expected amount in GEL
  '912345',          // Optional: order number
  {
    fromDate: '2025-11-19',  // Optional: search from date
  }
);

if (result.verified) {
  console.log(`✅ Verified! Confidence: ${result.confidence}`);
  // result.confidence can be:
  // - 'exact': Exact full name match
  // - 'surname': Surname match (very safe)
  // - 'full-partial': Both first name and surname found
  // - 'order-number': Matched by order number in description
}
```

**How It Works:**

1. **Checks today's activities first** (real-time, instant)
2. **Falls back to historical statement** (if not found today)
3. **Uses smart name matching:**
   - ✅ Accepts: Full names, surnames, reversed names
   - ❌ Rejects: First name only (too risky)

---

## 🧠 Smart Name Matching

### Matching Rules

| Customer Input | Payment Sender | Result | Confidence |
|---------------|----------------|--------|------------|
| "გიორგი ნოზაძე" | "გიორგი ნოზაძე" | ✅ Match | `exact` |
| "ნოზაძე" | "გიორგი ნოზაძე" | ✅ Match | `surname` |
| "გიორგი" | "გიორგი ნოზაძე" | ❌ Reject | Too risky! |
| "ნოზაძე გიორგი" | "გიორგი ნოზაძე" | ✅ Match | `surname` |

### Why Reject First Names Only?

**Problem:** Too many people named "გიორგი", "ნინო", "დავითი", etc.

**Solution:** Require surname for verification to avoid matching the wrong payment.

### Georgian Name Database

The system includes 60+ common Georgian first names:

**Male:** გიორგი, დავითი, ნიკა, ლუკა, ილია, გიგა, ლევან, ირაკლი, etc.
**Female:** ანა, მარიამ, ნინო, თამარ, ნათია, თამუნა, ეკა, სალომე, etc.

**Auto-detects** which part is first name vs surname in both orders:
- "გიორგი ნოზაძე" → First: გიორგი, Surname: ნოზაძე ✅
- "ნოზაძე გიორგი" → First: გიორგი, Surname: ნოზაძე ✅

---

## 🤖 Chatbot Integration

### Complete Order Flow

```typescript
import { getBOGClient } from './lib/bogClient';
import { logOrder, confirmBankTransfer } from './lib/orderLoggerWithFirestore';

// STEP 1: Customer places order
async function handleOrder(customerMessage: string) {
  // Customer: "I want to buy a red hat"

  const orderNumber = await logOrder({
    product: 'Red Hat',
    clientName: 'Pending',
    total: '59 GEL',
  }, 'messenger', {
    paymentMethod: 'bank_transfer',
    productSku: 'H-POMP-RED',
    quantity: 1,
  });

  return `
✅ შეკვეთა #${orderNumber} შექმნილია!

💰 გადარიცხეთ 59 GEL შემდეგ ანგარიშზე:
🏦 ბანკი: საქართველოს ბანკი
💳 ანგარიში: GE31BG0000000101465259

📝 გადახდის შემდეგ დაწერეთ "გადავიხადე" და მიუთითეთ თქვენი სრული სახელი
  `;
}

// STEP 2: Customer says they paid
async function handlePaymentConfirmation(customerMessage: string) {
  // Customer: "გადავიხადე"

  return `
რა სახელით გადაიხადეთ?
(მიუთითეთ სახელი და გვარი, როგორც ბანკის ანგარიშზე)
  `;
}

// STEP 3: Verify payment
async function verifyPayment(customerName: string, orderNumber: string, amount: number) {
  const bog = getBOGClient();

  const result = await bog.verifyPaymentByName(customerName, amount, orderNumber);

  if (result.verified) {
    // ✅ Payment found! Auto-confirm order
    await confirmBankTransfer(orderNumber);

    return `
✅ თქვენი გადახდა დადასტურდა!
📦 შეკვეთა #${orderNumber} დამუშავებაში.
🚚 მალე მოგივათ კურიერი!

მადლობა შეძენისთვის! ❤️
    `;
  } else {
    // ❌ Payment not found
    return `
❌ გადახდა ვერ მოიძებნა.

გთხოვთ შეამოწმოთ:
1. გადარიცხული თანხა: ${amount} GEL
2. ანგარიში: GE31BG0000000101465259
3. სრული სახელი და გვარი

ან დაგვიკავშირდით: 555-00-00-00
    `;
  }
}
```

### State Machine Example

```typescript
// Track conversation state
const userStates = new Map();

async function handleMessage(userId: string, message: string) {
  const state = userStates.get(userId) || { stage: 'idle' };

  switch (state.stage) {
    case 'idle':
      if (message.includes('შეკვეთა') || message.includes('order')) {
        // Create order
        const orderNumber = await createOrder();
        userStates.set(userId, {
          stage: 'awaiting_payment',
          orderNumber,
          amount: 59
        });
        return sendBankDetails(orderNumber);
      }
      break;

    case 'awaiting_payment':
      if (message.includes('გადავიხადე') || message.includes('paid')) {
        userStates.set(userId, {
          ...state,
          stage: 'awaiting_name'
        });
        return 'რა სახელით გადაიხადეთ?';
      }
      break;

    case 'awaiting_name':
      // Verify payment
      const result = await verifyPayment(message, state.orderNumber, state.amount);

      if (result.verified) {
        userStates.delete(userId); // Clear state
        return '✅ გადახდა დადასტურდა!';
      } else {
        return '❌ გადახდა ვერ მოიძებნა. სცადეთ ხელახლა.';
      }
      break;
  }

  return 'გამარჯობა! რით შემიძლია დაგეხმაროთ?';
}
```

---

## 🔧 Advanced Usage

### Batch Verification (Background Job)

Check all pending orders periodically:

```typescript
import { getBOGClient } from './lib/bogClient';
import { readOrders, confirmBankTransfer } from './lib/orderLoggerWithFirestore';

async function checkPendingPayments() {
  console.log('🔍 Checking pending bank transfer orders...');

  const bog = getBOGClient();
  const orders = await readOrders();

  // Get pending bank transfer orders
  const pendingOrders = orders.filter(
    order =>
      order.paymentMethod === 'bank_transfer' &&
      order.paymentStatus === 'pending'
  );

  console.log(`Found ${pendingOrders.length} pending orders`);

  let verified = 0;
  let notFound = 0;

  for (const order of pendingOrders) {
    const amount = parseFloat(order.total.replace(/[^0-9.]/g, ''));

    const result = await bog.verifyPaymentByName(
      order.clientName,
      amount,
      order.orderNumber
    );

    if (result.verified) {
      console.log(`✅ Payment verified for order ${order.orderNumber}`);
      await confirmBankTransfer(order.orderNumber);
      verified++;

      // TODO: Send notification to customer
    } else {
      notFound++;
    }
  }

  console.log(`✅ Verified: ${verified}, ❌ Not found: ${notFound}`);
  return { verified, notFound };
}

// Run every 5 minutes
setInterval(checkPendingPayments, 5 * 60 * 1000);
```

### Manual Admin Verification

Create an admin endpoint:

```typescript
// app/api/admin/verify-payment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getBOGClient } from '@/lib/bogClient';

export async function POST(request: NextRequest) {
  const { adminKey, customerName, amount, orderNumber } = await request.json();

  // Verify admin
  if (adminKey !== process.env.ADMIN_CONFIRMATION_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bog = getBOGClient();
  const result = await bog.verifyPaymentByName(customerName, amount, orderNumber);

  return NextResponse.json({
    verified: result.verified,
    confidence: result.confidence,
    transaction: result.transaction,
  });
}
```

---

## 🧪 Testing

### Test Scripts Included

```bash
# 1. Test authentication and account access
npx --yes dotenv-cli -e .env.local -- npx tsx test-bog-api.js

# 2. Test today's real-time transactions
npx --yes dotenv-cli -e .env.local -- npx tsx test-documents-todayactivities.js

# 3. Test smart name matching
npx --yes dotenv-cli -e .env.local -- npx tsx test-smart-matching.js

# 4. Test payment verification
npx --yes dotenv-cli -e .env.local -- npx tsx test-realtime-verification.js
```

### Manual Testing Flow

1. **Make a test payment:**
   - Transfer 1 GEL to `GE31BG0000000101465259`
   - Use your full name in payment

2. **Verify it appears:**
   ```bash
   npx --yes dotenv-cli -e .env.local -- npx tsx test-documents-todayactivities.js
   ```

3. **Test name matching:**
   ```typescript
   const result = await bog.verifyPaymentByName('Your Name', 1);
   console.log(result.verified); // Should be true
   ```

---

## 📊 API Endpoints Used

| Endpoint | Purpose | Speed |
|----------|---------|-------|
| `POST /auth/realms/bog/protocol/openid-connect/token` | Authentication | Fast |
| `GET /api/accounts/{account}/{currency}` | Get balance | Fast |
| `GET /api/documents/todayactivities/{account}/{currency}` | **Today's transactions** | ⚡ **REAL-TIME** |
| `GET /api/statement/{account}/{currency}/{start}/{end}` | Historical transactions | Slow (delayed) |

---

## ⚠️ Important Notes

### Security

- **Never commit `.env.local`** to git
- **Rotate credentials** regularly
- **Use HTTPS** for all API calls
- **Validate admin keys** on confirmation endpoints

### Rate Limits

- BOG API has rate limits (exact limits not documented)
- Recommended: Check pending payments every 5 minutes, not every second
- Use today activities for real-time, statement for history

### Data Privacy

- **Customer names** are sensitive data
- **Comply with GDPR/local privacy laws**
- **Don't log full names** in public logs
- **Secure database** with customer information

### Edge Cases

1. **Multiple payments same amount:**
   - Use surname matching to differentiate
   - If still ambiguous, ask customer for order number

2. **Payment from different name:**
   - Customer pays from spouse's/parent's account
   - Solution: Ask "who made the payment?" separately

3. **Partial payments:**
   - Check if amount is less than expected
   - Notify customer of remaining balance

4. **Refunds:**
   - Outgoing transactions also appear
   - Filter by `type: 'credit'` for incoming only

---

## 🐛 Troubleshooting

### "Authentication failed"

```bash
# Check credentials
echo $BOG_CLIENT_ID
echo $BOG_CLIENT_SECRET

# Test authentication
npx --yes dotenv-cli -e .env.local -- npx tsx test-bog-api.js
```

**Solutions:**
- Verify credentials are correct in `.env.local`
- Check if environment is set to `"production"` vs `"sandbox"`
- Ensure credentials haven't expired

### "Account not found" (404)

**Problem:** API credentials not linked to account

**Solutions:**
1. Log in to https://bonline.bog.ge/admin/api
2. Find your API application
3. Link account `GE31BG0000000101465259` to the application
4. Save changes

### "Payment not found" but customer insists they paid

**Checklist:**
1. ✅ Check customer provided **full name** (not just first name)
2. ✅ Check **amount matches** exactly
3. ✅ Check payment was made to **correct account** (GE31BG0000000101465259)
4. ✅ Check payment is from **today** (use todayactivities) or **past days** (use statement)
5. ✅ Ask customer to send **payment receipt screenshot**

**Debug:**
```typescript
// Get ALL today's transactions
const all = await bog.getTodayActivities();
console.log(all);  // Check if payment exists with different name

// Check with more flexible search
const result = await bog.verifyPaymentByName(
  'partial name',
  amount,
  undefined,
  { fromDate: '2025-11-01' }  // Wider date range
);
```

### "Name matching rejected my valid payment"

**Symptoms:** Customer used first name only

**Solution:**
```
Bot: "Please provide your FULL NAME (first and last name) as it appears on your bank account"
Customer: "გიორგი ნოზაძე" ← Full name works
```

---

## 📞 Support

### BOG API Support

- **Email:** api-support@bog.ge, customerservice@bog.ge
- **Developer Portal:** https://api.bog.ge/docs/en/bonline/introduction
- **Business Online:** https://bonline.bog.ge

### Integration Issues

Check in order:
1. **Logs:** `npm run dev` output
2. **Test scripts:** Run test-bog-api.js
3. **BOG portal:** Check account linking
4. **This documentation:** Review troubleshooting section

---

## 🎉 You're All Set!

Your bank integration is complete and production-ready. The system will:

✅ Detect payments in **real-time** (within seconds)
✅ Match customers by **surname** (safe and accurate)
✅ Reject **risky matches** (first names only)
✅ Auto-confirm orders **automatically**

**Next steps:**
1. Test with real payments (1 GEL test transfers)
2. Integrate into your chatbot conversation flow
3. Monitor for first few days
4. Enjoy automated payment verification! 🚀
