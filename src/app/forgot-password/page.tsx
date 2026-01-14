'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Logo } from '@/components/logo';
import { resetPassword } from '@/app/auth/actions';

type RecoveryData = {
  uid: string;
  email: string;
  securityQuestion?: string;
  securityAnswer?: string;
  isCaseSensitive?: boolean;
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [step, setStep] = useState(1); // 1: Email, 2: Security Question, 3: New Password
  const [email, setEmail] = useState('');
  const [recoveryData, setRecoveryData] = useState<RecoveryData | null>(null);
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [attempts, setAttempts] = useState(3);
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'Database not available.'});
        setIsLoading(false);
        return;
    }

    try {
        const recoveryRef = collection(firestore, 'password_recovery');
        const q = query(recoveryRef, where('email', '==', email.trim()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            toast({
                title: 'Check your email',
                description: "If an account with that email exists and has recovery options, we'll proceed to the next step.",
                duration: 9000,
            });
            router.push('/login'); 
            return;
        }

        const recoveryDoc = querySnapshot.docs[0];
        const data = recoveryDoc.data() as RecoveryData;
        data.uid = recoveryDoc.id;

        if (!data.securityQuestion) {
            toast({ 
              title: 'No Security Question', 
              description: 'This account does not have a security question set up. Cannot proceed with recovery.',
              variant: 'destructive',
            });
            setIsLoading(false);
            return;
        }
        
        setRecoveryData(data);
        setStep(2);

    } catch (error: any) {
        console.error("Forgot Password Error:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not verify email. Please try again.' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!recoveryData || !recoveryData.securityAnswer) {
      toast({ variant: 'destructive', title: 'Error', description: 'Recovery data is missing.' });
      setIsLoading(false);
      return;
    }
    
    let isCorrect = false;
    if (recoveryData.isCaseSensitive) {
        isCorrect = answer === recoveryData.securityAnswer;
    } else {
        isCorrect = answer.toLowerCase() === recoveryData.securityAnswer.toLowerCase();
    }

    if (isCorrect) {
        toast({
            title: 'Answer Correct!',
            description: `Please set your new password.`,
        });
        setStep(3);
    } else {
        const remainingAttempts = attempts - 1;
        setAttempts(remainingAttempts);
        if (remainingAttempts <= 0) {
            toast({ variant: 'destructive', title: 'Too many incorrect attempts.', description: 'You have been redirected.' });
            router.push('/');
        } else {
            toast({ variant: 'destructive', title: 'Incorrect Answer', description: `You have ${remainingAttempts} attempts remaining.` });
        }
    }
     setIsLoading(false);
  };
  
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 6 characters long.' });
      return;
    }
    if (!recoveryData) {
      toast({ variant: 'destructive', title: 'Error', description: 'User session expired. Please start over.' });
      router.push('/forgot-password');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword({ uid: recoveryData.uid, newPassword });
      toast({
        title: 'Password Reset Successfully',
        description: 'You can now log in with your new password.',
      });
      router.push('/login');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        variant: 'destructive',
        title: 'Error Resetting Password',
        description: 'An unexpected error occurred. Please try again later.',
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
        {step === 1 && (
            <>
                <CardHeader>
                    <CardTitle className="text-2xl font-headline">Forgot Password</CardTitle>
                    <CardDescription>
                        Enter your email address to begin the recovery process.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleEmailSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Verifying...' : 'Continue'}
                        </Button>
                    </form>
                </CardContent>
            </>
        )}
        {step === 2 && recoveryData && (
             <>
                <CardHeader>
                    <CardTitle className="text-2xl font-headline">Security Question</CardTitle>
                    <CardDescription>
                        Answer the question below to proceed. You have {attempts} attempts remaining.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAnswerSubmit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="securityQuestion">Question</Label>
                            <p id="securityQuestion" className="text-sm font-medium p-2 bg-muted rounded-md">{recoveryData.securityQuestion}</p>
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="answer">Your Answer</Label>
                            <Input id="answer" type="text" required value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={isLoading} />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Verifying...' : 'Verify Answer'}
                        </Button>
                    </form>
                </CardContent>
            </>
        )}
        {step === 3 && (
           <>
              <CardHeader>
                  <CardTitle className="text-2xl font-headline">Set New Password</CardTitle>
                  <CardDescription>
                      Enter and confirm your new password below.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <form onSubmit={handlePasswordResetSubmit} className="grid gap-4">
                      <div className="grid gap-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <Input id="new-password" type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isLoading} />
                      </div>
                      <div className="grid gap-2">
                          <Label htmlFor="confirm-password">Confirm New Password</Label>
                          <Input id="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} />
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                          {isLoading ? 'Saving...' : 'Save New Password'}
                      </Button>
                  </form>
              </CardContent>
          </>
        )}

        <div className="mt-4 text-center text-sm pb-6">
          Remember your password?{' '}
          <Link href="/login" className="underline">
            Login
          </Link>
        </div>
      </Card>
    </div>
  );
}
