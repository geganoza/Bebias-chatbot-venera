# Set Environment Variables in Cloud Function

## Quick Setup

You need to add 3 more environment variables to the Cloud Function. Go to:
https://console.cloud.google.com/functions/details/us-central1/verifyPayment?project=bebias-wp-db-handler

Click **EDIT** → **Runtime, build, connections and security settings** → **Runtime environment variables**

Add these variables:

### 1. PAGE_ACCESS_TOKEN
Get the value from Vercel:
```bash
vercel env pull --yes .env.production
grep PAGE_ACCESS_TOKEN .env.production
```

### 2. EMAIL_USER
Your Gmail address (e.g., `orders.bebias@gmail.com`)

### 3. EMAIL_PASSWORD
Your Gmail App Password (NOT your regular password!)
- Go to: https://myaccount.google.com/apppasswords
- Create an app password for "Mail"
- Use that generated password

## Current Status

✅ Already set:
- NEXT_PUBLIC_CHAT_API_BASE
- KV_REST_API_URL
- KV_REST_API_TOKEN

⏳ Need to set:
- PAGE_ACCESS_TOKEN (from Vercel)
- EMAIL_USER (your Gmail)
- EMAIL_PASSWORD (Gmail App Password)

## Alternative: Use gcloud CLI

```bash
cd cloud-functions/payment-verifier

# Get PAGE_ACCESS_TOKEN from Vercel
vercel env pull --yes .env.production
PAGE_TOKEN=$(grep "^PAGE_ACCESS_TOKEN=" .env.production | cut -d '=' -f2 | tr -d '"')

# Set all three variables at once
gcloud functions deploy verifyPayment \
  --gen2 \
  --region=us-central1 \
  --update-env-vars="PAGE_ACCESS_TOKEN=${PAGE_TOKEN},EMAIL_USER=your-email@gmail.com,EMAIL_PASSWORD=your-app-password"
```

Replace `your-email@gmail.com` and `your-app-password` with your actual values.
