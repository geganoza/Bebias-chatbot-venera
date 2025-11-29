# BEBIAS VENERA Chatbot - Deployment Architecture

**Last Updated:** 2025-11-29
**Status:** PRODUCTION ACTIVE

## Overview

This document explains the deployment architecture, folder structure, and why we use the beta_2 folder as the primary deployment source.

---

## Folder Structure

### 1. Parent Folder: `BEBIAS CHATBOT VENERA`
**Location:** `/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA`
**Purpose:** Legacy/archive version
**Status:** NOT actively deployed (last deployment 1+ day ago)

**Characteristics:**
- Older bot instructions (244 lines)
- Has QStash but NO Redis batching
- Missing Bug #5 fixes (ORDER_NUMBER placeholder, email improvements)
- Not used for production deployments

### 2. Beta_2 Folder: `BEBIAS CHATBOT VENERA beta_2` ✅ ACTIVE
**Location:** `/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2`
**Purpose:** PRIMARY PRODUCTION DEPLOYMENT
**Status:** ACTIVE (deployed ~1 hour ago as of 2025-11-29 23:00 UTC)

**Characteristics:**
- Enhanced bot instructions (378 lines)
- Redis message batching enabled
- Complete order processing with Bug #5 fixes
- Image recognition with GPT-4o
- All recent improvements and fixes

---

## Vercel Deployment

### Single Project Architecture

**IMPORTANT:** Both folders deploy to the **SAME** Vercel project:
- **Project ID:** `prj_GWUiiyNYDTkTpMRQ62Y3meRQsAYJ`
- **Project Name:** `bebias-venera-chatbot`
- **Production URL:** https://bebias-venera-chatbot.vercel.app

**How it works:**
- Whichever folder deploys LAST becomes the active production version
- Currently: beta_2 is the active deployment
- No separate test/production URLs - same domain for all

---

## Feature Flag System

### Redis Batching Rollout

**File:** `lib/featureFlags.ts`

```typescript
const FEATURES = {
  REDIS_MESSAGE_BATCHING: {
    enabled: process.env.ENABLE_REDIS_BATCHING?.trim() === 'true',
    testUsers: TEST_USER_IDS,
    rolloutPercentage: 100, // 100% rollout - all users
  }
};
```

**Current Configuration (as of 2025-11-29):**
- `ENABLE_REDIS_BATCHING="true"` (set in Vercel environment variables)
- `rolloutPercentage: 100` (all users get Redis batching)
- Test user still in array for future testing: `['3282789748459241']`

**How Routing Works:**
1. All FB Messenger messages hit same webhook
2. Code checks `isFeatureEnabled('REDIS_MESSAGE_BATCHING', userId)`
3. If enabled + (user in test array OR within rollout %):
   - Use Redis batching flow
   - Messages aggregated for 3 seconds
   - Process via `/api/process-batch-redis`
4. If not enabled:
   - Use QStash flow (legacy)
   - Process via `/api/process-message`

---

## Why Beta_2 is Primary

### 1. Complete Feature Set
- Redis message batching (reduces API costs, improves UX)
- Image recognition with GPT-4o
- Complete order processing with all fixes
- Enhanced context retention (378-line instructions vs 244)

### 2. Bug Fixes Included
- **Bug #4:** Image recognition in Redis batch flow
- **Bug #5:** ORDER_NUMBER placeholder replacement + Firestore undefined values
- Email improvements (removed redundant quantity field)

### 3. Production Stability
- All recent testing done on beta_2
- Order 900105 successfully created and tested
- Comprehensive logging in place
- Error handling improved

### 4. Future-Ready
- Feature flag system for gradual rollouts
- Modular instruction system in `data/content/test/`
- Better organized codebase

---

## Deployment Workflow

### Current Process (from beta_2)

```bash
# 1. Make changes in beta_2 folder
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"

# 2. Build
npm run build

# 3. Deploy to production
vercel --prod

# 4. Commit to git
git add .
git commit -m "feat: Description of changes"
git push origin main
```

### Environment Variables (Vercel)

**Required for Redis Batching:**
- `ENABLE_REDIS_BATCHING="true"`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Other Critical Variables:**
- `PAGE_ACCESS_TOKEN` (Facebook Messenger)
- `INSTAGRAM_PAGE_ACCESS_TOKEN` (Instagram - expired as of 2025-11-25)
- `OPENAI_API_KEY`
- `GOOGLE_CLOUD_PRIVATE_KEY`, `GOOGLE_CLOUD_PROJECT_ID`, etc.

---

## Migration History

### 2025-11-29: Redis Batching 100% Rollout

**Before:**
- `rolloutPercentage: 0` (only test user 3282789748459241)
- All other users used QStash

**After:**
- `rolloutPercentage: 100` (all users)
- Feature flag system kept for future testing

**Files Changed:**
- `lib/featureFlags.ts:17` - Changed rollout from 0 to 100

**Deployment:**
- Built and deployed from beta_2
- Deployment ID: `bebias-venera-chatbot-hco5zua1z`
- Timestamp: 2025-11-29 23:00:04 GMT+0400

---

## Key Differences: Parent vs Beta_2

| Feature | Parent Folder | Beta_2 Folder |
|---------|--------------|---------------|
| Bot Instructions | 244 lines | 378 lines ✅ |
| Redis Batching | ❌ No | ✅ Yes |
| Image Recognition | ❌ No | ✅ GPT-4o |
| Order Processing | ⚠️ Partial | ✅ Complete |
| Bug #5 Fixes | ❌ No | ✅ Yes |
| Email Improvements | ❌ No | ✅ Yes |
| Feature Flags | ❌ No | ✅ Yes |
| Last Deployment | 1+ days ago | ~1 hour ago ✅ |

---

## Monitoring & Debugging

### Check Which Version is Live

```bash
# List recent deployments
vercel ls bebias-venera-chatbot

# Most recent = currently active
# Look for "Age" column - smallest age = active deployment
```

### View Production Logs

```bash
cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"
vercel logs bebias-venera-chatbot.vercel.app
```

### Check Feature Flag Status

```bash
# In logs, search for:
grep "Feature REDIS_MESSAGE_BATCHING enabled"
# If you see this for non-test users = 100% rollout active
```

---

## Future Considerations

### When to Use Parent Folder
- NEVER deploy from parent folder
- Keep as archive/reference only
- If needed, sync important files TO parent (not deploy FROM parent)

### When to Create New Beta Folder
- Major architecture changes
- Testing completely new features
- Want to keep beta_2 as stable reference

### Gradual Rollout Pattern

For future features:
1. Add feature flag in `lib/featureFlags.ts`
2. Start with test users only (`rolloutPercentage: 0`)
3. Gradually increase: 10% → 25% → 50% → 100%
4. Monitor errors at each stage
5. Can rollback by decreasing percentage

---

## Known Issues

### Instagram Access Token Expired
- **Token:** `INSTAGRAM_PAGE_ACCESS_TOKEN`
- **Expired:** 2025-11-25 14:00 PST
- **Impact:** Instagram messages not working
- **Fix Required:** Regenerate token in Facebook Developer Console

### Facebook Messenger
- **Status:** ✅ Working normally
- **Token:** `PAGE_ACCESS_TOKEN` (still valid)

---

## Contact & Support

**Deployment Issues:** Check Vercel dashboard
**Feature Flags:** Edit `lib/featureFlags.ts`
**Bot Instructions:** Edit files in `data/content/`
**Order Processing:** Check `app/api/process-batch-redis/route.ts`

---

## Quick Reference

**Primary Deployment Folder:** `BEBIAS CHATBOT VENERA beta_2`
**Vercel Project:** `bebias-venera-chatbot`
**Redis Rollout:** 100% (all users)
**Feature Flags:** `lib/featureFlags.ts`
**Bot Instructions:** `data/content/bot-instructions.md` (378 lines)
