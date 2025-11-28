# Test Bot - Quick Start

## ✅ What's Been Built

A complete, isolated test environment for safely testing bot improvements.

```
┌─────────────────────────────────────────────────────────────┐
│                     PRODUCTION BOT                           │
│  (/data/content/)                                           │
│  ✅ Running normally                                         │
│  ✅ All real users                                          │
│  ✅ Completely unaffected                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      TEST BOT                                │
│  (/test-bot/)                                               │
│  ⚠️  NOT connected yet                                      │
│  ✅ Modular instructions ready                              │
│  ✅ Safe for employees to edit                              │
│  ✅ Ready to activate when you want                         │
│  🧪 LOCAL SIMULATOR - Test offline!                         │
└─────────────────────────────────────────────────────────────┘
```

## 📂 What's Inside test-bot/

```
test-bot/
├── 📘 INDEX.md                 ← Complete overview
├── 📗 README.md                ← Quick intro
├── 📙 ACTIVATION_GUIDE.md      ← For you (owner)
├── 📕 EMPLOYEE_GUIDE.md        ← For your team
│
├── 🧪 simulator/               ← NEW! Test offline
│   ├── index.html             ← Messenger lookalike
│   ├── simulator.js           ← Chat functionality
│   ├── api-endpoint-REFERENCE.ts
│   └── README.md              ← How to use
│
├── 📁 data/content/            ← EDIT THESE FREELY
│   ├── 📝 bot-instructions-modular.md
│   ├── 📁 core/                ← Order flow, critical rules
│   ├── 📁 context/             ← Context awareness
│   └── 📝 [all other .md files]
│
├── 📁 config/
│   └── ⚙️ test-config.json     ← Test user settings
│
└── 📁 api/
    └── 🔌 test-webhook-REFERENCE-ONLY.ts
```

## 🎯 For You (Owner):

**Read These:**
1. INDEX.md - Complete overview
2. simulator/README.md - **NEW! Test offline first**
3. ACTIVATION_GUIDE.md - How to activate with Facebook
4. test-config.json - Where to add test users

**Quick Start (No Facebook Needed!):**
1. Copy simulator/api-endpoint-REFERENCE.ts to app/api/test-simulator/route.ts
2. Run `npm run dev`
3. Open simulator/index.html in browser
4. **Start chatting immediately!**

**When Ready for Real Facebook:**
1. Get Facebook User IDs for test users
2. Add them to config/test-config.json
3. Follow ACTIVATION_GUIDE.md
4. Deploy and test!

## 👥 For Your Employees:

**Give Them:**
- ✅ Access to entire `test-bot/` folder
- ✅ EMPLOYEE_GUIDE.md to read
- ✅ Permission to edit any .md file in data/content/

**They Can Safely:**
- Edit order flow
- Modify tone rules
- Update context awareness
- Experiment freely

**They Cannot Break:**
- Production bot (totally separate)
- Real customer experience
- Anything outside test-bot/

## 🚀 3 Ways to Activate

### Option 1: Separate Test Facebook App (Safest)
- Create second Facebook App
- Point it to test webhook
- Test users use test app
- **Recommended for first time**

### Option 2: User-Based Routing (Same App)
- Same Facebook App
- Route specific users to test bot
- Based on Facebook User ID
- **Good for gradual testing**

### Option 3: Staging Server
- Deploy to separate server
- Completely isolated
- **Best for major changes**

**Details:** See ACTIVATION_GUIDE.md

## 📝 Editing Instructions

### Common Edits:

**Change Order Flow:**
→ Edit `data/content/core/order-flow-steps.md`

**Update Tone:**
→ Edit `data/content/bot-instructions-modular.md` (top section)

**Improve Context:**
→ Edit `data/content/context/context-awareness-rules.md`

**Modify Critical Rules:**
→ Edit `data/content/core/critical-rules.md`

## 🔒 Safety Guarantees

✅ **100% Isolated** - Test bot cannot affect production
✅ **Not Connected** - No users using it yet
✅ **Easy Rollback** - One setting change to disable
✅ **Employee Safe** - They can't break production

## ⚡ Next Steps

1. **Today:** Review documentation
2. **When Ready:** Add test users to config
3. **Activate:** Follow activation guide
4. **Test:** Make changes and verify
5. **Deploy:** Copy working changes to production

## 📞 Quick Reference

| I want to... | Do this... |
|-------------|------------|
| Understand the system | Read INDEX.md |
| Activate test bot | Read ACTIVATION_GUIDE.md |
| Edit instructions | Read EMPLOYEE_GUIDE.md |
| Configure test users | Edit config/test-config.json |
| Change order flow | Edit data/content/core/order-flow-steps.md |

## 🎉 Benefits

### For You:
- Test changes safely before going live
- No risk to production customers
- Easy to roll back if issues
- Clear separation of test/production

### For Employees:
- Learn by doing
- No fear of breaking things
- Immediate feedback
- Build confidence

### For Business:
- Better bot quality
- Faster improvements
- Less customer-facing bugs
- Team can contribute safely

---

**Current Status:** ✅ Built, documented, and ready
**Connected:** ❌ Not yet (intentionally)
**Safe to Use:** ✅ Completely safe
**Next Action:** Review docs, activate when ready

**Start Here:** Read INDEX.md for complete overview