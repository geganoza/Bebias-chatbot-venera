import { CloudTasksClient } from '@google-cloud/tasks';
import { db } from './firestore';

const MESSAGE_DEBOUNCE_MS = 10000; // 10 seconds
const MESSAGE_BURST_COUNT = 3; // Process after 3 messages

interface BurstTracker {
  count: number;
  firstMessageTime: number;
  lastMessageTime: number;
  taskName?: string; // Store task name to allow cancellation
}

/**
 * Add message to burst tracker in Firestore and return current count
 */
export async function addMessageToBurst(senderId: string): Promise<number> {
  const burstRef = db.collection('messageBursts').doc(senderId);
  const burstDoc = await burstRef.get();

  const now = Date.now();

  if (!burstDoc.exists) {
    // First message in burst
    const newTracker: BurstTracker = {
      count: 1,
      firstMessageTime: now,
      lastMessageTime: now
    };
    await burstRef.set(newTracker);
    console.log(`📊 Message burst started for ${senderId} (count: 1)`);
    return 1;
  } else {
    // Increment count
    const tracker = burstDoc.data() as BurstTracker;
    tracker.count++;
    tracker.lastMessageTime = now;
    await burstRef.update({
      count: tracker.count,
      lastMessageTime: now
    });
    console.log(`📊 Message burst continues for ${senderId} (count: ${tracker.count})`);
    return tracker.count;
  }
}

/**
 * Check if we should process now (3 messages OR 10 seconds passed)
 */
export async function shouldProcessNow(senderId: string): Promise<boolean> {
  const burstRef = db.collection('messageBursts').doc(senderId);
  const burstDoc = await burstRef.get();

  if (!burstDoc.exists) {
    return false; // First message, don't process yet
  }

  const tracker = burstDoc.data() as BurstTracker;
  const timeSinceFirst = Date.now() - tracker.firstMessageTime;
  const shouldProcess = tracker.count >= MESSAGE_BURST_COUNT || timeSinceFirst >= MESSAGE_DEBOUNCE_MS;

  if (shouldProcess) {
    console.log(`✅ Processing conditions met: count=${tracker.count}, time=${timeSinceFirst}ms`);
  }

  return shouldProcess;
}

/**
 * Clear burst tracker after processing
 */
export async function clearBurst(senderId: string): Promise<void> {
  const burstRef = db.collection('messageBursts').doc(senderId);
  await burstRef.delete();
  console.log(`🧹 Cleared burst tracker for ${senderId}`);
}

/**
 * Schedule a Cloud Task to process messages after delay
 */
export async function scheduleMessageProcessing(senderId: string): Promise<void> {
  const projectId = process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const location = process.env.GCP_LOCATION || 'us-central1'; // Default location
  const queue = process.env.GCP_TASK_QUEUE || 'default';

  if (!projectId) {
    console.error('❌ GCP_PROJECT_ID not configured, skipping Cloud Tasks');
    return;
  }

  try {
    const client = new CloudTasksClient();

    // Construct the fully qualified queue name
    const parent = client.queuePath(projectId, location, queue);

    // Callback URL - the endpoint that Cloud Tasks will call
    const callbackUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/internal/process-burst`
      : 'https://bebias-venera-chatbot.vercel.app/api/internal/process-burst';

    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: callbackUrl,
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(JSON.stringify({ senderId })).toString('base64'),
      },
      scheduleTime: {
        seconds: Math.floor(Date.now() / 1000) + Math.ceil(MESSAGE_DEBOUNCE_MS / 1000),
      },
    };

    const request = { parent, task };
    const [response] = await client.createTask(request);

    // Store task name for potential cancellation
    const burstRef = db.collection('messageBursts').doc(senderId);
    await burstRef.update({
      taskName: response.name
    });

    console.log(`✅ Scheduled Cloud Task for ${senderId}: ${response.name}`);
  } catch (error: any) {
    console.error(`❌ Failed to schedule Cloud Task:`, error.message);
    // Don't throw - continue processing even if task scheduling fails
  }
}

/**
 * Cancel a previously scheduled task (if user sends another message)
 */
export async function cancelScheduledTask(senderId: string): Promise<void> {
  const burstRef = db.collection('messageBursts').doc(senderId);
  const burstDoc = await burstRef.get();

  if (!burstDoc.exists) {
    return;
  }

  const tracker = burstDoc.data() as BurstTracker;
  if (!tracker.taskName) {
    return;
  }

  try {
    const client = new CloudTasksClient();
    await client.deleteTask({ name: tracker.taskName });
    console.log(`🗑️ Cancelled previous task: ${tracker.taskName}`);
  } catch (error: any) {
    // Task might have already executed or been deleted
    console.log(`⚠️ Could not cancel task: ${error.message}`);
  }
}
