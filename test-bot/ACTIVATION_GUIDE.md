# Test Bot Activation Guide

## Current Status: ⚠️ NOT ACTIVE

Everything is built and ready, but NOT connected to any users. Safe to continue working on production.

## When You're Ready to Activate

### Option 1: Separate Test Facebook App (Recommended)

**Safest approach** - Create a second Facebook App for testing:

1. **Create Test Facebook App:**
   - Go to Meta for Developers
   - Create new app
   - Set up Messenger product
   - Use same page or test page

2. **Point Test App to Test Webhook:**
   - Webhook URL: `https://your-domain.com/api/test-webhook`
   - Copy `test-bot/api/test-webhook-REFERENCE-ONLY.ts` to `app/api/test-webhook/route.ts`
   - Deploy

3. **Configure Test Users:**
   - Edit `test-bot/config/test-config.json`
   - Add Facebook user IDs
   - Set `enabled: true`

4. **Test:**
   - Message the page using test app
   - Bot uses test instructions
   - Production app unaffected!

### Option 2: User-Based Routing (Same App)

Use same Facebook App but route specific users to test bot:

1. **Copy Test Webhook:**
   ```bash
   cp test-bot/api/test-webhook-REFERENCE-ONLY.ts app/api/test-webhook/route.ts
   ```

2. **Modify Production Webhook:**
   Add routing logic to `app/api/messenger/route.ts`:
   ```typescript
   import testConfig from '../../test-bot/config/test-config.json';

   // At the start of POST handler:
   const senderId = messaging?.sender?.id;
   const isTestUser = testConfig.enabled &&
                     testConfig.testUsers.some(u => u.id === senderId);

   if (isTestUser) {
     // Forward to test webhook logic
     // Use test-bot instructions
   }
   ```

3. **Configure Test Users:**
   - Edit `test-bot/config/test-config.json`
   - Add test user Facebook IDs
   - Set `enabled: true`

4. **Deploy and Test**

### Option 3: Environment-Based (Staging Server)

Run test bot on separate server:

1. **Deploy to Staging:**
   - Deploy entire project to staging server
   - Point only test users to staging domain
   - Production remains on main domain

2. **Configure:**
   - Staging uses `test-bot/data/content/` files
   - Production uses `data/content/` files
   - Completely separated

## Pre-Activation Checklist

Before activating ANY option:

- [ ] Test users identified (have their Facebook IDs)
- [ ] `test-bot/config/test-config.json` configured
- [ ] All test instruction files reviewed
- [ ] Team knows test mode is active
- [ ] Rollback plan ready (just set enabled: false)

## Getting Facebook User IDs

When a user messages your page:
1. Check webhook payload logs
2. Look for `sender.id` field
3. Copy that ID to test config

Example from logs:
```json
{
  "sender": {
    "id": "1234567890123456"  // <-- This is the User ID
  }
}
```

## Testing Workflow

1. **Activate test mode** (choose option above)
2. **Verify test user can message bot**
3. **Check bot uses test instructions:**
   - Responses should have `[TEST]` prefix if debugMode is on
   - Check logs for "Using test instructions"
4. **Make changes to test-bot files**
5. **Test again** (may need to restart server)
6. **Iterate until perfect**
7. **Copy to production when ready**

## Safety Notes

✅ **Safe:**
- Editing files in `test-bot/` folder
- Testing with configured test users
- Experimenting with new flows

❌ **Not Safe (Don't Do Yet):**
- Deploying without testing
- Editing production files directly
- Adding all users as test users

## Rollback Process

If something goes wrong:

1. **Immediate:**
   - Set `enabled: false` in test config
   - Redeploy
   - All users back to production

2. **If Test Webhook Has Issues:**
   - Delete `app/api/test-webhook/route.ts`
   - Redeploy
   - Test route disappears

## Employee Access

Safe to give employees access to:
- ✅ Entire `test-bot/` folder
- ✅ All files in `test-bot/data/content/`
- ✅ They can edit freely - it's isolated
- ✅ Give them EMPLOYEE_GUIDE.md

Do NOT give access to:
- ❌ Production `data/content/` files
- ❌ Main webhook files
- ❌ Deployment access (until trained)

## Next Steps

1. Review this guide
2. Choose activation option
3. Get test user Facebook IDs
4. Configure test config
5. Activate when ready
6. Monitor test users
7. Iterate and improve
8. Deploy to production when stable

---

**Current Status:** Everything ready, nothing connected. Safe to continue production work.

**When Ready:** Follow Option 1 (Separate Facebook App) for maximum safety.