# BEBIAS VENERA CHATBOT - TROUBLESHOOTING GUIDE

**Created:** November 24, 2025
**Purpose:** Quick reference for known issues and their solutions

---

## TABLE OF CONTENTS

1. [Vercel Environment Variables](#1-vercel-environment-variables)
2. [OpenAI API Issues](#2-openai-api-issues)
3. [QStash Issues](#3-qstash-issues)
4. [Order Processing Issues](#4-order-processing-issues)
5. [Git/GitHub Issues](#5-gitgithub-issues)
6. [Bot Not Responding](#6-bot-not-responding-checklist)

---

## 1. VERCEL ENVIRONMENT VARIABLES

### Issue: "is not a legal HTTP header value"

**Symptom:**
```
TypeError: Bearer sk-proj-xxx...
   is not a legal HTTP header value
```

**Cause:** Hidden characters (newlines, spaces) in environment variable when added via Vercel CLI or dashboard.

**Solution:** Use `printf` instead of `echo` when adding env vars:
```bash
# WRONG - may add hidden characters
echo 'sk-proj-xxx' | vercel env add OPENAI_API_KEY production

# CORRECT - no hidden characters
printf 'sk-proj-xxx' | vercel env add OPENAI_API_KEY production
```

**Verification:**
```bash
vercel env pull .env.check --environment production -y
cat .env.check | grep OPENAI | xxd | head -5  # Check for hidden chars
rm .env.check
```

### Issue: Environment variables not updating after change

**Cause:** Vercel caches env vars at deployment time.

**Solution:** Always redeploy after changing env vars:
```bash
vercel env rm VARIABLE_NAME production -y
printf 'new_value' | vercel env add VARIABLE_NAME production
vercel --prod  # MUST redeploy!
```

---

## 2. OPENAI API ISSUES

### Issue: API key disabled/revoked

**Symptoms:**
- 401 Unauthorized errors
- "Invalid API key" messages

**Common Causes:**
1. Key exposed in GitHub (OpenAI automatically revokes)
2. Key expired or manually deleted
3. Billing issues

**Solution:**
1. Generate new key at https://platform.openai.com/api-keys
2. Update in Vercel using `printf` method (see above)
3. Redeploy

**Test API key locally:**
```bash
curl -s -X POST https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5}'
```

### Issue: Rate limiting (429 errors)

**Solution:** Bot has built-in handling. Check circuit breaker:
```bash
node scripts/check-bot-status.js
node scripts/reset-circuit-breaker.js  # If needed
```

---

## 3. QSTASH ISSUES

### Issue: QStash signature verification failed

**Symptom:** Messages queued but not processed, 401 errors on /api/process-message

**Cause:** QStash signing keys don't match

**Solution:**
1. Get new keys from https://console.upstash.com/qstash
2. Update in Vercel:
```bash
printf 'sig_xxx' | vercel env add QSTASH_CURRENT_SIGNING_KEY production
printf 'sig_yyy' | vercel env add QSTASH_NEXT_SIGNING_KEY production
vercel --prod
```

### Issue: QStash token invalid

**Symptom:** "Message queued to QStash" but nothing happens

**Test token:**
```bash
curl -X POST "https://qstash.upstash.io/v2/publish/https://example.com" \
  -H "Authorization: Bearer YOUR_QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## 4. ORDER PROCESSING ISSUES

### Issue: [ORDER_NUMBER] placeholder not replaced

**File:** `app/api/process-message/route.ts`

**Detection logic must include:**
```typescript
const hasOrderNumberPlaceholder =
  text.includes('[ORDER_NUMBER]') ||
  text.includes('[შეკვეთის ნომერი მალე]') ||
  text.includes('შეკვეთის ნომერი:') ||
  text.includes('🎫');  // IMPORTANT: Ticket emoji
```

### Issue: "Emergency orders" with null data

**Cause:** Fallback order creation without null check

**Fix (line ~1253):**
```typescript
// WRONG
if (hasOrderNumberPlaceholder(finalResponse)) {

// CORRECT
if (orderData && hasOrderNumberPlaceholder(finalResponse)) {
```

### Issue: Duplicate orders

**Check for locks:**
```bash
node scripts/check-order-locks.js
```

**Clear if stuck:**
```bash
# Clear specific user
node scripts/clear-test-user-history.js USER_ID
```

---

## 5. GIT/GITHUB ISSUES

### Issue: Push blocked - secrets detected

**Symptom:**
```
remote: Push cannot contain secrets
```

**Cause:** API keys committed to git history

**Solutions:**
1. **Allow specific secrets** (temporary): Click the GitHub security link provided
2. **Remove from history** (permanent):
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch FILE_WITH_SECRET" \
  --prune-empty --tag-name-filter cat -- --all
git push origin --force --all
```

**Prevention:** Add to `.gitignore`:
```
.env*
*credentials*
*secret*
```

---

## 6. BOT NOT RESPONDING - CHECKLIST

Run these checks in order:

### 1. Check bot status
```bash
node scripts/check-bot-status.js
```
- Is `paused: false`?
- Is `killSwitch: false`?
- Any pending messages?

### 2. Check Vercel logs
```bash
vercel logs bebias-venera-chatbot.vercel.app
```
Look for:
- `📩 Incoming Messenger webhook` - Messages arriving
- `✅ Message queued to QStash` - Queue working
- `🚀 [QStash] Processing` - Processing started
- `❌` - Any errors

### 3. Check environment variables
```bash
vercel env ls production
```
Required vars:
- OPENAI_API_KEY
- QSTASH_TOKEN
- QSTASH_CURRENT_SIGNING_KEY
- QSTASH_NEXT_SIGNING_KEY
- PAGE_ACCESS_TOKEN
- All GOOGLE_CLOUD_* vars

### 4. Test components individually
```bash
# Test OpenAI
curl -s https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'

# Test QStash token
curl -X POST "https://qstash.upstash.io/v2/queues" \
  -H "Authorization: Bearer $QSTASH_TOKEN"
```

### 5. Clear stuck state
```bash
node scripts/clear-test-user-history.js USER_ID
node scripts/reset-circuit-breaker.js
```

### 6. Force redeploy
```bash
vercel --prod --force
```

---

## QUICK REFERENCE COMMANDS

```bash
# Check status
node scripts/check-bot-status.js

# Clear user history
node scripts/clear-test-user-history.js USER_ID

# Reset circuit breaker
node scripts/reset-circuit-breaker.js

# View logs
vercel logs bebias-venera-chatbot.vercel.app

# Redeploy
vercel --prod

# List env vars
vercel env ls production

# Add env var (SAFE method)
printf 'value' | vercel env add VAR_NAME production
```

---

## VERSION-SPECIFIC FIXES

| Version | Issue | Fix |
|---------|-------|-----|
| Beta 1 | Order number not detected | Added `🎫` emoji check |
| Beta 2 | Order number placeholder | Added emoji detection |
| Beta 3 | Null orderData in fallback | Added `orderData &&` check |
| Beta 3 | API key hidden chars | Use `printf` not `echo` |

---

**Last Updated:** November 24, 2025
