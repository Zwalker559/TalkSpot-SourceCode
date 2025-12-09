
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: Error) => {
      // In a real app, you might want to log this to a service like Sentry.
      // We will show a toast in production and throw in development.
      if (process.env.NODE_ENV === 'development') {
        console.error("Caught a Firestore permission error:", error);
        // Throwing the error here will cause the Next.js error overlay to appear,
        // which is great for debugging security rules.
        throw error;
      } else {
        // In production, show a user-friendly toast message.
        toast({
          variant: 'destructive',
          title: 'Permission Denied',
          description: 'You do not have permission to perform this action.',
        });
      }
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null; // This component does not render anything.
}
