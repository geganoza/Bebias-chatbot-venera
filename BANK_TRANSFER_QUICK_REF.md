# Quick Reference: Chatbot Bank Transfer Flow

## Complete Workflow

```
Customer Orders → Reserve Stock → Bank Transfer → Admin Confirms → Update Stock → Sync to WooCommerce
```

## 1. Customer Places Order (Bank Transfer)

```typescript
import { logOrder, checkOrderAvailability } from './lib/orderLoggerWithFirestore';

// Check availability first
const { available } = await checkOrderAvailability('H-POMP-RED', 1);

if (!available) {
  return 'პროდუქტი არ არის მარაგში';
}

// Create order with bank transfer
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

// Stock is now RESERVED (not yet deducted)
// Reservation expires in 30 minutes
```

## 2. Send Bank Transfer Instructions

```typescript
const message = `
✅ შეკვეთა #${orderNumber} შექმნილია!

💰 გადარიცხეთ 59 GEL შემდეგ ანგარიშზე:
🏦 ბანკი: TBC
💳 ანგარიში: GE00TB0000000000000000
📝 დანიშნულება: შეკვეთა #${orderNumber}

⏰ შეკვეთა დაჯავშნილია 30 წუთით
📞 გადახდის შემდეგ დაგვიკავშირდით: 555-00-00-00
`;
```

## 3. Admin Confirms Payment

### Option A: Via API

```bash
curl -X POST https://your-chatbot.com/api/orders/confirm-payment \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "912345",
    "adminKey": "your-secret-key",
    "action": "confirm"
  }'
```

### Option B: Via Code

```typescript
import { confirmBankTransfer } from './lib/orderLoggerWithFirestore';

const confirmed = await confirmBankTransfer('912345');
// Stock is now DEDUCTED from Firestore
// Firestore automatically syncs to WooCommerce
```

## 4. Cancel if Payment Not Received

```typescript
import { cancelBankTransfer } from './lib/orderLoggerWithFirestore';

const cancelled = await cancelBankTransfer('912345');
// Stock reservation is RELEASED
```

## API Endpoints

### Confirm Payment
```
POST /api/orders/confirm-payment
Body: { orderNumber: "912345", adminKey: "secret", action: "confirm" }
```

### Cancel Payment
```
POST /api/orders/confirm-payment
Body: { orderNumber: "912345", adminKey: "secret", action: "cancel" }
```

### List Pending Orders
```
GET /api/orders/confirm-payment?adminKey=secret
```

## Environment Variables

Add to `.env.local`:

```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=bebias-wp-db-handler

# Admin API
ADMIN_CONFIRMATION_KEY=your-secret-admin-key-here

# Email (existing)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

## Firestore Data Flow

```
1. Order Created (Bank Transfer)
   ↓
   stock_reservations/{orderNumber}_{sku}
   {
     status: "pending",
     quantity: 1,
     expiresAt: "30 min from now"
   }

2. Payment Confirmed
   ↓
   products/{sku}
   {
     stock_qty: DECREASED,
     last_updated_by: "chatbot"
   }
   ↓
   stock_reservations/{orderNumber}_{sku}
   {
     status: "confirmed"
   }
   ↓
   firestore-trigger Cloud Function
   ↓
   WooCommerce Stock Updated
```

## Monitoring Commands

```bash
# Check pending orders
cat data/orders.log | jq 'select(.paymentStatus == "pending")'

# Check reservations in Firestore
gcloud firestore documents list stock_reservations

# Check product stock
gcloud firestore documents describe products/H-POMP-RED

# Check Cloud Function logs
gcloud functions logs read firestore-trigger --region us-central1 --limit 10
```

## Common Issues

### "Reservation not found"
- Order number might be wrong
- Reservation might have expired (>30 min)
- Check: `gcloud firestore documents list stock_reservations`

### "Stock not updating in WooCommerce"
- Check `last_updated_by` is set to `'chatbot'`
- Check firestore-trigger logs
- Verify Cloud Function is deployed

### "Order already confirmed"
- Check order log: `cat data/orders.log | jq 'select(.orderNumber == "912345")'`
- Verify payment status

## Testing Checklist

- [ ] Install `@google-cloud/firestore`
- [ ] Set up Google Cloud credentials
- [ ] Add `ADMIN_CONFIRMATION_KEY` to `.env.local`
- [ ] Test cash-on-delivery order (immediate stock update)
- [ ] Test bank transfer order (stock reservation)
- [ ] Test payment confirmation (stock deduction)
- [ ] Test payment cancellation (stock release)
- [ ] Verify WooCommerce stock is synced
- [ ] Test expired reservation cleanup

## Support

For issues, check:
1. Chatbot logs: `npm run dev` output
2. Firestore console: https://console.firebase.google.com
3. Cloud Function logs: `gcloud functions logs read firestore-trigger`
4. WooCommerce logs: WooCommerce → Status → Logs
