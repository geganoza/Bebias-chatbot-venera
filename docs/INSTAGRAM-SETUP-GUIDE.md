# Instagram DM Integration - Complete Setup Guide

**Status**: 🚧 In Progress
**Last Updated**: 2025-11-25

---

## Overview

Instagram Direct Messages can be integrated with the BEBIAS chatbot using Facebook's Graph API. The process is similar to Facebook Messenger but requires Instagram-specific permissions and configuration.

**What You'll Get**:
- Automatic responses to Instagram DMs
- Same AI chatbot as Facebook Messenger
- Shared conversation history (if needed)
- Product catalog integration
- Order management through Instagram

---

## Prerequisites Checklist

Before starting, ensure you have:

- ✅ Facebook Business Account
- ✅ Instagram Business or Creator Account
- ✅ Instagram account connected to Facebook Page
- ✅ Facebook App (can use existing Messenger app)
- ✅ Vercel deployment (for webhook URL)
- ✅ Admin access to Facebook App

**Check Your Instagram Account Type**:
1. Open Instagram app
2. Go to Settings → Account
3. Look for "Switch to Professional Account"
4. Must be Business or Creator (not Personal)

---

## Step-by-Step Setup

### Step 1: Facebook App Configuration

#### 1.1 Add Instagram Product

Go to Facebook Developers: https://developers.facebook.com/apps

```
1. Select your app (or create new one)
2. Click "Add Product" in left sidebar
3. Find "Instagram" → Click "Set Up"
4. This adds Instagram to your app
```

#### 1.2 Add Instagram Permissions

In App Dashboard → Products → Instagram → Configuration:

**Required Permissions**:
- `instagram_basic` - Basic Instagram access
- `instagram_manage_messages` - Read and send DMs
- `instagram_manage_comments` - (Optional) Manage comments
- `pages_manage_metadata` - Page metadata

**How to Add Permissions**:
```
1. Go to App Dashboard → App Review → Permissions and Features
2. Search for each permission above
3. Click "Request Advanced Access"
4. Complete Business Verification if required
```

**Note**: Some permissions require Business Verification (blue checkmark on Facebook Page)

### Step 2: Connect Instagram Account

#### 2.1 Link Instagram to Facebook Page

```
1. Go to your Facebook Page settings
2. Click "Instagram" in left sidebar
3. Click "Connect Account"
4. Log in to your Instagram Business account
5. Confirm connection
```

Verify connection:
```
Facebook Page Settings → Instagram → Should show "Connected"
```

#### 2.2 Generate Instagram Access Token

**Method 1: Graph API Explorer** (Recommended for testing)

```
1. Go to: https://developers.facebook.com/tools/explorer
2. Select your app from dropdown
3. Click "Generate Access Token"
4. Check permissions:
   - instagram_basic
   - instagram_manage_messages
   - pages_manage_metadata
5. Copy the access token
```

**Method 2: Manual Token Generation**

```bash
# Get Page Access Token first
curl -X GET "https://graph.facebook.com/v18.0/me/accounts?access_token=YOUR_USER_TOKEN"

# Use Page token to get Instagram account
curl -X GET "https://graph.facebook.com/v18.0/PAGE_ID?fields=instagram_business_account&access_token=PAGE_ACCESS_TOKEN"

# Result:
{
  "instagram_business_account": {
    "id": "INSTAGRAM_ACCOUNT_ID"
  }
}
```

**Make Token Long-Lived** (60 days):
```bash
curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN"
```

**Important**: Save this token! You'll need it for environment variables.

### Step 3: Create Instagram Webhook Endpoint

We'll create a new webhook endpoint specifically for Instagram.

#### 3.1 Create Webhook File

Create: `app/api/instagram/route.ts`

**Key Differences from Messenger**:
- Uses Instagram Graph API endpoints
- Message structure slightly different
- Sender ID is Instagram-scoped ID (IGSID)
- Story mentions and replies handled differently

#### 3.2 Get Your Webhook URL

Your webhook URL will be:
```
Production: https://bebias-venera-chatbot.vercel.app/api/instagram
Development: https://your-dev-url.vercel.app/api/instagram
```

### Step 4: Configure Webhook in Facebook App

#### 4.1 Set Up Webhook

```
1. Go to App Dashboard → Products → Instagram → Configuration
2. Scroll to "Webhooks"
3. Click "Add Callback URL"
4. Enter:
   - Callback URL: https://bebias-venera-chatbot.vercel.app/api/instagram
   - Verify Token: [Choose a secure random string]

   Example verify token: ig_webhook_bebias_2025_secure_token_xyz789

5. Click "Verify and Save"
```

**What Happens**:
- Facebook sends GET request to your webhook
- Your webhook must return the `hub.challenge` value
- If verification succeeds, webhook is saved

#### 4.2 Subscribe to Webhook Events

After webhook is verified, subscribe to events:

**Required Events**:
- ✅ `messages` - Incoming DMs
- ✅ `messaging_postbacks` - Button clicks
- ✅ `message_echoes` - Sent message confirmation (optional)

**Optional Events**:
- `message_reactions` - Message reactions
- `message_reads` - Read receipts
- `story_mentions` - When someone mentions you in story
- `messaging_handovers` - Handoff to human agent

**Subscribe**:
```
1. In Webhooks section, click "Add Subscriptions"
2. Check: messages, messaging_postbacks
3. Click "Save"
```

### Step 5: Environment Variables

Add to Vercel environment variables:

```bash
# Instagram-specific
INSTAGRAM_PAGE_ACCESS_TOKEN=your_instagram_page_token_here
INSTAGRAM_VERIFY_TOKEN=ig_webhook_bebias_2025_secure_token_xyz789

# Can reuse from Messenger (if using same bot logic)
OPENAI_API_KEY=sk-...
GOOGLE_CLOUD_PROJECT_ID=bebias-wp-db-handler
GOOGLE_CLOUD_CLIENT_EMAIL=...
GOOGLE_CLOUD_PRIVATE_KEY=...

# Optional: Separate Instagram from Messenger conversations
INSTAGRAM_SEPARATE_HISTORY=false  # true = separate DB collection
```

**Add to Vercel**:
```bash
# Add environment variables
vercel env add INSTAGRAM_PAGE_ACCESS_TOKEN production
# Paste token when prompted

vercel env add INSTAGRAM_VERIFY_TOKEN production
# Paste verify token when prompted
```

**Also add to local `.env.local`** for testing:
```bash
INSTAGRAM_PAGE_ACCESS_TOKEN=your_token_here
INSTAGRAM_VERIFY_TOKEN=ig_webhook_bebias_2025_secure_token_xyz789
```

### Step 6: Deploy Webhook

```bash
# From project root
cd /Users/giorginozadze/Documents/BEBIAS\ CHATBOT\ VENERA\ beta_2

# Deploy to production
vercel --prod

# Verify deployment
vercel ls | head -5
```

After deployment:
```
1. Go back to Facebook App Dashboard → Instagram → Webhooks
2. Click "Test" next to the webhook
3. Should see ✅ Success
```

### Step 7: Test Instagram Integration

#### 7.1 Send Test Message

```
1. Open Instagram app
2. Find your business account's DMs
3. Send a test message from another Instagram account:
   "გამარჯობა" (Hello in Georgian)

4. Bot should respond with greeting
```

#### 7.2 Check Logs

```bash
# View deployment logs
vercel logs bebias-venera-chatbot.vercel.app --since 5m

# Should see:
# ✅ Instagram webhook received
# 📨 Message from: [Instagram User ID]
# 🤖 AI response generated
# ✅ Message sent to Instagram
```

#### 7.3 Test Product Queries

```
Send: "მაჩვენე მწვანე ბამბის ქუდი"
Expected: Bot finds product and sends image
```

---

## Instagram-Specific Considerations

### Message Types

Instagram supports these message types:

**Text Messages**:
```json
{
  "recipient": { "id": "IGSID" },
  "message": { "text": "Hello from BEBIAS!" }
}
```

**Images**:
```json
{
  "recipient": { "id": "IGSID" },
  "message": {
    "attachment": {
      "type": "image",
      "payload": { "url": "https://bebias.ge/image.jpg" }
    }
  }
}
```

**Generic Template** (Product Cards):
```json
{
  "recipient": { "id": "IGSID" },
  "message": {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "Product Name",
          "image_url": "https://bebias.ge/product.jpg",
          "subtitle": "49 GEL",
          "buttons": [{
            "type": "web_url",
            "url": "https://bebias.ge/product",
            "title": "View"
          }]
        }]
      }
    }
  }
}
```

### Rate Limits

Instagram has stricter rate limits than Messenger:

- **Messages per user**: ~200 per day
- **API calls**: ~200 calls per hour per user
- **Concurrent requests**: ~10 concurrent

**Recommendation**: Implement rate limiting in webhook.

### Message Limitations

- **Text length**: 1000 characters max
- **Images**: Must be publicly accessible URLs
- **Videos**: Not supported in DMs (only stories)
- **Buttons**: Max 3 buttons per message

### Ice Breakers (Quick Replies)

Set up ice breakers for Instagram DMs:

```bash
# Set ice breakers
curl -X POST "https://graph.facebook.com/v18.0/INSTAGRAM_ACCOUNT_ID/messenger_profile?access_token=PAGE_ACCESS_TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "ice_breakers": [
    {
      "question": "🛍️ რა პროდუქცია გაქვთ?",
      "payload": "GET_STARTED_PRODUCTS"
    },
    {
      "question": "📦 როგორ შევუკვეთო?",
      "payload": "HOW_TO_ORDER"
    },
    {
      "question": "📍 სად მდებარეობთ?",
      "payload": "LOCATION"
    },
    {
      "question": "💬 ვისაუბროთ ადამიანთან",
      "payload": "TALK_TO_HUMAN"
    }
  ]
}'
```

These appear as quick reply buttons when user opens your DMs for the first time.

---

## Webhook Payload Structure

### Incoming Message

```json
{
  "object": "instagram",
  "entry": [{
    "id": "INSTAGRAM_ACCOUNT_ID",
    "time": 1732501973,
    "messaging": [{
      "sender": { "id": "IGSID" },
      "recipient": { "id": "PAGE_IGSID" },
      "timestamp": 1732501973000,
      "message": {
        "mid": "message_id",
        "text": "გამარჯობა"
      }
    }]
  }]
}
```

### Story Mention

```json
{
  "object": "instagram",
  "entry": [{
    "id": "INSTAGRAM_ACCOUNT_ID",
    "time": 1732501973,
    "messaging": [{
      "sender": { "id": "IGSID" },
      "recipient": { "id": "PAGE_IGSID" },
      "timestamp": 1732501973000,
      "message": {
        "mid": "message_id",
        "story_mention": {
          "link": "https://www.instagram.com/stories/username/story_id"
        }
      }
    }]
  }]
}
```

### Story Reply

```json
{
  "object": "instagram",
  "entry": [{
    "messaging": [{
      "sender": { "id": "IGSID" },
      "message": {
        "mid": "message_id",
        "text": "Nice product!",
        "reply_to": {
          "story": {
            "url": "https://www.instagram.com/stories/bebias/story_id",
            "id": "story_id"
          }
        }
      }
    }]
  }]
}
```

---

## Testing Checklist

Before going live:

- [ ] Webhook verification works
- [ ] Test message received and bot responds
- [ ] Images send correctly
- [ ] Product queries work
- [ ] Order tracking works (if applicable)
- [ ] Georgian text displays correctly
- [ ] Ice breakers appear when user opens DM
- [ ] Rate limiting is implemented
- [ ] Error handling for failed sends
- [ ] Logging to Firestore works
- [ ] Conversation history saves correctly

---

## Troubleshooting

### Issue 1: Webhook Verification Fails

**Symptom**: Facebook says "Unable to verify callback URL"

**Check**:
```bash
# Test webhook manually
curl "https://bebias-venera-chatbot.vercel.app/api/instagram?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"

# Should return: test123
```

**Common Causes**:
- Verify token mismatch (check environment variable)
- Webhook not deployed
- Endpoint returns wrong response

### Issue 2: Messages Not Received

**Symptom**: User sends message, webhook not triggered

**Check**:
```bash
# View logs
vercel logs bebias-venera-chatbot.vercel.app --since 10m

# Check webhook subscriptions
curl "https://graph.facebook.com/v18.0/INSTAGRAM_ACCOUNT_ID/subscribed_apps?access_token=PAGE_ACCESS_TOKEN"
```

**Common Causes**:
- Not subscribed to `messages` event
- Instagram account not connected to page
- Access token expired

### Issue 3: Can't Send Messages

**Symptom**: Bot receives message but can't reply

**Check**:
```bash
# Test sending manually
curl -X POST "https://graph.facebook.com/v18.0/me/messages?access_token=INSTAGRAM_PAGE_ACCESS_TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "recipient": {"id": "IGSID"},
  "message": {"text": "Test from API"}
}'
```

**Common Causes**:
- Wrong access token (must be Instagram-scoped)
- Missing `instagram_manage_messages` permission
- User blocked your account

### Issue 4: Access Token Expired

**Symptom**: API returns `(#190) Error validating access token`

**Fix**:
```bash
# Generate new long-lived token
curl "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN"

# Update in Vercel
vercel env rm INSTAGRAM_PAGE_ACCESS_TOKEN production
vercel env add INSTAGRAM_PAGE_ACCESS_TOKEN production
# Paste new token

# Redeploy
vercel --prod
```

---

## Differences from Messenger

| Feature | Messenger | Instagram |
|---------|-----------|-----------|
| API Endpoint | `/v18.0/me/messages` | `/v18.0/me/messages` (same) |
| Access Token | Page token | Instagram-scoped page token |
| User ID Format | PSID (Page-Scoped ID) | IGSID (Instagram-Scoped ID) |
| Message Length | 2000 chars | 1000 chars |
| Video Messages | ✅ Supported | ❌ Not in DMs |
| Templates | Full support | Limited support |
| Story Mentions | N/A | ✅ Supported |
| Story Replies | N/A | ✅ Supported |
| Payment | ✅ Supported | ❌ Not supported |

---

## Security Best Practices

1. **Validate Webhook Signatures**:
```typescript
import crypto from 'crypto';

function verifyInstagramSignature(req: Request, body: string): boolean {
  const signature = req.headers.get('X-Hub-Signature-256');
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.INSTAGRAM_APP_SECRET!)
    .update(body)
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}
```

2. **Use Environment Variables**: Never hardcode tokens

3. **Implement Rate Limiting**: Prevent abuse

4. **Log All Interactions**: For debugging and compliance

5. **Handle Errors Gracefully**: Don't expose internal errors to users

---

## Next Steps

After Instagram is working:

1. **Monitor Usage**:
   - Check Firestore for conversation logs
   - Monitor Vercel logs for errors
   - Track response times

2. **Optimize**:
   - Add Instagram-specific product filtering
   - Implement quick reply templates
   - Add story mention handling

3. **Marketing**:
   - Add "Send Message" button to Instagram profile
   - Use ice breakers to engage users
   - Promote chatbot in Instagram stories

4. **Analytics**:
   - Track most common queries
   - Monitor conversion rate
   - Compare Instagram vs Messenger performance

---

## Resources

- **Instagram Graph API Docs**: https://developers.facebook.com/docs/instagram-api
- **Messenger Platform API**: https://developers.facebook.com/docs/messenger-platform
- **Graph API Explorer**: https://developers.facebook.com/tools/explorer
- **Webhook Setup**: https://developers.facebook.com/docs/instagram-api/guides/webhooks

---

## Status Updates

- **2025-11-25**: Initial documentation created
- **Pending**: Webhook endpoint implementation
- **Pending**: Environment variable configuration
- **Pending**: Testing and verification

---

**Next**: Create the webhook endpoint → See implementation in `app/api/instagram/route.ts`
