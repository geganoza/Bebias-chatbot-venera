import { Firestore } from '@google-cloud/firestore';

// Initialize Firestore client
export const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bebias-wp-db-handler',
});
