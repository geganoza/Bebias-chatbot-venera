# Instagram Messaging API Setup Guide

## Successfully Working as of 2025-12-12

### What We Built
Instagram DM chatbot for bebias_handcrafted that:
- Receives messages from Instagram users
- Processes with AI (same logic as Facebook Messenger bot)
- Sends automated responses back to Instagram
- Shows all conversations in Control Panel

---

## Key Components

### 1. Webhook Endpoint
**File:** `/app/api/instagram/route.ts`

Handles two webhook formats:
- `entry.messaging[]` - Real-time Instagram DMs
- `entry.changes[]` - Meta's Test button webhooks

### 2. Token Configuration
**CRITICAL: Must use Page Access Token, NOT Instagram User Token**

| Token Type | Starts With | Use Case |
|------------|-------------|----------|
| Page Access Token | `EAA...` | **Required for sending messages** |
| Instagram User Token | `IGAAM...` | Only for user-specific actions |

### 3. Environment Variables (Vercel)
```
INSTAGRAM_PAGE_ACCESS_TOKEN = EAA...  (Page token for ბებიას Bebias)
INSTAGRAM_VERIFY_TOKEN = ig_webhook_verify_token
```

---

## How to Get the Correct Token

### Step 1: Get User Access Token
1. Go to Meta Developer Dashboard → Your App
2. Tools → Graph API Explorer
3. Generate User Access Token with permissions:
   - `pages_messaging`
   - `instagram_manage_messages`
   - `instagram_basic`
   - `pages_show_list`

### Step 2: Exchange for Page Access Token
```bash
# Get list of pages and their tokens
curl "https://graph.facebook.com/v18.0/me/accounts?access_token=USER_TOKEN"
```

Response shows Page Access Token:
```json
{
  "data": [{
    "access_token": "EAAL9sPOK4AoB...",  // THIS IS THE PAGE TOKEN
    "name": "ბებიას Bebias",
    "id": "241381986765713",
    "tasks": ["MESSAGING", ...]
  }]
}
```

### Step 3: Use Page Token in Vercel
```bash
npx vercel env rm INSTAGRAM_PAGE_ACCESS_TOKEN production -y
echo "EAAL9sPOK4AoB..." | npx vercel env add INSTAGRAM_PAGE_ACCESS_TOKEN production
npx vercel --prod
```

---

## Architecture

```
Instagram User (geganoza)
        │
        ▼ sends DM
bebias_handcrafted (Instagram Business)
        │
        ▼ webhook POST
/api/instagram (Vercel)
        │
        ├─► Save to Firestore (metaMessages collection)
        ├─► Generate AI response (OpenAI GPT-4o)
        └─► Send response via Graph API
                │
                ▼
Instagram User receives reply
```

---

## Files Modified

1. **`/app/api/instagram/route.ts`** - Main webhook handler
   - Added OpenAI integration
   - Added `changes[]` format support for Meta Test button
   - Added `saveToControlPanel()` function
   - Uses same content files as test bot

2. **`/app/api/instagram-webhooks/route.ts`** - API for viewing webhook logs

3. **`/app/instagram-webhooks/page.tsx`** - Webhook viewer UI

---

## Meta App Configuration

### Webhook Settings (Use Cases → Instagram → Configure webhooks)
- **Callback URL:** `https://bebias-venera-chatbot.vercel.app/api/instagram`
- **Verify Token:** `ig_webhook_verify_token`
- **Subscribed Fields:**
  - `messages`
  - `messaging_postbacks`
  - `messaging_optins`
  - `message_reactions`

### Required Permissions (for App Review)
- `instagram_manage_messages` - Send and receive DMs
- `instagram_basic` - Access Instagram account info
- `pages_messaging` - Send messages via Page

---

## Troubleshooting

### "Token expired" or "Session invalid"
- Regenerate Page Access Token using steps above
- Page tokens from `/me/accounts` are long-lived

### "Cannot parse access token"
- You're using wrong token type (IGAAM... instead of EAA...)
- Get Page token from `/me/accounts` endpoint

### Messages not appearing in Control Panel
- Check `entry.messaging` AND `entry.changes` handling
- Verify Firestore connection

### Bot not responding in Instagram
- Check token has MESSAGING permission
- Verify webhook is subscribed to `messages` field

---

## Test Commands

### Verify Token Works
```bash
curl "https://graph.facebook.com/v18.0/me?access_token=YOUR_PAGE_TOKEN"
# Should return page name and ID
```

### Test Send Message
```bash
curl -X POST "https://graph.facebook.com/v18.0/me/messages?access_token=YOUR_PAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipient":{"id":"USER_IGSID"},"message":{"text":"Test"}}'
```

### Check Instagram Account Link
```bash
curl "https://graph.facebook.com/v18.0/PAGE_ID?fields=instagram_business_account&access_token=TOKEN"
```

---

## Important IDs

| Entity | ID |
|--------|-----|
| Facebook Page (ბებიას Bebias) | 241381986765713 |
| Instagram Business (bebias_handcrafted) | 17841424690552638 |

---

## Token Storage (Local Reference)
File: `.env.local.instagram-tokens`
- Contains backup of tokens for reference
- NOT committed to git

---

## Summary: Why It Works Now

1. **Correct token type**: Page Access Token (EAA...) not Instagram token (IGAAM...)
2. **Both webhook formats**: Handles `messaging[]` AND `changes[]`
3. **Page linked to Instagram**: ბებიას Bebias → bebias_handcrafted
4. **Permissions**: Page has MESSAGING task enabled
5. **Same bot logic**: Uses test-bot content files and GPT-4o
