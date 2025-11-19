# BOG (Bank of Georgia) API Integration Guide

This guide explains how to integrate BOG's banking API to automatically verify bank transfer payments.

## Setup

### 1. Add BOG Credentials to Environment

Add these to your `.env.local` file:

```bash
# BOG API Credentials
BOG_CLIENT_ID=your_client_id_here
BOG_CLIENT_SECRET=your_client_secret_here
BOG_ACCOUNT_ID=your_account_id_here
BOG_ENVIRONMENT=sandbox  # or 'production'
```

### 2. Test Your Credentials

```bash
cd "BEBIAS CHATBOT VENERA"
node test-bog-api.js
```

This will:
- ✅ Test authentication
- ✅ Fetch account information
- ✅ Retrieve recent transactions
- ✅ Test transaction search

## Expected Output

```
🏦 Testing BOG API Integration
============================================================

📋 Configuration:
   Client ID: abc123...
   Environment: sandbox
   Account ID: GE00BG0000000000000000

🔐 Test 1: Authentication
------------------------------------------------------------
✅ Authentication successful!

💳 Test 2: Get Account Information
------------------------------------------------------------
✅ Account info retrieved:
   Account Number: GE00BG0000000000000000
   Account Name: BEBIAS LLC
   Currency: GEL
   Balance: 1234.56 GEL

📊 Test 3: Get Recent Transactions
------------------------------------------------------------
✅ Retrieved 10 transactions:

   1. 2024-01-19T10:30:00Z
      Amount: 59.00 GEL
      Type: credit
      Description: შეკვეთა #912345
      From/To: გიორგი ნოზაძე

   2. 2024-01-18T15:20:00Z
      Amount: 120.00 GEL
      Type: credit
      Description: Payment
      From/To: Customer Name

🔍 Test 4: Search for Transaction
------------------------------------------------------------
✅ Found matching transaction:
   ID: tx_abc123
   Amount: 59.00 GEL
   Description: შეკვეთა #912345

============================================================
✅ All tests completed!
============================================================
```

## Integration with Order Flow

### Automatic Payment Verification

Update your order confirmation flow to automatically check for payments:

```typescript
import { getBOGClient } from './lib/bogClient';
import { confirmBankTransfer } from './lib/orderLoggerWithFirestore';

async function checkPendingPayments() {
  const bog = getBOGClient();
  
  // Get all pending bank transfer orders
  const pendingOrders = await getPendingBankTransferOrders();
  
  for (const order of pendingOrders) {
    // Extract amount from order total (e.g., "59 GEL" -> 59)
    const amount = parseFloat(order.total.replace(/[^0-9.]/g, ''));
    
    // Verify payment
    const result = await bog.verifyPayment(order.orderNumber, amount);
    
    if (result.verified) {
      console.log(`✅ Payment verified for order ${order.orderNumber}`);
      
      // Confirm the order
      await confirmBankTransfer(order.orderNumber);
      
      // Notify customer
      await sendMessage(order.customerId, `
✅ თქვენი გადახდა დადასტურდა!

შეკვეთა #${order.orderNumber} დამუშავებაში.
მადლობა შეძენისთვის!
      `);
    }
  }
}

// Run every 5 minutes
setInterval(checkPendingPayments, 5 * 60 * 1000);
```

### Manual Payment Verification

Create an admin command to manually verify a specific order:

```typescript
import { getBOGClient } from './lib/bogClient';

async function verifyOrderPayment(orderNumber: string) {
  const bog = getBOGClient();
  
  // Get order details
  const order = await getOrder(orderNumber);
  if (!order) {
    return `❌ Order ${orderNumber} not found`;
  }
  
  // Extract amount
  const amount = parseFloat(order.total.replace(/[^0-9.]/g, ''));
  
  // Verify payment
  const result = await bog.verifyPayment(orderNumber, amount, {
    fromDate: new Date(order.timestamp).toISOString(),
  });
  
  if (result.verified && result.transaction) {
    return `
✅ Payment verified!

Transaction ID: ${result.transaction.id}
Amount: ${result.transaction.amount} ${result.transaction.currency}
Date: ${result.transaction.date}
From: ${result.transaction.counterpartyName || 'N/A'}

Use /confirm ${orderNumber} to confirm the order.
    `;
  } else {
    return `
❌ Payment not found

No matching transaction found for:
- Order: ${orderNumber}
- Amount: ${amount} GEL

Please check:
1. Payment was made to the correct account
2. Order number was included in description
3. Amount matches exactly
    `;
  }
}
```

## API Endpoint for Automatic Verification

Create an endpoint that automatically verifies and confirms payments:

```typescript
// app/api/orders/verify-payment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getBOGClient } from '@/lib/bogClient';
import { confirmBankTransfer } from '@/lib/orderLoggerWithFirestore';
import { readOrders } from '@/lib/orderLoggerWithFirestore';

export async function POST(request: NextRequest) {
  try {
    const { orderNumber, adminKey } = await request.json();
    
    // Validate admin key
    if (adminKey !== process.env.ADMIN_CONFIRMATION_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get order
    const orders = await readOrders();
    const order = orders.find(o => o.orderNumber === orderNumber);
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Extract amount
    const amount = parseFloat(order.total.replace(/[^0-9.]/g, ''));
    
    // Verify payment with BOG
    const bog = getBOGClient();
    const result = await bog.verifyPayment(orderNumber, amount, {
      fromDate: new Date(order.timestamp).toISOString(),
    });
    
    if (result.verified) {
      // Confirm order
      await confirmBankTransfer(orderNumber);
      
      return NextResponse.json({
        success: true,
        message: 'Payment verified and order confirmed',
        transaction: result.transaction,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Payment not found',
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Scheduled Payment Verification

Set up a cron job or scheduled task to automatically check for payments:

```typescript
// lib/scheduledTasks.ts
import { getBOGClient } from './bogClient';
import { confirmBankTransfer, readOrders } from './orderLoggerWithFirestore';

export async function verifyPendingPayments() {
  console.log('🔍 Checking for pending payments...');
  
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
    
    const result = await bog.verifyPayment(order.orderNumber, amount, {
      fromDate: new Date(order.timestamp).toISOString(),
    });
    
    if (result.verified) {
      console.log(`✅ Payment verified for ${order.orderNumber}`);
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
if (process.env.NODE_ENV === 'production') {
  setInterval(verifyPendingPayments, 5 * 60 * 1000);
}
```

## Testing in Sandbox

BOG provides a sandbox environment for testing. To test:

1. **Set environment to sandbox**:
   ```bash
   BOG_ENVIRONMENT=sandbox
   ```

2. **Use sandbox credentials** (provided by BOG)

3. **Test the flow**:
   ```bash
   node test-bog-api.js
   ```

4. **Check sandbox transactions** in BOG developer portal

## Production Checklist

Before going live:

- [ ] Get production credentials from BOG
- [ ] Set `BOG_ENVIRONMENT=production`
- [ ] Test authentication with production credentials
- [ ] Verify account ID is correct
- [ ] Test transaction retrieval
- [ ] Set up scheduled payment verification
- [ ] Configure error notifications
- [ ] Test end-to-end order flow
- [ ] Monitor logs for first few days

## Troubleshooting

### "Authentication failed"
- Check client ID and secret are correct
- Verify environment (sandbox vs production)
- Check if credentials are expired
- Contact BOG support if issue persists

### "Account not found"
- Verify `BOG_ACCOUNT_ID` is correct
- Check account has API access enabled
- Confirm account is active

### "No transactions found"
- Check date range (default is last 24 hours)
- Verify transactions exist in BOG portal
- Check account ID is correct
- Ensure API has permission to read transactions

### "Transaction not matching"
- Verify order number is in transaction description
- Check amount matches exactly
- Ensure transaction is a credit (incoming)
- Check transaction is in the date range

## Security Notes

- **Never commit credentials** to git
- **Use environment variables** for all sensitive data
- **Rotate credentials** regularly
- **Monitor API usage** for suspicious activity
- **Use HTTPS** for all API calls
- **Validate webhook signatures** if using webhooks

## Support

- BOG Developer Portal: https://developer.bog.ge/
- BOG API Documentation: https://developer.bog.ge/docs
- BOG Support: api-support@bog.ge

## Next Steps

1. ✅ Test credentials with `node test-bog-api.js`
2. ✅ Verify account access and transactions
3. ✅ Integrate with order confirmation flow
4. ✅ Set up scheduled payment verification
5. ✅ Test end-to-end with real orders
6. ✅ Monitor and optimize
