# Instagram Integration - Quick Start Checklist

**Status**: Ready to Deploy
**Time**: ~30 minutes

---

## ✅ Pre-Deployment Checklist

Before you start, make sure you have:

- [ ] Instagram Business/Creator account
- [ ] Instagram connected to Facebook Page
- [ ] Facebook App with Instagram product added
- [ ] Admin access to Facebook Developers

---

## 🚀 Quick Setup (Follow in Order)

### Step 1: Add Environment Variables

```bash
cd /Users/giorginozadze/Documents/BEBIAS\ CHATBOT\ VENERA\ beta_2

# Add to .env.local for testing
echo "INSTAGRAM_PAGE_ACCESS_TOKEN=your_token_here" >> .env.local
echo "INSTAGRAM_VERIFY_TOKEN=ig_webhook_bebias_2025_secure_token_xyz789" >> .env.local
```

**Get Your Access Token**:
1. Go to: https://developers.facebook.com/tools/explorer
2. Select your app
3. Click "Generate Access Token"
4. Check permissions: `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata`
5. Copy token

**Make Token Long-Lived** (60 days):
```bash
curl "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_TOKEN"
```

### Step 2: Deploy to Vercel

```bash
# Add environment variables to Vercel
vercel env add INSTAGRAM_PAGE_ACCESS_TOKEN production
# Paste your token when prompted

vercel env add INSTAGRAM_VERIFY_TOKEN production
# Use: ig_webhook_bebias_2025_secure_token_xyz789

# Deploy
vercel --prod

# Verify deployment
vercel ls | head -5
```

Your webhook URL will be:
```
https://bebias-venera-chatbot.vercel.app/api/instagram
```

### Step 3: Configure Facebook Webhook

1. Go to: https://developers.facebook.com/apps
2. Select your app → Products → Instagram → Configuration
3. Scroll to "Webhooks"
4. Click "Add Callback URL":
   - **Callback URL**: `https://bebias-venera-chatbot.vercel.app/api/instagram`
   - **Verify Token**: `ig_webhook_bebias_2025_secure_token_xyz789`
5. Click "Verify and Save"

**Expected Result**: ✅ Webhook verified successfully

### Step 4: Subscribe to Events

In the same Webhooks section:

1. Click "Add Subscriptions"
2. Check these boxes:
   - ✅ `messages`
   - ✅ `messaging_postbacks`
3. Click "Save"

### Step 5: Test Integration

**Option A: Manual Test**

Send yourself a DM on Instagram from another account:
```
Message: "გამარჯობა"
Expected: Bot responds in Georgian
```

**Option B: API Test**

```bash
# Get your Instagram Account ID
curl "https://graph.facebook.com/v18.0/me?fields=instagram_business_account&access_token=YOUR_PAGE_TOKEN"

# Result: {"instagram_business_account": {"id": "INSTAGRAM_ACCOUNT_ID"}}

# Send test message (to yourself)
curl -X POST "https://graph.facebook.com/v18.0/me/messages?access_token=YOUR_PAGE_TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "recipient": {"id": "INSTAGRAM_USER_IGSID"},
  "message": {"text": "Test from BEBIAS chatbot! 🤖"}
}'
```

### Step 6: Verify Logs

```bash
# Check Vercel logs
vercel logs bebias-venera-chatbot.vercel.app --since 5m

# Should see:
# 📨 Instagram webhook received
# 💬 Text message from [IGSID]
# ✅ Instagram message sent successfully
```

---

## 🎯 What Works Now

After setup, your Instagram bot can:

- ✅ Receive text messages
- ✅ Receive images
- ✅ Receive story mentions
- ✅ Receive story replies
- ✅ Send text responses
- ✅ Send images
- ✅ Log conversations

**Note**: Full AI integration coming next (currently sends simple responses)

---

## 🔧 Next Steps: Full AI Integration

To integrate with your existing chatbot AI:

### Option 1: Share Logic with Messenger (Recommended)

Create shared message processing:

1. Create `lib/processMessage.ts`:
```typescript
// Shared message processing logic
export async function processUserMessage(
  userId: string,
  message: string,
  platform: 'messenger' | 'instagram'
) {
  // Your existing AI logic here
  // Load products, get conversation history, call OpenAI, etc.
}
```

2. Update `app/api/instagram/route.ts`:
```typescript
import { processUserMessage } from '../../../lib/processMessage';

async function handleTextMessage(senderId: string, text: string) {
  const response = await processUserMessage(senderId, text, 'instagram');
  await sendInstagramMessage(senderId, { text: response });
}
```

3. Update `app/api/messenger/route.ts`:
```typescript
import { processUserMessage } from '../../../lib/processMessage';

// Use processUserMessage instead of inline logic
```

### Option 2: Separate Instagram Logic

Keep Instagram logic separate if you want different behavior:

```typescript
// In app/api/instagram/route.ts
async function handleTextMessage(senderId: string, text: string) {
  // Load products
  const products = JSON.parse(
    await fs.readFile('data/products.json', 'utf-8')
  );

  // Get conversation history from Firestore
  const history = await getInstagramConversationHistory(senderId);

  // Call OpenAI
  const aiResponse = await openai.chat.completions.create({
    model: "gpt-4.1-preview",
    messages: [
      { role: "system", content: "Instagram chatbot instructions..." },
      ...history,
      { role: "user", content: text }
    ]
  });

  // Send response
  await sendInstagramMessage(senderId, {
    text: aiResponse.choices[0].message.content
  });
}
```

---

## 📊 Testing Checklist

Before announcing to customers:

- [ ] Test basic conversation
- [ ] Test product queries in Georgian
- [ ] Test image recognition (if implemented)
- [ ] Test SEND_IMAGE command
- [ ] Test order tracking (if applicable)
- [ ] Test rate limiting
- [ ] Test error handling
- [ ] Verify conversation history saves correctly
- [ ] Test from multiple Instagram accounts
- [ ] Test story mentions
- [ ] Test story replies

---

## 🚨 Troubleshooting Quick Fixes

### Webhook Verification Failed

```bash
# Test manually
curl "https://bebias-venera-chatbot.vercel.app/api/instagram?hub.mode=subscribe&hub.verify_token=ig_webhook_bebias_2025_secure_token_xyz789&hub.challenge=test123"

# Should return: test123
```

### Messages Not Received

```bash
# Check subscriptions
curl "https://graph.facebook.com/v18.0/INSTAGRAM_ACCOUNT_ID/subscribed_apps?access_token=YOUR_TOKEN"

# Should show your app in the list
```

### Can't Send Messages

```bash
# Test sending
curl -X POST "https://graph.facebook.com/v18.0/me/messages?access_token=YOUR_TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "recipient": {"id": "IGSID"},
  "message": {"text": "Test"}
}'

# Check for errors in response
```

### Access Token Expired

```bash
# Generate new long-lived token
curl "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN"

# Update in Vercel
vercel env rm INSTAGRAM_PAGE_ACCESS_TOKEN production
vercel env add INSTAGRAM_PAGE_ACCESS_TOKEN production
vercel --prod
```

---

## 📝 Environment Variables Reference

Required in `.env.local` and Vercel:

```bash
# Instagram
INSTAGRAM_PAGE_ACCESS_TOKEN=EAAxxxxxxx...  # From Graph API Explorer
INSTAGRAM_VERIFY_TOKEN=ig_webhook_bebias_2025_secure_token_xyz789

# Existing (already configured)
OPENAI_API_KEY=sk-...
PAGE_ACCESS_TOKEN=...  # For Messenger
VERIFY_TOKEN=...  # For Messenger
GOOGLE_CLOUD_PROJECT_ID=bebias-wp-db-handler
GOOGLE_CLOUD_CLIENT_EMAIL=...
GOOGLE_CLOUD_PRIVATE_KEY=...
```

---

## 🎉 Success Criteria

You're done when:

1. ✅ Webhook verified in Facebook App Dashboard
2. ✅ Bot responds to test message on Instagram
3. ✅ Logs show successful message send/receive
4. ✅ No errors in Vercel logs
5. ✅ Conversation saves to Firestore

---

## 📞 Support

**Full Documentation**: See `docs/INSTAGRAM-SETUP-GUIDE.md`

**Common Issues**:
- Webhook verification → Check INSTAGRAM_VERIFY_TOKEN matches
- Messages not received → Check subscriptions and permissions
- Can't send messages → Check access token and permissions
- Token expired → Generate new long-lived token

**Test Commands**:
```bash
# View logs
vercel logs bebias-venera-chatbot.vercel.app --since 10m

# Test webhook
curl "https://bebias-venera-chatbot.vercel.app/api/instagram?hub.mode=subscribe&hub.verify_token=ig_webhook_bebias_2025_secure_token_xyz789&hub.challenge=test"

# Check deployment
vercel ls
```

---

**Status**: Ready to deploy! Follow steps 1-6 above. 🚀

**Estimated Time**: 20-30 minutes
**Difficulty**: Medium (similar to Messenger setup)
