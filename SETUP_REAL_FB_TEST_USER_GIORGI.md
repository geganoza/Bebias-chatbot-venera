# Setup Real Facebook Test User "Giorgi" (Safe - Won't Affect Production)

## ✅ Safety Guarantee

Your test-bot system is **completely isolated**:
- Test webhook only responds to configured user IDs
- Production bot continues working normally for all other users
- No cross-contamination between test and production
- Test users get [TEST] prefix in responses for visibility

---

## Step-by-Step Setup

### Step 1: Create Facebook Test User

1. **Go to Facebook Developers:**
   - Open https://developers.facebook.com/apps
   - Select your BEBIAS app

2. **Create Test User:**
   - Click **Roles** → **Test Users** in left menu
   - Click **Add Test Users** or **Create Test Users**
   - Set:
     - Name: **Giorgi** (or **გიორგი**)
     - Number of users: **1**
   - Click **Create**

3. **Get User ID:**
   - Click on the newly created test user
   - Copy the **User ID** (looks like: `1234567890123456`)
   - Save this - you'll need it!

4. **Get Login Credentials:**
   - Click **Edit** on the test user
   - Note the **email** (e.g., `test_abc123@tfbnw.net`)
   - Click **Change Password** to set a password you'll remember
   - Or click "Login as this test user" to get auto-logged in

---

### Step 2: Update Test Config

Edit `/test-bot/config/test-config.json`:

```json
{
  "enabled": true,  // ← Change from false to true
  "description": "Test bot configuration - Giorgi test user active",

  "testUsers": [
    {
      "id": "PASTE_GIORGI_USER_ID_HERE",  // ← Paste the User ID from Step 1
      "name": "Giorgi (გიორგი)",
      "description": "Real Facebook test user for batching tests"
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

---

### Step 3: Activate Test Webhook

Copy the test webhook to active API route:

```bash
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"

# Create the API route directory
mkdir -p app/api/test-webhook

# Copy the reference file to active location
cp test-bot/api/test-webhook-REFERENCE-ONLY.ts app/api/test-webhook/route.ts
```

---

### Step 4: Deploy

```bash
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"
vercel --prod
```

---

### Step 5: Login as Test User Giorgi

1. **Open Incognito/Private Browser:**
   - Chrome: Ctrl+Shift+N (Windows) or Cmd+Shift+N (Mac)
   - Firefox: Ctrl+Shift+P or Cmd+Shift+P
   - Safari: Cmd+Shift+N

2. **Go to Facebook:**
   - Navigate to https://facebook.com
   - Login with test user credentials from Step 1

3. **Find BEBIAS Page:**
   - Search for "BEBIAS" or go to https://facebook.com/bebias.ge
   - Click **Message** button

4. **Send Test Messages:**
   - Send: "გამარჯობა"
   - Bot should respond with **[TEST]** prefix
   - This confirms test mode is working!

---

### Step 6: Test Message Batching

**Test Rapid Messages (within 1 second):**
```
გამარჯობა
მინდა ქუდი
შავი
```

**Expected:**
- Messages batched together
- One response handling all 3
- Check logs to see batching behavior

**Watch Logs:**
```bash
vercel logs --follow
```

Look for:
```
[TEST WEBHOOK] Processing message for test user: 1234567890123456
📦 Batching 3 messages together
```

---

## How It Works (Safety Mechanisms)

### Test Webhook Path:
```
/api/test-webhook  ← Only processes test users
```

### Production Webhook Path:
```
/api/webhook  ← Continues working for everyone else
```

### User ID Check:
```typescript
function isTestUser(userId: string): boolean {
  const testUsers = testConfig.testUsers || [];
  return testUsers.some(user => user.id === userId);
}

// Only test users get test instructions
// Everyone else → production bot (unchanged)
```

---

## What Happens

### For Giorgi (Test User):
✅ Messages go to `/api/test-webhook`
✅ Uses test-bot instructions from `/test-bot/data/content/`
✅ Gets `[TEST]` prefix in responses
✅ No real order emails sent
✅ Verbose logging for debugging
✅ Tests message batching with real Facebook delays

### For Real Customers:
✅ Messages go to `/api/webhook` (production)
✅ Uses production instructions
✅ No `[TEST]` prefix
✅ Real order emails sent
✅ Normal logging
✅ **COMPLETELY UNAFFECTED**

---

## Verification Checklist

Before testing:

- [ ] Created Facebook test user "Giorgi"
- [ ] Copied User ID
- [ ] Updated `test-bot/config/test-config.json` with User ID
- [ ] Set `enabled: true` in config
- [ ] Copied test webhook to `app/api/test-webhook/route.ts`
- [ ] Deployed with `vercel --prod`
- [ ] Logged in as Giorgi in incognito browser
- [ ] Ready to message BEBIAS page

After first message:

- [ ] Bot responds with `[TEST]` prefix
- [ ] Logs show `[TEST WEBHOOK]` messages
- [ ] Real customers still work normally

---

## Troubleshooting

### Bot doesn't respond to Giorgi:
1. Check User ID is correct in test-config.json
2. Check `enabled: true` in config
3. Check test webhook file is at `app/api/test-webhook/route.ts`
4. Check deployment succeeded
5. Check logs: `vercel logs --follow`

### Bot responds without [TEST] prefix:
- Giorgi is going through production webhook
- User ID might be wrong in config
- Test webhook might not be active

### Real customers affected:
**This should NOT happen** - the systems are isolated
- But if it does, set `enabled: false` immediately
- Check that production webhook isn't loading test config

---

## Quick Start Commands

```bash
# 1. Update config with Giorgi's User ID
code test-bot/config/test-config.json
# Set enabled: true and paste User ID

# 2. Activate test webhook
mkdir -p app/api/test-webhook
cp test-bot/api/test-webhook-REFERENCE-ONLY.ts app/api/test-webhook/route.ts

# 3. Deploy
vercel --prod

# 4. Watch logs
vercel logs --follow

# 5. Message as Giorgi (in incognito browser)
# Open facebook.com/bebias.ge
# Send: "გამარჯობა"
```

---

**Ready to start?**
Let me know when you've created the Facebook test user and I'll help you update the config with the User ID!
