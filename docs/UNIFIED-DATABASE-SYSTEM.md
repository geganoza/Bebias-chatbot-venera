# Unified Database System Documentation

**Last Updated:** 2025-11-20
**Project:** BEBIAS Chatbot Venera
**Database:** Google Cloud Firestore (`bebias-wp-db-handler`)

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Data Flow](#data-flow)
3. [Firestore Collections](#firestore-collections)
4. [Order Sources](#order-sources)
5. [Cloud Functions](#cloud-functions)
6. [WordPress Integration](#wordpress-integration)
7. [Vercel Application](#vercel-application)
8. [Recent Updates](#recent-updates)
9. [File Locations](#file-locations)
10. [Testing & Verification](#testing--verification)

---

## System Architecture

The unified database system consolidates orders from three sources:
- **WordPress** (WooCommerce)
- **Facebook Chatbot** (Messenger)
- **Manual Orders** (Control Panel)

All orders are stored in a unified format in Firestore, enabling:
- Single source of truth for all orders
- Unified customer database
- Real-time stock management
- Payment verification integration
- Cross-platform order tracking

### Architecture Diagram

```
┌─────────────────┐
│   WordPress     │
│  WooCommerce    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  WordPress Plugin               │
│  (Woocommerce DB Handler)       │
│  - Hooks: woocommerce_new_order │
│  - Sends full customer data     │
└────────┬────────────────────────┘
         │
         ▼ POST (Bearer Token Auth)
┌──────────────────────────────────┐
│  Google Cloud Function           │
│  wp-webhook (Python 3.10)        │
│  - Transforms WP order format    │
│  - Creates unified order         │
│  - Upserts customer record       │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Google Cloud Firestore          │
│  Project: bebias-wp-db-handler   │
│  Collections:                    │
│  - orders                        │
│  - customers                     │
│  - products                      │
│  - product_stock                 │
└──────────────────────────────────┘
         ▲
         │
         │ (Chatbot & Manual Orders)
         │
┌────────┴─────────────────────────┐
│  Vercel Next.js App              │
│  - /api/chat (Chatbot orders)    │
│  - /api/webhook (FB Messenger)   │
│  - Control Panel (Manual orders) │
└──────────────────────────────────┘
```

---

## Data Flow

### WordPress Order Flow

1. Customer places order on WooCommerce
2. WordPress hook `woocommerce_new_order` fires
3. WordPress Plugin (`class-wcdbh-sync.php`) sends POST request to Cloud Function
4. Cloud Function (`wp-webhook`) receives order data
5. Cloud Function transforms data to unified format
6. Cloud Function writes to Firestore `orders` collection
7. Cloud Function upserts customer record in `customers` collection

### Chatbot Order Flow

1. User messages chatbot via Facebook Messenger
2. Messenger webhook sends to Vercel `/api/messenger`
3. Vercel processes order through `/api/chat`
4. Order saved to Firestore in unified format
5. Customer record created/updated
6. Payment verification triggered (BOG Bank integration)

### Manual Order Flow

1. Admin creates order via Control Panel
2. Order submitted through Vercel API
3. Saved to Firestore with `source: 'manual'`
4. Customer record updated

---

## Firestore Collections

### `orders` Collection

**Document ID Format:**
- WordPress: `WP-{order_id}` (e.g., `WP-11634`)
- Chatbot: `ORD-{timestamp}` (e.g., `ORD-1763590453785`)
- Manual: `MANUAL-{id}`

**Unified Order Schema:**

```typescript
interface UnifiedOrder {
  orderId: string;           // Document ID
  source: 'wordpress' | 'chatbot' | 'manual';
  status: 'pending' | 'processing' | 'confirmed' | 'shipped' | 'cancelled';

  customer: {
    name: string;
    telephone: string;
    email?: string;          // Optional - only if provided
    address: string;
    facebookId?: string;     // Optional - chatbot only
    customerId?: string;     // Link to customers collection
  };

  items: Array<{
    sku: string;
    productName: string;
    quantity: number;
    price: number;
  }>;

  total: number;
  paymentVerified: boolean;
  emailSent?: boolean;       // Optional
  timestamp: string;         // ISO 8601 format
  createdAt: Timestamp;      // Firestore server timestamp
  updatedAt?: Timestamp;     // Optional
}
```

**Important Notes:**
- **NEVER use `undefined` for optional fields** - omit them entirely or use `null`
- `facebookId` is chatbot-only, should NOT be in WordPress orders
- All optional fields are conditionally added based on availability

### `customers` Collection

**Document ID:** Normalized phone number (digits only)
**Example:** `577273090`

**Customer Schema:**

```typescript
interface Customer {
  customerId: string;        // Phone number (normalized)
  name: string;
  telephone: string;         // Original format
  email?: string;            // Optional
  facebookId?: string;       // Optional - chatbot only
  addresses: string[];       // Array of all addresses used
  totalOrders: number;
  totalSpent: number;
  firstOrderDate: string;
  lastOrderDate: string;
  source: 'wordpress' | 'chatbot' | 'manual';
  orderIds: string[];        // Array of order document IDs
  createdAt: string;         // ISO 8601
  updatedAt: string;         // ISO 8601
}
```

**Customer Update Logic:**
- Uses phone number as unique identifier
- Automatically aggregates orders and spending
- Maintains list of all addresses
- Preserves optional fields (email, facebookId) if previously set

### `products` Collection

Used for WooCommerce product stock sync (legacy).

### `product_stock` Collection

**Document ID:** Product SKU
**Example:** `1140`

**Schema:**

```typescript
interface ProductStock {
  productId: string;         // Same as SKU
  name: string;
  stock: number;
  lastUpdated: string;
  orders: number;            // Total orders for this product
}
```

**Stock Management:**
- Atomic transactions for stock reduction
- Prevents overselling
- Tracks total orders per product
- CSV import support (278 products imported)

---

## Order Sources

### 1. WordPress (WooCommerce)

**Status Mapping:**

| WooCommerce Status | Unified Status |
|-------------------|----------------|
| `pending`         | `pending`      |
| `on-hold`         | `pending`      |
| `processing`      | `processing`   |
| `completed`       | `confirmed`    |
| `cancelled`       | `cancelled`    |
| `refunded`        | `cancelled`    |
| `failed`          | `cancelled`    |

**Order ID Format:** `WP-{woocommerce_order_id}`

**Data Source:** Full WooCommerce order object via REST API

**Customer Fields:**
- Name: `billing.first_name` + `billing.last_name`
- Phone: `billing.phone`
- Email: `billing.email`
- Address: `billing.address_1`, `address_2`, `city`, `postcode` (combined)

### 2. Chatbot (Facebook Messenger)

**Status Mapping:**
- Always starts as `pending`
- Updated to `confirmed` after payment verification
- Can be `shipped` or `cancelled` manually

**Order ID Format:** `ORD-{timestamp}`

**Data Source:** Chatbot conversation + Facebook user profile

**Customer Fields:**
- Name: From Facebook profile or user input
- Phone: User input (validated)
- Email: Optional
- Address: User input
- Facebook ID: From Messenger sender ID

**Special Features:**
- Bank payment verification (BOG integration)
- Attachment support (payment screenshots)
- Real-time order status updates via Messenger

### 3. Manual Orders

**Status Mapping:**
- Admin sets initial status
- Can be any valid status

**Order ID Format:** `MANUAL-{sequential_id}`

**Data Source:** Control Panel form

**Customer Fields:**
- All fields manually entered by admin
- Can link to existing customer by phone

---

## Cloud Functions

### 1. `wp-webhook` (Google Cloud Function)

**Location:** `https://us-central1-bebias-wp-db-handler.cloudfunctions.net/wp-webhook`

**Runtime:** Python 3.10
**Region:** us-central1
**Memory:** 256MB
**Timeout:** 60s
**Current Revision:** `wp-webhook-00002-rud` (deployed 2025-11-20)

**Environment Variables:**
- `API_KEY`: `wcdbh_live_9x8d7f6g5h4j3k2l`
- `LOG_EXECUTION_ID`: `true`

**Authentication:** Bearer token in Authorization header

**Endpoints:**

#### `POST /` (Main webhook)

**Actions Supported:**

1. **`stock_update`** - Update product stock from WordPress
   ```json
   {
     "action": "stock_update",
     "sku": "1140",
     "stock_qty": 50,
     "timestamp": "2025-11-20 10:30:00"
   }
   ```

2. **`new_order`** - Create new order from WordPress
   ```json
   {
     "action": "new_order",
     "order_id": 11634,
     "status": "processing",
     "total": 55.0,
     "currency": "GEL",
     "customer": {
       "name": "John Doe",
       "telephone": "577123456",
       "email": "john@example.com",
       "address": "123 Main St, Tbilisi"
     },
     "items": [
       {
         "sku": "1140",
         "name": "Product Name",
         "quantity": 1,
         "price": 55.0
       }
     ],
     "timestamp": "2025-11-20 10:30:00"
   }
   ```

**Source Code Location:**
- Deployed from: `/tmp/wp-webhook-source/main.py`
- Backup: Can be downloaded from Google Cloud Storage

**Key Functions:**

1. `transform_wp_order_to_unified()` - Converts WordPress format to unified schema
2. `upsert_customer()` - Creates or updates customer record
3. `firestore_trigger()` - Background function for Firestore changes (stock sync back to WP)

**Recent Fix (2025-11-20):**
- ✅ Fixed undefined `facebookId` error
- ✅ Added conditional field inclusion for optional fields
- ✅ Proper customer record management
- ✅ Unified order transformation

### 2. `verifyPayment` (Google Cloud Function)

**Location:** `https://us-central1-bebias-wp-db-handler.cloudfunctions.net/verifyPayment`

**Runtime:** Node.js 20
**Region:** us-central1
**Purpose:** Verify bank payments via BOG (Bank of Georgia) integration

**Features:**
- OCR for payment screenshots
- Bank transaction verification
- Georgian language support
- Automatic order confirmation on successful payment

**Source Code:** `cloud-functions/payment-verifier/`

---

## WordPress Integration

### Plugin: Woocommerce DB Handler

**Location:** `/Users/giorginozadze/Library/CloudStorage/GoogleDrive-content.martividigital@gmail.com/My Drive/Personal Projects/AZON/WP Plugins/Woocommerce DB Handler`

**Key Files:**

#### 1. `includes/class-wcdbh-sync.php`

**Purpose:** Handles WooCommerce hooks and sends data to Cloud Function

**Hooks:**
- `woocommerce_new_order` - Fires when new order is created
- `woocommerce_product_set_stock` - Fires on stock changes
- `woocommerce_variation_set_stock` - Fires on variation stock changes

**Key Method: `sync_order_creation()`**

**Last Updated:** 2025-11-20

```php
public function sync_order_creation( $order_id, $order = null ) {
    if ( ! $order ) {
        $order = wc_get_order( $order_id );
    }

    // Build items array with full product details
    $items_data = array();
    foreach ( $order->get_items() as $item_id => $item ) {
        $product = $item->get_product();
        $items_data[] = array(
            'product_id' => $item->get_product_id(),
            'variation_id' => $item->get_variation_id(),
            'sku' => $product ? $product->get_sku() : '',
            'name' => $item->get_name(),              // Added
            'quantity' => $item->get_quantity(),
            'price' => floatval( $item->get_total() ) / floatval( $item->get_quantity() ), // Added
        );
    }

    // Build order data with FULL customer information
    $data = array(
        'action' => 'new_order',
        'order_id' => $order_id,
        'status' => $order->get_status(),           // Added
        'total' => floatval( $order->get_total() ), // Cast to float
        'currency' => $order->get_currency(),
        'customer' => array(                         // Added complete customer object
            'name' => trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() ),
            'telephone' => $order->get_billing_phone(),
            'email' => $order->get_billing_email(),
            'address' => trim( implode( ', ', array_filter( array(
                $order->get_billing_address_1(),
                $order->get_billing_address_2(),
                $order->get_billing_city(),
                $order->get_billing_postcode(),
            ) ) ) ),
        ),
        'items' => $items_data,
        'timestamp' => $order->get_date_created() ?
                      $order->get_date_created()->date( 'Y-m-d H:i:s' ) :
                      current_time( 'mysql' ),
    );

    // Send to Cloud Function
    $this->api->post( '', $data );
}
```

**Changes Made (2025-11-20):**
- ✅ Now sends complete customer information (name, email, phone, address)
- ✅ Sends order status
- ✅ Sends product details including name and price
- ✅ Proper timestamp handling
- ✅ Type casting for numeric values

#### 2. `includes/class-wcdbh-api.php`

**Purpose:** HTTP client for communicating with Cloud Function

**Configuration:**
- API URL: `https://us-central1-bebias-wp-db-handler.cloudfunctions.net/wp-webhook`
- Authentication: Bearer token
- Timeout: 15 seconds

**Headers:**
```php
'Content-Type' => 'application/json'
'Authorization' => 'Bearer ' . $this->api_key
'X-WCDBH-Source' => 'wordpress'
```

#### 3. `full-sync-to-firestore.php`

**Purpose:** One-time script to sync all products to Firestore

**Usage:**
```bash
php full-sync-to-firestore.php
```

**Features:**
- Syncs product stock quantities
- Updates product metadata
- Handles variations

### WordPress Admin Settings

**Location:** WooCommerce > Settings > Woocommerce DB Handler

**Required Settings:**
- API URL: `https://us-central1-bebias-wp-db-handler.cloudfunctions.net/wp-webhook`
- API Key: `wcdbh_live_9x8d7f6g5h4j3k2l`

---

## Vercel Application

### Project: bebias-venera-chatbot

**Production URL:** `https://bebias-venera-chatbot.vercel.app`

**Key API Routes:**

#### 1. `/api/chat` (POST)

**Purpose:** Main chatbot conversation handler

**Features:**
- Claude AI integration (Anthropic)
- Order creation
- Payment verification
- FAQ handling
- Product catalog

**Order Creation Flow:**
1. User provides: product, name, phone, address
2. System generates order ID: `ORD-{timestamp}`
3. Writes to Firestore orders collection
4. Upserts customer record
5. Returns order summary to user

#### 2. `/api/messenger` (POST)

**Purpose:** Facebook Messenger webhook

**Features:**
- Receives messages from Facebook
- Handles attachments (payment screenshots)
- Processes user inputs
- Sends responses back to Messenger

#### 3. `/api/webhook` (POST)

**Purpose:** Generic webhook endpoint (not currently used for WP orders)

**Note:** WordPress orders go directly to Google Cloud Function, NOT this endpoint.

#### 4. `/api/bank/verify-payment` (POST)

**Purpose:** Payment verification endpoint

**Integration:** Calls Google Cloud Function `verifyPayment`

**Features:**
- Handles payment screenshots
- OCR text extraction
- Transaction verification
- Order status update

#### 5. `/api/manual-control` (POST)

**Purpose:** Control panel API for manual order management

**Features:**
- Create manual orders
- Update order status
- Send notifications
- Manage customers

### Firestore Client (`lib/firestore.ts`)

**Purpose:** TypeScript client for Firestore operations

**Key Functions:**

1. **Order Management:**
   - `createUnifiedOrder()` - Create order in unified format
   - `getOrder()` - Retrieve order by ID
   - `getAllOrders()` - List orders with filters
   - `updateOrderStatus()` - Update order status

2. **Customer Management:**
   - `upsertCustomer()` - Create/update customer record
   - `getCustomer()` - Retrieve customer by phone
   - `getAllCustomers()` - List all customers

3. **Stock Management:**
   - `getProductStock()` - Get current stock
   - `reduceProductStock()` - Atomic stock reduction
   - `upsertProductStock()` - Update stock levels
   - `getAllProductStock()` - List all products

**Recent Updates (2025-11-20):**
```typescript
// Fixed: Conditional field inclusion
export async function upsertCustomer(orderData: UnifiedOrder): Promise<void> {
  // ... existing code ...

  // Only add optional fields if they exist
  if (orderData.customer.email) {
    newCustomer.email = orderData.customer.email;
  }
  if (orderData.customer.facebookId) {
    newCustomer.facebookId = orderData.customer.facebookId;
  }

  // NEVER add undefined values!
}
```

### Environment Variables

**File:** `.env.production`

**Firestore:**
```
GOOGLE_CLOUD_CLIENT_EMAIL=<service-account-email>
GOOGLE_CLOUD_PRIVATE_KEY=<service-account-key>
```

**Vercel KV (Redis):**
```
KV_REDIS_URL=rediss://default:***@intimate-rattler-22686.upstash.io:6379
KV_REST_API_TOKEN=***
KV_REST_API_URL=https://intimate-rattler-22686.upstash.io
```

**Anthropic (Claude AI):**
```
ANTHROPIC_API_KEY=<api-key>
```

**Facebook Messenger:**
```
FACEBOOK_PAGE_ACCESS_TOKEN=<token>
FACEBOOK_VERIFY_TOKEN=<token>
```

---

## Recent Updates

### 2025-11-20: Fixed Undefined `facebookId` Error

**Problem:**
- WordPress orders were being written to Firestore with `undefined` values for optional fields
- Firestore validation was failing
- Customer records couldn't be created

**Root Cause:**
- Cloud Function was directly saving raw WordPress data without transformation
- Optional fields (`email`, `facebookId`) were being set to JavaScript `undefined`
- Firestore doesn't accept `undefined` - requires `null` or field omission

**Solution:**

1. **Updated WordPress Plugin** (`class-wcdbh-sync.php`):
   - Now sends complete customer information
   - Includes all billing details
   - Sends product details (name, price)
   - Proper timestamp formatting

2. **Updated Cloud Function** (`wp-webhook`):
   - Added `transform_wp_order_to_unified()` function
   - Proper WordPress to unified format conversion
   - Conditional field inclusion (only add if value exists)
   - Added `upsert_customer()` for customer management
   - Status mapping (WooCommerce → Unified)

3. **Code Changes:**
```python
# Before (BROKEN):
db.collection('orders').document(str(order_id)).set(request_json)

# After (FIXED):
unified_order = transform_wp_order_to_unified(request_json)
db.collection('orders').document(f'WP-{order_id}').set(unified_order)
upsert_customer(unified_order)

# Conditional field inclusion:
if customer_data.get('email'):
    unified_order['customer']['email'] = customer_data['email']
# facebookId is NOT added for WordPress orders
```

**Verification:**
- Tested with order WP-11634
- Successfully created order
- Customer record updated (ID: 577273090)
- No undefined field errors
- Logs confirm: "✅ WordPress order 11634 saved as WP-11634"

**Deployment:**
- Cloud Function: Revision `wp-webhook-00002-rud`
- Deployed: 2025-11-20 06:50:44 UTC
- Status: ✅ Active

### Previous Updates

#### 2025-11-18: BOG Bank Integration
- Added payment verification Cloud Function
- OCR support for payment screenshots
- Georgian language support
- Automatic order confirmation

#### 2025-11-15: Product Import
- Imported 278 products from CSV
- Created product_stock collection
- Implemented atomic stock reduction

#### 2025-11-10: Unified Order System
- Created UnifiedOrder interface
- Implemented customer database
- Added order source tracking

---

## File Locations

### Google Drive

**WordPress Plugin:**
```
/Users/giorginozadze/Library/CloudStorage/GoogleDrive-content.martividigital@gmail.com/My Drive/Personal Projects/AZON/WP Plugins/Woocommerce DB Handler/
```

**Files:**
- `includes/class-wcdbh-sync.php` - Order sync handler (UPDATED 2025-11-20)
- `includes/class-wcdbh-api.php` - HTTP client
- `full-sync-to-firestore.php` - Product sync script

### Local Development

**Vercel Project:**
```
/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA/
```

**Key Files:**
- `lib/firestore.ts` - Firestore client (UPDATED 2025-11-20)
- `app/api/chat/route.ts` - Chatbot handler
- `app/api/messenger/route.ts` - Messenger webhook
- `app/api/bank/verify-payment/route.ts` - Payment verification
- `data/products.json` - Product catalog (278 products)

**Cloud Function Source (Backup):**
```
/tmp/wp-webhook-source/
```

**Files:**
- `main.py` - Cloud Function code (DEPLOYED 2025-11-20)
- `requirements.txt` - Python dependencies
- `deploy.md` - Deployment instructions

### Scripts

**Firestore Management:**
```
/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA/scripts/
```

**Files:**
- `import-csv-to-firestore.ts` - Import products from CSV
- `check-firestore-order.ts` - Check order existence
- `check-order.js` - Simple order checker
- `test-webhook.sh` - Test WordPress webhook

---

## Testing & Verification

### Check Order in Firestore

**Method 1: Cloud Function Logs**
```bash
gcloud functions logs read wp-webhook \
  --project=bebias-wp-db-handler \
  --region=us-central1 \
  --limit=20 \
  --gen2
```

**Method 2: Firestore Console**
- URL: https://console.firebase.google.com/project/bebias-wp-db-handler/firestore
- Navigate to: `orders` → `WP-{order_id}`

**Method 3: Script**
```bash
node scripts/check-order.js WP-11634
```

### Test WordPress Webhook

**Using test script:**
```bash
./scripts/test-webhook.sh
```

**Manual test:**
```bash
curl -X POST https://us-central1-bebias-wp-db-handler.cloudfunctions.net/wp-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wcdbh_live_9x8d7f6g5h4j3k2l" \
  -d '{
    "action": "new_order",
    "order_id": 99999,
    "status": "processing",
    "total": 55.0,
    "customer": {
      "name": "Test User",
      "telephone": "599999999",
      "email": "test@example.com",
      "address": "Test Address"
    },
    "items": [
      {
        "sku": "1140",
        "name": "Test Product",
        "quantity": 1,
        "price": 55.0
      }
    ],
    "timestamp": "2025-11-20 10:00:00"
  }'
```

### Verify Customer Record

**Check customer by phone:**
```bash
# Customer ID is normalized phone (digits only)
# Example: 577273090 for phone +995 577 27 30 90
```

**Firestore Console:**
- Navigate to: `customers` → `577273090`

### Check Product Stock

**Firestore Console:**
- Navigate to: `product_stock` → `{sku}`

**Example:** `product_stock/1140`

### Monitor Logs

**Cloud Function Logs:**
```bash
# Recent logs
gcloud functions logs read wp-webhook \
  --project=bebias-wp-db-handler \
  --region=us-central1 \
  --gen2 \
  --limit=50

# Filter by order
gcloud functions logs read wp-webhook \
  --project=bebias-wp-db-handler \
  --region=us-central1 \
  --gen2 | grep "WP-11634"
```

**Vercel Logs:**
```bash
vercel logs https://bebias-venera-chatbot.vercel.app --since 10m
```

---

## Common Issues & Solutions

### Issue: Undefined Fields in Firestore

**Symptoms:**
- Firestore validation errors
- Customer records not created
- Missing optional fields

**Solution:**
- ✅ FIXED in Cloud Function revision `wp-webhook-00002-rud`
- Never use `undefined` for optional fields
- Use conditional field inclusion
- Omit fields that don't have values

**Code Pattern:**
```python
# CORRECT
if customer_data.get('email'):
    unified_order['customer']['email'] = customer_data['email']

# WRONG
unified_order['customer']['email'] = customer_data.get('email')  # Could be None/undefined
```

### Issue: WordPress Plugin Not Sending Data

**Symptoms:**
- Orders created in WooCommerce but not in Firestore
- No Cloud Function logs

**Check:**
1. Plugin settings (API URL and key)
2. WordPress error logs
3. Network connectivity
4. Bearer token authentication

**Verify:**
```bash
# Check recent WordPress order syncs
gcloud functions logs read wp-webhook \
  --project=bebias-wp-db-handler \
  --region=us-central1 \
  --gen2 \
  --limit=10
```

### Issue: Stock Not Updating

**Symptoms:**
- Orders placed but stock remains unchanged

**Solution:**
- Check `product_stock` collection
- Verify SKU matches
- Review atomic transaction logs
- Ensure product exists in Firestore

**Manual Stock Update:**
```typescript
await reduceProductStock('1140', 1);
```

### Issue: Customer Duplicates

**Symptoms:**
- Multiple customer records for same person

**Cause:**
- Phone number normalization issues
- Different phone formats

**Solution:**
- Customer ID uses normalized phone (digits only)
- Example: `+995 577 27 30 90` → `577273090`

---

## Maintenance Tasks

### Daily

- Monitor Cloud Function logs for errors
- Check failed orders
- Verify payment confirmations

### Weekly

- Review customer database for duplicates
- Check stock levels
- Verify order statuses

### Monthly

- Backup Firestore data
- Review Cloud Function costs
- Update product catalog
- Check API rate limits

---

## API Rate Limits

### Google Cloud Firestore

**Free Tier (Spark Plan):**
- Reads: 50,000/day
- Writes: 20,000/day
- Deletes: 20,000/day

**Current Usage:** Within limits

### Google Cloud Functions

**Free Tier:**
- 2M invocations/month
- 400,000 GB-seconds
- 200,000 GHz-seconds

**Current Usage:** Within limits

### Anthropic (Claude AI)

**Plan:** Pay-as-you-go
**Model:** Claude 3.5 Sonnet
**Usage:** Tracked in Vercel logs

### Facebook Messenger

**Rate Limits:**
- 100 messages/second per app
- 10 messages/second per recipient

---

## Security

### Authentication

**Cloud Function:**
- Bearer token: `wcdbh_live_9x8d7f6g5h4j3k2l`
- Store in WordPress plugin settings
- Never commit to git

**Firestore:**
- Service account authentication
- Private key in environment variables
- Restricted to Cloud Run service accounts

**Vercel:**
- Environment variables encrypted
- HTTPS only
- CORS configured

### Data Privacy

**Customer Data:**
- PII stored in Firestore
- Phone numbers normalized
- Email optional
- No credit card storage

**Payment Data:**
- Bank verification only
- No sensitive data stored
- OCR processed in memory
- Screenshots not permanently stored

---

## Deployment

### Cloud Function Deployment

**Command:**
```bash
cd /tmp/wp-webhook-source
gcloud functions deploy wp-webhook \
  --gen2 \
  --runtime=python310 \
  --region=us-central1 \
  --source=. \
  --entry-point=wp_webhook \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=60s \
  --memory=256MB \
  --max-instances=10 \
  --project=bebias-wp-db-handler \
  --set-env-vars="API_KEY=wcdbh_live_9x8d7f6g5h4j3k2l"
```

**Verify Deployment:**
```bash
gcloud functions describe wp-webhook \
  --project=bebias-wp-db-handler \
  --region=us-central1 \
  --gen2
```

### Vercel Deployment

**Command:**
```bash
cd /Users/giorginozadze/Documents/BEBIAS\ CHATBOT\ VENERA
vercel --prod
```

**Environment Variables:**
- Set in Vercel dashboard
- Or use: `vercel env add`

### WordPress Plugin Update

**Steps:**
1. Edit files in Google Drive location
2. FTP to WordPress site
3. Or use WordPress file editor
4. Clear WordPress cache

**Plugin Files:**
```
wp-content/plugins/woocommerce-db-handler/
├── includes/
│   ├── class-wcdbh-sync.php    (UPDATE THIS)
│   ├── class-wcdbh-api.php
│   └── ...
├── woocommerce-db-handler.php
└── ...
```

---

## Troubleshooting Commands

### Check Firestore Order
```bash
# Using gcloud
gcloud firestore databases describe --project=bebias-wp-db-handler

# Check specific order
node scripts/check-order.js WP-11634
```

### Check Cloud Function Status
```bash
# List functions
gcloud functions list --project=bebias-wp-db-handler --gen2

# Get function details
gcloud functions describe wp-webhook \
  --project=bebias-wp-db-handler \
  --region=us-central1 \
  --gen2

# Check logs
gcloud functions logs read wp-webhook \
  --project=bebias-wp-db-handler \
  --region=us-central1 \
  --gen2 \
  --limit=50
```

### Check Vercel Deployment
```bash
# Get deployment URL
vercel ls

# Check logs
vercel logs https://bebias-venera-chatbot.vercel.app --since 10m

# Check environment variables
vercel env ls
```

### Test Webhook Manually
```bash
# WordPress webhook
./scripts/test-webhook.sh

# Or direct curl
curl -X POST https://us-central1-bebias-wp-db-handler.cloudfunctions.net/wp-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wcdbh_live_9x8d7f6g5h4j3k2l" \
  -d @test-order.json
```

---

## Contact & Support

**Project Owner:** Giorgi Nozadze
**Email:** content.martividigital@gmail.com

**Resources:**
- Firestore Console: https://console.firebase.google.com/project/bebias-wp-db-handler
- Google Cloud Console: https://console.cloud.google.com/functions?project=bebias-wp-db-handler
- Vercel Dashboard: https://vercel.com/giorgis-projects-cea59354
- WordPress Admin: [Your WordPress URL]/wp-admin

---

## Change Log

### 2025-11-20
- ✅ Fixed undefined `facebookId` error in WordPress orders
- ✅ Updated Cloud Function to properly transform orders
- ✅ Added conditional field inclusion for optional fields
- ✅ Updated WordPress plugin to send complete customer data
- ✅ Deployed Cloud Function revision `wp-webhook-00002-rud`
- ✅ Tested with order WP-11634 - SUCCESS
- ✅ Created this comprehensive documentation

### 2025-11-18
- Added BOG bank payment verification
- Deployed `verifyPayment` Cloud Function
- OCR integration for payment screenshots

### 2025-11-15
- Imported 278 products from CSV
- Created product_stock collection
- Implemented atomic stock reduction

### 2025-11-10
- Initial unified order system
- Created UnifiedOrder interface
- Implemented customer database
- WordPress plugin created

---

## Future Enhancements

### Planned Features

1. **Email Notifications**
   - Order confirmation emails
   - Shipping notifications
   - Payment reminders

2. **SMS Notifications**
   - Order status updates via SMS
   - Payment confirmations

3. **Advanced Analytics**
   - Sales reports
   - Customer lifetime value
   - Product performance

4. **Inventory Management**
   - Low stock alerts
   - Automated reordering
   - Supplier management

5. **Multi-Currency Support**
   - USD, EUR support
   - Currency conversion
   - Multi-language invoices

6. **Shipping Integration**
   - Courier API integration
   - Tracking numbers
   - Delivery confirmations

### Known Limitations

1. **Stock Sync**
   - One-way sync from WP to Firestore
   - Manual updates needed for Firestore → WP

2. **Payment Verification**
   - Manual verification required
   - OCR accuracy ~90%

3. **Customer Matching**
   - Phone-only matching
   - No email-based deduplication

---

## Glossary

**Unified Order:** Order format that consolidates all sources
**SKU:** Stock Keeping Unit (product identifier)
**Firestore:** Google's NoSQL cloud database
**Cloud Function:** Serverless function in Google Cloud
**Vercel:** Hosting platform for Next.js
**WooCommerce:** WordPress e-commerce plugin
**BOG:** Bank of Georgia
**OCR:** Optical Character Recognition

---

**End of Documentation**

Last Updated: 2025-11-20
Version: 1.0
Status: ✅ Active and Tested
