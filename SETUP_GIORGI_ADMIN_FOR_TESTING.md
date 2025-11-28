# Setup Giorgi (Page Admin) for Safe Testing

## ✅ Even Simpler - Giorgi is Already an Admin!

Since Giorgi is already a page admin, we can use his real Facebook account for testing **without creating a test user**.

---

## How to Get Giorgi's Facebook User ID

### Option 1: Message the Page and Check Logs

**Step 1:** Giorgi sends a message to BEBIAS page
```
გამარჯობა
```

**Step 2:** Check webhook logs to see the User ID:
```bash
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"
vercel logs --since 5m
```

Look for:
```
Sender ID: 1234567890123456  ← This is Giorgi's User ID
```

### Option 2: Use Facebook Graph API Explorer

1. Go to https://developers.facebook.com/tools/explorer
2. Select your BEBIAS app
3. Get User Access Token
4. Make request: `GET /me`
5. Copy the `id` field

### Option 3: Check Page Insights

1. Go to https://facebook.com/bebias.ge
2. Settings → Page Roles
3. Find Giorgi's profile
4. The URL will contain his User ID

---

## Quick Setup (3 Steps)

### Step 1: Get Giorgi's User ID

Use Option 1 above - just message the page and check logs for the ID.

### Step 2: Update Test Config

Edit `test-bot/config/test-config.json`:

```json
{
  "enabled": true,
  "description": "Giorgi (admin) configured for safe testing",

  "testUsers": [
    {
      "id": "PASTE_GIORGI_USER_ID_HERE",
      "name": "Giorgi Nozadze (Admin)",
      "description": "Page admin - safe for testing"
    }
  ],

  "features": {
    "debugMode": true,
    "skipOrderEmails": true,
    "verboseLogging": true,
    "showInstructionSource": false
  },

  "instructions": {
    "basePath": "./test-bot/data/content",
    "mainFile": "bot-instructions-modular.md",
    "useModularSystem": true
  }
}
```

### Step 3: Activate Test Webhook

```bash
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"

# Create directory
mkdir -p app/api/test-webhook

# Copy test webhook
cp test-bot/api/test-webhook-REFERENCE-ONLY.ts app/api/test-webhook/route.ts

# Deploy
vercel --prod
```

---

## Testing Process

### First Message (Get User ID):
1. Giorgi messages BEBIAS page: "test"
2. Check logs: `vercel logs --follow`
3. Copy User ID from logs
4. Add to `test-bot/config/test-config.json`
5. Deploy again: `vercel --prod`

### Second Message (Test Mode Active):
1. Giorgi messages again: "გამარჯობა"
2. Should see `[TEST]` prefix in response
3. Bot uses test-bot instructions
4. Ready to test batching!

### Test Batching:
Send rapidly:
```
გამარჯობა
მინდა ქუდი
შავი
```

Check logs for:
```
[TEST WEBHOOK] Processing message for test user
📦 Batching 3 messages together
```

---

## Safety - Will This Affect Real Customers?

**NO! Here's why:**

### Current State (Before Setup):
- **Everyone** (including Giorgi) → Production webhook
- Uses production instructions
- Real customers get normal service

### After Setup (Giorgi in test config):
- **Giorgi ONLY** → Test webhook with [TEST] prefix
- Uses test-bot instructions
- **All other customers** → Production webhook (unchanged!)

### How It Works:
```typescript
// In test webhook route.ts
function isTestUser(userId: string): boolean {
  // Only returns true for User IDs in test-config.json
  return testConfig.testUsers.some(user => user.id === userId);
}

// Giorgi's messages:
if (isTestUser(giorgiId)) {
  // → Test webhook → [TEST] responses
}

// All other customers:
else {
  // → Production webhook → Normal service
}
```

---

## Alternative: Use Separate Test Account

If you prefer to keep Giorgi's main account for production testing:

1. **Create a second Facebook account** (personal, not test user)
2. **Make it a page admin** of BEBIAS
3. **Use that account's ID** in test config

**Benefits:**
- Giorgi's main account still gets production bot
- Test account gets test bot
- Clean separation

---

## Current Status

**To activate:**

1. ✅ You already have: Test-bot instructions restructured
2. ✅ You already have: Test config file ready
3. ⏳ **Need to do:** Get Giorgi's User ID
4. ⏳ **Need to do:** Add ID to config
5. ⏳ **Need to do:** Copy test webhook to app/api/
6. ⏳ **Need to do:** Deploy

**Want me to help you get Giorgi's User ID from the logs?**

Just have Giorgi send one message to the page and run:
```bash
vercel logs --since 5m
```

I'll help you find the User ID in the output!
