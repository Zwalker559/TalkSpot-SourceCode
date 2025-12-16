
import * as admin from 'firebase-admin';

// This is a robust way to initialize the Firebase Admin SDK that works
// both locally and in a deployed Vercel environment.

// Define a type for our global singleton to avoid TypeScript errors.
interface FirebaseAdminWithApp extends admin.app.App {
  _singletonInitialized?: boolean;
}

// Function to parse credentials safely
const getCredentials = (): admin.ServiceAccount | undefined => {
  // 1. Check for Vercel/Production environment variable
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    } catch (e) {
      console.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', e);
      return undefined;
    }
  }

  // 2. Check for local development file path
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // For local, we don't return the object, as the SDK reads the file path directly.
    // We just need to confirm it's set.
    return undefined; // The SDK will handle the file path.
  }

  return undefined;
};

// Singleton pattern to initialize Firebase Admin
if (!admin.apps.length) {
    const creds = getCredentials();
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    try {
      admin.initializeApp({
        // If creds is an object (from Vercel env var), use admin.credential.cert().
        // If creds is undefined (local dev), the SDK will automatically look for
        // the GOOGLE_APPLICATION_CREDENTIALS file path env var.
        credential: creds ? admin.credential.cert(creds) : admin.credential.applicationDefault(),
        projectId: projectId,
      });
    } catch (error: any) {
      console.error('Firebase admin initialization error:', error.stack);
    }
}


export default admin;
