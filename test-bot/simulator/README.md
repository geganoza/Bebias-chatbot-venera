# 🧪 Local Messenger Simulator

## What Is This?

A **Facebook Messenger lookalike** that runs completely on your computer. Test your bot offline before connecting to real Facebook users!

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  You Type Here → Simulator → Test Bot → Response       │
│                      ↓                                  │
│              (No Facebook needed!)                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Features

✅ **Looks Like Real Messenger** - Familiar interface
✅ **Multiple Test Users** - Switch between different personas
✅ **Offline Testing** - No internet or Facebook required
✅ **Real Bot Logic** - Uses your actual test instructions
✅ **Quick Test Messages** - One-click common scenarios
✅ **Export Chats** - Save conversations for review
✅ **Debug Mode** - See what's happening behind the scenes

## How to Use

### Step 1: Activate the API (One-Time Setup)

**Copy the API endpoint:**
```bash
cp test-bot/simulator/api-endpoint-REFERENCE.ts app/api/test-simulator/route.ts
```

**Restart your Next.js server:**
```bash
npm run dev
```

### Step 2: Open the Simulator

**Option A: Direct File**
```bash
open test-bot/simulator/index.html
```

**Option B: Via Local Server**
Navigate to: `http://localhost:3000/test-bot/simulator/index.html`

### Step 3: Start Testing!

1. **Select a test user** from the sidebar
2. **Type a message** or click a quick action button
3. **See bot response** using your test instructions
4. **Iterate and improve!**

## Interface Guide

```
┌────────────┬──────────────────────────┬────────────────┐
│            │                          │                │
│  Test      │   Chat Messages          │  Settings &    │
│  Users     │                          │  Quick Actions │
│            │   [User] Message         │                │
│  • User 1  │   [Bot] Response        │  ☑ Test Mode   │
│  • User 2  │                          │  ☑ Debug       │
│  • User 3  │   [Input Box]            │                │
│  • User 4  │   [Send Button]          │  Quick Tests:  │
│            │                          │  👋 Greeting   │
│            │                          │  🧢 Order      │
│            │                          │  📦 Track      │
└────────────┴──────────────────────────┴────────────────┘
```

### Left Panel: Test Users
- 4 pre-configured test personas
- Click to switch between users
- Each user has separate conversation history
- Georgian and English name options

### Center Panel: Chat
- Messenger-like interface
- Your messages on right (blue)
- Bot responses on left (gray)
- Typing indicator when bot is thinking
- Timestamps (optional)

### Right Panel: Controls
- **Connection Status** - Shows you're in local mode
- **Test Configuration** - Toggle test instructions, debug mode
- **Quick Test Messages** - One-click common scenarios
- **Actions** - Clear chat, export conversation

## Quick Test Scenarios

### 1. Greeting Test
Click "👋 Greeting" button
- Tests: Opening message, tone, language

### 2. Product Order Test
Click "🧢 Order product" button
- Tests: Product catalog, image sending, delivery options

### 3. Order Lookup Test
Click "📦 Check order" button
- Tests: Order search, status checking, context awareness

### 4. Browse Products Test
Click "🔍 Browse products" button
- Tests: Product listing, recommendations

## Settings Explained

### Use Test Instructions ☑
- **ON**: Bot uses test-bot/data/content/ files
- **OFF**: Bot uses production data/content/ files
- **When to toggle**: Compare test vs production behavior

### Debug Mode ☑
- **ON**: Shows technical details in console
- **OFF**: Clean chat experience
- **When to toggle**: Troubleshooting issues

### Show Timestamps ☑
- **ON**: Shows time next to each message
- **OFF**: Clean interface
- **When to toggle**: Tracking conversation flow

## Features

### Clear Messages
- Removes all messages for current user
- Useful for starting fresh
- Each user's history is independent

### Export Chat
- Downloads conversation as .txt file
- Includes timestamps
- Format: `[Time] Sender: Message`
- Useful for: Bug reports, documentation, training

## How It Works

```
1. You type message in simulator
   ↓
2. Simulator sends to /api/test-simulator
   ↓
3. API loads test-bot instructions
   ↓
4. API processes with AI (or mock response)
   ↓
5. Response sent back to simulator
   ↓
6. You see bot's response
```

## Testing Workflow

### Basic Flow Test:
1. Open simulator
2. Click "👋 Greeting"
3. Verify warm Georgian response
4. Click "🧢 Order product"
5. Verify product shown with image
6. Type "1" (delivery option)
7. Verify total calculation
8. Continue order flow

### Context Retention Test:
1. Say "შავი ქუდი მინდა"
2. Bot shows black hat
3. Say "შავი" (just color)
4. Bot should remember = black hat
5. NOT "which black product?"

### Order Lookup Test:
1. Say "სად არის ჩემი შეკვეთა?"
2. Bot asks for order number/phone
3. Provide order number
4. Verify bot searches (won't find in test)
5. Check appropriate response

## Switching to Real Facebook

When you're ready to test with real Facebook:

### Option 1: Keep Both
- **Simulator** for quick local testing
- **Facebook Test Users** for real integration testing
- **Production** for live customers

### Option 2: Migrate to Facebook Test
1. Configure test users in config/test-config.json
2. Point Facebook webhook to /api/test-webhook
3. Test with real Messenger
4. Simulator still available for quick tests

## Troubleshooting

### "Failed to get response" Error
**Cause**: API endpoint not activated
**Fix**:
```bash
cp test-bot/simulator/api-endpoint-REFERENCE.ts app/api/test-simulator/route.ts
npm run dev
```

### Mock Responses Appearing
**Cause**: API not connected or error occurred
**Fix**: Check browser console for errors, verify API is running

### No Image Showing
**Cause**: Image path not configured
**Fix**: Check product catalog has image URLs, verify /api/products endpoint

### Bot Doesn't Remember Context
**Cause**: Each message is independent (stateless)
**Fix**: For full context, connect to your actual bot logic with conversation history

## Advanced Usage

### Testing Specific Scenarios

**Test Order Flow from Start to Finish:**
```
1. "შავი ქუდი მინდა"
2. "1" (standard delivery)
3. "თიბისი"
4. [Send fake payment screenshot]
5. Provide name, phone, address
6. Check order confirmation format
```

**Test Context Switching:**
```
1. "შავი ქუდი" → bot shows product
2. "სად არის ჩემი შეკვეთა?" → should NOT continue order
3. Should ask for order number instead
```

**Test Error Handling:**
```
1. Send gibberish
2. Send numbers only
3. Send very long message
4. Check bot handles gracefully
```

### Customizing Test Users

Edit `simulator.js`:
```javascript
const testUsers = [
    {
        id: 'my_test_user',
        name: 'My Test Name',
        avatar: 'MT',
        color: 'linear-gradient(135deg, #color1, #color2)'
    }
];
```

### Adding Quick Actions

Edit `index.html`, find `<div class="quick-actions">`:
```html
<button class="quick-action-btn" data-message="Your test message">
    🎯 Your Label
</button>
```

## Benefits

### For You:
- ✅ Test offline, anytime
- ✅ No Facebook setup needed
- ✅ Fast iteration
- ✅ Safe experimentation

### For Team:
- ✅ Anyone can test
- ✅ No risk to production
- ✅ Easy to demonstrate
- ✅ Export conversations for review

### For Development:
- ✅ Quick feedback loop
- ✅ Test edge cases easily
- ✅ Debug with full control
- ✅ Document test scenarios

## Next Steps

1. **Activate API** - Copy endpoint file
2. **Open Simulator** - test-bot/simulator/index.html
3. **Test Basic Flow** - Use quick actions
4. **Test Full Scenarios** - Complete order flows
5. **Export Results** - Save for documentation
6. **Move to Real FB** - When ready

---

**Status:** ✅ Ready to use (after API activation)
**Location:** test-bot/simulator/
**No Facebook Required:** Works 100% offline