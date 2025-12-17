
import * as admin from 'firebase-admin';

// This global variable will hold the initialized Firebase Admin app.
let adminApp: admin.app.App | undefined;

function initializeAdminApp() {
  // If the app is already initialized, return it.
  if (adminApp) {
    return adminApp;
  }

  try {
    // Vercel Environment: Use the JSON string from the environment variable.
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      console.log('Initializing Firebase Admin SDK with Vercel environment variable...');
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      return adminApp;
    }

    // Local Development Environment: Use the file path from .env.
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('Initializing Firebase Admin SDK with local service account file...');
      adminApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      return adminApp;
    }
    
    throw new Error('Firebase Admin SDK credentials are not configured. Please set either GOOGLE_APPLICATION_CREDENTIALS_JSON (for Vercel) or GOOGLE_APPLICATION_CREDENTIALS (for local development).');

  } catch (error: any) {
    console.error('Firebase admin initialization error:', error.stack);
    // Return null or re-throw to indicate failure.
    // For this app, we'll rethrow so the server action fails clearly.
    throw new Error('Could not initialize Firebase Admin SDK.');
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

// Export a pre-initialized instance for convenience in many files.
// Note: Direct import of this might behave differently in serverless environments,
// which is why getAdminApp() is the more robust approach.
const adminInstance = initializeAdminApp();
export default adminInstance;
