
'use client';
import { FirebaseProvider, initializeFirebase } from './provider';

let app: ReturnType<typeof initializeFirebase>;

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!app) {
    app = initializeFirebase();
  }
  return (
    <FirebaseProvider
      firebaseApp={app.firebaseApp}
      auth={app.auth}
      firestore={app.firestore}
      storage={app.storage}
    >
      {children}
    </FirebaseProvider>
  );
}
