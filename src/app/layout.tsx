import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthStateObserver } from '@/components/AuthStateObserver';

export const metadata: Metadata = {
  title: 'TalkSpot - Real-time Chat',
  description: 'Instant messaging with a request-based system.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <AuthStateObserver>
            {children}
          </AuthStateObserver>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
