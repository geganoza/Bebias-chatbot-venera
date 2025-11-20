# Message Debouncing & Smart Response Strategy

## Current Problem

User sends messages in quick succession:
```
1. "ამ ქუდის შეძენა მინდა" (text)
2. [sends photo] (0.5 seconds later)
```

Bot behavior:
- ❌ Responds immediately to message 1 (before seeing photo)
- ❌ Then processes photo and responds again
- ❌ User gets confusing multi-part response

## Solution: Message Debouncing with Wait Strategy

### Strategy 1: Wait for Message Burst to Complete

**Concept**: When a message arrives, wait a few seconds to see if more messages come in the same "conversation burst"

**Implementation**:
```typescript
// In KV store, track last message timestamp per user
const lastMessageKey = `last_message:${senderId}`;
const now = Date.now();

// Get last message timestamp
const lastMessageTime = await kv.get(lastMessageKey);

// If last message was < 3 seconds ago, this is part of a burst
const isPartOfBurst = lastMessageTime && (now - lastMessageTime) < 3000;

if (isPartOfBurst) {
  // Don't respond yet - wait for burst to complete
  await kv.set(lastMessageKey, now);

  // Schedule delayed processing (3 seconds from now)
  // Use setTimeout or queue system
  setTimeout(() => processPendingMessages(senderId), 3000);

  return NextResponse.json({ status: "queued" });
}

// First message in new conversation
await kv.set(lastMessageKey, now);
// Process normally...
```

### Strategy 2: Facebook Typing Indicators

**Concept**: Use Facebook's typing events to detect when user is still typing

Facebook sends `messaging_typing` webhook events:
- `typing_on`: User started typing
- `typing_off`: User stopped typing

**Implementation**:
```typescript
// Subscribe to messaging_typing webhook field in Facebook
// Track typing state in KV

const typingKey = `typing:${senderId}`;

// When typing_on received
if (event.typing?.on) {
  await kv.set(typingKey, 'true', { ex: 10 }); // 10 second expiry
  return; // Don't process messages while typing
}

// When typing_off received
if (event.typing?.off) {
  await kv.del(typingKey);
  // Process queued messages
}

// Before processing any message, check typing state
const isTyping = await kv.get(typingKey);
if (isTyping) {
  // Queue message for later processing
  await queueMessage(senderId, message);
  return NextResponse.json({ status: "queued_typing" });
}
```

### Strategy 3: Message Queue per User

**Concept**: Queue messages per user and process them together after debounce period

**Implementation**:
```typescript
interface QueuedMessage {
  messageId: string;
  text?: string;
  attachments?: any[];
  timestamp: number;
}

async function queueMessage(senderId: string, message: QueuedMessage) {
  const queueKey = `msg_queue:${senderId}`;

  // Get existing queue
  const queue = await kv.get<QueuedMessage[]>(queueKey) || [];

  // Add new message
  queue.push(message);

  // Store with 10 second expiry (auto-cleanup)
  await kv.set(queueKey, queue, { ex: 10 });

  // Schedule processing after debounce
  scheduleProcessing(senderId, 3000); // 3 second debounce
}

async function processQueuedMessages(senderId: string) {
  const queueKey = `msg_queue:${senderId}`;

  // Get all queued messages
  const queue = await kv.get<QueuedMessage[]>(queueKey) || [];

  if (queue.length === 0) return;

  // Combine messages
  const combinedText = queue
    .filter(m => m.text)
    .map(m => m.text)
    .join('\n');

  const allAttachments = queue
    .flatMap(m => m.attachments || []);

  // Process as single conversation turn
  await processMessage(senderId, combinedText, allAttachments);

  // Clear queue
  await kv.del(queueKey);
}
```

### Strategy 4: Intelligent Context Window

**Concept**: Look at recent message pattern to detect if user is done

**Heuristics**:
- If last 3 messages were within 2 seconds each → still typing
- If user sent image → likely waiting for response
- If message ends with "?" → complete question
- If message is very short (<5 words) → might be incomplete

**Implementation**:
```typescript
function shouldWaitForMore(
  userMessage: string,
  recentMessages: Array<{text: string, timestamp: number}>
): boolean {

  // Check message pattern
  const timestamps = recentMessages.map(m => m.timestamp);
  const gaps = [];
  for (let i = 1; i < timestamps.length; i++) {
    gaps.push(timestamps[i] - timestamps[i-1]);
  }

  // If recent messages have small gaps, user is rapid-typing
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (avgGap < 2000 && recentMessages.length >= 2) {
    return true; // Wait - user is in flow state
  }

  // Check if message seems incomplete
  const isShort = userMessage.split(' ').length < 5;
  const endsWithPunctuation = /[.!?]$/.test(userMessage.trim());

  if (isShort && !endsWithPunctuation) {
    return true; // Likely incomplete thought
  }

  // Message seems complete
  return false;
}
```

## Recommended Implementation (Hybrid Approach)

Combine multiple strategies:

```typescript
// 1. Debounce incoming messages (2-3 seconds)
// 2. Check for typing indicators
// 3. Queue messages per user
// 4. Process queue after debounce period

const DEBOUNCE_MS = 3000; // 3 seconds

export async function POST(req: Request) {
  const body = await req.json();

  // Extract message details
  const senderId = event.sender?.id;
  const messageText = message?.text;
  const messageAttachments = message?.attachments;
  const messageId = message?.mid;

  // Check deduplication
  if (await isDuplicate(messageId)) {
    return NextResponse.json({ status: "duplicate" });
  }

  // Queue the message
  await queueMessage(senderId, {
    messageId,
    text: messageText,
    attachments: messageAttachments,
    timestamp: Date.now()
  });

  // Check if user is typing
  const isTyping = await kv.get(`typing:${senderId}`);
  if (isTyping) {
    console.log(`⌨️ User is typing, delaying response`);
    return NextResponse.json({ status: "ok_typing" });
  }

  // Schedule debounced processing
  const processingKey = `processing:${senderId}`;
  const existingTimeout = await kv.get(processingKey);

  if (existingTimeout) {
    // Cancel existing timeout, reset debounce
    await kv.del(processingKey);
  }

  // Set new timeout marker
  await kv.set(processingKey, Date.now() + DEBOUNCE_MS, { ex: 5 });

  // Use Vercel KV or external queue for delayed processing
  // For now, use setTimeout (works in serverless with caveats)
  setTimeout(async () => {
    const shouldProcess = await kv.get(processingKey);
    if (shouldProcess) {
      await processQueuedMessages(senderId);
      await kv.del(processingKey);
    }
  }, DEBOUNCE_MS);

  return NextResponse.json({ status: "ok_queued" });
}
```

## Issues with setTimeout in Vercel Serverless

**Problem**: `setTimeout` doesn't work reliably in serverless functions because:
- Function might terminate before timeout fires
- Each request is a separate instance

**Better Solutions**:

### Option A: Use Vercel Cron Job
```typescript
// api/cron/process-queues/route.ts
export async function GET() {
  const allQueues = await kv.keys('msg_queue:*');

  for (const queueKey of allQueues) {
    const senderId = queueKey.replace('msg_queue:', '');
    const queue = await kv.get(queueKey);

    // Check if queue is old enough (debounce period passed)
    const oldestMessage = queue[0];
    const age = Date.now() - oldestMessage.timestamp;

    if (age >= DEBOUNCE_MS) {
      await processQueuedMessages(senderId);
    }
  }

  return NextResponse.json({ status: 'ok' });
}
```

Set cron schedule in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/process-queues",
    "schedule": "*/1 * * * *"  // Every minute
  }]
}
```

### Option B: Use Upstash QStash (Recommended)
```typescript
import { Client } from '@upstash/qstash';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!
});

// Queue message for delayed processing
await qstash.publishJSON({
  url: "https://your-app.vercel.app/api/process-message",
  body: { senderId, messages: queue },
  delay: DEBOUNCE_MS / 1000 // delay in seconds
});
```

## Facebook Typing Indicator Subscription

Add to webhook subscriptions:
- `messaging_typing` (NEW - to detect when user is typing)

Handle typing events:
```typescript
if (event.typing) {
  const senderId = event.sender.id;

  if (event.typing.on) {
    await kv.set(`typing:${senderId}`, 'true', { ex: 10 });
  } else {
    await kv.del(`typing:${senderId}`);
    // Trigger immediate processing if queue exists
    await processQueuedMessages(senderId);
  }

  return NextResponse.json({ status: 'ok' });
}
```

## Preventing Duplicate Responses

Track what questions have been answered:

```typescript
interface AnsweredQuestion {
  question: string;
  answeredAt: number;
  response: string;
}

async function checkIfAlreadyAnswered(
  senderId: string,
  question: string
): Promise<string | null> {

  const key = `answered:${senderId}`;
  const answered = await kv.get<AnsweredQuestion[]>(key) || [];

  // Check if similar question was answered recently (last 5 minutes)
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

  for (const qa of answered) {
    if (qa.answeredAt > fiveMinutesAgo) {
      // Calculate similarity (simple word overlap)
      const similarity = calculateSimilarity(question, qa.question);

      if (similarity > 0.8) {
        console.log(`🔄 Duplicate question detected, using cached response`);
        return qa.response;
      }
    }
  }

  return null;
}

async function markQuestionAnswered(
  senderId: string,
  question: string,
  response: string
) {
  const key = `answered:${senderId}`;
  const answered = await kv.get<AnsweredQuestion[]>(key) || [];

  answered.push({
    question,
    answeredAt: Date.now(),
    response
  });

  // Keep only last 10 questions
  if (answered.length > 10) {
    answered.shift();
  }

  await kv.set(key, answered, { ex: 3600 }); // 1 hour TTL
}
```

## Summary

**Immediate wins**:
1. ✅ Add message queue per user
2. ✅ Implement 2-3 second debounce
3. ✅ Subscribe to `messaging_typing` webhook

**Better long-term**:
1. ✅ Use Upstash QStash for reliable delayed processing
2. ✅ Track answered questions to prevent duplicates
3. ✅ Intelligent context window analysis

**Trade-offs**:
- ⏱️ Users wait 2-3 seconds for response (but get better, complete answers)
- 💰 Slightly more complex (queue management)
- ✅ Much better UX - coherent responses to multi-part messages
