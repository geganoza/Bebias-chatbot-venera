# Instagram Permission Fix - URGENT

## Current Issue
Instagram webhooks are NOT receiving messages because the app lacks required permissions.

### What's Working ✅
- Webhook verification endpoint works (returns challenge)
- App is subscribed to messages
- Webhook URL is correct: https://bebias-venera-chatbot.vercel.app/api/instagram

### What's Broken ❌
- Instagram messages are NOT being forwarded to webhook
- Token lacks Instagram permissions
- Cannot access Instagram Business Account data

## Required Permissions

The app needs these permissions to receive Instagram DMs:

1. **pages_read_engagement** (CRITICAL - Missing)
2. **instagram_basic** (Missing)
3. **instagram_manage_messages** (Missing)

## How to Fix - Step by Step

### Option 1: Add Permissions via Facebook Developer Console

1. Go to: https://developers.facebook.com/apps/841886395457546/app-review/permissions-and-features/

2. Request Advanced Access for:
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_manage_messages`

3. Since you're an admin, you can test immediately after adding permissions (no review needed for admins)

### Option 2: Quick Test Mode Fix

1. Go to: https://developers.facebook.com/apps/841886395457546/settings/basic/

2. Add yourself and test users to "Roles" → "Test Users"

3. Go to App Review → Permissions and Features

4. Toggle ON these permissions for testing:
   - pages_read_engagement
   - instagram_basic
   - instagram_manage_messages

### After Adding Permissions

1. Generate a new Page Access Token with the new permissions:
   ```
   https://developers.facebook.com/tools/explorer/?method=GET&path=me%2Faccounts&version=v24.0
   ```

2. Select your app "VENERA"

3. Add these permissions:
   - pages_show_list
   - pages_read_engagement
   - instagram_basic
   - instagram_manage_messages

4. Click "Generate Access Token"

5. Update the environment variable:
   ```bash
   vercel env rm INSTAGRAM_PAGE_ACCESS_TOKEN production --yes
   echo -n "YOUR_NEW_TOKEN" | vercel env add INSTAGRAM_PAGE_ACCESS_TOKEN production
   ```

6. Redeploy:
   ```bash
   vercel --prod
   ```

## Test After Fix

Run this to verify permissions:
```bash
TOKEN="YOUR_NEW_TOKEN"
curl -s "https://graph.facebook.com/v24.0/me/permissions?access_token=$TOKEN" | jq '.'
```

You should see:
```json
{
  "data": [
    {"permission": "pages_read_engagement", "status": "granted"},
    {"permission": "instagram_basic", "status": "granted"},
    {"permission": "instagram_manage_messages", "status": "granted"}
  ]
}
```

## Current Error Messages

```
"(#100) Object does not exist, cannot be loaded due to missing permission... This endpoint requires the 'pages_read_engagement' permission"

"(#3) Application does not have the granular permission to make this API call"
```

## Why This Happens

Facebook/Instagram requires explicit permissions for:
- Reading Instagram business account info
- Subscribing to Instagram webhooks
- Receiving Instagram messages

Even though you're an admin, the APP itself needs these permissions granted.

## Quick Check Command

After adding permissions and getting new token:
```bash
bash scripts/verify-instagram-ready.sh
```

This should show:
- All permissions listed
- Instagram account accessible
- Webhook subscribed

## Need Help?

If permissions don't appear or you can't add them:
1. Check if app is in Development or Live mode
2. For Development mode, you can test as admin immediately
3. For Live mode, may need App Review approval

The webhook code is ready and working - it just needs the permissions to receive Instagram messages!