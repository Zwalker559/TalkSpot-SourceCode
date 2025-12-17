
import * as admin from 'firebase-admin';

// This global variable will hold the initialized Firebase Admin app.
let adminApp: admin.app.App | undefined;

function initializeAdminApp() {
  // If the app is already initialized, return it.
  if (admin.apps.length > 0) {
    return admin.app();
  }

  try {
    // This is the standard and recommended way.
    // On Vercel, it automatically uses the GOOGLE_APPLICATION_CREDENTIALS_JSON env var.
    // Locally, it automatically uses the GOOGLE_APPLICATION_CREDENTIALS env var from .env.
    adminApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
    console.log('Firebase Admin SDK initialized successfully.');
    return adminApp;
  } catch (error: any) {
    console.error('CRITICAL: Firebase admin initialization error:', error.stack);
    // This will cause server actions to fail loudly if initialization fails.
    throw new Error('Could not initialize Firebase Admin SDK. Check server logs for details.');
  }
}

// Export a function that returns the initialized app.
// Server actions will call this to get the admin instance.
export function getAdminApp() {
  if (!adminApp) {
    return initializeAdminApp();
  }
  return adminApp;
}

// Export a pre-initialized instance for convenience.
const adminInstance = initializeAdminApp();
export default adminInstance;
