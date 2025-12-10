

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase';
import { Logo } from '@/components/logo';
import { logUserCreation } from '@/app/admin/actions';

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

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (!firestore || !email) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Database service not available or email is missing.",
        });
        setIsLoading(false);
        return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const newTextingId = generateTextingId();
      const displayName = user.email?.split('@')[0] || 'New User';
      
      const batch = writeBatch(firestore);

      // Create user document
      const userDocRef = doc(firestore, "users", user.uid);
      batch.set(userDocRef, {
        uid: user.uid,
        email: user.email,
        photoURL: user.photoURL,
        textingId: newTextingId,
        displayName: displayName,
        displayNameIsSet: false,
        textingIdIsSet: false,
        onboardingComplete: false,
        role: 'User',
        status: 'Active',
        providerData: [{ providerId: 'password' }],
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
          provider: 'password',
      });

      router.push('/dashboard');
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: error.message,
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
          <CardTitle className="text-2xl font-headline">Sign Up</CardTitle>
          <CardDescription>
            Enter your information to create an account.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleSignup} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email} onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading}/>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create an account'}
            </Button>
          </form>
        </CardContent>
        <div className="mt-4 text-center text-sm pb-6">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Login
          </Link>
        </div>
      </Card>
    </div>
  );
}
