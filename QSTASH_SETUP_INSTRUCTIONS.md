# QStash Setup Instructions

## ✅ Step 1: Package Installed
QStash package has been installed successfully.

## 🔑 Step 2: Get Your QStash Credentials

1. Go to: **https://console.upstash.com/qstash**

2. Sign up or log in (can use GitHub/Google)

3. In the dashboard, you'll see three keys:
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`

4. Copy all three values

## 📝 Step 3: Add Environment Variables to Vercel

### Option A: Using Vercel CLI (Recommended)

```bash
# Set QSTASH_TOKEN
vercel env add QSTASH_TOKEN

# When prompted, paste your token
# Select: Production, Preview, Development (all three)

# Set QSTASH_CURRENT_SIGNING_KEY
vercel env add QSTASH_CURRENT_SIGNING_KEY

# Set QSTASH_NEXT_SIGNING_KEY
vercel env add QSTASH_NEXT_SIGNING_KEY
```

### Option B: Using Vercel Dashboard

1. Go to: https://vercel.com/giorgis-projects-cea59354/bebias-venera-chatbot/settings/environment-variables

2. Add three new variables:
   - Name: `QSTASH_TOKEN`, Value: `[your token]`, Environment: All
   - Name: `QSTASH_CURRENT_SIGNING_KEY`, Value: `[your key]`, Environment: All
   - Name: `QSTASH_NEXT_SIGNING_KEY`, Value: `[your key]`, Environment: All

3. Click "Save"

## 📥 Step 4: Pull Environment Variables Locally

```bash
vercel env pull .env.local
```

This updates your local `.env.local` file with the new QStash credentials.

## ✅ What's Already Done

1. ✅ QStash package installed (`@upstash/qstash`)
2. ✅ Queue helper functions created
3. ✅ Dual model system (GPT-4.1 for text, GPT-4o for images)
4. ✅ Internal processing endpoint created (`/api/internal/process-queued-messages`)
5. ✅ Cron endpoint created (fallback)

## 🔄 What's Next (After You Add Credentials)

Once you've added the QStash credentials, I'll:

1. Update the messenger webhook handler to use QStash
2. Handle typing indicators
3. Implement message queueing logic
4. Subscribe to `messaging_typing` in Facebook
5. Deploy and test

## 🧪 Testing QStash

After setup, you can test QStash is working:

```bash
curl -X POST https://qstash.upstash.io/v2/publish/https://bebias-venera-chatbot.vercel.app/api/internal/process-queued-messages \
  -H "Authorization: Bearer YOUR_QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"senderId": "test123"}'
```

You should see the request arrive at your endpoint after a delay.

## 💰 QStash Pricing

- **Free tier**: 500 messages/day
- **Pro**: $10/month for 100,000 messages
- **Pay as you go**: $1 per 10,000 messages

For your chatbot, free tier should be more than enough!

## 📊 Monitor QStash

Dashboard: https://console.upstash.com/qstash

You can see:
- Messages sent
- Success/failure rates
- Message history
- Retry attempts

---

## ⏸️ PAUSED HERE

**Please complete Step 2 & 3 (get credentials and add to Vercel), then let me know when done!**

I'll then complete the implementation and deploy the full system.
