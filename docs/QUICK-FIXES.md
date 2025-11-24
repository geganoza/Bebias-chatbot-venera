# Quick Fixes - BEBIAS Chatbot

Quick reference for common issues. For detailed documentation, see [PRODUCT-SYNC-TROUBLESHOOTING.md](./PRODUCT-SYNC-TROUBLESHOOTING.md).

---

## 🚨 Emergency: Product Disappeared

```bash
# 1. Restore from backup
cp data/products.json.backup-LATEST data/products.json

# 2. Deploy immediately
vercel --prod

# 3. Check Firestore
node scripts/find-zero-price-products.js
```

---

## 🔧 Fix: Product Shows as "Out of Stock" But Has Stock

**Cause**: Price = 0 in Firestore

**Fix**:
```bash
# Check the product
node -e "
const admin = require('firebase-admin');
const key = require('./bebias-chatbot-key.json');
admin.initializeApp({ credential: admin.credential.cert(key) });

admin.firestore().collection('products')
  .where('name', '==', 'PRODUCT_NAME_HERE')
  .get()
  .then(snap => {
    snap.forEach(doc => {
      console.log('Price:', doc.data().price);
      console.log('Stock:', doc.data().stock_qty || doc.data().stock);
    });
    process.exit(0);
  });
"

# If price is 0, fix it:
node -e "
const admin = require('firebase-admin');
const key = require('./bebias-chatbot-key.json');
admin.initializeApp({ credential: admin.credential.cert(key) });

admin.firestore().collection('products').doc('PRODUCT_ID').update({
  price: 49,  // SET CORRECT PRICE
  currency: 'GEL',
  last_updated: new Date().toISOString()
}).then(() => {
  console.log('✅ Fixed');
  process.exit(0);
});
"

# Sync and deploy
node scripts/sync-from-firestore.js
vercel --prod
```

---

## 🔧 Fix: Images Not Showing

**Symptom**: Customer sees "SEND_IMAGE: პროდუქტის სახელი" as text

**Check**:
```bash
# 1. Verify regex is correct
grep "const imageRegex" app/api/process-message/route.ts
# Should be: /SEND_IMAGE:\s*(.+?)(?:\n|$)/gi

# 2. Check product has image
grep -A8 "PRODUCT_NAME" data/products.json | grep image
```

**Fix if regex wrong**:
```typescript
// Edit app/api/process-message/route.ts line 377:
const imageRegex = /SEND_IMAGE:\s*(.+?)(?:\n|$)/gi;
```

Then deploy:
```bash
git add app/api/process-message/route.ts
git commit -m "fix: SEND_IMAGE regex"
vercel --prod
```

---

## 🔧 Fix: Sync Not Running

**Check**:
```bash
# View recent sync activity
tail -20 /tmp/bebias-chatbot-sync.log

# Should see entries every 15 minutes
```

**Fix**:
```bash
# 1. Test manual sync
node scripts/sync-from-firestore.js

# 2. If auth error, check key file
ls -la bebias-chatbot-key.json

# 3. If missing, generate new key
gcloud iam service-accounts keys create bebias-chatbot-key.json \
  --iam-account=bebias-chatbot-firestore@bebias-wp-db-handler.iam.gserviceaccount.com

# 4. Check cron is running
crontab -l | grep bebias

# 5. If missing, add it back
crontab -e
# Add: */15 * * * * /Users/giorginozadze/Documents/BEBIAS\ CHATBOT\ VENERA\ beta_2/scripts/auto-sync-firestore.sh
```

---

## 🔧 Fix: Prices Don't Match WooCommerce

**Quick Fix**:
```bash
# 1. Export CSV from WooCommerce
# Go to: Products → Export → Download CSV

# 2. Edit script with CSV path
# Edit line 15 in scripts/sync-prices-from-csv.py:
# csv_path = '/Users/giorginozadze/Downloads/wc-product-export-LATEST.csv'

# 3. Run sync
python3 scripts/sync-prices-from-csv.py

# 4. Sync to products.json
node scripts/sync-from-firestore.js

# 5. Deploy
vercel --prod
```

**Single Product Fix**:
```bash
node -e "
const admin = require('firebase-admin');
const key = require('./bebias-chatbot-key.json');
admin.initializeApp({ credential: admin.credential.cert(key) });

admin.firestore().collection('products').doc('PRODUCT_ID').update({
  price: 59,  // SET CORRECT PRICE
  last_updated: new Date().toISOString()
}).then(() => {
  console.log('✅ Price updated');
  process.exit(0);
});
"

node scripts/sync-from-firestore.js
vercel --prod
```

---

## 📊 Quick Diagnostics

```bash
# Find all products with price = 0
node scripts/find-zero-price-products.js

# Count total products
jq length data/products.json

# Count in-stock products
jq '[.[] | select(.stock > 0)] | length' data/products.json

# Check when products.json was last updated
ls -la data/products.json

# View sync logs
tail -50 /tmp/bebias-chatbot-sync.log

# Test Firestore authentication
node -e "
const admin = require('firebase-admin');
const key = require('./bebias-chatbot-key.json');
admin.initializeApp({ credential: admin.credential.cert(key) });
admin.firestore().collection('products').limit(1).get()
  .then(() => console.log('✅ Auth OK'))
  .catch(err => console.error('❌ Auth Failed:', err.message));
"
```

---

## 🎯 Weekly Maintenance Checklist

Run every Monday:

```bash
# 1. Check for zero-price products with stock
node scripts/find-zero-price-products.js

# 2. Sync prices from WooCommerce
# - Export CSV from WooCommerce
# - Update csv_path in scripts/sync-prices-from-csv.py
python3 scripts/sync-prices-from-csv.py

# 3. Sync to products.json
node scripts/sync-from-firestore.js

# 4. Deploy if changes
vercel --prod

# 5. Backup products.json
cp data/products.json "data/products.json.backup-$(date +%Y%m%d)"

# 6. Check sync logs for errors
grep "❌" /tmp/bebias-chatbot-sync.log | tail -20
```

---

## 🆘 Common Error Messages

### "16 UNAUTHENTICATED: Request had invalid authentication credentials"
**Cause**: Firestore service account key invalid or missing
**Fix**: Regenerate key (see "Fix: Sync Not Running" above)

### "Cannot find module './bebias-chatbot-key.json'"
**Cause**: Key file missing
**Fix**: Regenerate key file with gcloud CLI

### "Products with price=0"
**Cause**: Product price not set in Firestore
**Fix**: Update price in Firestore, then sync

### "SEND_IMAGE: [product name]" showing as text
**Cause**: Regex not matching Georgian characters
**Fix**: Update regex in process-message/route.ts

---

## 📞 Quick Commands Reference

```bash
# Sync
node scripts/sync-from-firestore.js

# Deploy
vercel --prod

# Check logs
tail -f /tmp/bebias-chatbot-sync.log

# Clear test user
node scripts/clear-test-user-history.js

# Find issues
node scripts/find-zero-price-products.js

# Backup
cp data/products.json "data/products.json.backup-$(date +%Y%m%d-%H%M%S)"

# Restore
cp data/products.json.backup-LATEST data/products.json
```

---

## 📁 Important Files

```
/data/products.json                          - Product catalog (DO NOT EDIT MANUALLY)
/scripts/sync-from-firestore.js             - Main sync script
/scripts/auto-sync-firestore.sh             - Cron job script
/bebias-chatbot-key.json                    - Firestore credentials (SECRET)
/tmp/bebias-chatbot-sync.log                - Sync activity log
/app/api/process-message/route.ts           - Message processing & SEND_IMAGE
```

---

## 🎯 Testing Changes

Before deploying to production:

```bash
# 1. Clear test user history
node scripts/clear-test-user-history.js

# 2. Deploy to production
vercel --prod

# 3. Test with Facebook test user (ID: 3282789748459241)
# Send message: "გამარჯობა"
# Then: "მაჩვენე მწვანე ბამბის ქუდი"

# 4. Verify:
# - Bot finds the product
# - Image is sent (not text "SEND_IMAGE...")
# - Price is correct
# - Stock status is correct
```

---

**For detailed troubleshooting, see**: [PRODUCT-SYNC-TROUBLESHOOTING.md](./PRODUCT-SYNC-TROUBLESHOOTING.md)
