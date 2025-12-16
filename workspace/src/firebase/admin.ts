import * as admin from 'firebase-admin';
import 'dotenv/config';

if (!admin.apps.length) {
  try {
    // When GOOGLE_APPLICATION_CREDENTIALS is set, the SDK will automatically use them
    // providing a projectId here is good practice and helps stabilize initialization.
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } catch (e: any) {
    console.error('Firebase admin initialization error', e.stack);
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error(
        'Have you created a `.env` file and downloaded your service account key as `firebase-admin-key.json`?'
      );
    }
  }
}

export default admin;
