# Facebook Ads - Quick Reference Card

---

## ✅ One-Time Setup (Do Once)

### 1. Enable Webhooks
- [ ] Go to developers.facebook.com
- [ ] Your App → Messenger → Webhooks
- [ ] Check ✅ `messaging_postbacks`
- [ ] Check ✅ `messaging_referrals`
- [ ] Save

### 2. Choose Your Method

**Option A: Catalog Ads** (Recommended)
- Upload CSV to Facebook Catalog Manager
- Products auto-sync
- Bot auto-detects product ID

**Option B: Ref Parameter**
- Use format: `m.me/yourbotusername?ref=PRODUCT_9016`
- Change `9016` to your product ID

**Option C: Ad Mapping**
- Edit `data/ad-product-mapping.json`
- Add: `"AD_ID": { "productId": "9016" }`

---

## 📋 Create New Product Ad (5 minutes)

### Method 1: Catalog Ad
1. Facebook Ads Manager → Create Campaign
2. Objective: "Messages"
3. Ad format: "Carousel" or "Single Image"
4. Product set: Select from catalog
5. Message destination: Your Messenger bot
6. Done! ✅ (Product ID sent automatically)

### Method 2: Ref Parameter Ad
1. Create ad with "Messages" objective
2. Set message destination:
   ```
   m.me/bebiaschatbot?ref=PRODUCT_9016
   ```
3. Replace `9016` with your product ID
4. Done! ✅

---

## 🔍 Test Your Ad

### Step 1: Click Ad
Click the "Send Message" button on your ad

### Step 2: Check Logs
```bash
vercel logs bebias-venera-chatbot.vercel.app
```

Look for:
```
🎯 Message has AD REFERRAL attached
   ✅ Product ID from ref param: 9016
   🎯 Replaced message with product inquiry: 9016
```

### Step 3: Verify Bot Response
User should see:
```
გამარჯობა ბებია! 💛

შავი ბამბის ქუდი - 49 ლარი
[Product photo]

გინდა შევკვეთო?
```

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Bot not responding to ad | Enable webhooks (see above) |
| Bot responds but no product | Check product ID in logs, add to mapping |
| Wrong product shown | Fix product ID in ref parameter |

---

## 📊 Monitor Performance

### Daily (1 minute)
```bash
vercel logs | grep "🎯"  # Check ad clicks
```

### Weekly (5 minutes)
```bash
node scripts/ad-performance-report.js
```

---

## 🔗 Quick Links

- [Full Setup Guide](./FACEBOOK-AD-SETUP.md)
- [Automation Guide](./AD-AUTOMATION-GUIDE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

---

## 💡 Pro Tips

1. **Use catalog ads** - Less work, auto-updates
2. **Test with low budget** first - $5/day to start
3. **Monitor logs daily** - Catch issues early
4. **A/B test ad creative** - Try different photos/copy
5. **Update mapping file** - Keep product IDs in sync

---

**Last Updated:** November 24, 2025
