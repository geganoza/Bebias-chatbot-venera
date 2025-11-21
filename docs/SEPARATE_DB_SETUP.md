# Setting Up a Separate Database Environment

This guide will help you create an independent copy of your database environment for development/testing without affecting production.

## Overview

Your current production setup uses:
1. **Google Cloud Firestore** (Project: `bebias-wp-db-handler`)
2. **Vercel KV (Redis)** for key-value storage

## Step 1: Create a New Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it (e.g., `bebias-chatbot-dev` or `bebias-chatbot-test`)
4. Click "Create"

## Step 2: Enable Firestore in the New Project

1. In your new project, go to **Firestore Database**
2. Click "Create Database"
3. Choose **Native mode**
4. Select your region (e.g., `us-central1` or `europe-west1`)
5. Start in **Test mode** for development (you can secure it later)

## Step 3: Create Service Account Credentials

1. Go to **IAM & Admin** → **Service Accounts**
2. Click "Create Service Account"
3. Name: `bebias-chatbot-dev`
4. Grant these roles:
   - **Cloud Datastore User**
   - **Firebase Admin SDK Administrator Service Agent**
5. Click "Done"
6. Click on the created service account
7. Go to **Keys** tab → **Add Key** → **Create new key**
8. Choose **JSON** format
9. Download the key file (save it as `firestore-key-dev.json`)

## Step 4: Set Up Separate Environment File

Create a new environment file for your development database:

```bash
# .env.development
GOOGLE_CLOUD_PROJECT_ID="your-new-project-id"
GOOGLE_CLOUD_CLIENT_EMAIL="service-account-email@your-project.iam.gserviceaccount.com"
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Keep other settings from production or use test values
OPENAI_API_KEY="your_openai_api_key"
PAGE_ACCESS_TOKEN="test_page_access_token"
VERIFY_TOKEN="test_verify_token"
```

## Step 5: Copy Production Data (Optional)

If you want to copy existing data from production to your dev environment:

### Option A: Export/Import via gcloud CLI

```bash
# Install gcloud CLI if not installed
# https://cloud.google.com/sdk/docs/install

# Export from production
gcloud firestore export gs://bebias-backup-bucket/export-$(date +%Y%m%d) \
  --project=bebias-wp-db-handler

# Import to development
gcloud firestore import gs://bebias-backup-bucket/export-YYYYMMDD \
  --project=your-new-project-id
```

### Option B: Manual Data Migration Script

Create a script to copy specific collections:

```bash
# Create a migration script
npm install --save-dev @google-cloud/firestore
node scripts/migrate-data.js
```

I can help you create this migration script if needed.

## Step 6: Set Up Separate Vercel KV (Redis) Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Storage** → **Create Database**
3. Choose **KV**
4. Name it `bebias-chatbot-dev-kv`
5. Select region
6. After creation, copy the environment variables:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

Add these to your `.env.development` file.

## Step 7: Configure Your Code to Use the New Environment

Update your Firestore initialization to support multiple environments:

```typescript
// lib/firestore.ts
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID ||
  (process.env.NODE_ENV === 'production'
    ? 'bebias-wp-db-handler'
    : 'bebias-chatbot-dev');
```

## Step 8: Run Locally with Development Database

```bash
# Use the development environment
cp .env.development .env.local

# Run the development server
npm run dev
```

## Step 9: Security Best Practices

1. **Never commit** `.env.development` or service account keys to git
2. Add to `.gitignore`:
   ```
   .env.development
   firestore-key-dev.json
   ```
3. Use separate API keys for development
4. Set up Firestore security rules for dev environment

## Directory Structure

```
BEBIAS CHATBOT VENERA/
├── .env.local              # Local development (points to dev DB)
├── .env.development        # Dev database config
├── .env.production         # Production database config
├── firestore-key.json      # Production credentials (DO NOT COMMIT)
├── firestore-key-dev.json  # Dev credentials (DO NOT COMMIT)
└── lib/
    └── firestore.ts        # Updated to support multiple environments
```

## Firestore Collections to Replicate

Your production database has these collections:

1. **products** - Product inventory and stock levels
2. **stock_reservations** - Temporary holds on inventory
3. **botSettings** - Bot configuration (pause/resume, etc.)
4. **metaMessages** - Facebook Messenger message history
5. **userProfiles** - User profile information
6. **conversations** - Chat conversation history
7. **managerNotifications** - Notifications for managers
8. **errors** - Error logs
9. **processedMessages** - Message deduplication tracking
10. **logs** - Application logs

## Testing Your Setup

1. Start the development server with dev environment
2. Verify Firestore connection:
   ```bash
   node -e "const {db} = require('./lib/firestore.ts'); db.collection('botSettings').doc('global').get().then(doc => console.log('Connected:', doc.exists))"
   ```
3. Check that writes go to the dev database
4. Monitor the [Firestore Console](https://console.firebase.google.com/) for your dev project

## Switching Between Environments

```bash
# Development
cp .env.development .env.local
npm run dev

# Production
cp .env.production .env.local
npm run build
npm start

# Or use different terminals
NODE_ENV=development npm run dev  # Dev DB
NODE_ENV=production npm start     # Prod DB
```

## Cost Considerations

- **Firestore**: Free tier includes 1GB storage, 50K reads/day, 20K writes/day
- **Vercel KV**: Free tier includes 256MB storage, 10K commands/day
- For development, this should be more than sufficient

## Need Help?

I can help you with:
1. Creating the data migration script
2. Setting up automated backups
3. Configuring environment-specific settings
4. Setting up CI/CD with separate environments

Let me know what you'd like to set up next!
