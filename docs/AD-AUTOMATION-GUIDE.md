# Facebook Ad Automation - Complete Guide

**Created:** November 24, 2025
**Goal:** Maximize conversions with automated product ads

---

## Overview

This guide shows you how to **fully automate** your Facebook ads → bot → sales funnel for maximum efficiency and minimal manual work.

---

## 🎯 The Complete Automated Flow

```
Customer sees ad → Clicks "Send Message"
  ↓
Bot detects product from ad
  ↓
Shows product photo + price automatically
  ↓
Asks "Want to order?"
  ↓
Guides through payment (Georgian banks)
  ↓
Confirms order with tracking
  ↓
Email sent to orders.bebias@gmail.com
```

**Zero manual intervention needed!**

---

## Step 1: Set Up Product Catalog (One-Time Setup)

### Why Catalog Ads?
✅ **Fully automated** - Facebook sends product ID automatically
✅ **Dynamic** - One campaign, all products
✅ **Retargeting** - Show products users viewed
✅ **Scale easily** - Add new products, ads update automatically

### How to Create Product Catalog

**Option A: Upload CSV (Recommended)**

1. Create `data/bebias-product-catalog.csv`:
```csv
id,title,description,availability,condition,price,link,image_link
9016,შავი ბამბის ქუდი,ხელით მოქსოვილი ბამბის ქუდი - თბილი და მაგარი,in stock,new,49.00 GEL,https://bebias.ge/products/9016,https://yourdomain.com/images/9016.jpg
9017,თეთრი ბამბის ქუდი,ხელით მოქსოვილი ბამბის ქუდი - თბილი და მაგარი,in stock,new,49.00 GEL,https://bebias.ge/products/9017,https://yourdomain.com/images/9017.jpg
```

2. Go to Facebook Business Manager → Catalog Manager
3. Create new catalog → E-commerce
4. Upload CSV file
5. Set update schedule (daily auto-sync recommended)

**Option B: Use Facebook Pixel (Advanced)**

Install pixel on your website to auto-sync products.

---

## Step 2: Create Dynamic Product Ad Campaign

### Campaign Structure:
```
Campaign: "Bebias Winter Hats"
├── Ad Set 1: Cold Weather Retargeting
│   ├── Audience: Visited website (last 30 days)
│   └── Products: All hats
├── Ad Set 2: Lookalike - Previous Customers
│   ├── Audience: Lookalike of purchasers
│   └── Products: Best sellers
└── Ad Set 3: Interest Targeting
    ├── Audience: Interested in handmade, crafts
    └── Products: All catalog
```

### Ad Creative Template:
```
Headline: "ხელით მოქსოვილი {{product.name}}"
Description: "ბუნებრივი {{product.category}} - მხოლოდ {{product.price}}"
Call to Action: "Send Message"
```

Facebook automatically fills `{{product.name}}` from catalog!

---

## Step 3: Set Up Automated Ad → Product Mapping

### For Catalog Ads (Automatic ✅)

**No setup needed!** Bot automatically detects product ID.

Example webhook:
```json
{
  "referral": {
    "product": { "id": "9016" }  ← Auto-detected
  }
}
```

### For Non-Catalog Ads (Manual)

Create URL templates for each product:

**Template:**
```
m.me/bebiaschatbot?ref=PRODUCT_{PRODUCT_ID}
```

**Products:**
- Black hat (9016): `m.me/bebiaschatbot?ref=PRODUCT_9016`
- White hat (9017): `m.me/bebiaschatbot?ref=PRODUCT_9017`
- Red scarf (9020): `m.me/bebiaschatbot?ref=PRODUCT_9020`

**Scale this:** Create a script to generate URLs for all products:

```javascript
// scripts/generate-ad-links.js
const products = require('../data/products.json');

products.forEach(product => {
  const link = `m.me/bebiaschatbot?ref=PRODUCT_${product.id}`;
  console.log(`${product.name}: ${link}`);
});
```

Run: `node scripts/generate-ad-links.js > ad-links.txt`

---

## Step 4: Automate Order Processing

### Current Automation (Already Working ✅)

1. **Customer sends payment screenshot**
   - Bot verifies bank account match
   - Confirms payment amount

2. **Bot asks for details**
   - Name, phone, address
   - Product selection

3. **Auto-generates order number**
   - Format: `900095`, `900096`, etc.
   - Stored in Firestore

4. **Sends confirmation**
   - Shows order number
   - Email to `orders.bebias@gmail.com`

5. **Tracking updates**
   - Manual: Update in order manager
   - Bot automatically shows status when customer asks

### Optional: Auto-Sync with Courier

**Integration with trackings.ge (if you use them):**

Create `scripts/sync-tracking-status.js`:
```javascript
// Auto-sync tracking status from trackings.ge to Firestore
// Run as cron job every 2 hours

const admin = require('firebase-admin');
const fetch = require('node-fetch');

async function syncTracking() {
  const orders = await db.collection('orders')
    .where('shippingStatus', '==', 'shipped')
    .get();

  for (const order of orders.docs) {
    const trackingNumber = order.data().trackingNumber;

    // Fetch status from trackings.ge
    const status = await fetch(`https://trackings.ge/api/track/${trackingNumber}`);
    const data = await status.json();

    // Update Firestore
    await order.ref.update({
      trackingsStatusCode: data.status,
      trackingsStatusText: data.statusText,
      shippingUpdatedAt: new Date().toISOString()
    });
  }
}

syncTracking();
```

**Run automatically:** Set up GitHub Actions or cron job to run every 2 hours.

---

## Step 5: Analytics & Optimization

### Track Ad Performance by Product

Add analytics to measure which products convert best from ads:

**Firestore analytics collection:**
```javascript
// Log ad interaction
await db.collection('adAnalytics').add({
  timestamp: new Date().toISOString(),
  adId: '120208123456789',
  productId: '9016',
  userId: senderId,
  event: 'ad_click'
});

// Log conversion
await db.collection('adAnalytics').add({
  timestamp: new Date().toISOString(),
  adId: '120208123456789',
  productId: '9016',
  userId: senderId,
  orderNumber: '900095',
  event: 'purchase',
  amount: 49.00
});
```

### Generate Reports

Create `scripts/ad-performance-report.js`:
```javascript
const admin = require('firebase-admin');

async function generateReport() {
  const analytics = await db.collection('adAnalytics')
    .where('timestamp', '>', lastWeek)
    .get();

  const report = {};

  analytics.forEach(doc => {
    const { productId, event } = doc.data();
    if (!report[productId]) report[productId] = { clicks: 0, purchases: 0 };
    if (event === 'ad_click') report[productId].clicks++;
    if (event === 'purchase') report[productId].purchases++;
  });

  console.log('Product Performance:');
  for (const [productId, stats] of Object.entries(report)) {
    const conversionRate = (stats.purchases / stats.clicks * 100).toFixed(2);
    console.log(`  ${productId}: ${stats.clicks} clicks, ${stats.purchases} purchases (${conversionRate}%)`);
  }
}
```

**Run weekly:** Schedule with cron or GitHub Actions.

---

## Step 6: Advanced Automation Workflows

### A. Auto-Pause Low-Performing Ads

Use Facebook Marketing API to auto-pause ads with low conversion:

```javascript
// scripts/optimize-ads.js
const FB = require('fb');

async function pauseLowPerformers() {
  const report = await generateReport(); // From Step 5

  for (const [productId, stats] of Object.entries(report)) {
    const conversionRate = (stats.purchases / stats.clicks * 100);

    if (conversionRate < 1.0 && stats.clicks > 100) {
      // Pause ad for this product
      const adId = await getAdIdForProduct(productId);
      await FB.api(`${adId}`, 'POST', { status: 'PAUSED' });
      console.log(`⏸️ Paused ad for product ${productId} (CR: ${conversionRate}%)`);
    }
  }
}
```

### B. Auto-Increase Budget for Winners

```javascript
async function scaleBudget() {
  const report = await generateReport();

  for (const [productId, stats] of Object.entries(report)) {
    const conversionRate = (stats.purchases / stats.clicks * 100);

    if (conversionRate > 5.0) {
      // Increase budget by 20%
      const adSetId = await getAdSetForProduct(productId);
      const currentBudget = await getCurrentBudget(adSetId);
      const newBudget = currentBudget * 1.2;

      await FB.api(`${adSetId}`, 'POST', {
        daily_budget: newBudget
      });
      console.log(`📈 Increased budget for ${productId}: ${currentBudget}₾ → ${newBudget}₾`);
    }
  }
}
```

### C. Auto-Generate Ad Creatives

Use product photos + AI to generate ad copy:

```javascript
// scripts/generate-ad-creative.js
const OpenAI = require('openai');

async function generateAdCopy(product) {
  const openai = new OpenAI();

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "user",
      content: `Write a Facebook ad headline and description for this product:
      Name: ${product.name}
      Price: ${product.price} GEL
      Category: ${product.category}

      Target audience: Georgian women 25-45 interested in handmade crafts
      Tone: Warm, grandmother's love, natural materials
      Language: Georgian`
    }]
  });

  return completion.choices[0].message.content;
}
```

---

## Step 7: Seasonal Automation

### Winter Campaign (Nov-Feb)

Auto-enable winter products:

```javascript
// scripts/seasonal-campaigns.js
async function enableWinterCampaign() {
  const month = new Date().getMonth(); // 0-11

  if (month >= 10 || month <= 1) { // Nov-Feb
    console.log('🌨️ Enabling winter campaign...');

    // Update catalog to feature winter products
    const winterProducts = products.filter(p =>
      p.category === 'hat' || p.category === 'glove'
    );

    // Increase budget for winter products
    await FB.api('act_ACCOUNT_ID/campaigns', 'POST', {
      name: 'Winter Essentials 2025',
      status: 'ACTIVE',
      objective: 'MESSAGES',
      special_ad_categories: []
    });
  }
}
```

**Schedule:** Run on November 1st and March 1st.

---

## Step 8: Maintenance & Monitoring

### Daily Checklist (5 minutes)

```bash
# Check bot status
node scripts/check-bot-status.js

# Check recent orders
node scripts/check-recent-orders.js

# Check ad performance
node scripts/ad-performance-report.js
```

### Weekly Tasks (15 minutes)

1. **Review analytics**
   ```bash
   node scripts/weekly-report.js
   ```

2. **Update product catalog** (if needed)
   - New products
   - Price changes
   - Stock updates

3. **Review and respond to issues**
   ```bash
   vercel logs | grep "❌"  # Check for errors
   ```

### Monthly Tasks (1 hour)

1. **A/B test ad creatives**
   - Test different images
   - Test different copy

2. **Optimize targeting**
   - Review audience performance
   - Create new lookalike audiences

3. **Update bot instructions** (if customer behavior changed)

---

## Automation Tools Reference

### Recommended Stack:

| Tool | Purpose | Cost |
|------|---------|------|
| **Facebook Catalog Manager** | Product catalog | Free |
| **Vercel** | Bot hosting | Free tier OK |
| **Firestore** | Database | Free tier OK |
| **GitHub Actions** | Scheduled scripts | Free |
| **Upstash QStash** | Message queue | Free tier OK |
| **trackings.ge** | Courier tracking | Free API |

### Scripts to Create:

1. ✅ `scripts/generate-ad-links.js` - Generate ad URLs for all products
2. ✅ `scripts/ad-performance-report.js` - Weekly analytics report
3. ⬜ `scripts/optimize-ads.js` - Auto-pause/scale ads
4. ⬜ `scripts/sync-tracking-status.js` - Auto-sync courier status
5. ⬜ `scripts/seasonal-campaigns.js` - Enable/disable seasonal campaigns
6. ⬜ `scripts/generate-ad-creative.js` - AI-generated ad copy

---

## ROI Calculation

### Example: 100 ad clicks/month

**Without automation:**
- Manual response time: 2 hours average
- Conversion rate: 2% (many drop off waiting)
- Revenue: 2 orders × 49₾ = 98₾

**With automation:**
- Instant bot response
- Conversion rate: 8% (4x better)
- Revenue: 8 orders × 49₾ = 392₾

**Difference:** +294₾/month (+300% ROI)

---

## Quick Start Checklist

- [ ] Enable `messaging_postbacks` webhook
- [ ] Enable `messaging_referrals` webhook
- [ ] Create product catalog (CSV or Facebook Pixel)
- [ ] Set up dynamic product ads
- [ ] Test ad click → bot response
- [ ] Monitor Vercel logs for errors
- [ ] Set up weekly analytics script
- [ ] Create seasonal campaign plan

---

## Resources

### Documentation
- [Facebook Ad Setup](./FACEBOOK-AD-SETUP.md) - Basic setup guide
- [Order Tracking](./ORDER-TRACKING-FEATURE.md) - How order tracking works
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues

### Facebook Docs
- [Messenger Platform Referrals](https://developers.facebook.com/docs/messenger-platform/discovery/ads)
- [Dynamic Ads for Messaging](https://developers.facebook.com/docs/marketing-api/dynamic-product-ads)
- [Product Catalog Setup](https://www.facebook.com/business/help/125074381480892)

### Scripts Location
```
scripts/
├── generate-ad-links.js       # Generate ad URLs
├── ad-performance-report.js   # Analytics
├── optimize-ads.js            # Auto-optimization
├── sync-tracking-status.js    # Courier sync
└── seasonal-campaigns.js      # Seasonal automation
```

---

**Last Updated:** November 24, 2025

**Need help?** Check `docs/TROUBLESHOOTING.md` or review Vercel logs.
