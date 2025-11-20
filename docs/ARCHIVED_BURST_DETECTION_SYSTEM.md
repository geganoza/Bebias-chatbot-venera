# ARCHIVED: Message Burst Detection System

**Status:** ARCHIVED - Not currently in use
**Date Archived:** 2025-01-20
**Reason:** Reverting to immediate single-answer system for better user experience

---

## Overview

This was a message burst detection system designed to collect multiple rapid messages from users and process them together. It used Firestore to track message counts and timing.

## Configuration

- **Threshold:** 2 messages OR 5 seconds (whichever comes first)
- **Storage:** Firestore `messageBursts` collection
- **No external dependencies:** No QStash, no cron jobs (due to Vercel Hobby plan limitations)

## How It Worked

### Message Flow

1. **First Message:**
   - Created burst tracker in Firestore
   - Returned `{ status: "queued" }` immediately
   - No response sent to user

2. **Second Message (within 5 seconds):**
   - Updated burst counter
   - Checked: `messageCount >= 2` → TRUE
   - Processed BOTH messages together
   - Deleted burst tracker
   - Sent ONE combined response

3. **Second Message (after 5+ seconds):**
   - Checked: `timeSinceFirst >= 5000` → TRUE
   - Processed BOTH messages
   - Sent ONE combined response

## Code Location

**Original Location:** `/app/api/messenger/route.ts`

### Constants (Lines ~34-36)

```typescript
const MESSAGE_DEBOUNCE_MS = 10000; // 10 seconds max wait
const MESSAGE_BURST_COUNT = 3; // Process after 3 messages
const pendingMessages = new Map<string, UserMessageQueue>();
```

### Interfaces (Lines ~21-32)

```typescript
interface PendingMessage {
  messageId: string;
  text?: string;
  attachments?: any[];
  timestamp: number;
}

interface UserMessageQueue {
  messages: PendingMessage[];
  timer: NodeJS.Timeout | null;
  processing: boolean;
}
```

### Main Logic (Lines ~1680-1710)

```typescript
// Check existing burst
const burstRef = db.collection('messageBursts').doc(senderId);
const burstDoc = await burstRef.get();
const burstData = burstDoc.exists ? burstDoc.data() : null;

let messageCount = 1;
const now = Date.now();

if (burstData) {
  messageCount = burstData.count + 1;
  await burstRef.update({
    count: messageCount,
    lastMessageTime: now,
    lastMessageText: userTextForProcessing,
    lastMessageAttachments: attachmentsData || []
  });
} else {
  await burstRef.set({
    count: 1,
    firstMessageTime: now,
    lastMessageTime: now,
    firstMessageText: userTextForProcessing,
    firstMessageAttachments: attachmentsData || [],
    userId: senderId
  });
}

// Check if we should process now (2 messages OR 5 seconds elapsed)
const timeSinceFirst = burstData ? now - burstData.firstMessageTime : 0;
const shouldProcessNow = messageCount >= 2 || timeSinceFirst >= 5000;

if (!shouldProcessNow) {
  console.log(`📊 Message burst: ${messageCount} messages, waiting...`);
  return NextResponse.json({ status: "queued" }, { status: 200 });
}

// Process burst
console.log(`🚀 Processing burst: ${messageCount} messages`);
await burstRef.delete();

// Combine messages...
```

## Firestore Schema

### Collection: `messageBursts`

```typescript
{
  count: number,                    // Number of messages in burst
  firstMessageTime: number,         // Timestamp of first message (Date.now())
  lastMessageTime: number,          // Timestamp of last message
  firstMessageText: string,         // Text of first message
  lastMessageText: string,          // Text of last message
  firstMessageAttachments: any[],   // Attachments from first message
  lastMessageAttachments: any[],    // Attachments from last message
  userId: string                    // Sender ID
}
```

## Limitations

1. **Single message orphans:** If user sends 1 message and never sends another, message never processed
2. **5-second delay:** User waits up to 5 seconds for response
3. **No true timeout:** Can't process after N seconds without new message
4. **Vercel Hobby constraints:** Can't use cron jobs more frequent than daily

## Why It Was Archived

- Users found the delay confusing
- Orphaned single messages were problematic
- Immediate responses provide better UX
- Burst detection added complexity without clear benefit for this use case

## How to Restore

To restore this system:

1. Add back the interfaces and constants (lines 21-36)
2. Add back the burst detection logic before normal processing (lines ~1680-1710)
3. Update Firestore rules to allow `messageBursts` collection
4. Consider implementing a cleanup cron job for orphaned bursts

## Related Files

- `/app/api/messenger/route.ts` - Main implementation
- `/app/api/internal/delayed-response/route.ts` - QStash delayed callback endpoint (part of burst system)
- `/docs/BURST_DETECTION_SETUP.md` - Original setup documentation

## Additional Components

### Delayed Response Endpoint

**Location:** `/app/api/internal/delayed-response/route.ts`

**Purpose:** QStash callback endpoint that processes bursts after timeout

**Status:** Still exists but will not be called (burst detection removed from main route)

**Note:** This endpoint can be deleted or kept for future restoration. It handles the QStash callback after the 10-second delay for processing accumulated messages.

---

**Date Created:** 2025-01-20
**Last Modified:** 2025-01-20
**Archived By:** Claude Code
