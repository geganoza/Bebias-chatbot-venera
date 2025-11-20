# Cloud Function Deployment - Complete Summary

## Problem Solved

The async payment verification in the Vercel webhook was timing out after 10 seconds (Vercel hobby plan limit), causing the follow-up confirmation messages to never be sent to users after payment.

## Solution Implemented

Migrated async payment verification to **Google Cloud Functions** with 60-second timeout, ensuring reliable payment confirmation messages.

---

## What Was Done

### 1. Cloud Function Created ✅

**Location**: `cloud-functions/payment-verifier/`

**Files Created**:
- `index.js` - Main Cloud Function code with full payment verification logic
- `package.json` - Dependencies (@google-cloud/functions-framework, @vercel/kv, nodemailer)
- `deploy.sh` - Deployment automation script

**Cloud Function URL**:
```
https://us-central1-bebias-wp-db-handler.cloudfunctions.net/verifyPayment
```

**Configuration**:
- Runtime: Node.js 20
- Timeout: 60 seconds (vs Vercel's 10s limit)
- Memory: 256MB
- Region: us-central1
- Trigger: HTTP (unauthenticated)
- Max instances: 10

### 2. Environment Variables Set ✅

**Already Set in Cloud Function**:
- `NEXT_PUBLIC_CHAT_API_BASE` = https://bebias-venera-chatbot.vercel.app
- `KV_REST_API_URL` = https://intimate-rattler-22686.upstash.io
- `KV_REST_API_TOKEN` = [set]

**STILL NEED TO SET** (see instructions below):
- `PAGE_ACCESS_TOKEN` (Facebook API)
- `EMAIL_USER` (Gmail for order emails)
- `EMAIL_PASSWORD` (Gmail App Password)

### 3. Vercel Webhook Updated ✅

**File**: `app/api/messenger/route.ts` (line 507-523)

**Change Made**:
Replaced direct call to `verifyPaymentAsync()` with HTTP call to Cloud Function:

```typescript
const cloudFunctionUrl = process.env.CLOUD_FUNCTION_URL ||
  'https://us-central1-bebias-wp-db-handler.cloudfunctions.net/verifyPayment';

fetch(cloudFunctionUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    expectedAmount,
    name,
    isKa,
    senderId,
    delayMs: 10000
  })
}).catch(err => {
  console.error('❌ Cloud Function call failed:', err);
});
```

### 4. Vercel Deployment ✅

- Added `CLOUD_FUNCTION_URL` environment variable to Vercel production
- Deployed updated code to production
- **Production URL**: https://bebias-venera-chatbot-nf80s0woy-giorgis-projects-cea59354.vercel.app

---

## How It Works Now

### Payment Flow (10-20 seconds total):

1. **User sends**: "ჩავრიცხე, გიორგი ნოზაძე, 55 ლარი"

2. **Vercel responds immediately** (< 1 second):
   ```
   მადლობა! ❤️
   თქვენი გადახდა 55 ლარი "გიორგი ნოზაძე"-ის სახელზე მიიღება.
   ⏳ ვამოწმებთ გადახდას ბანკში... (10-20 წამი)
   ```

3. **Vercel calls Cloud Function** (non-blocking, returns immediately)

4. **Cloud Function waits 10 seconds** (gives bank time to process)

5. **Cloud Function checks BOG API** for payment

6. **If payment found**:
   - Logs order to KV database
   - Sends email to orders.bebias@gmail.com
   - Sends follow-up message via Facebook:
     ```
     ✅ გადახდა დადასტურდა! ❤️

     55 ლარი მიღებულია "გიორგი ნოზაძე"-ისგან.

     📦 შეკვეთა #ORD-1234567890 დადასტურებულია!

     📧 ელექტრონული ზედნადები გამოგზავნილია.
     🚚 შეკვეთა მალე იქნება გაგზავნილი.

     მადლობა! 🎉
     ```

7. **If payment not found**:
   - Retries once after 10 more seconds
   - Sends appropriate error message if still not found

---

## What Still Needs to Be Done

### CRITICAL: Set 3 Missing Environment Variables

The Cloud Function needs these to work fully:

#### Option 1: Via Google Cloud Console (Easiest)

1. Go to: https://console.cloud.google.com/functions/details/us-central1/verifyPayment?project=bebias-wp-db-handler

2. Click **EDIT** → **Runtime, build, connections and security settings** → **Runtime environment variables**

3. Add these 3 variables:

   **PAGE_ACCESS_TOKEN**:
   ```bash
   # Get from Vercel:
   vercel env pull --yes .env.production
   grep "^PAGE_ACCESS_TOKEN=" .env.production
   # Copy the value (without quotes)
   ```

   **EMAIL_USER**:
   ```
   orders.bebias@gmail.com
   ```
   (or whatever Gmail you want to receive order notifications)

   **EMAIL_PASSWORD**:
   - Go to: https://myaccount.google.com/apppasswords
   - Create an App Password for "Mail"
   - Use that 16-character password

4. Click **NEXT** → **DEPLOY**

#### Option 2: Via gcloud CLI (Faster)

```bash
cd cloud-functions/payment-verifier

# Get PAGE_ACCESS_TOKEN from Vercel
vercel env pull --yes .env.production
PAGE_TOKEN=$(grep "^PAGE_ACCESS_TOKEN=" .env.production | cut -d '=' -f2 | tr -d '"')

# Deploy with all env vars at once
gcloud functions deploy verifyPayment \
  --gen2 \
  --region=us-central1 \
  --update-env-vars="PAGE_ACCESS_TOKEN=${PAGE_TOKEN},EMAIL_USER=orders.bebias@gmail.com,EMAIL_PASSWORD=your-gmail-app-password-here"
```

Replace `orders.bebias@gmail.com` and `your-gmail-app-password-here` with real values.

---

## Testing

Once env vars are set, test with a real payment:

1. Send payment via BOG bank
2. Message chatbot: "ჩავრიცხე, [your name], [amount] ლარი"
3. Within 10-20 seconds, you should receive confirmation

**Monitor Cloud Function logs**:
```bash
gcloud functions logs read verifyPayment --region=us-central1 --limit=50
```

---

## Cost

**100% FREE** for your use case:
- Google Cloud Free Tier: 2 million invocations/month
- Expected usage: ~100-500/month
- Cost: $0.00

---

## Files Modified

1. **cloud-functions/payment-verifier/index.js** - Fixed `PAGE_ACCESS_TOKEN` reference (was `FACEBOOK_PAGE_ACCESS_TOKEN`)
2. **app/api/messenger/route.ts:507-523** - Replaced local async call with Cloud Function call
3. **SETUP_ENV_VARS.md** - Created instructions for setting remaining env vars
4. **CLOUD_FUNCTION_SETUP.md** - Original setup guide (still valid)
5. **CLOUD_FUNCTION_DEPLOYMENT_SUMMARY.md** - This file

---

## Troubleshooting

### Payment confirmation not received

**Check Cloud Function logs**:
```bash
gcloud functions logs read verifyPayment --region=us-central1 --limit=50
```

**Common issues**:
1. Missing env vars (PAGE_ACCESS_TOKEN, EMAIL_USER, EMAIL_PASSWORD)
2. Bank API timeout
3. KV connection issues

### Email not sent

- Verify `EMAIL_USER` and `EMAIL_PASSWORD` are set correctly
- Check Gmail App Password is active
- Look for email errors in Cloud Function logs

### Cloud Function timeout

- Current timeout: 60s (should be plenty)
- If needed, increase: `--timeout=90s` in deploy command

---

## Next Steps

1. ✅ Cloud Function deployed
2. ✅ Vercel updated and deployed
3. ⏳ **Set 3 remaining env vars** (see instructions above)
4. ⏳ **Test with real payment**
5. ⏳ **Monitor logs** for any issues

---

## References

- Cloud Function: https://console.cloud.google.com/functions/details/us-central1/verifyPayment?project=bebias-wp-db-handler
- Vercel Project: https://vercel.com/giorgis-projects-cea59354/bebias-venera-chatbot
- Production URL: https://bebias-venera-chatbot.vercel.app
