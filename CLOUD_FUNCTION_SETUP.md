# Google Cloud Function Setup Guide

## Quick Setup (5-10 minutes)

### Step 1: Install Google Cloud CLI

```bash
# Install gcloud CLI
brew install google-cloud-sdk

# Login to Google Cloud
gcloud auth login

# Set your project (create one if needed at console.cloud.google.com)
gcloud config set project YOUR_PROJECT_ID
```

### Step 2: Deploy the Cloud Function

```bash
cd cloud-functions/payment-verifier
./deploy.sh
```

### Step 3: Set Environment Variables in Google Cloud

Go to [Google Cloud Console](https://console.cloud.google.com/functions) → Your Function → Edit

Add these Runtime environment variables:

```
NEXT_PUBLIC_CHAT_API_BASE=https://bebias-venera-chatbot.vercel.app
FACEBOOK_PAGE_ACCESS_TOKEN=<your-facebook-token>
KV_REST_API_URL=<from-vercel>
KV_REST_API_TOKEN=<from-vercel>
EMAIL_USER=<your-gmail>
EMAIL_PASSWORD=<your-gmail-app-password>
```

To get Vercel KV credentials:
```bash
vercel env ls production | grep KV
```

### Step 4: Update Vercel with Cloud Function URL

After deployment, you'll get a URL like:
`https://us-central1-YOUR-PROJECT.cloudfunctions.net/verifyPayment`

Add it to Vercel:
```bash
echo 'https://us-central1-YOUR-PROJECT.cloudfunctions.net/verifyPayment' | vercel env add CLOUD_FUNCTION_URL production
```

### Step 5: Deploy Vercel

```bash
vercel --prod
```

## How It Works

1. User says "ჩავრიცხე, name, amount"
2. Vercel webhook responds immediately: "მადლობა! ❤️ ვამოწმებთ..."
3. Vercel calls Cloud Function (non-blocking)
4. Cloud Function waits 10s, checks bank, sends follow-up message
5. User receives confirmation after 10-20 seconds!

## Testing

Test the Cloud Function directly:
```bash
curl -X POST https://YOUR-FUNCTION-URL \
  -H "Content-Type: application/json" \
  -d '{
    "expectedAmount": 55,
    "name": "გიორგი ნოზაძე",
    "isKa": true,
    "senderId": "test123",
    "delayMs": 5000
  }'
```

## Monitoring

View logs:
```bash
gcloud functions logs read verifyPayment --region=us-central1 --limit=50
```

## Cost

**100% FREE** for your use case:
- Free tier: 2 million invocations/month
- You'll use: ~100-500/month
- Cost: $0.00

## Troubleshooting

**Function times out:**
- Increase timeout: `--timeout=90s` in deploy.sh

**Can't find function:**
- Check region matches: `--region=us-central1`

**Environment variables not working:**
- Verify in Cloud Console → Function → Configuration
- Redeploy after adding variables
