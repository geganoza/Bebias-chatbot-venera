# Test Bot - Isolated Testing Environment

## Overview
This is a **completely separate** bot environment for testing new instruction structures and flows without affecting production users.

## Structure
```
test-bot/
├── data/content/          # All instruction files (modular version)
│   ├── bot-instructions-modular.md  # Main instructions
│   ├── core/              # Core modules
│   ├── context/           # Context modules
│   └── [all other .md files]
├── config/
│   └── test-config.json   # Test user configuration
├── api/
│   └── test-webhook.ts    # Separate webhook endpoint
└── README.md              # This file
```

## Key Features
- ✅ **Completely isolated** from production
- ✅ **Separate webhook** endpoint (/api/test-webhook)
- ✅ **Modular instructions** - easy to edit individual flows
- ✅ **Safe for employees** - they can edit test instructions without fear
- ✅ **No production impact** - production users never affected

## How to Use

### Step 1: Configure Test Users
Edit `config/test-config.json` and add Facebook user IDs who should use the test bot:

```json
{
  "testUsers": [
    "FACEBOOK_USER_ID_1",
    "FACEBOOK_USER_ID_2"
  ],
  "features": {
    "debugMode": true,
    "skipOrderEmails": true
  }
}
```

### Step 2: Set Up Test Webhook (When Ready)

⚠️ **DO NOT DO THIS YET** - This is for when you're ready to activate

1. Point Facebook webhook to: `https://your-domain.com/api/test-webhook`
2. Or use separate test Facebook app pointing to test webhook
3. Test users will hit the test webhook, production users stay on `/api/messenger`

### Step 3: Edit Instructions Freely

You and your employees can safely edit files in `test-bot/data/content/`:

**Want to change order flow?**
- Edit `core/order-flow-steps.md`

**Want to adjust tone rules?**
- Edit main `bot-instructions-modular.md` (critical rules)
- Or edit full details in `tone-style.md`

**Want to modify context awareness?**
- Edit `context/context-awareness-rules.md`

All changes only affect test users!

## Testing Checklist

Before going live with changes:
- [ ] Test complete order flow
- [ ] Test order lookup
- [ ] Test image handling
- [ ] Test context retention
- [ ] Test payment verification
- [ ] Test error scenarios
- [ ] Test with multiple test users

## Deploying to Production

When test instructions are stable and working:

1. Copy tested files from `test-bot/data/content/` to main `data/content/`
2. Deploy normally
3. All users get the improved bot!

## Safety Notes

- This folder is 100% isolated
- Editing here CANNOT break production
- Perfect for training employees
- Easy rollback - just don't deploy test files

---

**Current Status:** ✅ Built and ready - NOT connected to any users yet