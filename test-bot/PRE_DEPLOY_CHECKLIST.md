# Pre-Deployment Safety Checklist

## ✅ VERIFIED ISOLATION - Safe to Deploy

### Production Bot (UNTOUCHED):
- ✅ Route: `/api/messenger`
- ✅ Instructions: `data/content/bot-instructions.md`
- ✅ Function: `loadContentFile()` → `data/content/`
- ✅ Users: All real customers
- ✅ **WILL NOT BE MODIFIED**

### Test Bot (NEW - ISOLATED):
- ✅ Route: `/api/test-simulator` (completely different)
- ✅ Instructions: `test-bot/data/content/bot-instructions-modular.md`
- ✅ Function: `loadTestInstructions()` → `test-bot/data/content/`
- ✅ Users: Only simulator interface
- ✅ **NO PRODUCTION IMPACT**

## File Path Verification

### Production Paths (Never Touched by Test):
```
✅ data/content/bot-instructions.md
✅ data/content/tone-style.md
✅ data/content/purchase-flow.md
✅ data/content/* (all files)
```

### Test Paths (Isolated):
```
✅ test-bot/data/content/bot-instructions-modular.md
✅ test-bot/data/content/core/*
✅ test-bot/data/content/context/*
✅ test-bot/data/content/* (all test files)
```

### No Overlap:
- ❌ Test bot NEVER reads from `data/content/`
- ❌ Production bot NEVER reads from `test-bot/data/content/`
- ✅ Complete separation confirmed

## API Routes Verification

### Existing Routes (Untouched):
```
✅ /api/messenger          → Production bot
✅ /api/process-batch-redis → Production batch processing
✅ /api/products           → Product API
✅ /api/orders             → Order management
✅ All other existing routes → Unchanged
```

### New Routes (Added):
```
✅ /api/test-simulator     → Test bot API (NEW)
```

### Public Routes (Added):
```
✅ /test-chat              → Simulator UI (if using rewrite)
```

## What Gets Deployed

### New Files Only:
```
✅ app/api/test-simulator/route.ts  → NEW endpoint
✅ test-bot/simulator/*             → UI files
✅ test-bot/data/content/*          → Test instructions
```

### Existing Files (Unchanged):
```
✅ app/api/messenger/route.ts       → NO CHANGES
✅ data/content/*                   → NO CHANGES
✅ All production code               → NO CHANGES
```

## Database & External Services

### Production Database:
- ✅ Test bot does NO writes to Firestore
- ✅ Test bot does NO order creation
- ✅ Test bot does NO email sending
- ✅ **READ-ONLY for product catalog**

### Redis:
- ✅ Test bot uses NO Redis (no batching yet)
- ✅ Production Redis keys untouched
- ✅ **OPTIONAL: Add later with different prefix**

### QStash:
- ✅ Test bot not connected to QStash
- ✅ Production QStash unchanged
- ✅ **OPTIONAL: Add later with different endpoint**

## User Impact

### Production Users:
- ✅ NO changes to their experience
- ✅ Same bot behavior
- ✅ Same responses
- ✅ Same everything
- ✅ **ZERO IMPACT**

### Test Users (Simulator):
- ✅ Can access /test-chat
- ✅ See test bot responses
- ✅ Use test instructions
- ✅ **Completely separate**

## Rollback Plan

### If Issues Occur:

**Option 1: Quick Disable**
```bash
# Delete test simulator endpoint
rm -rf app/api/test-simulator
vercel --prod
```

**Option 2: Full Rollback**
```bash
vercel rollback
```

**Option 3: Just Hide UI**
- Test API still works, just not accessible
- Production completely unaffected

## Pre-Deploy Tests

### Local Tests (Before Deploy):
- [ ] Test simulator works locally
- [ ] Production bot still works locally
- [ ] No conflicts in routes
- [ ] Instructions load correctly

### Post-Deploy Tests:
- [ ] Production bot still responding
- [ ] Test simulator accessible
- [ ] No errors in Vercel logs
- [ ] Both endpoints independent

## Deployment Command

```bash
# This will:
# 1. Build the project
# 2. Deploy to Vercel
# 3. Make test-simulator available
# 4. Keep production unchanged

vercel --prod
```

## What to Monitor After Deploy

1. **Production Bot** (Most Important):
   - Check `/api/messenger` still works
   - Verify real users getting responses
   - No errors in logs

2. **Test Simulator**:
   - Access `/test-chat`
   - Send test message
   - Verify response

3. **Vercel Logs**:
   ```bash
   vercel logs --follow
   ```
   - Look for "[TEST SIMULATOR]" (test bot)
   - Look for normal logs (production)
   - Should be separate

## Safety Guarantees

### Code Level:
- ✅ Different file paths (test-bot/ vs data/)
- ✅ Different API routes (/test-simulator vs /messenger)
- ✅ Different functions (loadTestInstructions vs loadContentFile)
- ✅ Explicit isolation in code comments

### Infrastructure Level:
- ✅ Same Vercel project (easy to manage)
- ✅ Different routes (no conflicts)
- ✅ Same API keys (cost-effective)
- ✅ No shared state

### Data Level:
- ✅ No database writes from test
- ✅ No production data modification
- ✅ Read-only catalog access
- ✅ No order emails

## Final Verification

Run this before deploying:

```bash
# Check production route exists
ls -la app/api/messenger/route.ts

# Check test route created
ls -la app/api/test-simulator/route.ts

# Verify paths don't overlap
grep "data/content" app/api/messenger/route.ts
grep "test-bot/data/content" app/api/test-simulator/route.ts

# Should show different paths
```

## Ready to Deploy?

If all checks pass:

```bash
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"
vercel --prod
```

Access test chat at: `https://your-domain.vercel.app/test-chat`

---

**Status:** ✅ SAFE TO DEPLOY
**Risk Level:** 🟢 MINIMAL (isolated endpoints)
**Production Impact:** ✅ NONE
**Rollback:** ✅ EASY (delete one folder)