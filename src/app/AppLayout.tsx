'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  LogOut,
  Menu,
  MessageSquare,
  Send,
  Settings,
  Shield,
  RefreshCcw,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase/errors';
import { getAuth, signOut, EmailAuthProvider, reauthenticateWithCredential, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import PromotionsCarousel from '@/components/chat/PromotionsCarousel';
import SidebarPromotions from '@/components/chat/SidebarPromotions';
import { logDisplayNameChange } from '@/app/admin/actions';

const navItems = [
  { href: '/dashboard', icon: MessageSquare, label: 'Chats' },
  { href: '/requests', icon: Send, label: 'Requests' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

const adminNavItem = { href: '/admin', icon: Shield, label: 'Admin' };

const presetQuestions = [
  "What was your first pet's name?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "In what city were you born?",
];

type GlobalNotice = {
    message: string;
    active: boolean;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [textingId, setTextingId] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [globalNotice, setGlobalNotice] = useState<GlobalNotice | null>(null);

  // Onboarding states
  const [isDisplayNameModalOpen, setDisplayNameModalOpen] = useState(false);
  const [isSecurityQuestionModalOpen, setSecurityQuestionModalOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isUserDataLoaded, setUserDataLoaded] = useState(false);

  // Security Question state for the modal
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [customSecurityQuestion, setCustomSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [isCaseSensitive, setCaseSensitive] = useState(false);
  const [passwordForSave, setPasswordForSave] = useState('');
  
  const finalSecurityQuestion = securityQuestion === 'custom' ? customSecurityQuestion : securityQuestion;
  
  const finalNavItems = userRole && ['Lead-Manager', 'Sub-Manager', 'Co-Owner', 'Owner'].includes(userRole) ? [...navItems, adminNavItem] : navItems;
  const isGoogleUser = user?.providerData.some(p => p.providerId === 'google.com');


  useEffect(() => {
    if (user && firestore) {
      // Listen for global notice
      const noticeDocRef = doc(firestore, 'site_config', 'global_notice');
      const unsubscribeNotice = onSnapshot(noticeDocRef, (docSnap) => {
          if (docSnap.exists() && docSnap.data().active) {
              setGlobalNotice(docSnap.data() as GlobalNotice);
          } else {
              setGlobalNotice(null);
          }
      },
      (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: noticeDocRef.path,
            operation: 'get',
        } satisfies SecurityRuleContext));
      });
        
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
        setUserDataLoaded(true);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTextingId(data.textingId || '');
          setUserRole(data.role || 'User');

          const needsOnboarding = !data.onboardingComplete;

          if (needsOnboarding) {
            setShowOnboarding(true);
            const needsDisplayName = !data.displayNameIsSet;
            const needsSecurityQuestion = !data.securityQuestion && !isGoogleUser;

            if (needsDisplayName) {
              setNewDisplayName(data.displayName || '');
              setDisplayNameModalOpen(true);
              setSecurityQuestionModalOpen(false);
            } else if (needsSecurityQuestion) {
              setDisplayNameModalOpen(false);
              setSecurityQuestionModalOpen(true);
            } else {
              // If only Google user is here, mark onboarding as complete.
              if (isGoogleUser) {
                  const userDocRef = doc(firestore, 'users', user.uid);
                  updateDoc(userDocRef, { onboardingComplete: true });
              }
              setDisplayNameModalOpen(false);
              setSecurityQuestionModalOpen(false);
              setShowOnboarding(false);
            }
          } else {
            setShowOnboarding(false);
            setDisplayNameModalOpen(false);
            setSecurityQuestionModalOpen(false);
          }
        } else {
            setUserDataLoaded(false); 
        }
      }, (error) => {
          console.error("Error listening to user document:", error);
          setUserDataLoaded(true);
          errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'get',
          } satisfies SecurityRuleContext));
      });
       return () => {
         unsubscribeNotice();
         unsubscribeUser();
       };
    } else if (!user) {
        setUserDataLoaded(true);
        setShowOnboarding(false);
    }
  }, [user, firestore, isGoogleUser]);


  const handleDisplayNameSave = async () => {
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: "Error", description: "User not found." });
        return;
    }
    if (!newDisplayName.trim()) {
        toast({ variant: 'destructive', title: "Error", description: "Display name cannot be empty." });
        return;
    }
    try {
        const oldDisplayName = user.displayName || '';
        const batch = writeBatch(firestore);
        
        await updateProfile(user, { displayName: newDisplayName });
        
        const userDocRef = doc(firestore, 'users', user.uid);
        batch.update(userDocRef, {
            displayName: newDisplayName,
            displayNameIsSet: true,
        });

        const lookupDocRef = doc(firestore, 'user_lookups', user.uid);
        batch.update(lookupDocRef, { displayName: newDisplayName });

        await batch.commit();

        await logDisplayNameChange({
            uid: user.uid,
            oldDisplayName: oldDisplayName,
            newDisplayName: newDisplayName,
        });

        toast({ title: "Success", description: "Display name saved." });
        setDisplayNameModalOpen(false);
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: "Could not save display name." });
    }
  };


  const handleSecurityQuestionSave = async () => {
    if (!user || !user.email || !firestore) {
      toast({ variant: 'destructive', title: "Error", description: "User not found or email not verified." });
      return;
    }
    if (!finalSecurityQuestion || !securityAnswer) {
      toast({ variant: 'destructive', title: "Error", description: "Please fill out the question and answer." });
      return;
    }

    if (isGoogleUser === false && !passwordForSave) {
        toast({ variant: 'destructive', title: "Error", description: "Please provide your password to save." });
        return;
    }

    try {
      if (isGoogleUser === false) {
          const credential = EmailAuthProvider.credential(user.email, passwordForSave);
          await reauthenticateWithCredential(user, credential);
      }

      const batch = writeBatch(firestore);

      // Save security info to the dedicated collection
      const recoveryDocRef = doc(firestore, 'password_recovery', user.uid);
      batch.update(recoveryDocRef, {
        securityQuestion: finalSecurityQuestion,
        securityAnswer: securityAnswer,
        isCaseSensitive: isCaseSensitive,
      });

      // Mark onboarding as complete in the main user document
      const userDocRef = doc(firestore, 'users', user.uid);
      batch.update(userDocRef, {
          onboardingComplete: true,
          securityQuestion: true, // Mark that a question is now set
      });

      await batch.commit();

      toast({ title: "Success", description: "Security question saved. Setup complete!" });
      setSecurityQuestionModalOpen(false);
      setPasswordForSave('');
      setSecurityAnswer('');
      setSecurityQuestion('');
      setCustomSecurityQuestion('');

    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast({ variant: 'destructive', title: "Error", description: "Incorrect password." });
      } else {
        console.error("Error saving security question:", error);
        toast({ variant: 'destructive', title: "Error", description: "An error occurred saving your security question. Please try again." });
      }
    }
  }


  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push('/login');
  };
  
  const handleRepairOnboarding = async () => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot find user data.' });
      return;
    }
    toast({ title: 'Please wait', description: 'Checking your account status...' });
    const userDocRef = doc(firestore, 'users', user.uid);
    try {
        await updateDoc(userDocRef, { onboardingComplete: false, displayNameIsSet: false, securityQuestion: false });
        toast({ title: 'Onboarding Reset', description: 'Your onboarding process will now restart.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not reset onboarding status.' });
    }
  };

  const canRenderChildren = isUserDataLoaded && !showOnboarding;

  return (
      <>
        {globalNotice && (
            <div className="bg-destructive/90 text-destructive-foreground text-center p-2 font-bold shadow-lg">
                {globalNotice.message}
            </div>
        )}
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] bg-background/80 backdrop-blur-sm">
          <div className="hidden border-r bg-muted/40 md:block">
            <div className="flex h-full max-h-screen flex-col gap-2">
              <div className="flex h-16 items-center border-b px-4 lg:px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                  <Logo className="h-6 w-6" />
                  <span className="font-headline">TalkSpot</span>
                </Link>
              </div>
              <div className="flex-1">
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                  {finalNavItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${
                        pathname.startsWith(item.href) ? 'bg-muted text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="mt-auto">
                <SidebarPromotions />
              </div>
            </div>
          </div>
          <div className="flex flex-col max-h-screen">
            <header className="flex h-16 items-center gap-4 border-b bg-muted/40 px-4 lg:px-6">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 md:hidden"
                  >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle navigation menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col">
                  <SheetHeader>
                    <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                  </SheetHeader>
                  <nav className="grid gap-2 text-lg font-medium">
                    <Link
                      href="#"
                      className="flex items-center gap-2 text-lg font-semibold mb-4"
                    >
                      <Logo className="h-6 w-6" />
                      <span className="sr-only">TalkSpot</span>
                    </Link>
                    {finalNavItems.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 hover:text-foreground ${
                          pathname.startsWith(item.href) ? 'bg-muted text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-auto">
                    <SidebarPromotions />
                  </div>
                </SheetContent>
              </Sheet>
              <div className="w-full flex-1" />
              {textingId && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Your ID:</span>
                  <span className="text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded-md">{textingId}</span>
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon" className="rounded-full">
                    <Avatar>
                      <AvatarImage src={user?.photoURL ?? undefined} alt="My Avatar" />
                      <AvatarFallback>{user?.displayName?.charAt(0) ?? 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="sr-only">Toggle user menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <p>{user?.displayName}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>
            <main className={`flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 ${pathname.startsWith('/dashboard') ? 'overflow-hidden' : 'overflow-y-auto'}`}>
              <PromotionsCarousel />
               {canRenderChildren ? children : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-lg">Please complete the onboarding steps...</p>
                  <p className="text-sm text-muted-foreground mb-4">If a popup does not appear, please click the button below to restart the process.</p>
                  <Button onClick={handleRepairOnboarding}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Restart Onboarding
                  </Button>
                </div>
              )}
            </main>
          </div>
        </div>

        <Dialog open={isDisplayNameModalOpen} onOpenChange={setDisplayNameModalOpen}>
            <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Welcome to TalkSpot!</DialogTitle>
                    <DialogDescription>
                        Please set your public display name to continue.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="display-name" className="text-right">
                            Display Name
                        </Label>
                        <Input
                            id="display-name"
                            className="col-span-3"
                            value={newDisplayName}
                            onChange={(e) => setNewDisplayName(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleDisplayNameSave}>Save and Continue</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isSecurityQuestionModalOpen} onOpenChange={setSecurityQuestionModalOpen}>
            <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>Set Security Question</DialogTitle>
                <DialogDescription>
                  For your account's security, you must set a security question. This can be used to recover your account if you forget your password.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="question-modal" className="text-right">
                    Question
                  </Label>
                  <Select onValueChange={setSecurityQuestion} value={securityQuestion}>
                    <SelectTrigger id="question-modal" className="col-span-3">
                      <SelectValue placeholder="Select a question" />
                    </SelectTrigger>
                    <SelectContent>
                      {presetQuestions.map((q, i) => (
                        <SelectItem key={i} value={q}>{q}</SelectItem>
                      ))}
                      <SelectItem value="custom">Create your own...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {securityQuestion === 'custom' && (
                  <div className="grid grid-cols-4 items-center gap-4">
                     <Label htmlFor="custom-question-modal" className="text-right col-span-1">
                      Custom
                    </Label>
                    <Input id="custom-question-modal" className="col-span-3" placeholder="Type your question" value={customSecurityQuestion} onChange={(e) => setCustomSecurityQuestion(e.target.value)} />
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="answer-modal" className="text-right">
                    Answer
                  </Label>
                  <Input id="answer-modal" className="col-span-3" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="case-sensitive-modal" className="text-right">
                    Case Sensitive
                  </Label>
                  <Switch id="case-sensitive-modal" checked={isCaseSensitive} onCheckedChange={setCaseSensitive} />
                </div>
                {isGoogleUser === false && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password-confirm-modal" className="text-right">
                            Your Password
                        </Label>
                        <Input id="password-confirm-modal" type="password" className="col-span-3" placeholder="Enter password to save" value={passwordForSave} onChange={(e) => setPasswordForSave(e.target.value)} />
                    </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleSecurityQuestionSave}>Save and Finish</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      </>
  );
}
