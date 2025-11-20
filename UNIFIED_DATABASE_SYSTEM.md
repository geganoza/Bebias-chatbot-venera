# Unified Database System Documentation

**Last Updated:** November 20, 2025
**Status:** ✅ Fully Operational

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Collections](#database-collections)
4. [Data Flow](#data-flow)
5. [Components](#components)
6. [API Endpoints](#api-endpoints)
7. [Scripts & Tools](#scripts--tools)
8. [Environment Variables](#environment-variables)
9. [Deployment](#deployment)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Unified Database System consolidates all order and product data from multiple sources (WooCommerce, Chatbot, Manual) into a single Firestore database. This enables:

- **Centralized Data**: All orders, products, and customers in one place
- **Real-time Sync**: Automatic synchronization from WooCommerce
- **Customer Tracking**: Lifetime value and order history
- **Multi-source Support**: Handles orders from WP, chatbot, and manual entry
- **Stock Management**: Real-time inventory tracking

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                              │
├─────────────────────────────────────────────────────────────────┤
│  WooCommerce  │  Facebook Chatbot  │  Manual Control Panel      │
└───────┬─────────────────┬─────────────────────┬─────────────────┘
        │                 │                     │
        │ Webhook         │ API                 │ API
        ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL API ROUTES                             │
├─────────────────────────────────────────────────────────────────┤
│  /api/wp-webhook  │  /api/chat  │  /api/manual-control          │
└───────┬─────────────────┬─────────────────────┬─────────────────┘
        │                 │                     │
        └─────────────────┴─────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │      lib/firestore.ts               │
        │  (Unified Data Layer)               │
        └─────────────────┬───────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │      GOOGLE FIRESTORE               │
        │                                     │
        │  ┌───────────┬──────────┬─────────┐│
        │  │ products  │  orders  │customers││
        │  └───────────┴──────────┴─────────┘│
        └─────────────────────────────────────┘
```

---

## Database Collections

### 1. **products** Collection

Stores all product data synchronized from WooCommerce.

**Document ID:** `{sku}` (e.g., "1140")

**Schema:**
```typescript
{
  sku: string;                    // Product SKU (document ID)
  product_id: number;             // WooCommerce product ID
  product_name: string;           // Product name (Georgian)
  product_name_en?: string;       // Product name (English) - optional
  price: number;                  // Regular price
  sale_price?: number;            // Sale price - optional
  stock_qty: number;              // Available quantity
  in_stock: boolean;              // Stock availability flag
  category: string;               // Product category
  tags: string[];                 // Product tags
  images: string[];               // Product image URLs
  attributes: {                   // Product attributes (e.g., sizes)
    [key: string]: string;
  };
  short_description?: string;     // Short description
  description?: string;           // Full description
  product_type: string;           // 'simple' | 'variation' | 'variable'
  last_updated_by: string;        // 'wordpress' | 'csv_import' | 'manual'
  last_updated_at: string;        // ISO timestamp
  created_at: string;             // ISO timestamp
}
```

**Example:**
```json
{
  "sku": "1140",
  "product_id": 1140,
  "product_name": "მწვანე ქუდი - შავი დიზაინით",
  "price": 55,
  "stock_qty": 10,
  "in_stock": true,
  "category": "ქუდები",
  "tags": ["winter", "hat"],
  "images": ["https://bebias.ge/wp-content/uploads/..."],
  "attributes": {
    "size": "L, M, S"
  },
  "product_type": "simple",
  "last_updated_by": "wordpress",
  "last_updated_at": "2025-11-20T08:30:00Z",
  "created_at": "2025-11-20T08:00:00Z"
}
```

---

### 2. **orders** Collection

Stores all orders from all sources in a unified format.

**Document ID:** `{orderId}` (e.g., "WP-12345", "ORD-20251120-001")

**Schema:**
```typescript
{
  orderId: string;                // Unique order ID (document ID)
  source: 'wordpress' | 'chatbot' | 'manual';
  status: 'pending' | 'processing' | 'confirmed' | 'cancelled';
  customer: {
    name: string;                 // Customer full name
    telephone: string;            // Phone number
    email?: string;               // Email (WP only)
    address: string;              // Delivery address
    facebookId?: string;          // Facebook PSID (chatbot only)
  };
  items: Array<{
    sku: string;                  // Product SKU
    productName: string;          // Product name
    quantity: number;             // Quantity ordered
    price: number;                // Unit price
  }>;
  total: number;                  // Order total amount
  paymentVerified: boolean;       // Payment verification status
  emailSent: boolean;             // Email confirmation sent
  timestamp: string;              // Order creation time (ISO)
  createdAt: string | null;       // Firestore server timestamp
}
```

**Order ID Formats:**
- WooCommerce: `WP-{order_id}` (e.g., "WP-12345")
- Chatbot: `ORD-{YYYYMMDD}-{sequence}` (e.g., "ORD-20251120-001")
- Manual: Custom format

**Example:**
```json
{
  "orderId": "WP-12345",
  "source": "wordpress",
  "status": "confirmed",
  "customer": {
    "name": "გიორგი ნოზაძე",
    "telephone": "599123456",
    "email": "customer@example.com",
    "address": "თბილისი, ვაკე, ჭავჭავაძის 12"
  },
  "items": [
    {
      "sku": "1140",
      "productName": "მწვანე ქუდი - შავი დიზაინით",
      "quantity": 2,
      "price": 55
    }
  ],
  "total": 110,
  "paymentVerified": true,
  "emailSent": false,
  "timestamp": "2025-11-20T10:30:00Z",
  "createdAt": "2025-11-20T10:30:05Z"
}
```

---

### 3. **customers** Collection

Tracks customer information and lifetime value.

**Document ID:** `{customerId}` (phone number or Facebook ID)

**Schema:**
```typescript
{
  customerId: string;             // Phone or Facebook ID (document ID)
  name: string;                   // Customer name
  telephone?: string;             // Phone number
  email?: string;                 // Email address
  facebookId?: string;            // Facebook PSID
  addresses: string[];            // All delivery addresses used
  totalOrders: number;            // Total number of orders
  totalSpent: number;             // Total amount spent
  firstOrderDate: string;         // ISO timestamp
  lastOrderDate: string;          // ISO timestamp
  source: 'wordpress' | 'chatbot' | 'manual';
  orderIds: string[];             // Array of order IDs
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
}
```

**Example:**
```json
{
  "customerId": "599123456",
  "name": "გიორგი ნოზაძე",
  "telephone": "599123456",
  "email": "customer@example.com",
  "addresses": [
    "თბილისი, ვაკე, ჭავჭავაძის 12",
    "თბილისი, საბურთალო, პეკინის 5"
  ],
  "totalOrders": 3,
  "totalSpent": 285,
  "firstOrderDate": "2025-10-15T10:00:00Z",
  "lastOrderDate": "2025-11-20T10:30:00Z",
  "source": "wordpress",
  "orderIds": ["WP-12345", "WP-12380", "WP-12401"],
  "createdAt": "2025-10-15T10:00:05Z",
  "updatedAt": "2025-11-20T10:30:10Z"
}
```

---

## Data Flow

### 1. WooCommerce Order Flow

```
New Order Created in WooCommerce
    ↓
WooCommerce sends webhook to /api/wp-webhook
    ↓
Verify HMAC signature
    ↓
Parse order data
    ↓
createUnifiedOrder() → Firestore
    ↓
upsertCustomer() → Update customer record
    ↓
Return success (HTTP 200)
```

### 2. Chatbot Order Flow

```
User completes order in chatbot
    ↓
POST /api/chat with order data
    ↓
createUnifiedOrder() → Firestore
    ↓
upsertCustomer() → Update customer record
    ↓
Send confirmation to user
```

### 3. Manual Order Flow

```
Admin creates order in control panel
    ↓
POST /api/manual-control
    ↓
createUnifiedOrder() → Firestore
    ↓
upsertCustomer() → Update customer record
    ↓
Update UI
```

### 4. Product Sync Flow

```
WooCommerce Product Updated
    ↓
WordPress Plugin detects change
    ↓
Plugin updates Firestore directly
    ↓
OR
    ↓
Export CSV from WooCommerce
    ↓
Run: npx ts-node scripts/import-csv-to-firestore.ts
    ↓
Products imported to Firestore
```

---

## Components

### Core Files

#### 1. `lib/firestore.ts`
Central data access layer for all Firestore operations.

**Key Functions:**

```typescript
// Order Management
createUnifiedOrder(order: UnifiedOrder): Promise<void>
getOrders(limit?: number): Promise<UnifiedOrder[]>
getOrderById(orderId: string): Promise<UnifiedOrder | null>
updateOrderStatus(orderId: string, status: string): Promise<void>

// Customer Management
upsertCustomer(order: UnifiedOrder): Promise<void>
getCustomers(limit?: number): Promise<Customer[]>
getCustomerById(customerId: string): Promise<Customer | null>

// Product Management
getProducts(limit?: number): Promise<Product[]>
getProductBySku(sku: string): Promise<Product | null>
updateProductStock(sku: string, newStock: number): Promise<void>
```

#### 2. `app/api/wp-webhook/route.ts`
Receives webhooks from WooCommerce for new orders.

**Configuration:**
- URL: `https://bebias-venera-chatbot.vercel.app/api/wp-webhook`
- Method: POST
- Authentication: HMAC SHA256 signature verification
- Secret: `process.env.WP_WEBHOOK_SECRET`

**Webhook Events:**
- `order.created` - New order created

**Response:**
- Always returns HTTP 200 (to prevent webhook failures)
- Logs all processing details

#### 3. `app/api/chat/route.ts`
Handles chatbot conversations and order creation.

**Features:**
- Facebook Messenger integration
- Order processing from chatbot
- Payment verification integration
- Product catalog queries

#### 4. `app/api/manual-control/route.ts`
Admin API for manual order management.

**Endpoints:**
- Create manual orders
- Update order status
- Manage inventory

#### 5. `app/control-panel/page.tsx`
Admin dashboard for viewing and managing all data.

**Features:**
- View all orders (WP, Chatbot, Manual)
- Filter by source, status, date
- View customer database
- Track inventory
- Manual order creation

---

## API Endpoints

### WooCommerce Webhook

**Endpoint:** `POST /api/wp-webhook`

**Headers:**
```
Content-Type: application/json
X-WC-Webhook-Signature: {hmac_sha256_signature}
```

**Payload:**
```json
{
  "id": 12345,
  "status": "processing",
  "total": "110.00",
  "billing": {
    "first_name": "გიორგი",
    "last_name": "ნოზაძე",
    "email": "customer@example.com",
    "phone": "599123456",
    "address_1": "ჭავჭავაძის 12",
    "address_2": "",
    "city": "თბილისი"
  },
  "line_items": [
    {
      "sku": "1140",
      "name": "მწვანე ქუდი",
      "quantity": 2,
      "total": "110.00"
    }
  ],
  "date_created": "2025-11-20T10:30:00"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "WP-12345",
  "message": "Order created successfully"
}
```

---

## Scripts & Tools

### 1. Import Products from CSV

**File:** `scripts/import-csv-to-firestore.ts`

**Purpose:** Import WooCommerce product export to Firestore

**Usage:**
```bash
npx ts-node scripts/import-csv-to-firestore.ts [csv-path]
```

**Default CSV Path:**
```
/Users/giorginozadze/Downloads/wc-product-export-20-11-2025-1763612693038.csv
```

**Features:**
- Parses WooCommerce CSV export
- Skips variable parent products (imports only variations)
- Handles inconsistent CSV columns
- Maps WooCommerce fields to Firestore schema
- Imports ~278 products (118 skipped as variable parents)

**Output:**
```
🚀 Starting CSV import to Firestore...
📊 Found 397 products in CSV

✅ Imported: 1140 - მწვანე ქუდი (Stock: 10)
⚠️  Skipping variable product (parent): მშობელი პროდუქტი
...

✨ Import Complete!
Total products in CSV: 397
Successfully imported: 278
Skipped: 118
Failed: 1
```

### 2. Test Unified System

**File:** `scripts/test-unified-system.ts`

**Purpose:** Test all components before production

**Usage:**
```bash
npx ts-node scripts/test-unified-system.ts
```

**Tests:**
1. Firestore connection
2. Product creation
3. WP order creation
4. Chatbot order creation
5. Customer creation
6. Customer update (second order)
7. Cleanup test data

**Output:**
```
🧪 Starting Unified System Tests...

✅ Firestore Connection - Connected successfully
✅ Create Sample Product - Product created and verified
✅ Create WP Order - WP order created successfully
✅ Create Chatbot Order - Chatbot order created successfully
✅ Customer Creation - Customer record created successfully
✅ Customer Update - Customer updated with second order
✅ Cleanup Test Data - All test data cleaned up

📊 TEST RESULTS
Total: 7 tests
✅ Passed: 7
❌ Failed: 0

🎉 ALL TESTS PASSED! System is ready for deployment.
```

---

## Environment Variables

### Vercel Environment Variables

**Required:**

```bash
# Firebase/Firestore
FIREBASE_PROJECT_ID=bebias-chatbot
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@bebias-chatbot.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# WooCommerce Webhook
WP_WEBHOOK_SECRET=UYt<A<,-EYdS2yV)^FE6ents=;VeFTw~W6=eE]QTySiEHvMSfR

# Facebook Messenger
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
FACEBOOK_VERIFY_TOKEN=your_verify_token

# Payment Verification
GOOGLE_CLOUD_FUNCTION_URL=https://us-central1-bebias-chatbot.cloudfunctions.net/verifyPayment
```

**Setting Environment Variables:**

```bash
# Add all variables
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_PRIVATE_KEY
vercel env add WP_WEBHOOK_SECRET

# Pull to local
vercel env pull
```

### Local Development

**File:** `.env.local`

```bash
FIREBASE_PROJECT_ID=bebias-chatbot
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
WP_WEBHOOK_SECRET=...
```

---

## Deployment

### Initial Setup

1. **Install Dependencies:**
```bash
npm install firebase-admin
npm install csv-parse
```

2. **Add Firestore Credentials:**
```bash
# Place firestore-key.json in project root
# Add to .gitignore
echo "firestore-key.json" >> .gitignore
```

3. **Configure Environment:**
```bash
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_PRIVATE_KEY
vercel env add WP_WEBHOOK_SECRET
```

4. **Deploy to Vercel:**
```bash
vercel --prod
```

### Import Products

```bash
# Export products from WooCommerce
# WooCommerce → Products → Export → Export to CSV

# Import to Firestore
npx ts-node scripts/import-csv-to-firestore.ts /path/to/export.csv
```

### Configure WooCommerce Webhook

1. **Go to WooCommerce Settings:**
   - WooCommerce → Settings → Advanced → Webhooks

2. **Create New Webhook:**
   - Name: `Bebias Chatbot - New Orders`
   - Status: `Active`
   - Topic: `Order created`
   - Delivery URL: `https://bebias-venera-chatbot.vercel.app/api/wp-webhook`
   - Secret: `UYt<A<,-EYdS2yV)^FE6ents=;VeFTw~W6=eE]QTySiEHvMSfR`
   - API Version: `WP REST API Integration v3`

3. **Save Webhook**
   - Should show "Webhook updated successfully"

---

## Testing

### Test Webhook Endpoint

```bash
# Test with curl
curl -X POST https://bebias-venera-chatbot.vercel.app/api/wp-webhook \
  -H "Content-Type: application/json" \
  -d '{"test":"ping"}'

# Expected response:
# {"success":true,"message":"Test webhook received"}
```

### Test Order Creation

1. **Create Test Order in WooCommerce:**
   - Add product to cart
   - Complete checkout
   - Order should appear in Firestore

2. **Verify in Firestore:**
```bash
# Check orders collection for WP-{order_id}
# Check customers collection for phone number
```

3. **Check Logs:**
```bash
vercel logs https://bebias-venera-chatbot.vercel.app | grep "WP Webhook"
```

### Expected Log Output

```
🚨 WP Webhook called!
📥 Received WooCommerce webhook, body length: 1234
Signature present: true Secret present: true
✅ Signature verified
📥 Processing WooCommerce order #12345
   Status: processing, Total: 110
   Customer: გიორგი ნოზაძე
✅ WP order 12345 saved to Firestore
```

---

## Troubleshooting

### Webhook Not Receiving Data

**Symptoms:**
- Webhook returns 500 error in WooCommerce
- No logs appear in Vercel

**Solutions:**
1. Check webhook URL is correct
2. Verify `WP_WEBHOOK_SECRET` is set in Vercel
3. Check Vercel logs: `vercel logs https://bebias-venera-chatbot.vercel.app`
4. Test endpoint manually with curl

### Products Not Importing

**Symptoms:**
- CSV import fails
- Missing products in Firestore

**Solutions:**
1. Check CSV format (must be WooCommerce export)
2. Verify firestore-key.json exists
3. Check Firestore permissions
4. Run test script: `npx ts-node scripts/test-unified-system.ts`

### Orders Not Creating

**Symptoms:**
- Order appears in WP but not Firestore
- Webhook succeeds but no data

**Solutions:**
1. Check webhook logs in Vercel
2. Verify order has all required fields
3. Check Firestore rules allow writes
4. Test with manual API call

### Customer Records Not Updating

**Symptoms:**
- Multiple customer records for same person
- Total orders/spent incorrect

**Solutions:**
1. Check customer ID format (phone number)
2. Verify upsertCustomer() is called after createUnifiedOrder()
3. Check for duplicate phone numbers with different formats

---

## System Status Summary

### ✅ Completed

- [x] Firestore database setup
- [x] Product collection structure
- [x] Order collection structure
- [x] Customer collection structure
- [x] WooCommerce webhook endpoint
- [x] Webhook signature verification
- [x] CSV product importer
- [x] Test suite
- [x] Environment configuration
- [x] Vercel deployment
- [x] Webhook configuration in WooCommerce
- [x] 278 products imported

### 📊 Current Statistics

- **Products in Firestore:** 278
- **Collections:** 3 (products, orders, customers)
- **Active Webhooks:** 1 (WooCommerce order.created)
- **API Endpoints:** 4 (/wp-webhook, /chat, /manual-control, /bank/verify-payment)

### 🔄 Data Sources

1. **WooCommerce** → Webhook → Firestore ✅
2. **Facebook Chatbot** → API → Firestore ✅
3. **Manual Control Panel** → API → Firestore ✅

---

## Next Steps

### To Complete Setup:

1. **Test with Real Order:**
   - Create test order in WooCommerce
   - Verify order appears in Firestore
   - Verify customer record created/updated
   - Check logs for successful processing

2. **Monitor Initial Orders:**
   - Watch first few real orders
   - Verify data accuracy
   - Check stock updates
   - Confirm customer tracking

3. **Optimize (Future):**
   - Add email notifications
   - Implement stock alerts
   - Create analytics dashboard
   - Add order status updates

---

## Contact & Support

**Project:** Bebias Chatbot Venera
**Firestore Project:** bebias-chatbot
**Vercel URL:** https://bebias-venera-chatbot.vercel.app
**WooCommerce:** https://bebias.ge

---

## Backup & Recovery

### Firestore Backup

Firestore data is automatically backed up by Google Cloud. For manual export:

```bash
# Export entire database
gcloud firestore export gs://bebias-chatbot-backups/$(date +%Y%m%d)

# Import from backup
gcloud firestore import gs://bebias-chatbot-backups/YYYYMMDD
```

### Re-import Products

```bash
# If products need to be re-imported
npx ts-node scripts/import-csv-to-firestore.ts /path/to/latest-export.csv
```

---

**Documentation Version:** 1.0
**Last Tested:** November 20, 2025
**All Systems:** ✅ Operational
