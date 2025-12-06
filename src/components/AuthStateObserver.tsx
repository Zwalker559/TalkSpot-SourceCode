
'use client';

import { useUser, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from './logo';
import AppLayout from '@/app/AppLayout';
import { doc, onSnapshot } from 'firebase/firestore';

const publicPaths = ['/login', '/signup', '/forgot-password', '/'];
const privatePaths = ['/requests', '/settings', '/admin', '/dashboard'];

type PersonalizationSettings = {
    theme?: string;
    language?: string;
}


export function AuthStateObserver({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [personalization, setPersonalization] = useState<PersonalizationSettings>({});

  useEffect(() => {
    if (loading) return;

    const isPublicPath = publicPaths.includes(pathname);
    const isPrivatePath = privatePaths.some(p => pathname.startsWith(p));

    if (!user && isPrivatePath) {
      router.replace('/login');
    } else if (user && isPublicPath) {
      router.replace('/dashboard');
    }
  }, [user, loading, router, pathname]);

  // Listen to user settings for personalization
  useEffect(() => {
    if (user && firestore) {
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPersonalization(data.personalization || { theme: 'theme-classic', language: 'en' });
        }
      });
       return () => unsubscribe();
    } else {
        // Reset for logged-out users
        setPersonalization({ theme: 'theme-classic', language: 'en' });
    }
  }, [user, firestore]);

  // Apply theme to the root element
  useEffect(() => {
    if (loading) return;
    
    const root = document.documentElement;
    root.className = ''; // Clear all existing theme classes.

    let themeToApply = 'theme-classic';
    let isDark = true;

    if (user) {
        // A user is logged in, use their saved preference
        themeToApply = personalization.theme || 'theme-classic';
        if (themeToApply.endsWith('-d') || themeToApply === 'theme-classic') {
            isDark = true;
        } else {
            isDark = false;
        }
    } else {
        // No user is logged in, default to classic dark theme for all public pages.
        themeToApply = 'theme-classic';
        isDark = true;
    }
    
    if (isDark) {
        root.classList.add('dark');
    }
    root.classList.add(themeToApply);

    // Special background gradients
    document.body.classList.remove('bg-gradient-patriotic', 'bg-gradient-default', 'bg-gradient-kenny');
    if (themeToApply.startsWith('theme-patriotic')) {
      document.body.classList.add('bg-gradient-patriotic');
    } else if (themeToApply.startsWith('theme-kenny')) {
      document.body.classList.add('bg-gradient-kenny');
    }
     else {
      // Default gradient for classic theme and others.
      document.body.classList.add('bg-gradient-default');
    }
  }, [personalization.theme, user, loading]);

  if (loading || (user && publicPaths.includes(pathname)) || (!user && privatePaths.some(p=>pathname.startsWith(p)))) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <Logo className="h-12 w-12 animate-pulse" />
      </div>
    );
  }

  if (privatePaths.some(p => pathname.startsWith(p))) {
    return <AppLayout>{children}</AppLayout>;
  }

  return <>{children}</>;
}
