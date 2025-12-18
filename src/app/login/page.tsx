
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Logo } from '@/components/logo';
import { useAuth, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { logUserCreation } from '@/app/auth/actions';

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>Google</title>
      <path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.62-4.55 1.62-3.87 0-7-3.13-7-7s3.13-7 7-7c2.04 0 3.92.82 5.33 2.15l2.42-2.42C18.14.92 15.48 0 12.48 0 5.88 0 .52 5.36.52 12s5.36 12 11.96 12c3.43 0 6.2-1.17 8.24-3.25 2.13-2.13 2.76-5.3 2.76-8.5v-1.18h-8.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function generateTextingId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${part1}-${part2}`;
}

// Helper function to get a user-friendly message from a Firebase auth error code
function getAuthErrorMessage(errorCode: string): string {
    switch (errorCode) {
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/user-not-found':
            return 'No account found with this email address.';
        case 'auth/invalid-email':
            return 'The email address is not valid.';
        case 'auth/account-exists-with-different-credential':
            return 'An account with this email already exists using a different sign-in method.';
        case 'auth/operation-not-allowed':
             return 'This sign-in method is not enabled. Please contact support.';
        case 'auth/popup-closed-by-user':
            return 'The sign-in window was closed. Please try again.';
        default:
            return 'An unexpected error occurred. Please try again later.';
    }
}


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const checkUserStatusAndRedirect = async (userId: string) => {
    if (!firestore) throw new Error("Firestore not available");
    const userDocRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists() && userDoc.data()?.status === 'Suspended') {
      await signOut(auth);
      toast({
        variant: 'destructive',
        title: 'Account Suspended',
        description: 'Your account has been suspended. Please contact an administrator.',
        duration: 9000,
      });
      setIsLoading(false);
      return false;
    }
    return true;
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!firestore) throw new Error("Firestore not available");
      if (!user.email) throw new Error("Could not retrieve email from Google sign-in.");

      const userDocRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // This is a brand new user via Google, so create their documents
        const newTextingId = generateTextingId();
        const displayName = user.displayName || user.email?.split('@')[0] || 'New User';
        
        const batch = writeBatch(firestore);

        // Create user document
        batch.set(userDocRef, {
            uid: user.uid,
            displayName: displayName,
            email: user.email,
            photoURL: user.photoURL,
            textingId: newTextingId,
            displayNameIsSet: !!user.displayName, // Set to true if Google provides a name
            textingIdIsSet: false,
            onboardingComplete: false,
            role: 'User',
            status: 'Active',
            providerData: user.providerData.map(p => ({ providerId: p.providerId })),
            visibility: 'private' // Default to private
        });

        // Create public lookup document
        const lookupDocRef = doc(firestore, 'user_lookups', user.uid);
        batch.set(lookupDocRef, {
          uid: user.uid,
          displayName: displayName,
          textingId: newTextingId,
          visibility: 'private' // Default to private
        });
        
        // Create password recovery document
        const recoveryDocRef = doc(firestore, 'password_recovery', user.uid);
        batch.set(recoveryDocRef, {
            uid: user.uid,
            email: user.email,
        });

        await batch.commit();

        // Log the creation event
        await logUserCreation({
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            provider: 'google.com',
        });
      }
      
      const canLogin = await checkUserStatusAndRedirect(user.uid);
      if(canLogin) {
        router.push('/dashboard');
      }

    } catch (error: any) {
        const description = getAuthErrorMessage(error.code);
        toast({
            variant: "destructive",
            title: "Sign-in Failed",
            description,
        });
    } finally {
       setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const canLogin = await checkUserStatusAndRedirect(userCredential.user.uid);
      if(canLogin) {
        router.push('/dashboard');
      }
    } catch (error: any) {
       const description = getAuthErrorMessage(error.code);
       toast({
        variant: "destructive",
        title: "Login Failed",
        description,
      });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background/80 backdrop-blur-sm p-4">
       <div className="absolute top-4 left-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Logo className="h-6 w-6" />
            <span className="font-headline">TalkSpot</span>
        </Link>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
            {isLoading ? 'Please wait...' : <> <GoogleIcon className="mr-2 h-4 w-4" /> Login with Google </>}
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          <form onSubmit={handleEmailLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
            </div>
            <div className="grid gap-2">
                <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password"className="ml-auto inline-block text-sm underline">
                        Forgot your password?
                    </Link>
                </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
        <div className="mt-4 text-center text-sm pb-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </div>
      </Card>
    </div>
  );
}
