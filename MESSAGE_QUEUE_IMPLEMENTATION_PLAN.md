# Message Queue Implementation Plan

## Overview

We're implementing a message debouncing system to handle users sending messages in bursts (like text + photo).

## Current Status

✅ **Completed**:
- GPT-4.1 (gpt-4-turbo) for text-only messages
- GPT-4o for messages with images
- Queue helper functions (queueMessage, getQueuedMessages, etc.)
- Message sanitization for expired Facebook URLs

🔄 **In Progress**:
- Message queueing and debouncing logic
- Typing indicator handling
- Delayed processing system

## Implementation Options

### Option A: Upstash QStash (RECOMMENDED)

**Pros**:
- ✅ Built specifically for delayed/scheduled tasks in serverless
- ✅ Reliable, handles retries automatically
- ✅ Easy to use with Vercel
- ✅ Free tier: 500 messages/day
- ✅ No cron jobs needed

**Cons**:
- Requires additional service signup
- Small cost after free tier

**Setup**:
```bash
npm install @upstash/qstash
```

**Env vars needed**:
```
QSTASH_TOKEN=xxxxx
QSTASH_CURRENT_SIGNING_KEY=xxxxx
QSTASH_NEXT_SIGNING_KEY=xxxxx
```

Get from: https://console.upstash.com/qstash

**Usage**:
```typescript
import { Client } from '@upstash/qstash';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!
});

// Schedule processing after 3 seconds
await qstash.publishJSON({
  url: "https://your-app.vercel.app/api/internal/process-queued-messages",
  body: { senderId },
  delay: 3 // seconds
});
```

### Option B: Vercel Cron (SIMPLER, but less reliable)

**Pros**:
- ✅ Built into Vercel
- ✅ No additional services
- ✅ Free

**Cons**:
- ❌ Runs every minute (not instant)
- ❌ Users might wait up to 1 minute + 3 second debounce
- ❌ Less precise timing
- ❌ Available only on Pro plan ($20/month)

**Setup**:
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/process-message-queues",
    "schedule": "* * * * *"
  }]
}
```

### Option C: Self-Triggering with Fetch (HACK, not recommended)

**Pros**:
- ✅ No external services
- ✅ Works immediately

**Cons**:
- ❌ Hacky, unreliable
- ❌ Function might timeout before trigger happens
- ❌ Not guaranteed to work in serverless

**How it works**:
```typescript
// Queue message, then trigger self after delay
setTimeout(async () => {
  await fetch(`${baseUrl}/api/internal/process-queued-messages`, {
    method: 'POST',
    body: JSON.stringify({ senderId })
  });
}, MESSAGE_DEBOUNCE_MS);
```

## Recommended Approach: Hybrid

Use **QStash for production**, fall back to **cron for development**:

```typescript
const useQStash = process.env.NODE_ENV === 'production' && process.env.QSTASH_TOKEN;

if (useQStash) {
  // Use QStash for reliable scheduling
  await qstash.publishJSON({...});
} else {
  // Development: just process immediately or use simple timeout
  // Or rely on cron job
}
```

## Implementation Steps

### Step 1: Modify POST handler in /api/messenger/route.ts

```typescript
export async function POST(req: Request) {
  const body = await req.json();

  // ... existing code to parse webhook ...

  // Handle typing indicators
  if (event.typing) {
    const senderId = event.sender?.id;
    if (!senderId) return NextResponse.json({ status: 'ok' });

    await setUserTyping(senderId, event.typing === 'on');

    // If typing stopped, trigger immediate processing
    if (event.typing === 'off') {
      await triggerQueueProcessing(senderId);
    }

    return NextResponse.json({ status: 'ok' });
  }

  // Handle regular messages
  const senderId = event.sender?.id;
  const message = event.message;
  const messageText = message?.text;
  const messageAttachments = message?.attachments;
  const messageId = message?.mid;

  if (!senderId || !messageId) {
    return NextResponse.json({ status: 'ok' });
  }

  // Check for duplicates
  const dupKey = `msg_processed:${messageId}`;
  const isDup = await kv.get(dupKey);
  if (isDup) {
    console.log(`⚠️ Duplicate message ${messageId}, skipping`);
    return NextResponse.json({ status: 'duplicate' });
  }

  // Mark as seen (TTL 1 hour)
  await kv.set(dupKey, 'true', { ex: 3600 });

  // Queue the message
  await queueMessage(senderId, {
    messageId,
    text: messageText,
    attachments: messageAttachments,
    timestamp: Date.now()
  });

  // Check if user is typing
  const typing = await isUserTyping(senderId);
  if (typing) {
    console.log(`⌨️ User ${senderId} is typing, waiting...`);
    return NextResponse.json({ status: 'ok_typing' });
  }

  // Schedule processing
  await scheduleProcessing(senderId);

  return NextResponse.json({ status: 'ok_queued' });
}
```

### Step 2: Implement scheduleProcessing function

```typescript
async function scheduleProcessing(senderId: string): Promise<void> {
  const processingKey = `processing:${senderId}`;

  // Check if already scheduled
  const existing = await kv.get(processingKey);
  if (existing) {
    console.log(`⏰ Processing already scheduled for ${senderId}, resetting timer`);
  }

  // Update schedule
  const scheduledTime = Date.now() + MESSAGE_DEBOUNCE_MS;
  await kv.set(processingKey, scheduledTime, { ex: 10 });

  // Use QStash if available
  if (process.env.QSTASH_TOKEN) {
    const qstash = new Client({ token: process.env.QSTASH_TOKEN });

    const baseUrl = process.env.VERCEL_URL || 'localhost:3000';
    const protocol = baseUrl.includes('localhost') ? 'http://' : 'https://';

    await qstash.publishJSON({
      url: `${protocol}${baseUrl}/api/internal/process-queued-messages`,
      body: { senderId },
      delay: MESSAGE_DEBOUNCE_MS / 1000 // Convert to seconds
    });

    console.log(`✅ Scheduled QStash processing for ${senderId}`);
  } else {
    // Fallback: rely on cron job
    console.log(`⏰ Scheduled cron processing for ${senderId}`);
  }
}
```

### Step 3: Create internal processing endpoint

File: `app/api/internal/process-queued-messages/route.ts`

```typescript
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
// Import all the messenger handler functions we need

export async function POST(req: Request) {
  try {
    const { senderId } = await req.json();

    console.log(`🔄 Processing queued messages for user ${senderId}`);

    // Get queued messages
    const queue = await getQueuedMessages(senderId);

    if (queue.length === 0) {
      console.log(`⚠️ No messages in queue for ${senderId}`);
      return NextResponse.json({ status: 'no_messages' });
    }

    // Check if user is still typing
    const typing = await isUserTyping(senderId);
    if (typing) {
      console.log(`⌨️ User ${senderId} still typing, re-scheduling`);
      await scheduleProcessing(senderId);
      return NextResponse.json({ status: 'still_typing' });
    }

    // Combine all messages
    const combinedText = queue
      .filter(m => m.text)
      .map(m => m.text)
      .join('\n');

    const allAttachments = queue.flatMap(m => m.attachments || []);

    // Process combined message
    // (This calls the existing message processing logic)
    await processUserMessage(senderId, combinedText, allAttachments);

    // Clear processing schedule
    await kv.del(`processing:${senderId}`);

    console.log(`✅ Processed ${queue.length} messages for ${senderId}`);

    return NextResponse.json({
      success: true,
      messagesProcessed: queue.length
    });

  } catch (error: any) {
    console.error("❌ Error processing queued messages:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### Step 4: Subscribe to typing indicators in Facebook

1. Go to Facebook Developer Console
2. Messenger → Settings → Webhooks
3. Edit Subscription
4. Add checkbox for: **`messaging_typing`**
5. Save

Now Facebook will send these events:
```json
{
  "sender": {"id": "USER_ID"},
  "recipient": {"id": "PAGE_ID"},
  "timestamp": 1234567890,
  "typing": {
    "on": true  // or "off": true
  }
}
```

## Testing Plan

### Test 1: Single message
- Send: "Hello"
- Expected: Bot responds after 3 second debounce

### Test 2: Message burst (no typing indicator)
- Send: "ამ ქუდის"
- Send: "შეძენა მინდა" (within 3 seconds)
- Expected: Bot waits 3 seconds after LAST message, then responds to both

### Test 3: Message + photo
- Send: "ამ ქუდის შეძენა მინდა"
- Send: [photo] (within 3 seconds)
- Expected: Bot processes both together, responds with photo recognition

### Test 4: Typing indicator
- Start typing (typing_on sent)
- Send: "Hello"
- Continue typing (typing indicator still on)
- Expected: Bot waits until typing_off before responding

### Test 5: Duplicate prevention
- Send same message twice quickly
- Expected: Only processes once

## Monitoring

Check these logs:
- `📥 Queued message...` - Message added to queue
- `⏰ Scheduled processing...` - Debounce timer set
- `⌨️ User is typing...` - Typing detected, waiting
- `✋ User stopped typing` - Typing ended, triggering processing
- `📤 Retrieved X queued messages...` - Processing queue
- `🤖 Using model: gpt-4-turbo` - Text-only message
- `🤖 Using model: gpt-4o (hasImages: true)` - Message with image

## Cost Comparison

### Current (immediate processing):
- Text message: gpt-4o = ~$0.005 per request
- Image message: gpt-4o = ~$0.01-0.05 per request

### New (debounced + dual model):
- Text message: gpt-4-turbo = ~$0.001 per request (5x cheaper)
- Image message: gpt-4o = ~$0.01-0.05 per request (same)
- Message bursts: 1 API call instead of 2-3 (3x cheaper)

**Total savings: ~70% on API costs**

## Next Steps

1. ✅ Decide: QStash vs Vercel Cron vs both
2. Install QStash if chosen: `npm install @upstash/qstash`
3. Set up QStash account & get API keys
4. Implement modified POST handler
5. Create internal processing endpoint
6. Subscribe to `messaging_typing` webhook
7. Deploy and test
8. Monitor logs and iterate

## Rollback Plan

If something breaks:
1. Remove message queueing from POST handler
2. Process messages immediately (current behavior)
3. Keep dual model system (that's working great!)
4. Debug queueing separately

The dual model system (GPT-4.1 for text, GPT-4o for images) is independent and can be deployed separately from the queueing system.
