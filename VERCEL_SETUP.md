# Vercel Deployment Setup

## Environment Variables Configuration

Before deploying, you need to add the following environment variables to your Vercel project:

### Required Environment Variables:

1. **OPENAI_API_KEY**
   ```
   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
   ```

2. **PAGE_ACCESS_TOKEN** (Facebook Page Access Token)
   ```
   EAAZAjBxu2jWcBP0VhcM3yocpgmqClPn0lWbAzbEqB3FHE0bBQvzNjxCcPoZAjZCFvZCz8zIwnZCQyxVy3FBbk4VGx2JzAZCfvVkzjRwAg3cooZCm7O8pO74mTcIkjqkHgDZCAEaqbLj7FysQl2Br5xVAbSLDMwd7sVbH1UtvUnAUDpTHcZCny0km2pwKVUqWmmRjmGrFQA6P3V7ZBs7ZA9viCFgQZAwZD
   ```

3. **VERIFY_TOKEN** (Webhook Verification Token)
   ```
   martivi_bebias_webhook_2025
   ```

4. **NEXT_PUBLIC_CHAT_API_BASE**
   ```
   https://mc-chat-230925-43vp.vercel.app
   ```

5. **NEXT_PUBLIC_GA_MEASUREMENT_ID**
   ```
   G-4XZ9W578J6
   ```

## How to Add Environment Variables:

### Option 1: Via Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Select your project: `martivi-consulting-website`
3. Go to Settings → Environment Variables
4. Add each variable above for Production, Preview, and Development environments

### Option 2: Via Vercel CLI
```bash
# Login to Vercel first
vercel login

# Add environment variables
vercel env add OPENAI_API_KEY production
vercel env add PAGE_ACCESS_TOKEN production
vercel env add VERIFY_TOKEN production
vercel env add NEXT_PUBLIC_CHAT_API_BASE production
vercel env add NEXT_PUBLIC_GA_MEASUREMENT_ID production
```

## Deployment

After setting up environment variables, deploy with:

```bash
vercel --prod
```

## Webhook URL

After deployment, your webhook URL will be:
```
https://your-domain.vercel.app/api/webhook
```

## Facebook Messenger Setup

1. Go to Facebook Developer Console: https://developers.facebook.com/
2. Select your app
3. Go to Messenger → Settings
4. In "Webhooks" section, click "Add Callback URL"
5. Enter your webhook URL: `https://your-domain.vercel.app/api/webhook`
6. Enter Verify Token: `martivi_bebias_webhook_2025`
7. Subscribe to webhook fields:
   - messages
   - messaging_postbacks
   - messaging_optins

## Testing

Test webhook verification:
```bash
curl "https://your-domain.vercel.app/api/webhook?hub.mode=subscribe&hub.verify_token=martivi_bebias_webhook_2025&hub.challenge=test123"
```

Should return: `test123`

## Logs

View logs in Vercel Dashboard or via CLI:
```bash
vercel logs
```

All incoming webhooks will be logged with:
- 📩 Incoming message details
- 👤 User information
- 💬 Message content
- 📤 Response sent
- ✅/❌ Success/error indicators
