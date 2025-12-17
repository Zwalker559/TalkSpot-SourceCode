
import * as admin from 'firebase-admin';

// This ensures the code is readable and works correctly when parsing the private key.
const privateKey = process.env.PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  try {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set in .env");
    }
    if (!privateKey) {
      throw new Error("PRIVATE_KEY is not set in .env");
    }
    if (!process.env.CLIENT_EMAIL) {
      throw new Error("CLIENT_EMAIL is not set in .env");
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.CLIENT_EMAIL,
      }),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } catch (error: any) {
    console.error('Firebase admin initialization error:', error.stack);
  }
}

export default admin;
