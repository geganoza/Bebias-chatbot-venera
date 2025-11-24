# BEBIAS Chatbot - Cheat Sheet

Quick reference for daily operations. Print this!

---

## 🚨 Emergency Commands

```bash
# Restore from backup
cp data/products.json.backup-LATEST data/products.json
vercel --prod

# Kill stuck sync
pkill -f sync-from-firestore

# Check system health
tail -20 /tmp/bebias-chatbot-sync.log
jq length data/products.json  # Should be ~278
```

---

## 📦 Product Missing? (Common!)

```bash
# 1. Check Firestore
node -e "
const admin = require('firebase-admin');
const key = require('./bebias-chatbot-key.json');
admin.initializeApp({ credential: admin.credential.cert(key) });
admin.firestore().collection('products')
  .where('name', '==', 'PRODUCT_NAME')
  .get()
  .then(snap => {
    snap.forEach(doc => {
      const d = doc.data();
      console.log('Price:', d.price, 'Stock:', d.stock_qty || d.stock);
    });
    process.exit(0);
  });
"

# 2. If price=0, fix it:
node -e "
const admin = require('firebase-admin');
const key = require('./bebias-chatbot-key.json');
admin.initializeApp({ credential: admin.credential.cert(key) });
admin.firestore().collection('products').doc('PRODUCT_ID').update({
  price: 49,  // CHANGE THIS
  currency: 'GEL'
}).then(() => { console.log('✅'); process.exit(0); });
"

# 3. Sync and deploy
node scripts/sync-from-firestore.js
vercel --prod
```

---

## 🔄 Weekly Maintenance (Mondays)

```bash
# 1. Find problems
node scripts/find-zero-price-products.js

# 2. Export CSV from WooCommerce
#    Products → Export → Download CSV

# 3. Update prices
# Edit: scripts/sync-prices-from-csv.py line 15
# Set: csv_path = '/Users/.../wc-product-export-LATEST.csv'
python3 scripts/sync-prices-from-csv.py

# 4. Sync
node scripts/sync-from-firestore.js

# 5. Backup
cp data/products.json "data/products.json.backup-$(date +%Y%m%d)"

# 6. Deploy
vercel --prod
```

---

## 🖼️ Images Not Sending?

```bash
# Check regex (should be .+? not [A-Z0-9])
grep "const imageRegex" app/api/process-message/route.ts

# Should see:
# const imageRegex = /SEND_IMAGE:\s*(.+?)(?:\n|$)/gi;

# If wrong, fix it:
# Edit app/api/process-message/route.ts line 377
# Then:
vercel --prod
```

---

## 🔐 Auth Error?

```bash
# Error: 16 UNAUTHENTICATED

# Generate new key:
gcloud iam service-accounts keys create bebias-chatbot-key.json \
  --iam-account=bebias-chatbot-firestore@bebias-wp-db-handler.iam.gserviceaccount.com

# Test it:
node scripts/sync-from-firestore.js
```

---

## 📊 Daily Checks

```bash
# Sync working? (should see every 15 min)
tail -20 /tmp/bebias-chatbot-sync.log

# Product count OK?
jq length data/products.json  # ~278

# In-stock count OK?
jq '[.[] | select(.stock > 0)] | length' data/products.json  # ~83

# Last sync time
ls -la data/products.json
```

---

## 🧪 Testing

```bash
# Clear test user
node scripts/clear-test-user-history.js

# Test user ID: 3282789748459241

# Test in Messenger:
# 1. "გამარჯობა"
# 2. "მაჩვენე მწვანე ბამბის ქუდი"
# 3. Verify image sends (not text)
```

---

## 🚀 Deployment

```bash
# Deploy
vercel --prod

# Check status
vercel ls | head -5

# View logs (30 sec timeout)
timeout 30 vercel logs bebias-venera-chatbot.vercel.app

# Rollback if needed
vercel rollback
```

---

## 🔍 Quick Diagnostics

```bash
# Find zero-price products
node scripts/find-zero-price-products.js

# Test image regex
node scripts/test-image-regex.js

# Test Firestore connection
node -e "
const admin = require('firebase-admin');
const key = require('./bebias-chatbot-key.json');
admin.initializeApp({ credential: admin.credential.cert(key) });
admin.firestore().collection('products').limit(1).get()
  .then(() => console.log('✅ OK'))
  .catch(err => console.error('❌ FAIL:', err.message));
"
```

---

## 📝 File Locations

```
Config:
  bebias-chatbot-key.json          - Auth key (SECRET!)
  .env.prod                        - Env vars

Data:
  data/products.json               - Product catalog
  data/products.json.backup-*      - Backups

Logs:
  /tmp/bebias-chatbot-sync.log     - Sync log

Scripts:
  scripts/sync-from-firestore.js   - Main sync
  scripts/auto-sync-firestore.sh   - Cron job
```

---

## ⚠️ Important Rules

1. **NEVER edit products.json manually** - Always sync from Firestore
2. **price=0 products are hidden** - Always check price first
3. **Backup before big changes** - `cp data/products.json ...`
4. **Test with test user** - ID: 3282789748459241
5. **Check sync logs daily** - `/tmp/bebias-chatbot-sync.log`

---

## 🎯 Common Issues Quick Index

| Issue | Command |
|-------|---------|
| Product missing | `node scripts/find-zero-price-products.js` |
| Sync failing | Check `/tmp/bebias-chatbot-sync.log` |
| Auth error | Regenerate `bebias-chatbot-key.json` |
| Images broken | Check regex in `process-message/route.ts` |
| Wrong prices | Run `sync-prices-from-csv.py` |

---

## 📞 URLs

- **Production**: bebias-venera-chatbot.vercel.app
- **E-commerce**: bebias.ge
- **Database**: Firestore (bebias-wp-db-handler)

---

## 🔢 Key Numbers

- **Total Products**: ~278
- **In Stock**: ~83
- **Cotton Hats**: 11 colors, 52 units
- **Sync Frequency**: Every 15 minutes
- **Test User ID**: 3282789748459241

---

## 📚 Full Documentation

See `/docs/README.md` for complete documentation index

**Emergency?** → `/docs/QUICK-FIXES.md`
**Deep Dive?** → `/docs/PRODUCT-SYNC-TROUBLESHOOTING.md`

---

**Cheat Sheet Version**: 1.0
**Last Updated**: 2025-11-25
