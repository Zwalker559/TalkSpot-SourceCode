
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // Explicitly initialize with project ID to stabilize server-side auth.
    // The SDK will still automatically use Application Default Credentials.
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } catch (e: any) {
    console.error('Firebase admin initialization error', e.stack);
  }
}

export default admin;
