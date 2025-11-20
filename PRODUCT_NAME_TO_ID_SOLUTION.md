# Product Name → ID Lookup for Stock Reduction

**Deployed**: 2025-11-19 22:40 UTC
**Cloud Function**: verifypayment-00015-xuv

## Problem Solved

Bot already knows which product customer is buying (shows image, mentions name, asks confirmation), but Cloud Function wasn't using this to reduce stock because it didn't have product ID.

## Solution Implemented

### Flow:
1. Bot extracts product name from conversation (exact match from database)
2. Cloud Function receives product name in order details
3. **NEW**: Cloud Function calls `/api/products` to get all products
4. **NEW**: Exact match product name → product ID
5. Calls `/api/stock/reduce` with product ID
6. Stock reduced in Firestore

### Code Added:

```javascript
// Get product ID from product name using exact match
async function getProductIdFromName(productName) {
  // Fetch products from Vercel API
  const response = await fetch(`${process.env.NEXT_PUBLIC_CHAT_API_BASE}/api/products`);
  const products = await response.json();

  // EXACT match only - product names must match database exactly
  const match = products.find(p => p.name === productName || p.name_en === productName);

  if (match) {
    console.log(`✅ Found product: ${match.name} (ID: ${match.id})`);
    return match.id;
  }

  console.warn(`⚠️ No exact match found for: "${productName}"`);
  return null;
}
```

### Usage in Order Confirmation:

```javascript
// Get product ID from product name and reduce stock
const productId = await getProductIdFromName(orderDetails.product);

if (productId) {
  // Reduce stock via API
  await fetch(`${NEXT_PUBLIC_CHAT_API_BASE}/api/stock/reduce`, {
    method: 'POST',
    body: JSON.stringify({ productId, quantity: 1, orderNumber })
  });
}
```

## CRITICAL Requirements

### Bot MUST Use Exact Product Names

**Correct** (exact match from database):
- ✅ `შავი ბამბის მოკლე ქუდი`
- ✅ `Black Short Cotton Hat`
- ✅ `მწვანე შალის ქუდი`

**Wrong** (will NOT match):
- ❌ `შავი ქუდი` (missing "ბამბის მოკლე")
- ❌ `ბამბის ქუდი` (missing "შავი" and "მოკლე")
- ❌ `VENERA პროდუქტი` (generic name)

### Logs Will Show:

**Success**:
```
🔍 Getting product ID for: "შავი ბამბის მოკლე ქუდი"
📦 Loaded 500 products for matching
🔍 Looking for exact match: "შავი ბამბის მოკლე ქუდი"
✅ Found product: შავი ბამბის მოკლე ქუდი (ID: H-PLAIN-BLACK)
📦 Reducing stock for product: H-PLAIN-BLACK
✅ Stock reduced: 10 → 9
```

**Failure** (name doesn't match):
```
🔍 Getting product ID for: "შავი ქუდი"
📦 Loaded 500 products for matching
🔍 Looking for exact match: "შავი ქუდი"
⚠️ No exact match found for: "შავი ქუდი"
   Make sure bot uses exact product name from database
⚠️ Could not find product ID for "შავი ქუდი"
   Stock will NOT be reduced. Bot must use exact product name from database.
```

## Next Steps

For stock reduction to work fully:

1. ✅ Cloud Function deployed with product lookup
2. ⏳ **Deploy Vercel with Firestore integration** (firebase-admin, API endpoints)
3. ⏳ **Sync products.json to Firestore** (create initial stock database)
4. ⏳ **Ensure bot uses exact product names** from database in conversations
5. ⏳ **Test with real order** to verify stock reduction

## Testing Commands

After Firestore is deployed:

```bash
# Sync products to Firestore
curl -X POST https://bebias-venera-chatbot.vercel.app/api/stock/sync

# Check stock levels
curl https://bebias-venera-chatbot.vercel.app/api/stock/sync

# View Cloud Function logs
gcloud functions logs read verifyPayment --region=us-central1 --limit=50
```

## Important Notes

- Product name matching is **case-sensitive** and must be **exact**
- Both Georgian (`name`) and English (`name_en`) are checked
- If no match found, order still completes but stock is NOT reduced
- Bot instructions should ensure exact product names are used in conversation
