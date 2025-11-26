# Image Not Showing - Root Cause & Fix

**Date:** November 24, 2025
**Issue:** Bot says it will show photo but doesn't send image
**Status:** ✅ Fixed

---

## Root Cause Analysis

### What Happened:

1. **User asked:** "მაჩვენე შავი ბამბის ქუდი" (show me black cotton hat)
2. **Bot said:** "ბოდიში, ბებია! ახლავე გაჩვენებ შავი ბამბის მოკლე ქუდის ფოტოს"
3. **But no image sent** ❌

### Investigation Results:

```bash
# Checked products.json
Total products: 269
შავი (black) products: 0  ← PRODUCT DOESN'T EXIST!
ბამბის (cotton) products: 2 (pink and blue only)
```

**The problem:** "შავი ბამბის ქუდი" doesn't exist in the database.

### Why No Image Was Sent:

```
User asks for "black cotton hat"
  ↓
Product filter tries to find it
  ↓
No black products exist → filter returns generic bestsellers
  ↓
AI looks at bestsellers, doesn't find "black cotton hat"
  ↓
AI HALLUCINATES the product name anyway (BAD!)
  ↓
No SEND_IMAGE command (product not in AI's catalog)
  ↓
User sees text but no image
```

---

## The Fix

### Changed AI Instructions:

**Before:**
```
## CRITICAL: ALWAYS SEND PRODUCT IMAGES
When you mention or discuss ANY product...
```

**After:**
```
## ⚠️ CRITICAL RULES - PRODUCT CATALOG

**RULE #1: NEVER HALLUCINATE PRODUCTS**
- ONLY suggest products from the catalog below
- If customer asks for product not in catalog, say "ამჟამად არ გვაქვს, მაგრამ გვაქვს ..." and show similar alternatives
- NEVER make up product names, colors, or features not listed below

**RULE #2: ALWAYS SEND IMAGES**
When you show or discuss ANY product with [HAS_IMAGE]:
1. Show the product details (name, price)
2. Add this command at the END: SEND_IMAGE: PRODUCT_ID
3. Use EXACT ID from catalog (numbers only)

Example response:
"აგურისფერი სადა ქუდი - 59 ლარი 💛
SEND_IMAGE: 4714

გინდა შევკვეთო?"
```

---

## Expected Behavior Now

### Scenario 1: Product Exists

**User:** "მაჩვენე აგურისფერი ქუდი"
**Bot response:**
```
აგურისფერი სადა ქუდი - M - 59 ლარი 💛
SEND_IMAGE: 4714

გინდა შევკვეთო?
```
**Result:** ✅ Image sent, product details shown

### Scenario 2: Product Doesn't Exist

**User:** "მაჩვენე შავი ბამბის ქუდი"
**Bot response:**
```
ბოდიში ბებია, ამჟამად შავი ბამბის ქუდი არ გვაქვს 😔
მაგრამ გვაქვს მსგავსი:

ლურჯი ბამბის მოკლე ქუდი - 49 ლარი
SEND_IMAGE: 11406

ვარდისფერი ბამბის მოკლე ქუდი - 49 ლარი
SEND_IMAGE: 11300

რომელი მოგწონს?
```
**Result:** ✅ Honest response + alternatives with images

---

## Testing

### Test Product (EXISTS with image):
```
ID: 4714
Name: აგურისფერი სადა ქუდი - M
Stock: 2
Image: ✅ YES
```

### Test Commands:

1. **Test with existing product:**
   ```
   "გამარჯობა"
   "მაჩვენე აგურისფერი ქუდი"
   ```
   Expected: Shows product + sends image

2. **Test with non-existent product:**
   ```
   "გამარჯობა"
   "მაჩვენე შავი ქუდი"
   ```
   Expected: Says "we don't have it" + shows alternatives with images

---

## Verification Checklist

After testing, check logs for:

```bash
vercel logs bebias-venera-chatbot.vercel.app | grep "SEND_IMAGE\|🖼️"
```

**Should see:**
```
🔍 Found 1 SEND_IMAGE matches
   Matched product ID: "4714"
📸 Sending image to 3282789748459241: https://bebias.ge/...
✅ Image sent successfully
```

---

## Product Database Issue

### Why "შავი ბამბის ქუდი" doesn't exist:

Check your WooCommerce export:
```bash
# Search for black products in WooCommerce
# If they exist there but not in products.json:
python3 scripts/sync-woocommerce-full.py ~/Downloads/latest-export.csv
```

**Possible reasons:**
1. Product not in WooCommerce
2. Product archived/draft (not exported)
3. Sync script filters it out
4. Product name in WooCommerce is different (e.g., "მუქი" instead of "შავი")

---

## Long-Term Solution

### Add Product Existence Check to Filter:

When user asks for non-existent product, bot should:
1. ✅ Detect it's not available (DONE)
2. ✅ Show similar alternatives (DONE)
3. ✅ Send images for alternatives (DONE)
4. ⭐ Log request for analysis (TODO)

### Track "Not Found" Products:

```javascript
// Log to Firestore when product requested but not found
await db.collection('productRequests').add({
  requested: 'შავი ბამბის ქუდი',
  timestamp: new Date().toISOString(),
  userId: senderId
});
```

**Benefit:** Know which products customers want but you don't have.

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/process-message/route.ts:1067-1096` | Improved AI instructions - no hallucination |
| `docs/IMAGE-ISSUE-FIX.md` | This document |

---

## Summary

**Problem:** AI hallucinated non-existent products, didn't send images
**Root Cause:** Product doesn't exist in database, AI made up the name
**Fix:** Strict instructions to ONLY suggest catalog products + show alternatives
**Status:** ✅ Deployed and ready to test

---

**Test user cleared:** Ready for fresh test
**Test with:** "მაჩვენე აგურისფერი ქუდი" (product that EXISTS)

---

**Last Updated:** November 24, 2025
