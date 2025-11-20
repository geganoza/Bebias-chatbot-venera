# Unified Database System Setup Guide

**Created**: 2025-11-20
**Status**: Ready for Implementation

## 🎯 System Overview

This unified system connects:
- **WooCommerce** (WordPress site)
- **Facebook Messenger Chatbot** (Vercel/Next.js)
- **Customer Database** (Firestore)
- **Order Management** (Firestore)
- **Product Stock** (Firestore)

All data flows through **Google Cloud Firestore** as the central database.

## 📊 Firestore Collections

### 1. `products` (WP Format - Source of Truth)
```javascript
{
  "sku": "H-PLAIN-GREEN",                    // Document ID
  "product_id": 2251,
  "product_name": "მწვანე სადა ქუდი",
  "price": 55,
  "stock_qty": 10,
  "in_stock": true,
  "category": "ქუდები > სადა ქუდები",
  "tags": ["ბებიას", "მწვანე ქუდი", ...],
  "images": ["https://..."],
  "attributes": { "ზომა": "L, M, S, XS", ... },
  "last_updated_by": "wordpress",  // or "chatbot", "csv_import"
  "last_updated_at": "2025-11-20T04:00:00Z"
}
```

### 2. `orders` (Unified Orders from All Sources)
```javascript
{
  "orderId": "WP-12345",  // or "ORD-1763590453785" (chatbot) or "MANUAL-123"
  "source": "wordpress",  // or "chatbot", "manual"
  "status": "confirmed",  // pending, processing, confirmed, shipped, cancelled
  "customer": {
    "name": "გიორგი ნოზაძე",
    "telephone": "577273090",
    "email": "customer@example.com",
    "address": "დემეტრე თავდადებული 4",
    "facebookId": "123456" // For chatbot orders
  },
  "items": [{
    "sku": "H-PLAIN-GREEN",
    "productName": "მწვანე სადა ქუდი",
    "quantity": 1,
    "price": 55
  }],
  "total": 55,
  "paymentVerified": true,
  "emailSent": false,
  "timestamp": "2025-11-20T04:00:00Z",
  "createdAt": FirestoreTimestamp,
  "updatedAt": FirestoreTimestamp
}
```

### 3. `customers` (Client Database)
```javascript
{
  "customerId": "577273090",  // Phone number (digits only)
  "name": "გიორგი ნოზაძე",
  "telephone": "577273090",
  "email": "customer@example.com",
  "facebookId": "123456",
  "addresses": [
    "დემეტრე თავდადებული 4",
    "ჩავრიცხე, გიორგი ნოზაძე"
  ],
  "totalOrders": 3,
  "totalSpent": 165,
  "firstOrderDate": "2025-01-01T00:00:00Z",
  "lastOrderDate": "2025-11-20T04:00:00Z",
  "source": "chatbot",  // First order source
  "orderIds": ["ORD-123", "ORD-456", "WP-789"],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-11-20T04:00:00Z"
}
```

## 🚀 Setup Steps

### Step 1: Import Products from CSV

```bash
cd /Users/giorginozadze/Documents/BEBIAS\ CHATBOT\ VENERA

# Install dependencies if needed
npm install csv-parse

# Run the importer
npx ts-node scripts/import-csv-to-firestore.ts
```

**What this does:**
- Reads your 768-product WooCommerce CSV export
- Uploads to Firestore `products` collection
- Compatible with your existing WordPress plugin structure

### Step 2: Add API Key to Vercel Environment

```bash
# Generate a secure API key
openssl rand -hex 32

# Add to Vercel (replace YOUR_API_KEY with generated key)
vercel env add WP_WEBHOOK_API_KEY production
# When prompted, paste: YOUR_API_KEY
```

### Step 3: Deploy Vercel with New Endpoints

```bash
vercel --prod
```

**New endpoints available:**
- `POST /api/wp-webhook` - Receives WooCommerce order webhooks
- Existing chatbot endpoints continue working

### Step 4: Configure WooCommerce Webhooks

1. Go to WordPress Admin → WooCommerce → Settings → Advanced → Webhooks
2. Click "Add webhook"
3. Configure:
   - **Name**: `Bebias Chatbot - New Orders`
   - **Status**: Active
   - **Topic**: Order created
   - **Delivery URL**: `https://bebias-venera-chatbot.vercel.app/api/wp-webhook`
   - **Secret**: (leave empty)
   - **API Version**: WP REST API Integration v3

4. Add custom headers (click "Add Header"):
   - **Name**: `Authorization`
   - **Value**: `Bearer YOUR_API_KEY` (use the key from Step 2)

5. Save webhook

### Step 5: Test the Integration

#### Test 1: WooCommerce Order
1. Create a test order in WooCommerce
2. Check Vercel logs: `vercel logs https://bebias-venera-chatbot.vercel.app --since 5m`
3. Verify order appears in Firestore `orders` collection
4. Verify customer appears in Firestore `customers` collection

#### Test 2: Chatbot Order
1. Make a test purchase via Facebook Messenger chatbot
2. Verify order created in Firestore
3. Verify customer created/updated

## 🔄 Data Flow

### WooCommerce → Firestore
```
Customer places order in WP
    ↓
WooCommerce creates order
    ↓
Webhook fires → Vercel /api/wp-webhook
    ↓
Creates unified order in Firestore
    ↓
Creates/updates customer record
```

### Chatbot → Firestore
```
Customer orders via Facebook
    ↓
Payment verified (BOG bank API)
    ↓
Cloud Function confirms order
    ↓
Creates unified order in Firestore
    ↓
Creates/updates customer record
    ↓
Reduces product stock
```

### Stock Updates
```
WooCommerce stock updated
    ↓
WordPress plugin → wp-webhook Cloud Function
    ↓
Updates Firestore products collection
    ↓
Chatbot reads latest stock
```

## 📝 API Endpoints

### `/api/wp-webhook` (POST)
Receives WooCommerce webhooks

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Body (new_order):**
```json
{
  "action": "new_order",
  "order_id": 12345,
  "status": "processing",
  "total": "55.00",
  "customer_name": "გიორგი ნოზაძე",
  "customer_email": "customer@example.com",
  "customer_phone": "577273090",
  "customer_address": "დემეტრე თავდადებული 4",
  "items": [
    {
      "sku": "H-PLAIN-GREEN",
      "name": "მწვანე სადა ქუდი",
      "quantity": 1,
      "total": "55.00"
    }
  ],
  "timestamp": "2025-11-20 04:00:00"
}
```

## 🔐 Security

### API Keys
- **WP_WEBHOOK_API_KEY**: Used for WooCommerce webhooks
- Store in Vercel environment variables (already added)
- Use Bearer token authentication

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Products: Read-only for public, write only from server
    match /products/{sku} {
      allow read: if true;
      allow write: if false; // Only server-side writes
    }

    // Orders: No public access
    match /orders/{orderId} {
      allow read, write: if false; // Only server-side
    }

    // Customers: No public access
    match /customers/{customerId} {
      allow read, write: if false; // Only server-side
    }
  }
}
```

## 📊 Monitoring

### Check Firestore Data
```bash
# View products
gcloud firestore documents list products --limit 10

# View orders
gcloud firestore documents list orders --limit 10

# View customers
gcloud firestore documents list customers --limit 10
```

### Check Vercel Logs
```bash
# All logs
vercel logs https://bebias-venera-chatbot.vercel.app --since 1h

# Filter for webhooks
vercel logs https://bebias-venera-chatbot.vercel.app --since 1h | grep "wp-webhook"
```

## 🎯 Next Steps (Future Enhancements)

1. **Manual Sales Dashboard**
   - Create admin panel for manual order entry
   - Track offline/phone orders

2. **New Arrivals Management**
   - Bulk stock updates from CSV/spreadsheet
   - Automatic sync to main products collection

3. **Analytics Dashboard**
   - Customer lifetime value
   - Popular products
   - Sales by source (WP vs Chatbot vs Manual)

4. **Automated Reports**
   - Daily sales summary
   - Low stock alerts
   - Customer retention metrics

## 📚 File Reference

- **CSV Importer**: `scripts/import-csv-to-firestore.ts`
- **Firestore Library**: `lib/firestore.ts`
- **WP Webhook Endpoint**: `app/api/wp-webhook/route.ts`
- **Product CSV**: `/Users/giorginozadze/Downloads/wc-product-export-20-11-2025-1763612693038.csv`

## ✅ Checklist

- [ ] Run CSV importer to load 768 products
- [ ] Add WP_WEBHOOK_API_KEY to Vercel
- [ ] Deploy Vercel with new endpoints
- [ ] Configure WooCommerce webhook
- [ ] Test WooCommerce order → Firestore
- [ ] Test Chatbot order → Firestore
- [ ] Verify customer database is populated
- [ ] Update Firestore security rules

---

**Last Updated**: 2025-11-20
**Maintained By**: Claude Code + Giorgi Nozadze
