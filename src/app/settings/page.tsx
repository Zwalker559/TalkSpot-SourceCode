'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase/errors';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot, writeBatch, setDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { logDisplayNameChange } from '@/app/admin/actions';

const presetQuestions = [
  "What was your first pet's name?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "In what city were you born?",
];

const themes = [
  { value: 'theme-classic-l', label: 'Classic (L)' },
  { value: 'theme-classic-d', label: 'Classic (D)' },
  { value: 'theme-patriotic-l', label: 'Patriotic (L)' },
  { value: 'theme-patriotic-d', label: 'Patriotic (D)' },
  { value: 'theme-electric-l', label: 'Electric (L)' },
  { value: 'theme-electric-d', label: 'Electric (D)' },
  { value: 'theme-forest-l', label: 'Forest (L)' },
  { value: 'theme-forest-d', label: 'Forest (D)' },
  { value: 'theme-sunset-l', label: 'Sunset (L)' },
  { value: 'theme-sunset-d', label: 'Sunset (D)' },
  { value: 'theme-ocean-l', label: 'Ocean (L)' },
  { value: 'theme-ocean-d', label: 'Ocean (D)' },
  { value: 'theme-lavender-l', label: 'Lavender (L)' },
  { value: 'theme-lavender-d', label: 'Lavender (D)' },
  { value: 'theme-monochrome-l', label: 'Monochrome (L)' },
  { value: 'theme-monochrome-d', label: 'Monochrome (D)' },
  { value: 'theme-coral-l', label: 'Coral (L)' },
  { value: 'theme-coral-d', label: 'Coral (D)' },
  { value: 'theme-mint-l', label: 'Mint (L)' },
  { value: 'theme-mint-d', label: 'Mint (D)' },
  { value: 'theme-kenny-l', label: 'Kenny (L)' },
  { value: 'theme-kenny-d', label: 'Kenny (D)' },
];

function obscureEmail(email?: string | null) {
  if (!email) return '';
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name[0]}***@${domain}`;
}

type ChatFilters = {
    blockLinks?: boolean;
    blockProfanity?: boolean;
}

type PersonalizationSettings = {
    theme?: string;
    language?: string;
}

type Visibility = 'public' | 'private';


export default function SettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for dialogs
  const [isDisplayNameDialogOpen, setDisplayNameDialogOpen] = useState(false);
  const [isTextingIdDialogOpen, setTextingIdDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [isSecurityQuestionDialogOpen, setSecurityQuestionDialogOpen] = useState(false);
  const [isAvatarDialogOpen, setAvatarDialogOpen] = useState(false);


  // Form states
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  
  const [textingId, setTextingId] = useState('');
  const [textingIdInput, setTextingIdInput] = useState('');
  const [hasCustomizedId, setHasCustomizedId] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Avatar state
  const [newAvatarPreview, setNewAvatarPreview] = useState<string | null>(null);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);

  // Security Question state
  const [savedSecurityQuestion, setSavedSecurityQuestion] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [customSecurityQuestion, setCustomSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [isCaseSensitive, setCaseSensitive] = useState(false);
  const [passwordForSave, setPasswordForSave] = useState('');

  // Chat Filter state
  const [chatFilters, setChatFilters] = useState<ChatFilters>({});
  
  // Personalization state
  const [personalization, setPersonalization] = useState<PersonalizationSettings>({ theme: 'theme-classic-d' });
  
  // Visibility State
  const [visibility, setVisibility] = useState<Visibility>('private');

  
  const finalSecurityQuestion = securityQuestion === 'custom' ? customSecurityQuestion : securityQuestion;

  const isGoogleUser = user?.providerData.some(p => p.providerId === 'google.com');

  useEffect(() => {
    if (user && firestore) {
      setIsLoading(true);
      // Listener for main user document
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDisplayName(data.displayName || '');
          setTextingId(data.textingId || '');
          setTextingIdInput(data.textingId || '');
          setHasCustomizedId(data.textingIdIsSet || false);
          setChatFilters(data.chatFilters || {});
          setPersonalization(data.personalization || { theme: 'theme-classic-d' });
          setVisibility(data.visibility || 'private');
        }
      },
      (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'get',
        } satisfies SecurityRuleContext));
      });
      
      // Listener for password recovery document
      if (!isGoogleUser) {
        const recoveryDocRef = doc(firestore, 'password_recovery', user.uid);
        const unsubscribeRecovery = onSnapshot(recoveryDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSavedSecurityQuestion(data.securityQuestion || '');
                 if (data.securityQuestion) {
                    if (!presetQuestions.includes(data.securityQuestion)) {
                        setSecurityQuestion('custom');
                        setCustomSecurityQuestion(data.securityQuestion);
                    } else {
                        setSecurityQuestion(data.securityQuestion);
                    }
                    setCaseSensitive(data.isCaseSensitive || false);
                 }
            }
            setIsLoading(false);
        }, (error) => {
          setIsLoading(false)
          errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: recoveryDocRef.path,
              operation: 'get',
          } satisfies SecurityRuleContext));
        });
         return () => {
             unsubscribeUser();
             unsubscribeRecovery();
         };
      } else {
          setIsLoading(false);
          return () => unsubscribeUser();
      }
    }
  }, [user, firestore, isGoogleUser]);

  const handleDisplayNameSave = async () => {
    if (!user || !firestore) return;
    const oldDisplayName = user.displayName || '';
    try {
      const batch = writeBatch(firestore);
      
      // Update Auth profile
      await updateProfile(user, { displayName });

      // Update user document
      const userDocRef = doc(firestore, 'users', user.uid);
      batch.update(userDocRef, { displayName });

      // Update public lookup document
      const lookupDocRef = doc(firestore, 'user_lookups', user.uid);
      batch.update(lookupDocRef, { displayName });
      
      await batch.commit();

      await logDisplayNameChange({
          uid: user.uid,
          oldDisplayName,
          newDisplayName: displayName,
      });

      toast({ title: "Success", description: "Display name updated." });
      setDisplayNameDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    }
  }

  const handleTextingIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
    let formattedValue = rawValue.slice(0, 8);
    if (rawValue.length > 4) {
      formattedValue = `${rawValue.slice(0, 4)}-${rawValue.slice(4)}`;
    }
    setTextingIdInput(formattedValue);
  }

  const handleTextingIdSave = async () => {
    if (!user || !firestore) return;

    const idRegex = /^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/;
    if (!idRegex.test(textingIdInput)) {
        toast({ variant: 'destructive', title: "Invalid Format", description: "Texting ID must be in the format xxxx-xxxx and contain 8 alphanumeric characters." });
        return;
    }

    try {
        const lookupsRef = collection(firestore, 'user_lookups');
        const q = query(lookupsRef, where('textingId', '==', textingIdInput));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty && querySnapshot.docs[0].id !== user.uid) {
             toast({ variant: 'destructive', title: "ID Taken", description: "This texting ID is already in use. Please choose another." });
            return;
        }
        
        const batch = writeBatch(firestore);

        const userDocRef = doc(firestore, 'users', user.uid);
        batch.update(userDocRef, { textingId: textingIdInput, textingIdIsSet: true });

        const lookupDocRef = doc(firestore, 'user_lookups', user.uid);
        batch.update(lookupDocRef, { textingId: textingIdInput });
        
        await batch.commit();
        
        toast({ title: "Success", description: "Texting ID updated." });
        setTextingIdDialogOpen(false);
    } catch (error: any) {
        console.error("Error updating texting ID:", error);
        toast({ variant: 'destructive', title: "Error", description: error.message });
    }
  };


  const handlePasswordSave = async () => {
    if (!user || !user.email) {
      toast({ variant: 'destructive', title: "User not found", description: "User not found or email not verified." });
      return;
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast({ title: "Success", description: "Password updated successfully." });
      setPasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: "Password change failed. Please check your current password." });
    }
  }

  const handleSecurityQuestionSave = async () => {
    if (!user || !user.email) {
      toast({ variant: 'destructive', title: "User not found" });
      return;
    }
    if (!finalSecurityQuestion || !securityAnswer) {
      toast({ variant: 'destructive', title: "Error", description: "Please fill out the question and answer." });
      return;
    }
    
    if (!passwordForSave) {
        toast({ variant: 'destructive', title: "Error", description: "Please provide your password to save." });
        return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, passwordForSave);
      await reauthenticateWithCredential(user, credential);
      
      const recoveryDocRef = doc(firestore, 'password_recovery', user.uid);
      await updateDoc(recoveryDocRef, {
        securityQuestion: finalSecurityQuestion,
        securityAnswer: securityAnswer,
        isCaseSensitive: isCaseSensitive,
      });
      
      setSavedSecurityQuestion(finalSecurityQuestion);
      toast({ title: "Success", description: "Security question saved." });
      setSecurityQuestionDialogOpen(false);
      setPasswordForSave('');
      setSecurityAnswer('');

    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast({ variant: 'destructive', title: "Error", description: "Incorrect password." });
      } else {
        toast({ variant: 'destructive', title: "Error", description: "An error occurred. Please try again." });
      }
    }
  }
  
  const handleFilterChange = async (filterName: keyof ChatFilters, value: boolean) => {
    if (!user || !firestore) return;
    const newFilters = { ...chatFilters, [filterName]: value };
    setChatFilters(newFilters);
    try {
        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDoc(userDocRef, {
            chatFilters: newFilters,
        });
        toast({ title: "Filter settings updated." });
    } catch (error) {
        console.error("Error updating filter settings:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not save filter settings." });
    }
  }
  
  const handlePersonalizationChange = async (settingName: keyof PersonalizationSettings, value: string) => {
     if (!user || !firestore) return;
    const newSettings = { ...personalization, [settingName]: value };
    setPersonalization(newSettings);
    try {
        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDoc(userDocRef, {
            personalization: newSettings,
        });
        toast({ title: `${settingName.charAt(0).toUpperCase() + settingName.slice(1)} updated.` });
    } catch (error: any) {
        console.error(`Error updating ${settingName}:`, error);
        toast({ variant: 'destructive', title: "Error", description: `Could not save ${settingName}.` });
    }
  }

  const handleVisibilityChange = async (newVisibility: Visibility) => {
    if (!user || !firestore) return;
    setVisibility(newVisibility);
    try {
        const batch = writeBatch(firestore);
        
        const userDocRef = doc(firestore, 'users', user.uid);
        batch.update(userDocRef, { visibility: newVisibility });

        const lookupDocRef = doc(firestore, 'user_lookups', user.uid);
        batch.update(lookupDocRef, { visibility: newVisibility });

        await batch.commit();
        toast({ title: 'Visibility Updated', description: `Your profile is now ${newVisibility}.` });
    } catch (error: any) {
        console.error("Error updating visibility:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update visibility setting.' });
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
       if (file.size > 500 * 1024) { // 500KB limit for Base64
          toast({ variant: 'destructive', title: "File too large", description: "Please select an image smaller than 500KB." });
          return;
      }
      setNewAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        setNewAvatarPreview(loadEvent.target?.result as string);
        setAvatarDialogOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarSave = async () => {
    if (!user || !firestore || !newAvatarPreview) return;

    try {
        const dataUrl = newAvatarPreview;

        const batch = writeBatch(firestore);

        await updateProfile(user, { photoURL: dataUrl });

        const userDocRef = doc(firestore, 'users', user.uid);
        batch.update(userDocRef, { photoURL: dataUrl });
        
        const lookupDocRef = doc(firestore, 'user_lookups', user.uid);
        batch.update(lookupDocRef, { photoURL: dataUrl });
        
        // Also update photoURL in all conversation participantDetails
        const convosQuery = query(collection(firestore, 'conversations'), where('participants', 'array-contains', user.uid));
        const convosSnapshot = await getDocs(convosQuery);
        convosSnapshot.forEach(convoDoc => {
            const convoRef = doc(firestore, 'conversations', convoDoc.id);
            batch.update(convoRef, {
                [`participantDetails.${user.uid}.photoURL`]: dataUrl
            });
        });

        await batch.commit();

        toast({ title: "Success", description: "Profile picture updated." });
    } catch (error: any) {
        console.error("Error updating profile picture:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not update profile picture." });
    } finally {
        setAvatarDialogOpen(false);
        setNewAvatarPreview(null);
        setNewAvatarFile(null);
    }
  };

  const PageSkeleton = () => (
     <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent className="space-y-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-24 mb-1" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-10 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-24 mb-1" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-10 w-40" />
            </div>
             <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-24 mb-1" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-8 w-12" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Manage your account details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.photoURL ?? undefined} />
                  <AvatarFallback>{displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <Label>Profile Picture</Label>
                <p className="text-sm text-muted-foreground">Click edit to change your avatar.</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Edit</Button>
            <Input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/png, image/jpeg, image/gif" />
          </div>

          {/* Display Name */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <p id="displayName" className="text-lg font-medium">{displayName}</p>
            </div>
            <Dialog open={isDisplayNameDialogOpen} onOpenChange={setDisplayNameDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Edit</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Display Name</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 py-4">
                  <Label htmlFor="displayNameInput">New Display Name</Label>
                  <Input id="displayNameInput" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleDisplayNameSave}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Texting ID */}
           <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="textingId">Texting ID</Label>
              <p id="textingId" className="text-lg font-medium font-mono">{textingId || 'Not set'}</p>
            </div>
            <Dialog open={isTextingIdDialogOpen} onOpenChange={setTextingIdDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={hasCustomizedId}>Edit</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Texting ID</DialogTitle>
                  <CardDescription>You can customize your Texting ID. This can only be done once.</CardDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                  <Label htmlFor="textingIdInput">New Texting ID</Label>
                  <Input id="textingIdInput" placeholder="xxxx-xxxx" value={textingIdInput} onChange={handleTextingIdChange} maxLength={9}/>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleTextingIdSave}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Username / Email */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="username">Username (Email)</Label>
              <p id="username" className="text-lg font-medium font-mono tracking-wider">
                {showEmail ? user?.email : obscureEmail(user?.email)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEmail(!showEmail)}>{showEmail ? "Hide" : "Show"}</Button>
            </div>
          </div>
          
           {/* Account Visibility */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="visibility-switch">Account Visibility</Label>
              <p className="text-sm text-muted-foreground">
                {visibility === 'public' ? 'Your profile is discoverable in search.' : 'Your profile is hidden from search.'}
              </p>
            </div>
             <Switch 
                id="visibility-switch" 
                checked={visibility === 'public'} 
                onCheckedChange={(checked) => handleVisibilityChange(checked ? 'public' : 'private')} 
             />
          </div>


          {/* Password */}
          {!isGoogleUser && (
            <div className="flex items-center justify-between">
                <div>
                <Label>Password</Label>
                <p className="text-lg font-mono tracking-widest">••••••••</p>
                </div>
                <Dialog open={isPasswordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline">Edit</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                    <div className='space-y-2'>
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    </div>
                    </div>
                    <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handlePasswordSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
                </Dialog>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Personalization</CardTitle>
            <CardDescription>Customize the look and feel of the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Label htmlFor="theme-select">Theme</Label>
                    <p className="text-sm text-muted-foreground">Select a color theme for the UI.</p>
                </div>
                <Select value={personalization.theme} onValueChange={(value) => handlePersonalizationChange('theme', value)}>
                    <SelectTrigger id="theme-select" className="w-[180px]">
                        <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                        {themes.map(theme => (
                            <SelectItem key={theme.value} value={theme.value}>{theme.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chat Filtration</CardTitle>
          <CardDescription>
            Automatically hide content from incoming messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <Label htmlFor="filter-links">Block Links</Label>
                    <p className="text-sm text-muted-foreground">Hide messages that contain URLs.</p>
                </div>
                <Switch id="filter-links" checked={chatFilters.blockLinks || false} onCheckedChange={(value) => handleFilterChange('blockLinks', value)} />
            </div>
            <div className="flex items-center justify-between">
                <div>
                    <Label htmlFor="filter-profanity">Block Profanity</Label>
                    <p className="text-sm text-muted-foreground">Hide messages that contain profane language.</p>
                </div>
                <Switch id="filter-profanity" checked={chatFilters.blockProfanity || false} onCheckedChange={(value) => handleFilterChange('blockProfanity', value)} />
            </div>
        </CardContent>
      </Card>

      {!isGoogleUser && (
      <Card>
        <CardHeader>
          <CardTitle>Security Question</CardTitle>
          <CardDescription>
            This question can be used to recover your account if you forget your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
           <div>
              <Label>Your Question</Label>
              <p className="text-lg font-medium">{savedSecurityQuestion || 'Not set'}</p>
            </div>
          <Dialog open={isSecurityQuestionDialogOpen} onOpenChange={setSecurityQuestionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">{savedSecurityQuestion ? "Edit" : "Set"}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{savedSecurityQuestion ? "Edit Security Question" : "Set Security Question"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="question" className="text-right">
                    Question
                  </Label>
                  <Select onValueChange={setSecurityQuestion} value={securityQuestion}>
                    <SelectTrigger className="col-span-3">
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
                     <Label htmlFor="custom-question" className="text-right col-span-1">
                      Custom
                    </Label>
                    <Input id="custom-question" className="col-span-3" placeholder="Type your question" value={customSecurityQuestion} onChange={(e) => setCustomSecurityQuestion(e.target.value)} />
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="answer" className="text-right">
                    Answer
                  </Label>
                  <Input id="answer" className="col-span-3" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="case-sensitive" className="text-right">
                    Case Sensitive
                  </Label>
                  <Switch id="case-sensitive" checked={isCaseSensitive} onCheckedChange={setCaseSensitive} />
                </div>
                {!isGoogleUser && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password-confirm" className="text-right">
                      Your Password
                    </Label>
                    <Input id="password-confirm" type="password" className="col-span-3" placeholder="Enter password to save" value={passwordForSave} onChange={(e) => setPasswordForSave(e.target.value)} />
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSecurityQuestionSave}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      )}

      <Dialog open={isAvatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Set New Profile Picture</DialogTitle>
                <CardDescription>
                    This will be your new avatar across the application.
                </CardDescription>
            </DialogHeader>
            <div className="flex justify-center items-center py-4">
                {newAvatarPreview && (
                  <Image src={newAvatarPreview} alt="New avatar preview" width={128} height={128} className="rounded-full aspect-square object-cover" />
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setAvatarDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAvatarSave}>Save and Set</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
