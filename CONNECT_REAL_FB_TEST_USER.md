# How to Connect a Real Facebook Test User to Your Bot

## Current Status
✅ You have the test-bot system working with mock users
✅ You want to test with 1 REAL Facebook Messenger test user
✅ Goal: Test message batching with real Facebook messages

---

## Option 1: Use Your Personal Account (Quickest)

### Step 1: Go to Your Facebook Page
1. Go to https://facebook.com/bebias.ge
2. Make sure you're logged in as a page admin

### Step 2: Send Message to Your Page
1. Open Messenger
2. Search for "BEBIAS"
3. Send a message to your own page
4. Your messages will trigger the webhook!

**Pros:**
- ✅ Instant - no setup needed
- ✅ Real Facebook messages
- ✅ Tests actual batching behavior

**Cons:**
- ⚠️ Your messages will be in the production inbox
- ⚠️ Can't reset conversation easily

---

## Option 2: Create a Facebook Test User (Recommended)

### Step 1: Create Test User in Facebook App
1. Go to https://developers.facebook.com/apps
2. Select your app (BEBIAS Chatbot app)
3. Go to **Roles** → **Test Users** in left menu
4. Click **Add** or **Create Test Users**
5. Create 1 test user
6. Note the test user's email and password

### Step 2: Login as Test User
1. Open an **Incognito/Private window**
2. Go to https://facebook.com
3. Login with test user credentials
4. Accept any permissions

### Step 3: Find Your Page as Test User
1. In the test user's Facebook, search for "BEBIAS"
2. Or go directly to: https://facebook.com/bebias.ge
3. Click "Message" button
4. Send a test message!

### Step 4: Verify It's Working
Check your webhook is receiving messages:
```bash
vercel logs bebias-venera-chatbot.vercel.app --since 5m
```

You should see:
```
📨 Received webhook event
Processing message from test user
```

**Pros:**
- ✅ Clean test environment
- ✅ Can reset easily
- ✅ Doesn't pollute production inbox
- ✅ Real Facebook message batching

**Cons:**
- ⏱️ Takes 5-10 minutes to set up

---

## Option 3: Use Instagram Test Account (Alternative)

If your bot also works with Instagram:

### Step 1: Create Instagram Test Account
1. Go to https://developers.facebook.com/apps
2. Select your app
3. Instagram → **Roles** → **Instagram Testers**
4. Add a test Instagram account

### Step 2: Message Your Instagram
1. Login to test Instagram account
2. Go to @bebias.ge
3. Send a DM

---

## Testing Message Batching

Once connected, test batching by:

### Test 1: Rapid Messages (Same Second)
Send these messages quickly (within 1 second):
```
გამარჯობა
მინდა ქუდი
შავი
```

**Expected behavior:**
- Bot should batch these together
- Process as one group
- Respond once with context of all 3 messages

### Test 2: Spaced Messages (3+ seconds apart)
Send message 1:
```
გამარჯობა
```

Wait 5 seconds, then send message 2:
```
მინდა ქუდი
```

**Expected behavior:**
- Message 1 processed immediately
- Message 2 processed as separate batch
- Two separate responses

### Test 3: Image + Text
Send an image, then immediately send:
```
ეს რა არის?
```

**Expected behavior:**
- Both batched together
- Bot identifies image with context from text

---

## Checking Batch Behavior in Logs

### View Real-Time Logs:
```bash
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"
vercel logs --follow
```

### Look for Batch Indicators:
```
✅ GOOD (batching working):
📦 Batching 3 messages together
Processing batch for user: 1234567890
Combined message: "გამარჯობა მინდა ქუდი შავი"

❌ BAD (not batching):
Processing message: "გამარჯობა"
Processing message: "მინდა ქუდი"
Processing message: "შავი"
```

---

## Current Batching Configuration

Your bot uses Redis for batching. Check current config:

```bash
# Check if Redis batching is enabled
cat .env.local | grep BATCH
```

Should show:
```
REDIS_BATCH_ENABLED=true
REDIS_BATCH_WINDOW_MS=1000  # 1 second window
```

---

## Recommended: Option 2 (Facebook Test User)

**Steps:**
1. Create 1 Facebook test user (5 minutes)
2. Login as test user in incognito window
3. Message BEBIAS page
4. Watch logs: `vercel logs --follow`
5. Test rapid messages to see batching

**Why this is best:**
- ✅ Real Facebook Messenger behavior
- ✅ Tests actual webhook batching
- ✅ Clean test environment
- ✅ Easy to reset/repeat tests
- ✅ Doesn't affect production inbox

---

## Quick Start (Recommended Path)

```bash
# Terminal 1: Watch logs
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"
vercel logs --follow

# Browser: Create test user
# 1. https://developers.facebook.com/apps
# 2. Your App → Roles → Test Users → Create
# 3. Login as test user (incognito)
# 4. Message bebias.ge
# 5. Watch Terminal 1 for batching behavior
```

---

**Which option do you want to use?**
1. Personal account (instant but messy)
2. Facebook test user (recommended, 5 min setup)
3. Instagram test account (if available)
