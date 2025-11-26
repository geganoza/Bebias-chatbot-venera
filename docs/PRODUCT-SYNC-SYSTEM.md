# Product Sync System - Complete Documentation

**Created:** November 24, 2025
**Status:** ✅ Working

---

## Overview

This document explains how product stock/price data flows from your **Order Manager** → **Chatbot AI**.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   SOURCE OF TRUTH                        │
│        WooCommerce (bebias.ge website)                   │
│           Order Manager updates here                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ CSV Export
                       ↓
           ┌───────────────────────┐
           │ sync-woocommerce-full.py │  ← PRIMARY SCRIPT
           └───────────┬───────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
            ↓                     ↓
    ┌──────────────┐      ┌──────────────┐
    │  Firestore   │      │ products.json│
    │  products/   │      │ (124 KB)     │
    └──────┬───────┘      └──────┬───────┘
           │                     │
           │ Alternative         │ Current method
           │ (not used now)      │
           │                     ↓
           │              ┌──────────────┐
           │              │ Chatbot AI   │
           │              │ (loads JSON) │
           │              └──────────────┘
           │
           ↓
    ┌──────────────────┐
    │sync-from-firestore.js│ ← BACKUP METHOD
    └──────────────────┘
```

---

## File Structure

### Data Files
```
data/
├── products.json          # AI chatbot reads this (124 KB)
└── products.json.backup   # Backup copy
```

### Sync Scripts

#### ✅ **PRIMARY (Current)**
```
scripts/sync-woocommerce-full.py
```
- **Purpose:** WooCommerce CSV → Firestore + products.json
- **Input:** CSV export from WooCommerce
- **Output:** Updates both Firestore AND products.json
- **When to use:** Primary sync method, after Order Manager updates
- **Last modified:** Nov 22

#### ✅ **BACKUP (Alternative)**
```
scripts/sync-from-firestore.js
```
- **Purpose:** Firestore → products.json
- **Input:** Firestore products collection
- **Output:** products.json only
- **When to use:** If Firestore is already up-to-date
- **Last modified:** Nov 24

#### ❌ **DEPRECATED (Old - Don't Use)**
```
scripts/sync-products-to-firestore.js  # Opposite direction
scripts/sync-products-firestore.py     # Old Python version
```

---

## How It Works Now

### Step 1: Update Stock in Order Manager

Your team updates stock in **Order Manager** → Changes saved to **WooCommerce**.

### Step 2: Export CSV from WooCommerce

1. Go to WooCommerce → Products
2. Click "Export"
3. Select all products
4. Download CSV (e.g., `wc-products-export-2025-11-24.csv`)

### Step 3: Run Sync Script

```bash
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"
python3 scripts/sync-woocommerce-full.py ~/Downloads/wc-products-export-2025-11-24.csv
```

**What it does:**
1. Reads CSV file
2. Parses products (name, price, stock, images)
3. Encodes URLs for Facebook Messenger
4. Writes to **Firestore** `products/` collection
5. Writes to **data/products.json**

**Output:**
```
✅ Synced 156 products to Firestore
✅ Saved 156 products to data/products.json
   📦 In stock: 89
   ❌ Out of stock: 67
```

### Step 4: Deploy to Vercel (if needed)

If products.json changed:
```bash
vercel --prod
```

**Note:** Vercel picks up the new products.json automatically on next deployment.

---

## Product Data Format

### WooCommerce CSV (Input)
```csv
ID,Name,Stock,Price,Images
4719,აგურისფერი სადა ქუდი - L,0,59,"https://bebias.ge/wp-content/uploads/..."
4714,აგურისფერი სადა ქუდი - M,2,59,"https://bebias.ge/wp-content/uploads/..."
```

### products.json (AI Format)
```json
[
  {
    "id": "4719",
    "name": "აგურისფერი სადა ქუდი - L",
    "price": 59.0,
    "currency": "GEL",
    "stock": 0,
    "category": "",
    "image": "https://bebias.ge/wp-content/uploads/%E1%83%90%E1%83%92%E1%83%A3...",
    "short_description": ""
  }
]
```

**Note:** Georgian characters in URLs are percent-encoded for Facebook Messenger compatibility.

### Firestore Format
```
products/
  └── აგურისფერი სადა ქუდი - L/  ← Document ID = product name
      ├── id: "4719"
      ├── name: "აგურისფერი სადა ქუდი - L"
      ├── stock_qty: 0
      ├── price: 59.0
      ├── currency: "GEL"
      └── images: ["https://..."]
```

---

## Alternative: Direct Firestore Loading (Future)

### Current Method (File-Based)
✅ **Pros:**
- Fast (no database query)
- Works offline/locally
- Simple to debug

❌ **Cons:**
- Must redeploy to update stock
- Delay between sync and live data

### Alternative Method (Database-Based)

**Change chatbot to read from Firestore directly:**

```javascript
// app/api/process-message/route.ts
async function loadProducts(): Promise<Product[]> {
  // OLD: Read from file
  // const filePath = path.join(process.cwd(), 'data', 'products.json');
  // const fileContent = fs.readFileSync(filePath, 'utf8');
  // return JSON.parse(fileContent);

  // NEW: Read from Firestore
  const snapshot = await db.collection('products').get();
  const products: Product[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    products.push({
      id: data.id || doc.id,
      name: data.name,
      price: data.price || 0,
      stock: data.stock_qty || 0,
      currency: data.currency || 'GEL',
      category: data.category || '',
      image: data.images?.[0] || '',
      short_description: data.short_description || ''
    });
  });
  return products;
}
```

**Performance comparison:**

| Method | Load Time | Real-Time Stock | Deployment Needed |
|--------|-----------|-----------------|-------------------|
| File (current) | ~50ms | ❌ No | ✅ Yes |
| Firestore | ~200ms | ✅ Yes | ❌ No |

**Recommendation:**
- **Keep file-based** if stock updates are infrequent (once daily)
- **Switch to Firestore** if stock updates are frequent (multiple times per day)

---

## Automation Options

### Option 1: Manual Sync (Current)

**Frequency:** When stock changes
**Steps:**
1. Update Order Manager
2. Export CSV
3. Run `sync-woocommerce-full.py`
4. Deploy if needed

**Time:** 5 minutes
**Pros:** Simple, you control when
**Cons:** Manual work required

---

### Option 2: Scheduled Auto-Sync (Recommended)

Run sync automatically every 2 hours.

**Setup:**

Create `scripts/auto-sync-stock.sh`:
```bash
#!/bin/bash
# Auto-sync script - run every 2 hours

cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"

# Download CSV from WooCommerce via API
curl -u "ck_XXXXX:cs_XXXXX" \
  "https://bebias.ge/wp-json/wc/v3/products?per_page=100" \
  -o /tmp/products.json

# Convert JSON to products.json format
node scripts/convert-wc-api-to-products.js /tmp/products.json

# Deploy to Vercel
vercel --prod --yes

echo "✅ Auto-sync completed at $(date)"
```

**Schedule with cron:**
```bash
# Edit crontab
crontab -e

# Add this line (runs every 2 hours)
0 */2 * * * /path/to/scripts/auto-sync-stock.sh >> /var/log/bebias-sync.log 2>&1
```

---

### Option 3: Real-Time Sync (Advanced)

Use WooCommerce webhooks to trigger sync immediately when stock changes.

**Setup:**

1. **Create webhook endpoint:**
   ```javascript
   // app/api/woocommerce-webhook/route.ts
   export async function POST(req: Request) {
     const body = await req.json();
     const product = body; // WooCommerce sends product data

     // Update Firestore immediately
     await db.collection('products').doc(product.id).set({
       stock_qty: product.stock_quantity,
       price: product.price,
       // ... other fields
     });

     return NextResponse.json({ success: true });
   }
   ```

2. **Configure WooCommerce webhook:**
   - Go to WooCommerce → Settings → Advanced → Webhooks
   - Create new webhook
   - Topic: "Product updated"
   - Delivery URL: `https://bebias-venera-chatbot.vercel.app/api/woocommerce-webhook`
   - Secret: (generate random string)

**Flow:**
```
Order Manager updates stock
  ↓
WooCommerce triggers webhook
  ↓
Vercel endpoint updates Firestore
  ↓
Chatbot sees new stock immediately (if reading from Firestore)
```

---

## Recommendations

### For Current Setup (Manual Updates)

**Keep current method** (file-based + manual sync):
- Simple and working
- Stock doesn't change frequently
- Manual sync takes 5 minutes

### For Frequent Updates (Multiple Times Daily)

**Switch to Option 2** (Scheduled auto-sync):
- Automatic every 2 hours
- No manual work
- Still uses file-based loading (fast)

### For Real-Time Stock (Order Manager Integration)

**Implement Option 3** (Webhook + Firestore):
- Instant stock updates
- Zero manual work
- Switch chatbot to read from Firestore

---

## Migration Guide: File → Firestore

If you want real-time stock updates, follow these steps:

### Step 1: Update Product Loading (All Routes)

Update these files:
- `app/api/process-message/route.ts:143`
- `app/api/messenger/route.ts:363`
- `app/api/chat/route.ts:26`
- `app/api/manual-control/route.ts:11`

Replace `loadProducts()` function with Firestore version (see code above).

### Step 2: Test Performance

```bash
# Test Firestore loading speed
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./firestore-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function test() {
  const start = Date.now();
  const snapshot = await db.collection('products').get();
  const time = Date.now() - start;
  console.log(\`Loaded \${snapshot.size} products in \${time}ms\`);
}
test();
"
```

Expected: ~150-300ms (acceptable for real-time updates)

### Step 3: Deploy

```bash
npm run build
vercel --prod
```

### Step 4: Monitor Performance

```bash
vercel logs | grep "Loaded products"
```

If too slow (>500ms), add caching:
```javascript
let productsCache: Product[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadProducts(): Promise<Product[]> {
  if (productsCache && Date.now() - lastCacheTime < CACHE_TTL) {
    return productsCache;
  }

  const snapshot = await db.collection('products').get();
  productsCache = snapshot.docs.map(/* ... */);
  lastCacheTime = Date.now();
  return productsCache;
}
```

---

## Scripts Reference

| Script | Purpose | Direction | Status |
|--------|---------|-----------|--------|
| `sync-woocommerce-full.py` | CSV → Firestore + JSON | Import | ✅ Current |
| `sync-from-firestore.js` | Firestore → JSON | Export | ✅ Backup |
| `sync-products-to-firestore.js` | JSON → Firestore | Import | ❌ Old |
| `sync-products-firestore.py` | JSON → Firestore | Import | ❌ Old |

### When to Use Each

**Primary workflow:**
```bash
# After Order Manager updates
python3 scripts/sync-woocommerce-full.py ~/Downloads/export.csv
vercel --prod  # If needed
```

**Backup workflow** (if Firestore is already updated):
```bash
node scripts/sync-from-firestore.js
vercel --prod  # If needed
```

---

## Troubleshooting

### Issue: Products not updating in chatbot

**Check:**
1. Did you run the sync script?
   ```bash
   python3 scripts/sync-woocommerce-full.py export.csv
   ```

2. Is products.json updated?
   ```bash
   ls -lh data/products.json  # Check timestamp
   ```

3. Did you redeploy?
   ```bash
   vercel --prod
   ```

### Issue: Sync script fails

**Error:** "No module named 'google.cloud'"
**Fix:**
```bash
pip3 install google-cloud-firestore google-auth
```

**Error:** "Permission denied"
**Fix:** Check `.env.local` has correct Firebase credentials

### Issue: Out of sync

**Fix:** Force full resync:
```bash
# 1. Export fresh CSV from WooCommerce
# 2. Clear Firestore products (optional)
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./firestore-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function clear() {
  const snapshot = await db.collection('products').get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log('Cleared \${snapshot.size} products');
}
clear();
"

# 3. Run sync
python3 scripts/sync-woocommerce-full.py export.csv

# 4. Deploy
vercel --prod
```

---

## Quick Reference

### Daily Task (Manual Sync)
```bash
# 1. Export CSV from WooCommerce
# 2. Run sync
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"
python3 scripts/sync-woocommerce-full.py ~/Downloads/wc-export.csv

# 3. Deploy (if products.json changed)
vercel --prod
```

### Check Current Stock
```bash
node -e "
const products = require('./data/products.json');
const inStock = products.filter(p => p.stock > 0).length;
const total = products.length;
console.log(\`In stock: \${inStock}/\${total}\`);
"
```

### Verify Sync
```bash
# Check Firestore
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./firestore-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function check() {
  const snapshot = await db.collection('products').get();
  console.log(\`Firestore: \${snapshot.size} products\`);
}
check();
"

# Check products.json
cat data/products.json | jq 'length'
```

---

**Last Updated:** November 24, 2025

**Next Steps:** Review automation options and decide if you want scheduled/real-time sync.
