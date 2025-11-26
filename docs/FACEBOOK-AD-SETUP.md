# Facebook Ad Integration - Product Detection

**Created:** November 24, 2025
**Status:** ✅ Working

---

## Overview

When users click your Facebook ads and message the bot, the bot can automatically detect which product they're interested in and show it immediately with photo and price.

---

## Problem & Solution

### Before:
- User clicks ad → sees empty conversation → bot not responding ❌
- You see the message but bot doesn't

### After:
- User clicks ad → bot immediately shows the product they clicked on ✅
- Bot responds with greeting + product photo + price

---

## Step 1: Enable Webhooks in Facebook Developer Portal

### Required Webhook Subscriptions:
1. ✅ `messages` (already enabled)
2. ✅ **`messaging_postbacks`** ← NEW (for ad button clicks)
3. ✅ **`messaging_referrals`** ← NEW (for ad context)

### How to Enable:
1. Go to https://developers.facebook.com/apps/
2. Select your app
3. Messenger → Settings → Webhooks
4. Click "Edit" on webhook subscriptions
5. Check the boxes for `messaging_postbacks` and `messaging_referrals`
6. Click "Save"

---

## Step 2: Choose Your Product Detection Method

You have **3 options** for telling the bot which product the ad is for:

### ✅ **Option 1: Catalog Ads** (Best - Automatic)

**Best for:** Dynamic product ads with Facebook catalog

**How it works:**
- Facebook automatically sends `product.id` in the referral
- No manual setup needed
- Bot automatically detects product from catalog ID

**Setup:**
1. Create product catalog in Facebook Business Manager
2. Run Dynamic Product Ads or Catalog Ads
3. Facebook sends product ID automatically

**Example webhook payload:**
```json
{
  "referral": {
    "ad_id": "120208123456789",
    "source": "ADS",
    "type": "OPEN_THREAD",
    "product": {
      "id": "9016"  ← Automatically included!
    }
  }
}
```

---

### ✅ **Option 2: Custom Ref Parameter** (Manual - Easy)

**Best for:** Regular click-to-messenger ads

**How it works:**
- Add `ref=PRODUCT_9016` parameter to your ad link
- Bot extracts product ID from the ref parameter

**Setup:**
1. In Facebook Ads Manager, create click-to-messenger ad
2. In message destination, use this format:
   ```
   m.me/yourbotusername?ref=PRODUCT_9016
   ```
3. Replace `9016` with your actual product ID

**Multiple products:**
```
Product 9016: m.me/yourbotusername?ref=PRODUCT_9016
Product 9017: m.me/yourbotusername?ref=PRODUCT_9017
```

**Example webhook payload:**
```json
{
  "referral": {
    "ad_id": "120208123456789",
    "ref": "PRODUCT_9016",  ← Your custom parameter
    "source": "SHORTLINK",
    "type": "OPEN_THREAD"
  }
}
```

---

### ✅ **Option 3: Ad ID Mapping** (Manual - Flexible)

**Best for:** Existing ads you can't change, or testing

**How it works:**
- Map Facebook ad IDs to product IDs in a config file
- Bot looks up product from the ad ID

**Setup:**

Edit **`data/ad-product-mapping.json`**:
```json
{
  "mappings": {
    "120208123456789": {
      "productId": "9016",
      "productName": "შავი ბამბის ქუდი",
      "note": "Winter hat campaign - Black hat ad"
    },
    "120208987654321": {
      "productId": "9017",
      "productName": "თეთრი ბამბის ქუდი",
      "note": "Winter hat campaign - White hat ad"
    }
  }
}
```

**Finding your ad ID:**
1. Go to Facebook Ads Manager
2. Click on your ad
3. Look in URL: `...&selected_ad_id=120208123456789`
4. Or check webhook logs after someone clicks the ad

---

## How It Works (Technical)

### Priority Order for Product Detection:

1. **Catalog product ID** (from `referral.product.id`)
2. **Ref parameter** (from `referral.ref` like `PRODUCT_9016`)
3. **Ad ID mapping** (from `data/ad-product-mapping.json`)

### Message Transformation:

**Before (user clicks ad):**
```
Facebook sends: postback/referral event (no visible message)
```

**After (bot processes):**
```
Synthetic message: "[SHOW_PRODUCT:9016] გამარჯობა! დაინტერესდი ამ პროდუქტით?"
```

**Bot response:**
```
გამარჯობა ბებია! 💛 რა მაგარი არჩევანი!

შავი ბამბის ქუდი - 49 ლარი
[Shows product image]

გინდა შევკვეთო?
```

---

## Testing

### 1. Test Ad Click
Click your ad and send a message

### 2. Check Vercel Logs
```bash
vercel logs bebias-venera-chatbot.vercel.app
```

**Expected output:**
```
🎯 [WH:abc123] Message has AD REFERRAL attached
   Ad ID: 120208123456789, Source: ADS, Type: OPEN_THREAD
   Ref param: PRODUCT_9016, Catalog product: null
   ✅ Product ID from ref param: 9016
   🎯 Replaced message with product inquiry: 9016
✅ [WH:abc123] Queued referral_1732468800000
```

### 3. Verify Bot Response
User should see:
- Greeting
- Product name + price
- Product photo
- Order question

---

## Troubleshooting

### Issue: Bot still not responding to ad clicks

**Check:**
1. ✅ `messaging_postbacks` enabled in Facebook Developer Portal?
2. ✅ `messaging_referrals` enabled in Facebook Developer Portal?
3. Check Vercel logs - do you see `🎯 POSTBACK from ad detected`?

### Issue: Bot responds but doesn't show product

**Check logs for:**
```
   ℹ️ No ad mapping found for ad 120208123456789
```

**Fix:** Add the ad ID to `data/ad-product-mapping.json`

### Issue: Can't find ad ID

**Method 1 - From Ads Manager:**
1. Go to Facebook Ads Manager
2. Click on your ad
3. Check URL: `...selected_ad_id=120208123456789`

**Method 2 - From webhook logs:**
1. Have someone click the ad
2. Check Vercel logs:
   ```
   Ad ID: 120208123456789, Source: ADS, Type: OPEN_THREAD
   ```

---

## Example Ad Setup (Step by Step)

### Example: Black Hat Ad with Ref Parameter

**1. Create ad in Ads Manager:**
- Objective: "Messages"
- Ad creative: Photo of black hat
- Call to action: "Send Message"

**2. Set message destination:**
```
m.me/bebiaschatbot?ref=PRODUCT_9016
```

**3. Test:**
- Click ad preview
- Bot should respond with:
  ```
  გამარჯობა ბებია! 💛 რა მაგარი არჩევანი!

  შავი ბამბის ქუდი - 49 ლარი
  [Photo of black hat]

  გინდა შევკვეთო?
  ```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/api/messenger/route.ts:1980-2089` | Webhook handler - postback/referral detection |
| `data/ad-product-mapping.json` | Manual ad ID → product ID mapping |
| `data/content/bot-instructions.md:46-65` | AI instructions for [SHOW_PRODUCT:ID] |

---

## Comparison: 3 Methods

| Method | Setup Difficulty | Best For | Auto-Updates |
|--------|-----------------|----------|--------------|
| **Catalog Ads** | Easy | Dynamic product ads | ✅ Yes |
| **Ref Parameter** | Medium | Click-to-messenger ads | ❌ Manual per ad |
| **Ad ID Mapping** | Hard | Existing ads, testing | ❌ Manual per ad |

**Recommendation:** Use **Catalog Ads** if possible, fall back to **Ref Parameter** for regular ads.

---

**Last Updated:** November 24, 2025
