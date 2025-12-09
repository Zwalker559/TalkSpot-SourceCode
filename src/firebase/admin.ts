
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      // The SDK will automatically detect GOOGLE_APPLICATION_CREDENTIALS
      // and other environment variables.
    });
  } catch (e: any) {
    console.error('Firebase admin initialization error', e.stack);
  }
}

export default admin;
