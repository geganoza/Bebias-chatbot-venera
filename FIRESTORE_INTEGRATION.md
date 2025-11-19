# Chatbot → Firestore Integration Guide

This guide explains how to integrate your chatbot with Firestore to automatically update stock when orders are placed.

## Overview

The chatbot can now:
1. ✅ Check product availability in real-time
2. ✅ Reserve stock for bank transfer orders
3. ✅ Update stock immediately for cash-on-delivery
4. ✅ Confirm/cancel reservations after bank transfer verification

## Setup

### 1. Install Dependencies

```bash
cd "BEBIAS CHATBOT VENERA"
npm install @google-cloud/firestore
```

### 2. Set up Google Cloud Credentials

```bash
# Authenticate with Google Cloud
gcloud auth application-default login

# Or set the credentials file path
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### 3. Update Your Order Flow

Replace the old `orderLogger.ts` import with the new Firestore-enabled version:

```typescript
// Old way
import { logOrder } from './lib/orderLogger';

// New way
import { 
  logOrder, 
  confirmBankTransfer, 
  cancelBankTransfer,
  checkOrderAvailability 
} from './lib/orderLoggerWithFirestore';
```

## Usage Examples

### Example 1: Cash on Delivery Order

Stock is updated immediately in Firestore (and syncs to WooCommerce automatically).

```typescript
import { logOrder } from './lib/orderLoggerWithFirestore';

// When customer places order
const orderNumber = await logOrder(
  {
    product: 'წითელი ქუდი პომპონით',
    clientName: 'გიორგი',
    telephone: '555123456',
    address: 'თბილისი, ვაკე',
    total: '59 GEL',
  },
  'messenger', // or 'chat'
  {
    paymentMethod: 'cash_on_delivery',
    productSku: 'H-POMP-RED',
    quantity: 1,
  }
);

console.log(`Order created: ${orderNumber}`);
// Stock is automatically updated in Firestore
// Firestore triggers sync to WooCommerce
```

### Example 2: Bank Transfer Order (Reserve Stock)

Stock is reserved for 30 minutes while waiting for payment confirmation.

```typescript
import { logOrder } from './lib/orderLoggerWithFirestore';

// When customer selects bank transfer
const orderNumber = await logOrder(
  {
    product: 'წითელი ქუდი პომპონით',
    clientName: 'გიორგი',
    telephone: '555123456',
    address: 'თბილისი, ვაკე',
    total: '59 GEL',
  },
  'messenger',
  {
    paymentMethod: 'bank_transfer',
    productSku: 'H-POMP-RED',
    quantity: 1,
  }
);

console.log(`Order created: ${orderNumber}`);
console.log('Stock reserved for 30 minutes');
// Send bank transfer instructions to customer
```

### Example 3: Confirm Bank Transfer

After verifying the bank transfer, confirm the order to update stock.

```typescript
import { confirmBankTransfer } from './lib/orderLoggerWithFirestore';

// After admin verifies payment
const confirmed = await confirmBankTransfer('912345');

if (confirmed) {
  console.log('✅ Payment confirmed, stock updated');
  // Send confirmation message to customer
} else {
  console.log('❌ Failed to confirm payment');
}
```

### Example 4: Cancel Bank Transfer

If payment is not received or customer cancels.

```typescript
import { cancelBankTransfer } from './lib/orderLoggerWithFirestore';

// If payment not received or customer cancels
const cancelled = await cancelBankTransfer('912345');

if (cancelled) {
  console.log('✅ Order cancelled, stock released');
  // Send cancellation message to customer
}
```

### Example 5: Check Product Availability

Before creating an order, check if the product is in stock.

```typescript
import { checkOrderAvailability } from './lib/orderLoggerWithFirestore';

// Before showing order form
const availability = await checkOrderAvailability('H-POMP-RED', 1);

if (availability.available) {
  console.log(`✅ ${availability.message}`);
  // Show order form
} else {
  console.log(`❌ ${availability.message}`);
  // Show out-of-stock message
}
```

## Integration with Your Chatbot

### Step 1: Add Product SKU to Your Products

Update your chatbot's product selection to include SKU:

```typescript
// In your chatbot logic
const selectedProduct = {
  name: 'წითელი ქუდი პომპონით',
  sku: 'H-POMP-RED',
  price: 59,
  // ... other fields
};
```

### Step 2: Check Availability Before Order

```typescript
// Before showing order form
const { available, currentStock, message } = await checkOrderAvailability(
  selectedProduct.sku,
  1
);

if (!available) {
  return `სამწუხაროდ, ${selectedProduct.name} ${message}. გთხოვთ აირჩიოთ სხვა პროდუქტი.`;
}
```

### Step 3: Create Order with Payment Method

```typescript
// After customer provides details
const paymentMethod = customerSelectedBankTransfer 
  ? 'bank_transfer' 
  : 'cash_on_delivery';

const orderNumber = await logOrder(
  orderData,
  'messenger',
  {
    paymentMethod,
    productSku: selectedProduct.sku,
    quantity: 1,
  }
);

if (paymentMethod === 'bank_transfer') {
  return `
შეკვეთა #${orderNumber} შექმნილია!

გადარიცხეთ ${orderData.total} შემდეგ ანგარიშზე:
🏦 ბანკი: TBC
💳 ანგარიში: GE00TB0000000000000000

შეკვეთა დაჯავშნილია 30 წუთით.
გადახდის შემდეგ დაგვიკავშირდით დასადასტურებლად.
  `;
} else {
  return `
შეკვეთა #${orderNumber} მიღებულია!
გადახდა მიწოდებისას.
  `;
}
```

### Step 4: Handle Bank Transfer Confirmation

Create an admin endpoint or command to confirm payments:

```typescript
// Admin command: /confirm ORDER_NUMBER
async function handleConfirmCommand(orderNumber: string) {
  const confirmed = await confirmBankTransfer(orderNumber);
  
  if (confirmed) {
    // Notify customer
    await sendMessage(customer, `
✅ თქვენი გადახდა დადასტურდა!
შეკვეთა #${orderNumber} დამუშავებაში.
    `);
    
    return `✅ Order ${orderNumber} confirmed`;
  } else {
    return `❌ Failed to confirm order ${orderNumber}`;
  }
}

// Admin command: /cancel ORDER_NUMBER
async function handleCancelCommand(orderNumber: string) {
  const cancelled = await cancelBankTransfer(orderNumber);
  
  if (cancelled) {
    return `✅ Order ${orderNumber} cancelled`;
  } else {
    return `❌ Failed to cancel order ${orderNumber}`;
  }
}
```

## Firestore Collections

### products Collection

```javascript
{
  "sku": "H-POMP-RED",
  "stock_qty": 11,
  "last_updated_by": "chatbot",
  "last_order_number": "912345",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### stock_reservations Collection

```javascript
{
  "sku": "H-POMP-RED",
  "quantity": 1,
  "orderNumber": "912345",
  "status": "pending", // or "confirmed", "cancelled", "expired"
  "createdAt": "2024-01-01T00:00:00Z",
  "expiresAt": "2024-01-01T00:30:00Z",
  "confirmedAt": "2024-01-01T00:15:00Z" // optional
}
```

## Automatic Cleanup

Set up a cron job to clean up expired reservations:

```typescript
import { cleanupExpiredReservations } from './lib/firestoreSync';

// Run every 5 minutes
setInterval(async () => {
  const cleaned = await cleanupExpiredReservations();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired reservations`);
  }
}, 5 * 60 * 1000);
```

Or use a Cloud Function scheduled trigger:

```typescript
// Cloud Function
export const cleanupReservations = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    await cleanupExpiredReservations();
  });
```

## Testing

### Test 1: Cash on Delivery Order

```bash
# Check stock before
gcloud firestore documents describe products/H-POMP-RED

# Create order (run in your chatbot)
# Stock should decrease immediately

# Check stock after
gcloud firestore documents describe products/H-POMP-RED

# Check WooCommerce admin - stock should be updated
```

### Test 2: Bank Transfer Flow

```bash
# Create bank transfer order
# Check reservations
gcloud firestore documents list stock_reservations

# Confirm payment
# Check that stock decreased and reservation is confirmed

# Check WooCommerce admin - stock should be updated
```

## Monitoring

### Check Firestore Logs

```bash
# View all reservations
gcloud firestore documents list stock_reservations

# View specific product stock
gcloud firestore documents describe products/H-POMP-RED
```

### Check Cloud Function Logs

```bash
# Check if firestore-trigger is syncing to WooCommerce
gcloud functions logs read firestore-trigger --region us-central1 --limit 20
```

### Check Order Logs

```bash
# View all orders
cat "BEBIAS CHATBOT VENERA/data/orders.log" | jq

# View pending bank transfers
cat "BEBIAS CHATBOT VENERA/data/orders.log" | jq 'select(.paymentMethod == "bank_transfer" and .paymentStatus == "pending")'
```

## Troubleshooting

### "Stock not updating in Firestore"
- Check Google Cloud credentials are set up
- Verify `GOOGLE_CLOUD_PROJECT` environment variable
- Check Firestore logs for errors

### "Reservation not found"
- Check if reservation expired (30 minute timeout)
- Verify order number is correct
- Check `stock_reservations` collection in Firestore

### "Stock not syncing to WooCommerce"
- Check `last_updated_by` is set to `'chatbot'`
- Verify `firestore-trigger` Cloud Function is deployed
- Check Cloud Function logs for errors

## Best Practices

1. **Always check availability** before creating orders
2. **Set appropriate reservation timeout** (default 30 minutes)
3. **Clean up expired reservations** regularly
4. **Monitor pending bank transfers** and follow up with customers
5. **Log all Firestore operations** for debugging
6. **Handle errors gracefully** and notify customers

## Security

- Firestore security rules should restrict write access
- Only chatbot backend should update stock
- Admin commands should be authenticated
- Use environment variables for sensitive data

## Next Steps

1. ✅ Install `@google-cloud/firestore` package
2. ✅ Set up Google Cloud credentials
3. ✅ Update chatbot to use new order logger
4. ✅ Add product SKUs to your product data
5. ✅ Test cash-on-delivery flow
6. ✅ Test bank transfer flow
7. ✅ Set up reservation cleanup
8. ✅ Monitor for a few days
