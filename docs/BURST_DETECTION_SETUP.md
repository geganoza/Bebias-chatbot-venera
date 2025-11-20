# Message Burst Detection Setup

**Setup Name:** "2-Message or 5-Second Trigger System"

## Overview
This is a simplified burst detection system that works without external schedulers (QStash) or cron jobs. It's designed to work within Vercel Hobby plan limitations.

## How It Works

### Configuration
- **Threshold:** 2 messages OR 5 seconds (whichever comes first)
- **Storage:** Firestore `messageBursts` collection
- **No external dependencies:** No QStash, no cron jobs

### Message Flow

1. **First Message Arrives:**
   - Creates burst tracker in Firestore with:
     - `count: 1`
     - `firstMessageTime: timestamp`
     - `lastMessageTime: timestamp`
   - Returns `{ status: "queued" }` immediately
   - No response sent to user

2. **Second Message Arrives (within 5 seconds):**
   - Updates burst counter to `count: 2`
   - Checks: `messageCount >= 2` → TRUE
   - Processes BOTH messages together with full context
   - Deletes burst tracker
   - Sends ONE combined response

3. **Second Message Arrives (after 5+ seconds):**
   - Updates burst counter to `count: 2`
   - Checks: `timeSinceFirst >= 5000` → TRUE
   - Processes BOTH messages with full context
   - Deletes burst tracker
   - Sends ONE combined response

4. **Only One Message (user stops):**
   - First message queued, no response
   - When ANY next message arrives (even hours later):
     - Time check triggers: `timeSinceFirst >= 5000` → TRUE
     - Processes old queued message + new message
     - Sends response

## Code Location

**File:** `/app/api/messenger/route.ts`

**Key Lines:**
- Line 1691-1694: Burst detection logic
  ```typescript
  // Check if we should process now (2 messages OR 5 seconds elapsed)
  const burstData = burstDoc.exists ? burstDoc.data() : null;
  const timeSinceFirst = burstData ? now - burstData.firstMessageTime : 0;
  const shouldProcessNow = messageCount >= 2 || timeSinceFirst >= 5000;
  ```

- Line 1696-1705: Processing trigger
- Line 1078: `sendMessageInChunks` - sends ONE complete message (no splitting)

## Limitations

### Known Issues:
1. **Single message orphans:** If user sends 1 message and never sends another, that message is never processed
2. **5-second delay:** User must wait up to 5 seconds for response to 2 quick messages
3. **No true timeout:** Can't process after N seconds without a new message arriving

### Why These Limitations Exist:
- **Vercel Hobby Plan:** Only allows daily cron jobs (can't run every second/minute)
- **Serverless Functions:** Terminate after response, can't keep background timers
- **QStash Limits:** Exceeded free tier limits
- **Cost Constraints:** Can't upgrade to Pro plan

## Alternatives Considered

### ❌ Vercel Cron Jobs
- **Problem:** Hobby plan only allows daily frequency
- **Tried:** `"schedule": "* * * * *"` (every minute)
- **Result:** Error - "Hobby accounts are limited to daily cron jobs"

### ❌ QStash (Upstash)
- **Problem:** Hit free tier limits
- **User Note:** "qstash limits are over"

### ❌ Background Timers
- **Problem:** Serverless functions terminate after returning response
- **Tried:** `setTimeout` for in-memory debouncing
- **Result:** Timers killed when function terminates

## Model Configuration

**Text Messages:** GPT-4.1 (gpt-4.1)
**Image Messages:** GPT-4o (gpt-4o)

**Logic:**
```typescript
const hasImages = Array.isArray(userMessage) && userMessage.some(c => c.type === 'image_url');
const selectedModel = hasImages ? "gpt-4o" : "gpt-4.1";
```

## Message Sending

**Method:** Single complete message (no chunking)

**Previous Issue:** Bot was splitting responses into 5-6 separate messages
**Fix:** `sendMessageInChunks` now sends the complete message as ONE piece

## Status

**Deployed:** Production (https://bebias-venera-chatbot.vercel.app)
**Working:** Yes, with limitations noted above
**User Assessment:** "not working good but better than nothing I guess"

## Future Improvements

If upgrading to Vercel Pro plan:
1. Enable minute-based cron jobs
2. Create `/api/cron/process-bursts` endpoint (already written but removed)
3. Run every 15-30 seconds to check for expired bursts
4. Would fully solve the "orphaned single message" problem

## Git Commit Reference

Last deployment with burst detection changes:
```
Commit: [most recent - includes 2 message / 5 second changes]
Files modified:
- app/api/messenger/route.ts
- vercel.json (removed cron config)
```

## Environment Variables

Required:
- `GOOGLE_CLOUD_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_CLIENT_EMAIL`
- `GOOGLE_CLOUD_PRIVATE_KEY`
- `OPENAI_API_KEY`
- `PAGE_ACCESS_TOKEN` (Facebook)
- `VERIFY_TOKEN` (Facebook)

Firestore Collections:
- `metaMessages` - Conversation history
- `messageBursts` - Active burst trackers

---

**Date Created:** 2025-01-20
**Setup Name:** 2-Message or 5-Second Trigger System
**Status:** Active but imperfect
