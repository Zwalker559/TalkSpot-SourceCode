
import * as admin from 'firebase-admin';

// This global variable will hold the initialized Firebase Admin app.
let adminApp: admin.app.App | undefined;

function initializeAdminApp() {
  if (admin.apps.length > 0) {
    // If the app is already initialized, return it.
    // This is important to prevent re-initialization in serverless environments.
    return admin.apps[0] as admin.app.App;
  }

  // Vercel and local environments will have these variables set.
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // The private key from the environment variable needs to have its newlines restored.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('CRITICAL: Missing Firebase Admin SDK credentials. Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in your environment.');
    throw new Error('Could not initialize Firebase Admin SDK. Missing credentials.');
  }

  try {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId: projectId, // Explicitly pass projectId here as well
    });
    console.log('Firebase Admin SDK initialized successfully.');
    return adminApp;
  } catch (error: any) {
    console.error('CRITICAL: Firebase admin initialization error:', error.stack);
    throw new Error('Could not initialize Firebase Admin SDK. Check server logs for details.');
  }
}

// Export a pre-initialized instance for convenience in server actions.
const adminInstance = initializeAdminApp();
export default adminInstance;
