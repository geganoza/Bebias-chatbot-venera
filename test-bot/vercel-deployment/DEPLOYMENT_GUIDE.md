# Deploy Test Bot to Vercel

## Overview

Deploy the test bot simulator to its own Vercel URL where you and your team can access it from anywhere.

**Key Points:**
- ✅ Separate from production bot
- ✅ Uses same OpenAI API key (shared cost is minimal)
- ✅ Can use separate QStash queue (or same with different prefix)
- ✅ Accessible via URL like: `https://bebias-test-bot.vercel.app/test-chat`
- ✅ No impact on production

## QStash with Two Bots

### Answer: YES, QStash works with multiple bots! ✅

**Option 1: Separate Endpoints (Recommended)**
```javascript
// Production bot
QStash webhook: https://your-domain.vercel.app/api/process-batch-redis

// Test bot
QStash webhook: https://test-bot-domain.vercel.app/api/test-process-batch-redis

// Each gets its own schedule/queue
// Completely isolated
```

**Option 2: Shared Endpoint, Different Prefixes**
```javascript
// Same QStash, different Redis keys
Production: `prod:batch:${userId}`
Test: `test:batch:${userId}`

// Filter in code:
const prefix = isTestUser(userId) ? 'test:batch:' : 'prod:batch:';
```

**Cost:** QStash free tier is 500 requests/day. If you need more, both bots can share same account or use separate QStash accounts.

## Deployment Methods

### Method 1: Separate Vercel Project (Safest)

**Pros:**
- Completely isolated
- Own domain
- Independent deploys
- No risk to production

**Setup:**

1. **Create new folder for deployment:**
```bash
mkdir test-bot-deploy
cd test-bot-deploy
```

2. **Copy necessary files:**
```bash
# Copy Next.js config
cp package.json test-bot-deploy/
cp next.config.js test-bot-deploy/
cp tsconfig.json test-bot-deploy/

# Copy test bot files
cp -r test-bot/ test-bot-deploy/
cp -r app/api/test-simulator test-bot-deploy/app/api/
```

3. **Create minimal package.json:**
```json
{
  "name": "bebias-test-bot",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

4. **Deploy to Vercel:**
```bash
cd test-bot-deploy
vercel
```

5. **Set environment variables in Vercel dashboard:**
```
OPENAI_API_KEY=sk-proj-...
FACEBOOK_PAGE_ACCESS_TOKEN=your_test_token
USE_TEST_INSTRUCTIONS=true
REDIS_URL=your_redis_url (optional, can be same)
QSTASH_URL=your_qstash_url (optional)
```

6. **Access at:**
```
https://bebias-test-bot.vercel.app/test-chat
```

### Method 2: Same Project, Different Route

**Pros:**
- One deployment
- Shared resources
- Easier to maintain

**Cons:**
- Need to be careful with routing
- Shares same Vercel project

**Setup:**

1. **Add public route for simulator:**

Edit `next.config.js`:
```javascript
module.exports = {
  async rewrites() {
    return [
      {
        source: '/test-chat',
        destination: '/test-bot/simulator/index.html',
      },
    ]
  },
}
```

2. **Create public API route:**

Already done! Your `/api/test-simulator` endpoint.

3. **Deploy:**
```bash
vercel --prod
```

4. **Access at:**
```
https://your-production-domain.vercel.app/test-chat
```

### Method 3: Subdomain (Recommended for Production Use)

**Setup:**

1. **Deploy as separate project** (Method 1)

2. **Add custom domain in Vercel:**
```
test.bebias.ge → bebias-test-bot.vercel.app
```

3. **Access at:**
```
https://test.bebias.ge/test-chat
```

## Environment Variables

### Required for Test Bot:

```bash
# AI Service
OPENAI_API_KEY=sk-proj-...  # Can be SAME as production

# Instructions Mode
USE_TEST_INSTRUCTIONS=true   # Forces test-bot/data/content/

# Optional: Separate Facebook Page
FACEBOOK_PAGE_ACCESS_TOKEN=...  # Use test page token
FACEBOOK_VERIFY_TOKEN=...       # Can be different

# Optional: Redis (can share or separate)
REDIS_URL=...                   # Same Redis, different prefixes

# Optional: QStash (can share or separate)
QSTASH_URL=...
QSTASH_TOKEN=...
```

### Sharing vs Separate Resources:

**Can Share (Safe):**
- ✅ OpenAI API Key - Just costs more API calls
- ✅ Redis - Use different key prefixes
- ✅ QStash - Use different endpoints or schedules

**Should Separate:**
- ⚠️ Facebook Page Access Token - Use test page
- ⚠️ Vercel Project - For isolation

## QStash Configuration

### Option A: Separate QStash Schedules (Recommended)

**Production:**
```bash
curl -X POST "https://qstash.upstash.io/v2/schedules" \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "https://your-domain.vercel.app/api/process-batch-redis",
    "cron": "*/30 * * * * *"
  }'
```

**Test Bot:**
```bash
curl -X POST "https://qstash.upstash.io/v2/schedules" \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "https://test-bot-domain.vercel.app/api/test-process-batch-redis",
    "cron": "*/30 * * * * *"
  }'
```

### Option B: Shared QStash, Different Redis Prefixes

Modify your batch processing code:

```typescript
// lib/redis-batch.ts
const getPrefix = (userId: string) => {
  const isTest = process.env.USE_TEST_INSTRUCTIONS === 'true';
  return isTest ? 'test:batch:' : 'prod:batch:';
};

export async function addToBatch(userId: string, message: any) {
  const prefix = getPrefix(userId);
  const key = `${prefix}${userId}`;
  // ... rest of logic
}
```

## Cost Implications

### Shared Resources:

**OpenAI API:**
- Production: ~1000 requests/day
- Test: ~50 requests/day (mostly you/team)
- **Total cost increase: ~5%** (negligible)

**Redis:**
- Free tier: 10,000 commands/day
- Both bots fit easily
- **No extra cost**

**QStash:**
- Free tier: 500 requests/day
- Can share or use separate account
- Paid: $10/month for 100k requests
- **Probably fine to share**

**Vercel:**
- Free tier: 100GB bandwidth
- Simulator is lightweight
- **No extra cost**

## Security

### Protecting Test Bot:

**Option 1: Simple Password (Quick)**

Add to simulator:
```javascript
// In simulator.js
const password = prompt('Enter test bot password:');
if (password !== 'your-secret-password') {
  alert('Access denied');
  window.location.href = '/';
}
```

**Option 2: Environment-Based Auth**

```typescript
// app/api/test-simulator/route.ts
const TEST_PASSWORD = process.env.TEST_BOT_PASSWORD;

if (request.headers.get('x-test-password') !== TEST_PASSWORD) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Option 3: Vercel Password Protection**

In Vercel dashboard:
- Settings → Password Protection
- Enable for test bot project only

## Deployment Steps (Quick)

### Fastest Path - Same Project:

```bash
# 1. Copy API endpoint (if not done)
cp test-bot/simulator/api-endpoint-REFERENCE.ts app/api/test-simulator/route.ts

# 2. Deploy
vercel --prod

# 3. Access
# https://your-domain.vercel.app/test-chat
```

### Best Path - Separate Project:

```bash
# 1. Create new Vercel project via dashboard
# 2. Point to same GitHub repo
# 3. Set root directory to: test-bot/
# 4. Add environment variables
# 5. Deploy
# 6. Access at separate URL
```

## Testing the Deployment

1. **Open URL:**
   ```
   https://your-test-bot-url.vercel.app/test-chat
   ```

2. **Check API:**
   ```
   https://your-test-bot-url.vercel.app/api/test-simulator
   ```
   Should return: `{"status": "Test Simulator API Active"}`

3. **Send test message**

4. **Verify using test instructions**

## Monitoring Both Bots

### Vercel Logs:

Production:
```bash
vercel logs your-production-url
```

Test:
```bash
vercel logs your-test-bot-url
```

### QStash Dashboard:

- View separate endpoints
- Monitor request counts
- Check success rates

### Redis:

```bash
# Check production batches
redis-cli KEYS "prod:batch:*"

# Check test batches
redis-cli KEYS "test:batch:*"
```

## Rollback

If test bot has issues:

**Separate Project:**
```bash
vercel rollback  # In test-bot project
```

**Same Project:**
- Rollback doesn't affect production routes
- Or just delete `/api/test-simulator`

## Sharing with Team

Send them:
```
Test Bot Simulator: https://test.bebias.ge/test-chat
Password: [your-password]

Instructions: Just click a user and start chatting!
```

## Recommended Setup

For your use case, I recommend:

1. **Start: Same project, same resources**
   - Quick to set up
   - Minimal cost
   - Test if it works well

2. **When stable: Separate project**
   - Better isolation
   - Custom domain: test.bebias.ge
   - Independent scaling

3. **Resources:**
   - ✅ Share OpenAI key
   - ✅ Share Redis (different prefixes)
   - ✅ Share QStash initially
   - ⚠️ Separate Facebook pages

## Next Steps

1. Choose deployment method
2. Set up environment variables
3. Deploy
4. Test thoroughly
5. Share with team
6. Monitor usage

---

**Want me to help you deploy right now?** I can:
1. Prepare the files
2. Show exact commands
3. Configure QStash for both bots
4. Set up environment variables