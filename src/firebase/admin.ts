
import * as admin from 'firebase-admin';
import 'dotenv/config';

// This function checks if we have the necessary credential info.
function hasCredentials() {
  // Check for the production environment variable first.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return true;
  }
  // Check for the local development environment variable.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return true;
  }
  return false;
}

if (!admin.apps.length) {
  try {
    let creds: admin.ServiceAccount | undefined = undefined;

    // Production / Vercel environment: Parse credentials from environment variable.
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    } 
    // Local development environment: SDK will use GOOGLE_APPLICATION_CREDENTIALS file path.
    else if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
       console.error(
        'Firebase admin initialization error: Credentials not found. ' +
        'For local development, ensure GOOGLE_APPLICATION_CREDENTIALS is set in your .env file and points to your service account key. ' +
        'For production, ensure GOOGLE_APPLICATION_CREDENTIALS_JSON is set as an environment variable.'
      );
    }
    
    admin.initializeApp({
      credential: creds ? admin.credential.cert(creds) : undefined, // Use cert only if we parsed creds
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });

  } catch (e: any) {
    console.error('Firebase admin initialization error:', e.stack);
  }
}

export default admin;
