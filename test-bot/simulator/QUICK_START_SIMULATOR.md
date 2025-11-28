# 🧪 Local Simulator - 3-Minute Quick Start

## What You Get

A **Facebook Messenger lookalike** running on your computer. Chat with your bot completely offline!

## Super Quick Setup (3 commands)

```bash
# 1. Run activation script
./test-bot/simulator/activate-simulator.sh

# 2. Start dev server
npm run dev

# 3. Open simulator
open test-bot/simulator/index.html
```

**That's it!** Start chatting immediately.

## Manual Setup (if script doesn't work)

```bash
# Copy API endpoint
cp test-bot/simulator/api-endpoint-REFERENCE.ts app/api/test-simulator/route.ts

# Start server
npm run dev

# Open in browser
open test-bot/simulator/index.html
```

## First Test

1. **Click a test user** (left sidebar)
2. **Click "👋 Greeting"** button
3. **See bot respond** in Georgian!
4. **Type your own message**
5. **Keep chatting!**

## Interface Overview

```
┌──────────┬────────────────┬─────────────┐
│  Users   │   Chat         │   Actions   │
├──────────┼────────────────┼─────────────┤
│          │                │             │
│  Click   │  Type here →   │  Quick      │
│  user    │  Get response  │  test       │
│  here    │                │  buttons    │
│          │                │             │
└──────────┴────────────────┴─────────────┘
```

## Quick Test Buttons

- **👋 Greeting** - "გამარჯობა"
- **🧢 Order** - "შავი ქუდი მინდა"
- **📦 Track** - "სად არის ჩემი შეკვეთა?"
- **🔍 Browse** - "რა ქუდები გაქვთ?"

## What Gets Tested

✅ **Test Bot Instructions** - From test-bot/data/content/
✅ **Tone & Language** - Georgian grandmother voice
✅ **Product Catalog** - Your products
✅ **Order Flow** - Complete purchase process
✅ **Context Awareness** - Bot remembers conversation
✅ **Image Sending** - SEND_IMAGE commands

## Settings

- ☑ **Use Test Instructions** - Uses test-bot files
- ☑ **Debug Mode** - Shows technical details
- ☑ **Show Timestamps** - Time on messages

## Tips

💡 **Switch users** to test different conversations
💡 **Clear messages** to start fresh
💡 **Export chat** to save conversation
💡 **Check console** (F12) for debug info

## Moving to Real Facebook

When simulator works well:

1. **Keep simulator** for quick tests
2. **Activate Facebook webhook** for real users
3. **Best of both worlds!**

See `../ACTIVATION_GUIDE.md` for Facebook setup.

## Troubleshooting

### "Failed to get response"
→ Server not running. Run `npm run dev`

### Mock responses appearing
→ API not activated. Run activation script

### No test users showing
→ Open index.html in browser correctly

## Benefits

✅ **No Facebook needed** - Test offline
✅ **Instant feedback** - See changes immediately
✅ **Safe** - No real users affected
✅ **Fast** - No deployment needed

---

**Next:** Full guide at `README.md`
**Help:** Open an issue or check docs