# BEBIAS Chatbot Documentation

Complete documentation for the BEBIAS Facebook Messenger chatbot system.

---

## 🚀 Quick Start

**New to the system?** Start here:
1. [QUICK-FIXES.md](./QUICK-FIXES.md) - Common issues and quick solutions
2. [PRODUCT-SYNC-TROUBLESHOOTING.md](./PRODUCT-SYNC-TROUBLESHOOTING.md) - Comprehensive sync system guide
3. [SYSTEM-DOCUMENTATION.md](./SYSTEM-DOCUMENTATION.md) - Overall system architecture

**Emergency?** Go to: [QUICK-FIXES.md](./QUICK-FIXES.md)

---

## 📚 Documentation Index

### Core System Documentation

#### [PRODUCT-SYNC-TROUBLESHOOTING.md](./PRODUCT-SYNC-TROUBLESHOOTING.md) ⭐ NEW
**Complete guide to the product sync system**
- System architecture (WooCommerce → Firestore → products.json)
- All fixes implemented (Nov 24-25, 2025)
- Troubleshooting guide for common issues
- Maintenance procedures (daily/weekly/monthly)
- Emergency procedures
- Authentication setup
- Scripts reference

**When to use**: Product visibility issues, sync failures, price inconsistencies

#### [QUICK-FIXES.md](./QUICK-FIXES.md) ⭐ NEW
**Quick reference for common issues**
- Emergency product recovery
- Fix products showing as "out of stock"
- Fix image sending issues
- Fix sync failures
- Fix price discrepancies
- Weekly maintenance checklist

**When to use**: Need a quick fix, troubleshooting in production

#### [SESSION-SUMMARY-NOV-25.md](./SESSION-SUMMARY-NOV-25.md) ⭐ NEW
**Detailed summary of Nov 25, 2025 fixes**
- Issues discovered and root causes
- All fixes implemented with code changes
- Before/after metrics
- Verification steps
- Revenue impact analysis

**When to use**: Understanding recent changes, training new team members

---

### Product Management

#### [PRODUCT-SYNC-SYSTEM.md](./PRODUCT-SYNC-SYSTEM.md)
**Original product sync documentation**
- Product data flow
- Sync script functionality
- Manual sync procedures
- Troubleshooting basics

**Status**: Superseded by PRODUCT-SYNC-TROUBLESHOOTING.md but still useful for basics

---

### Facebook Integration

#### [FACEBOOK-AD-SETUP.md](./FACEBOOK-AD-SETUP.md)
**Facebook Ads integration guide**
- Lead form setup
- Webhook configuration
- Product mapping
- Testing procedures

#### [AD-AUTOMATION-GUIDE.md](./AD-AUTOMATION-GUIDE.md)
**Automated ad response system**
- Lead form processing
- Product detection from images
- Response automation
- Troubleshooting

#### [QUICK-REFERENCE-ADS.md](./QUICK-REFERENCE-ADS.md)
**Quick reference for ad operations**
- Common commands
- Testing procedures
- Quick fixes

---

### Order Management

#### [ORDER-TRACKING-FEATURE.md](./ORDER-TRACKING-FEATURE.md)
**Order tracking system documentation**
- Order search functionality
- Status updates
- Customer communication
- Database integration

#### [order-flow-fixes-2025-11-22.md](./order-flow-fixes-2025-11-22.md)
**Order flow improvements (Nov 22)**
- Search fixes
- Status field corrections
- Response formatting

---

### Technical Issues & Fixes

#### [IMAGE-ISSUE-FIX.md](./IMAGE-ISSUE-FIX.md)
**Image processing fixes**
- Facebook image downloads
- Base64 conversion
- GPT-4o integration
- Message deduplication

#### [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
**General troubleshooting guide**
- Common errors
- Debugging procedures
- Log analysis

#### [500K_MESSAGE_BURN_ANALYSIS.md](./500K_MESSAGE_BURN_ANALYSIS.md)
**Analysis of rapid message consumption**
- Message loop detection
- Rate limiting implementation
- Cost optimization

---

### System Architecture

#### [SYSTEM-DOCUMENTATION.md](./SYSTEM-DOCUMENTATION.md)
**Overall system architecture**
- Component overview
- Data flow diagrams
- Technology stack
- API integrations

#### [UNIFIED-DATABASE-SYSTEM.md](./UNIFIED-DATABASE-SYSTEM.md)
**Database architecture**
- Firestore structure
- Collections and schemas
- Query patterns
- Indexing strategy

#### [SEPARATE_DB_SETUP.md](./SEPARATE_DB_SETUP.md)
**Database separation setup**
- Environment configuration
- Migration procedures
- Testing strategies

---

### Advanced Features

#### [QSTASH_ASYNC_WITH_SAFETY.md](./QSTASH_ASYNC_WITH_SAFETY.md)
**Async message processing with QStash**
- Background job processing
- Retry mechanisms
- Safety features
- Rate limiting

#### [WAREHOUSE-APP-INTEGRATION.md](./WAREHOUSE-APP-INTEGRATION.md)
**Warehouse management integration**
- Inventory sync
- Stock updates
- Order fulfillment
- API documentation

#### [CONTROL_PANEL_MOBILE_FRIENDLY.md](./CONTROL_PANEL_MOBILE_FRIENDLY.md)
**Mobile-friendly admin panel**
- Responsive design
- Mobile optimization
- Feature overview

---

### Version History

#### [VERSION-BETA-2.md](./VERSION-BETA-2.md)
**Beta 2 release notes**
- New features
- Bug fixes
- Migration guide

#### [VERSION-BETA-3.md](./VERSION-BETA-3.md)
**Beta 3 release notes**
- Feature updates
- Performance improvements
- Breaking changes

---

### Archived Documentation

#### [ARCHIVED_BANK_VERIFICATION.md](./ARCHIVED_BANK_VERIFICATION.md)
**Archived: Bank account verification system**
- Original implementation
- Reasons for archival
- Historical reference

#### [ARCHIVED_BURST_DETECTION_SYSTEM.md](./ARCHIVED_BURST_DETECTION_SYSTEM.md)
**Archived: Burst detection system**
- Message burst handling
- Detection algorithms
- Superseded by QSTASH implementation

#### [BURST_DETECTION_SETUP.md](./BURST_DETECTION_SETUP.md)
**Burst detection configuration**
- Setup instructions
- Configuration options
- Testing procedures

#### [PENDING_BANK_ACCOUNT_CHANGES.md](./PENDING_BANK_ACCOUNT_CHANGES.md)
**Pending: Bank account feature changes**
- Planned improvements
- Implementation notes

---

### Testing & Development

#### [TEST-USER.md](./TEST-USER.md)
**Test user documentation**
- Test user ID: 3282789748459241
- Testing procedures
- History clearing

#### [tracking-code-search.md](./tracking-code-search.md)
**Tracking code reference**
- Code snippets
- Implementation notes

---

## 🔍 Finding What You Need

### By Problem Type

| Problem | Document |
|---------|----------|
| Product not showing in chatbot | [QUICK-FIXES.md](./QUICK-FIXES.md) → "Product Shows as Out of Stock" |
| Sync not running | [QUICK-FIXES.md](./QUICK-FIXES.md) → "Fix: Sync Not Running" |
| Images not sending | [QUICK-FIXES.md](./QUICK-FIXES.md) → "Fix: Images Not Showing" |
| Wrong prices | [QUICK-FIXES.md](./QUICK-FIXES.md) → "Fix: Prices Don't Match" |
| Authentication error | [PRODUCT-SYNC-TROUBLESHOOTING.md](./PRODUCT-SYNC-TROUBLESHOOTING.md) → Issue 2 |
| Order search issues | [ORDER-TRACKING-FEATURE.md](./ORDER-TRACKING-FEATURE.md) |
| Facebook ad integration | [FACEBOOK-AD-SETUP.md](./FACEBOOK-AD-SETUP.md) |
| Message loops | [500K_MESSAGE_BURN_ANALYSIS.md](./500K_MESSAGE_BURN_ANALYSIS.md) |

### By Task

| Task | Document |
|------|----------|
| Weekly maintenance | [QUICK-FIXES.md](./QUICK-FIXES.md) → Weekly Maintenance Checklist |
| Sync prices from WooCommerce | [PRODUCT-SYNC-TROUBLESHOOTING.md](./PRODUCT-SYNC-TROUBLESHOOTING.md) → Scripts → sync-prices-from-csv |
| Clear test user history | [TEST-USER.md](./TEST-USER.md) |
| Deploy to production | [QUICK-FIXES.md](./QUICK-FIXES.md) → Testing Changes |
| Setup Facebook webhook | [FACEBOOK-AD-SETUP.md](./FACEBOOK-AD-SETUP.md) |
| Configure order tracking | [ORDER-TRACKING-FEATURE.md](./ORDER-TRACKING-FEATURE.md) |

### By Component

| Component | Document |
|-----------|----------|
| Product sync system | [PRODUCT-SYNC-TROUBLESHOOTING.md](./PRODUCT-SYNC-TROUBLESHOOTING.md) |
| Firestore database | [UNIFIED-DATABASE-SYSTEM.md](./UNIFIED-DATABASE-SYSTEM.md) |
| Facebook Messenger | [SYSTEM-DOCUMENTATION.md](./SYSTEM-DOCUMENTATION.md) |
| WooCommerce integration | [PRODUCT-SYNC-TROUBLESHOOTING.md](./PRODUCT-SYNC-TROUBLESHOOTING.md) |
| Image processing | [IMAGE-ISSUE-FIX.md](./IMAGE-ISSUE-FIX.md) |
| Order system | [ORDER-TRACKING-FEATURE.md](./ORDER-TRACKING-FEATURE.md) |

---

## 📊 Recent Updates

### November 25, 2025 - Major Product Sync Fixes
- ✅ Fixed Firestore authentication failure
- ✅ Recovered 8 cotton hat products (44 units, ~2,156 GEL value)
- ✅ Fixed SEND_IMAGE for Georgian characters
- ✅ Created WooCommerce CSV price sync
- ✅ Created comprehensive troubleshooting documentation

**See**: [SESSION-SUMMARY-NOV-25.md](./SESSION-SUMMARY-NOV-25.md)

### November 24, 2025 - Facebook Ads Integration
- ✅ Lead form webhook setup
- ✅ Product image recognition
- ✅ Automated responses

**See**: [FACEBOOK-AD-SETUP.md](./FACEBOOK-AD-SETUP.md)

### November 22, 2025 - Order Tracking Fixes
- ✅ Order search improvements
- ✅ Latin name support
- ✅ Status field corrections

**See**: [order-flow-fixes-2025-11-22.md](./order-flow-fixes-2025-11-22.md)

---

## 🛠️ Essential Commands

### Product Sync
```bash
# Manual sync from Firestore
node scripts/sync-from-firestore.js

# Find zero-price products
node scripts/find-zero-price-products.js

# Sync prices from WooCommerce CSV
python3 scripts/sync-prices-from-csv.py
```

### Deployment
```bash
# Deploy to production
vercel --prod

# View logs
vercel logs bebias-venera-chatbot.vercel.app

# Rollback deployment
vercel rollback
```

### Monitoring
```bash
# View sync logs
tail -f /tmp/bebias-chatbot-sync.log

# Check product count
jq length data/products.json

# Check in-stock products
jq '[.[] | select(.stock > 0)] | length' data/products.json
```

### Testing
```bash
# Clear test user history
node scripts/clear-test-user-history.js

# Test image regex
node scripts/test-image-regex.js

# Test Firestore auth
node -e "
const admin = require('firebase-admin');
const key = require('./bebias-chatbot-key.json');
admin.initializeApp({ credential: admin.credential.cert(key) });
admin.firestore().collection('products').limit(1).get()
  .then(() => console.log('✅ Auth OK'))
  .catch(err => console.error('❌ Failed:', err.message));
"
```

---

## 📁 Important Files

### Configuration
- `bebias-chatbot-key.json` - Firestore service account credentials (SECRET)
- `.env.local` - Local environment variables
- `.env.prod` - Production environment variables
- `.gitignore` - Git ignore rules (includes key file)

### Data
- `data/products.json` - Product catalog (synced from Firestore)
- `data/products.json.backup-*` - Automatic backups
- `data/content/bot-instructions.md` - Chatbot AI instructions

### Scripts
- `scripts/sync-from-firestore.js` - Main sync script
- `scripts/auto-sync-firestore.sh` - Cron job wrapper
- `scripts/sync-prices-from-csv.py` - WooCommerce price sync
- `scripts/clear-test-user-history.js` - Test user management

### Logs
- `/tmp/bebias-chatbot-sync.log` - Sync activity log
- Vercel logs - Deployment and runtime logs

### Application
- `app/api/messenger/route.ts` - Facebook Messenger webhook
- `app/api/process-message/route.ts` - Message processing & SEND_IMAGE
- `app/api/facebook-leads/route.ts` - Facebook lead form webhook

---

## 🆘 Emergency Contacts

### System Status
- **Production URL**: bebias-venera-chatbot.vercel.app
- **Database**: Firestore (bebias-wp-db-handler)
- **E-commerce**: bebias.ge (WooCommerce)

### Quick Health Check
```bash
# 1. Check sync is running
tail -20 /tmp/bebias-chatbot-sync.log

# 2. Check product count
jq length data/products.json  # Should be ~278

# 3. Check Firestore auth
node -e "
const admin = require('firebase-admin');
const key = require('./bebias-chatbot-key.json');
admin.initializeApp({ credential: admin.credential.cert(key) });
admin.firestore().collection('products').limit(1).get()
  .then(() => { console.log('✅ OK'); process.exit(0); })
  .catch(() => { console.log('❌ FAILED'); process.exit(1); });
"

# 4. Check deployment
vercel ls | head -5
```

---

## 📖 Contributing

When adding new documentation:
1. Use descriptive filenames with UPPERCASE-KEBAB-CASE.md
2. Include creation date and "Last Updated" at top
3. Add entry to this README.md
4. Include code examples where relevant
5. Tag with ⭐ NEW for recent additions

---

## 📝 Notes

- All times in documentation are in local time (Georgia/Tbilisi)
- Test user ID: 3282789748459241
- Cron runs every 15 minutes: `*/15 * * * *`
- Products with price=0 are filtered out from sync
- Image URLs must be percent-encoded for Georgian characters

---

**Documentation Last Updated**: 2025-11-25
**Total Documents**: 28
**System Status**: ✅ Operational
