# Get Instagram Access Token - Step by Step

## Method 1: Graph API Explorer (Easiest)

### Step 1: Open Graph API Explorer
Go to: https://developers.facebook.com/tools/explorer

### Step 2: Configure Settings

1. **Select Your App**:
   - Click dropdown at top (currently says "VENERA" or "Graph API Explorer")
   - Select **"VENERA"** (your app)

2. **Change Endpoint**:
   - Click the dropdown that says `graph.instagram.com/`
   - Change to just blank or `graph.facebook.com`
   - Or just remove the `.instagram` part

3. **Set Path**:
   - In the path field, enter: `/me/accounts`

### Step 3: Add Permissions

Click "Add a Permission" (or the permissions section):

**Required Instagram Permissions**:
- ✅ `instagram_basic`
- ✅ `instagram_manage_messages`
- ✅ `instagram_manage_comments` (optional)

**Required Pages Permissions**:
- ✅ `pages_show_list`
- ✅ `pages_messaging`
- ✅ `pages_manage_metadata`
- ✅ `pages_read_engagement`

### Step 4: Generate Token

1. Click **"Generate Access Token"** (blue button on right)
2. Facebook will show a popup asking you to:
   - Select your Facebook Page (BEBIAS)
   - Confirm Instagram account connection
   - Grant the permissions
3. Click **"Continue"** and **"Done"**

### Step 5: Get Token

After the popup closes:
- Look at the "Access Token" field at the top right
- You should see a long token starting with `EAAA...`
- Click the copy icon next to it
- **Save this token somewhere safe!**

### Step 6: Test Your Token

Click **"Submit"** button to test the `/me/accounts` request.

You should see a response like:
```json
{
  "data": [
    {
      "access_token": "EAAA...",  ← This is your Page token
      "category": "Shopping & Retail",
      "name": "BEBIAS",
      "id": "123456789",
      "tasks": ["ANALYZE", "ADVERTISE", "MODERATE", "CREATE_CONTENT", "MANAGE"]
    }
  ]
}
```

**The `access_token` inside the data array is what you need!**

### Step 7: Get Instagram Account ID

Change the path to:
```
/{PAGE_ID}?fields=instagram_business_account
```

Replace `{PAGE_ID}` with the `id` from Step 6.

Click Submit. You should see:
```json
{
  "instagram_business_account": {
    "id": "17841234567890"  ← Your Instagram Account ID
  },
  "id": "123456789"
}
```

**Save this Instagram Account ID too!**

---

## Method 2: From App Dashboard

### Step 1: Go to App Settings
https://developers.facebook.com/apps/

### Step 2: Select VENERA App

### Step 3: Add Instagram Product
- Left sidebar → "Add Product"
- Find "Instagram" → Click "Set Up"

### Step 4: Configure Instagram
- Left sidebar → Instagram → Configuration
- Follow the prompts to connect your Instagram account

### Step 5: Get Token
- Scroll to "Token Generation"
- Select your Page from dropdown
- Click "Generate Token"
- Copy the token

---

## Method 3: Business Settings (Most Reliable for Production)

### Step 1: Go to Business Settings
https://business.facebook.com/settings

### Step 2: System Users
- Left sidebar → "System Users" (under Users section)
- Click "Add" to create a new System User
  - Name: "BEBIAS Chatbot"
  - Role: Admin

### Step 3: Generate Token
- Click on the System User you created
- Click "Generate New Token"
- Select your app: **VENERA**
- Select permissions:
  - instagram_basic
  - instagram_manage_messages
  - pages_manage_metadata
  - pages_messaging
- Select which Page: **BEBIAS**
- Click "Generate Token"

### Step 4: Save Token
- Copy the token (starts with EAAA...)
- Store it securely
- **This token doesn't expire!** (as long as System User exists)

---

## Troubleshooting

### "Invalid OAuth access token"
- Token copied incorrectly (extra spaces, line breaks)
- Token expired
- Wrong type of token (User token instead of Page token)

**Solution**: Generate fresh token using Method 1 above

### "Invalid platform app"
- Using `graph.instagram.com` instead of `graph.facebook.com`
- Missing Instagram permissions

**Solution**: Use `graph.facebook.com` and add instagram permissions

### "Instagram account not found"
- Instagram not connected to Facebook Page
- Not a Business/Creator account

**Solution**:
1. Go to Facebook Page Settings → Instagram
2. Click "Connect Account"
3. Switch Instagram to Business/Creator account if needed

---

## Quick Test Commands

After you get a token, test it:

```bash
# Test 1: Get account info
curl "https://graph.facebook.com/v24.0/me?access_token=YOUR_TOKEN"

# Test 2: Get Instagram account
curl "https://graph.facebook.com/v24.0/me?fields=instagram_business_account&access_token=YOUR_TOKEN"

# Test 3: Send test message (replace IGSID with recipient ID)
curl -X POST "https://graph.facebook.com/v24.0/me/messages?access_token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipient":{"id":"IGSID"},"message":{"text":"Test from API"}}'
```

---

## What Token Should Look Like

**Valid token format**:
```
EAAA[lots of random characters]
```

**Length**: Usually 150-300 characters

**Example** (fake):
```
EAABsbCS1iHgBO7Hzp5ZBkQZCZBZAqB9LDe8wZAyKXINDBI5xdqeRZAVkkLZCCkxkDimT...
```

**NOT valid**:
- Starts with `IG` (that's an Instagram Graph API token, different format)
- Contains spaces or line breaks
- Very short (< 100 characters)

---

## Next Steps After Getting Token

1. Add to environment variables:
```bash
vercel env add INSTAGRAM_PAGE_ACCESS_TOKEN production
# Paste token when prompted
```

2. Add to .env.local:
```bash
echo "INSTAGRAM_PAGE_ACCESS_TOKEN=YOUR_TOKEN_HERE" >> .env.local
```

3. Deploy:
```bash
vercel --prod
```

4. Test webhook:
```bash
curl "https://bebias-venera-chatbot.vercel.app/api/instagram?hub.mode=subscribe&hub.verify_token=ig_webhook_bebias_2025_secure_token_xyz789&hub.challenge=test123"
```

Should return: `test123`

---

## Need Help?

If you're still having issues:
1. Share a screenshot of the Graph API Explorer
2. Check that Instagram is connected to your Page
3. Verify your Instagram account is Business/Creator type
4. Check App Review status for Instagram permissions
