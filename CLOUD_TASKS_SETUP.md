# Google Cloud Tasks Setup for Message Debouncing

This guide explains how to set up Google Cloud Tasks for message debouncing in the chatbot.

## What is Message Debouncing?

The chatbot uses message debouncing to combine rapid successive messages (like text + photo) before processing. It waits for EITHER:
- **3 messages** from the user, OR
- **10 seconds** after the first message

Whichever comes first triggers processing.

## How It Works

1. User sends message → Saved to Firestore history
2. Burst tracker updated (count + timestamp)
3. If count < 3: Cloud Task scheduled for 10 seconds later
4. If count reaches 3: Process immediately
5. If 10 seconds pass: Cloud Task triggers processing

## Prerequisites

- Google Cloud Project (you already have this for Firestore)
- Google Cloud CLI installed (`gcloud`)
- Project admin access

## Setup Steps

### 1. Enable Cloud Tasks API

```bash
gcloud services enable cloudtasks.googleapis.com
```

### 2. Create a Task Queue (Optional)

The bot uses the `default` queue by default. If it doesn't exist:

```bash
gcloud tasks queues create default \
  --location=us-central1
```

To use a custom queue:

```bash
gcloud tasks queues create bebias-chatbot-queue \
  --location=us-central1
```

### 3. Set Environment Variables in Vercel

Go to your Vercel project settings → Environment Variables:

#### Required:
- **`GCP_PROJECT_ID`**: Your Google Cloud Project ID
  - Example: `bebias-chatbot-12345`
  - Or reuse: `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (if already set)

#### Optional:
- **`GCP_LOCATION`**: Region for Cloud Tasks (default: `us-central1`)
  - Example: `us-central1`, `europe-west1`, `asia-east1`

- **`GCP_TASK_QUEUE`**: Queue name (default: `default`)
  - Example: `bebias-chatbot-queue`

### 4. Service Account Permissions

Your existing Firebase/Firestore service account needs these permissions:

```bash
# Get your service account email
gcloud iam service-accounts list

# Grant Cloud Tasks permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

The service account credentials JSON should already be set in Vercel as:
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PROJECT_ID`

### 5. Verify Setup

Check that Cloud Tasks API is enabled:

```bash
gcloud services list --enabled | grep cloudtasks
```

List your queues:

```bash
gcloud tasks queues list --location=us-central1
```

## Testing

1. Deploy to Vercel: `vercel --prod`
2. Send a message in Messenger
3. Check logs: `vercel logs --prod`

Look for:
- `📊 Message burst started` - First message tracked
- `✅ Scheduled Cloud Task` - Task scheduled successfully
- `⏱️ [Cloud Task Callback]` - Task executed after 10s

## Troubleshooting

### "Cloud Tasks API not enabled"
```bash
gcloud services enable cloudtasks.googleapis.com
```

### "Queue not found"
```bash
# Create the default queue
gcloud tasks queues create default --location=us-central1
```

### "Permission denied"
Check service account permissions:
```bash
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/cloudtasks.enqueuer"
```

### "Tasks not executing"
1. Check queue exists: `gcloud tasks queues list --location=us-central1`
2. Check Vercel endpoint is accessible: `/api/internal/process-burst`
3. Verify environment variables in Vercel

## Architecture

```
User Message
    ↓
Facebook → Vercel /api/messenger
    ↓
Add to Firestore history
    ↓
Update burst tracker (Firestore)
    ↓
Count < 3? → Schedule Cloud Task (10s delay)
    ↓
[Wait 10 seconds OR 2 more messages]
    ↓
Cloud Task → Vercel /api/internal/process-burst
    ↓
Trigger processing with all accumulated messages
    ↓
Bot responds with combined context
```

## Cost Estimate

Cloud Tasks pricing (as of 2024):
- First 1 million task invocations/month: **FREE**
- After that: $0.40 per million

Expected usage:
- ~100-500 messages/day = 3,000-15,000 tasks/month
- Well within free tier

## Fallback Behavior

If Cloud Tasks fails to schedule:
- Bot still works (processes immediately)
- Warning logged: `❌ Failed to schedule Cloud Task`
- No message debouncing (processes each message separately)

This ensures the bot never breaks due to Cloud Tasks issues.
