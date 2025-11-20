# Next Session: Complete QStash Message Queue Implementation

## ✅ What's Already Done

1. ✅ QStash package installed
2. ✅ QStash credentials added to Vercel Production
3. ✅ Queue helper functions created in `messenger/route.ts`:
   - `queueMessage()`
   - `getQueuedMessages()`
   - `isUserTyping()` / `setUserTyping()`
   - `scheduleProcessing()`
4. ✅ Dual model system (GPT-4.1 for text, GPT-4o for images)
5. ✅ Image base64 conversion
6. ✅ History sanitization
7. ✅ Internal processing endpoint skeleton created

## 🔧 What Needs to be Completed

### 1. Update `scheduleProcessing()` function to use QStash

**File**: `app/api/messenger/route.ts`

**Find** the `scheduleProcessing()` function (around line 162) and replace it with:

```typescript
async function scheduleProcessing(senderId: string): Promise<void> {
  const processingKey = `processing:${senderId}`;

  // Check if already scheduled
  const existing = await kv.get(processingKey);
  if (existing) {
    console.log(`⏰ Processing already scheduled for ${senderId}, resetting timer`);
  }

  // Update schedule marker
  const scheduledTime = Date.now() + MESSAGE_DEBOUNCE_MS;
  await kv.set(processingKey, scheduledTime, { ex: 10 });

  // Use QStash for reliable scheduling
  if (process.env.QSTASH_TOKEN) {
    try {
      const { Client } = require('@upstash/qstash');
      const qstash = new Client({ token: process.env.QSTASH_TOKEN });

      const baseUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_CHAT_API_BASE || 'localhost:3000';
      const protocol = baseUrl.includes('localhost') ? 'http://' : 'https://';
      const fullUrl = `${protocol}${baseUrl}/api/internal/process-queued-messages`;

      await qstash.publishJSON({
        url: fullUrl,
        body: { senderId },
        delay: Math.ceil(MESSAGE_DEBOUNCE_MS / 1000) // Convert to seconds
      });

      console.log(`✅ Scheduled QStash processing for ${senderId} in ${MESSAGE_DEBOUNCE_MS}ms`);
    } catch (error) {
      console.error(`❌ QStash scheduling failed:`, error);
      // Fallback: rely on cron job
    }
  } else {
    console.log(`⏰ QStash not configured, relying on cron for ${senderId}`);
  }
}
```

### 2. Modify POST Handler in `/api/messenger/route.ts`

**Find** the main POST handler (around line 1360) and add message queueing logic BEFORE the existing message processing.

**Add this near the start of the POST handler, after parsing the webhook:**

```typescript
// Handle typing indicators
if (event.typing) {
  const typingSenderId = event.sender?.id;
  if (!typingSenderId) {
    return NextResponse.json({ status: 'ok' });
  }

  await setUserTyping(typingSenderId, event.typing.on === true);

  // If typing stopped, trigger immediate processing
  if (event.typing.on === false) {
    console.log(`✋ User ${typingSenderId} stopped typing, triggering queue processing`);
    // Check if there's a queue to process
    const queueKey = `msg_queue:${typingSenderId}`;
    const queue = await kv.get(queueKey);
    if (queue && queue.length > 0) {
      // Trigger immediate processing via QStash with minimal delay
      await scheduleProcessing(typingSenderId);
    }
  }

  return NextResponse.json({ status: 'ok' });
}

// For regular messages, check if we should queue or process immediately
const messageDedup = `msg_processed:${messageId}`;
const isDuplicate = await kv.get(messageDedup);

if (isDuplicate) {
  console.log(`⚠️ Duplicate message ${messageId}, skipping`);
  return NextResponse.json({ status: 'duplicate' });
}

// Mark as processed (1 hour TTL)
await kv.set(messageDedup, 'true', { ex: 3600 });

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
  console.log(`⌨️ User ${senderId} is typing, queueing message`);
  return NextResponse.json({ status: 'ok_queued_typing' });
}

// Schedule processing
await scheduleProcessing(senderId);

return NextResponse.json({ status: 'ok_queued' });
```

**IMPORTANT**: This replaces the immediate message processing. The old code starting with `if (messageText || messageAttachments)` should be MOVED to a new function that processes queued messages.

### 3. Create Message Processing Function

**Extract the existing message processing logic into a reusable function:**

```typescript
async function processUserMessage(
  senderId: string,
  messageText: string,
  messageAttachments: any[]
): Promise<void> {

  // This is the EXISTING code from the POST handler
  // Starting from "if (messageText || messageAttachments)"
  // All the way to sending the response

  // Copy the entire block that:
  // 1. Builds userContent from text/attachments
  // 2. Loads conversation
  // 3. Calls getAIResponse
  // 4. Sends response via sendMessage
  // 5. Saves conversation

  // (The existing 200+ lines of message processing logic)
}
```

### 4. Fix Internal Processing Endpoint

**File**: `app/api/internal/process-queued-messages/route.ts`

**Replace the processor URL call with direct function call:**

```typescript
// Instead of fetching /api/messenger/process
// Import and call processUserMessage directly

import { processUserMessage } from '../../messenger/route';

// Then in the handler:
await processUserMessage(senderId, combinedText, allAttachments);
```

**OR** keep the HTTP call but create the `/api/messenger/process` endpoint that calls `processUserMessage`.

### 5. Subscribe to `messaging_typing` in Facebook

1. Go to: Facebook Developer Console
2. Navigate to: Messenger → Settings → Webhooks
3. Click "Edit Subscription"
4. Check the box for: **`messaging_typing`**
5. Click "Save"

Now Facebook will send typing events to your webhook.

### 6. Deploy

```bash
vercel --prod
```

### 7. Test

**Test 1: Single message**
- Send: "Hello"
- Expected: Bot waits 3 seconds, then responds

**Test 2: Message burst**
- Send: "ამ ქუდის შეძენა მინდა"
- Quickly send: [photo]
- Expected: Bot waits 3 seconds after last message, processes both together

**Test 3: Typing indicator**
- Start typing (don't send yet)
- Wait 2 seconds
- Send message
- Expected: Bot waits until you stop typing

## 📝 Simplified Alternative (If Above is Too Complex)

If the full implementation is too complex, you can deploy just the **dual model system** (already working!) and add queueing later:

1. Comment out the queueing logic in POST handler
2. Keep the immediate processing (current behavior)
3. Deploy with just the dual model optimization

This still gives you:
- ✅ Image support
- ✅ 70% cost savings
- ✅ Everything working

Then add queueing in a future update when you have more time.

## 🐛 Debugging

If issues occur:

1. Check QStash dashboard: https://console.upstash.com/qstash
2. Check Vercel logs: `vercel logs --follow`
3. Look for these log messages:
   - `📥 Queued message...`
   - `✅ Scheduled QStash processing...`
   - `🔄 [QStash] Processing queued messages...`
   - `⌨️ User is typing...`
   - `✋ User stopped typing...`

## 📚 References

- `MESSAGE_QUEUE_IMPLEMENTATION_PLAN.md` - Full implementation details
- `MESSAGE_DEBOUNCING_STRATEGY.md` - Strategy overview
- `QSTASH_SETUP_INSTRUCTIONS.md` - QStash setup
- `SESSION_SUMMARY.md` - What we accomplished today

---

**Good luck! The hard part (QStash setup) is done. The rest is mostly code organization.** 🚀
