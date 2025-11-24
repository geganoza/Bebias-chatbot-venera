# Warehouse App - Firestore Integration Guide

## Overview

The warehouse app connects to the main BEBIAS Firestore database to:
1. **READ** orders from the `orders` collection
2. **WRITE** status updates to the `shippingUpdates` collection (NEVER directly to `orders`)

A Cloud Function validates and syncs `shippingUpdates` → `orders` automatically.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FIRESTORE DATABASE                           │
│                     (bebias-wp-db-handler)                       │
│                                                                  │
│  ┌─────────────┐     ┌──────────────────┐     ┌──────────────┐  │
│  │   orders    │────▶│ shippingUpdates  │◀────│  Warehouse   │  │
│  │ (READ ONLY) │     │ (WRITE HERE)     │     │     App      │  │
│  └─────────────┘     └──────────────────┘     └──────────────┘  │
│         ▲                    │                                   │
│         │                    ▼                                   │
│         │           ┌──────────────────┐                        │
│         └───────────│  Cloud Function  │                        │
│                     │  (validates &    │                        │
│                     │   syncs to       │                        │
│                     │   orders)        │                        │
│                     └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

Add these to your warehouse app's `.env.local`:

```env
# Firestore Configuration
GOOGLE_CLOUD_PROJECT_ID=bebias-wp-db-handler
GOOGLE_CLOUD_CLIENT_EMAIL=<see below>
GOOGLE_CLOUD_PRIVATE_KEY=<see below>
```

**IMPORTANT**: Get the actual values from `.env.prod` in the chatbot project, or ask the project owner.

---

## Firestore Connection (TypeScript/Next.js)

Create `lib/firestore.ts`:

```typescript
import { Firestore } from '@google-cloud/firestore';

// Parse credentials from environment
const credentials = {
  client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '',
  private_key: (process.env.GOOGLE_CLOUD_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

export const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'bebias-wp-db-handler',
  credentials,
});
```

---

## Reading Orders (READ ONLY)

```typescript
import { db } from '@/lib/firestore';

// Get all confirmed orders (for warehouse processing)
async function getOrdersForWarehouse() {
  const snapshot = await db.collection('orders')
    .where('paymentStatus', '==', 'confirmed')
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,  // This is the order number like "900032"
    ...doc.data()
  }));
}

// Get single order by order number
async function getOrder(orderNumber: string) {
  const doc = await db.collection('orders').doc(orderNumber).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

// Real-time listener for new orders
function listenToNewOrders(callback: (orders: any[]) => void) {
  return db.collection('orders')
    .where('paymentStatus', '==', 'confirmed')
    .where('warehouseStatus', '==', null)  // Not yet processed
    .onSnapshot(snapshot => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(orders);
    });
}
```

### Order Structure (from `orders` collection)

```typescript
interface Order {
  // Order identification
  orderNumber: string;      // e.g., "900032"
  timestamp: string;        // ISO date
  source: 'messenger' | 'chat';

  // Customer info
  clientName: string;
  telephone: string;
  address: string;

  // Product info
  product: string;          // Product name in Georgian
  productSku?: string;      // Firestore product document ID
  productId?: string;       // WooCommerce product ID
  quantity: string;
  total: string;            // Price in GEL

  // Payment
  paymentMethod: 'bank_transfer' | 'cash_on_delivery';
  paymentStatus: 'pending' | 'confirmed' | 'failed';

  // Warehouse status (set by Cloud Function from shippingUpdates)
  warehouseStatus?: 'pending' | 'processing' | 'packed' | 'shipped' | 'delivered';
  trackingNumber?: string;
  shippingCompany?: string;
  warehouseNotes?: string;
  warehouseUpdatedAt?: string;
}
```

---

## Updating Order Status (WRITE to shippingUpdates)

**NEVER write directly to the `orders` collection!**

Instead, write to `shippingUpdates` and the Cloud Function will sync it:

```typescript
import { db } from '@/lib/firestore';

// Update order status
async function updateOrderStatus(
  orderId: string,
  status: 'pending' | 'processing' | 'packed' | 'shipped' | 'delivered',
  options?: {
    trackingNumber?: string;
    shippingCompany?: string;
    trackingsOrderId?: number;
    notes?: string;
  }
) {
  const updateData = {
    orderId,
    status,
    trackingNumber: options?.trackingNumber || null,
    shippingCompany: options?.shippingCompany || null,
    trackingsOrderId: options?.trackingsOrderId || null,
    notes: options?.notes || null,
    updatedBy: 'warehouse_app',
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending',  // Cloud Function will update this
  };

  // Write to shippingUpdates collection
  const docRef = await db.collection('shippingUpdates').add(updateData);
  console.log(`Shipping update created: ${docRef.id}`);

  return docRef.id;
}

// Example: Mark order as shipped with tracking
await updateOrderStatus('900032', 'shipped', {
  trackingNumber: 'GLS123456',
  shippingCompany: 'GLS',
  trackingsOrderId: 12345,
  notes: 'Shipped via express courier'
});
```

---

## Checking Sync Status

After writing to `shippingUpdates`, you can check if the sync succeeded:

```typescript
async function checkSyncStatus(updateId: string) {
  const doc = await db.collection('shippingUpdates').doc(updateId).get();
  if (!doc.exists) return null;

  const data = doc.data();
  return {
    syncStatus: data?.syncStatus,  // 'pending' | 'success' | 'failed'
    syncError: data?.syncError,    // Error message if failed
    syncedAt: data?.syncedAt,
  };
}
```

---

## Complete Integration Flow

### When Order Arrives in Warehouse App:

```typescript
// 1. Fetch new orders from Firestore
const orders = await getOrdersForWarehouse();

// 2. For each order, create in local Prisma DB (optional)
for (const order of orders) {
  // Check if already exists locally
  const existing = await prisma.order.findUnique({
    where: { externalId: order.orderNumber }
  });

  if (!existing) {
    await prisma.order.create({
      data: {
        externalId: order.orderNumber,
        customerName: order.clientName,
        customerPhone: order.telephone,
        customerAddress: order.address,
        city: extractCity(order.address),
        productName: order.product,
        quantity: parseInt(order.quantity) || 1,
        notes: `From: ${order.source}`,
        status: 'PENDING',
      }
    });
  }
}
```

### When Sending to Courier (trackings.ge):

```typescript
// After successfully creating order in trackings.ge
async function onShippingCreated(
  orderId: string,
  trackingCode: string,
  trackingsOrderId: number
) {
  // 1. Update local Prisma DB
  await prisma.order.update({
    where: { externalId: orderId },
    data: {
      status: 'READY',
      trackingCode,
      trackingsOrderId,
    }
  });

  // 2. Sync to Firestore via shippingUpdates
  await updateOrderStatus(orderId, 'packed', {
    trackingNumber: trackingCode,
    shippingCompany: 'trackings.ge',
    trackingsOrderId,
    notes: 'Sent to courier for pickup'
  });
}
```

### When Marking as Shipped:

```typescript
async function onOrderShipped(orderId: string) {
  // 1. Update local Prisma DB
  await prisma.order.update({
    where: { externalId: orderId },
    data: { status: 'SHIPPED' }
  });

  // 2. Sync to Firestore
  await updateOrderStatus(orderId, 'shipped');
}
```

---

## API Endpoints to Add to Warehouse App

### Sync Orders from Firestore

```typescript
// app/api/sync-firestore/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firestore';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Fetch orders from Firestore
    const snapshot = await db.collection('orders')
      .where('paymentStatus', '==', 'confirmed')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    let synced = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
      const order = doc.data();

      // Check if already exists
      const existing = await prisma.order.findUnique({
        where: { externalId: doc.id }
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create new order
      await prisma.order.create({
        data: {
          externalId: doc.id,
          customerName: order.clientName || 'Unknown',
          customerPhone: order.telephone || '',
          customerAddress: order.address || '',
          city: 'თბილისი',
          productName: order.product || '',
          quantity: parseInt(order.quantity) || 1,
          notes: `Source: ${order.source || 'messenger'}`,
          status: 'PENDING',
        }
      });
      synced++;
    }

    return NextResponse.json({
      success: true,
      synced,
      skipped,
      total: snapshot.size
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
```

---

## Security Rules

The warehouse app can ONLY:
- ✅ READ from `orders` collection
- ✅ WRITE to `shippingUpdates` collection
- ❌ NEVER write to `orders` directly
- ❌ NEVER modify `products` collection
- ❌ NEVER access `conversations` or other collections

---

## Deployment

After adding Firestore integration:

1. Add environment variables to Vercel:
   ```bash
   vercel env add GOOGLE_CLOUD_PROJECT_ID
   vercel env add GOOGLE_CLOUD_CLIENT_EMAIL
   vercel env add GOOGLE_CLOUD_PRIVATE_KEY
   ```

2. Install dependencies:
   ```bash
   npm install @google-cloud/firestore
   ```

3. Deploy:
   ```bash
   vercel --prod
   ```

---

## Troubleshooting

### Sync not working?
1. Check `shippingUpdates` document for `syncStatus: 'failed'`
2. Check GCP Cloud Function logs: `gcloud functions logs read on_shipping_update`

### Order not found?
- Ensure the `orderId` matches exactly (e.g., "900032" not "900032 ")

### Permission denied?
- Verify Firestore credentials are correct
- Check service account has `Cloud Datastore User` role

---

## Cloud Function Deployment

The `on_shipping_update` function needs to be deployed:

```bash
gcloud functions deploy on_shipping_update \
  --runtime python311 \
  --trigger-event providers/cloud.firestore/eventTypes/document.create \
  --trigger-resource "projects/bebias-wp-db-handler/databases/(default)/documents/shippingUpdates/{updateId}" \
  --region europe-west1
```
