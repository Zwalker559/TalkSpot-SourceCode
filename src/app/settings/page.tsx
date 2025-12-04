
'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot, writeBatch, setDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { useTranslation } from '@/hooks/use-translation';
import { Skeleton } from '@/components/ui/skeleton';

const presetQuestions = [
  "What was your first pet's name?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "In what city were you born?",
];

const themes = [
  { value: 'theme-classic', label: 'Classic' },
  { value: 'theme-classic-l', label: 'Classic (L)' },
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
];

const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'ja', label: 'Japanese' },
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
  const [personalization, setPersonalization] = useState<PersonalizationSettings>({ theme: 'theme-classic', language: 'en' });
  const { t, isLoading: isTranslationLoading } = useTranslation(personalization.language);
  
  // Visibility State
  const [visibility, setVisibility] = useState<Visibility>('private');

  
  const finalSecurityQuestion = securityQuestion === 'custom' ? customSecurityQuestion : securityQuestion;

  const isGoogleUser = user?.providerData.some(p => p.providerId === 'google.com');

  useEffect(() => {
    if (user && firestore) {
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
          setPersonalization(data.personalization || { theme: 'theme-classic', language: 'en' });
          setVisibility(data.visibility || 'private');
        }
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
        });
         return () => {
             unsubscribeUser();
             unsubscribeRecovery();
         };
      } else {
          return () => unsubscribeUser();
      }
    }
  }, [user, firestore, isGoogleUser]);

  const handleDisplayNameSave = async () => {
    if (!user || !firestore) return;
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

      toast({ title: t('toasts.displayNameSuccessTitle'), description: t('toasts.displayNameSuccessDescription') });
      setDisplayNameDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('toasts.errorTitle'), description: error.message });
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
        toast({ variant: 'destructive', title: t('toasts.textingIdInvalidFormatTitle'), description: t('toasts.textingIdInvalidFormatDescription') });
        return;
    }

    try {
        const lookupsRef = collection(firestore, 'user_lookups');
        const q = query(lookupsRef, where('textingId', '==', textingIdInput));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty && querySnapshot.docs[0].id !== user.uid) {
             toast({ variant: 'destructive', title: t('toasts.textingIdTakenTitle'), description: t('toasts.textingIdTakenDescription') });
            return;
        }
        
        const batch = writeBatch(firestore);

        const userDocRef = doc(firestore, 'users', user.uid);
        batch.update(userDocRef, { textingId: textingIdInput, textingIdIsSet: true });

        const lookupDocRef = doc(firestore, 'user_lookups', user.uid);
        batch.update(lookupDocRef, { textingId: textingIdInput });
        
        await batch.commit();
        
        toast({ title: t('toasts.textingIdSuccessTitle'), description: t('toasts.textingIdSuccessDescription') });
        setTextingIdDialogOpen(false);
    } catch (error: any) {
        console.error("Error updating texting ID:", error);
        toast({ variant: 'destructive', title: t('toasts.errorTitle'), description: error.message });
    }
  };


  const handlePasswordSave = async () => {
    if (!user || !user.email) {
      toast({ variant: 'destructive', title: t('toasts.userNotFoundErrorTitle'), description: t('toasts.userNotFoundErrorDescription') });
      return;
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast({ title: t('toasts.passwordSuccessTitle'), description: t('toasts.passwordSuccessDescription') });
      setPasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('toasts.errorTitle'), description: t('toasts.passwordErrorDescription') });
    }
  }

  const handleSecurityQuestionSave = async () => {
    if (!user || !user.email) {
      toast({ variant: 'destructive', title: t('toasts.userNotFoundErrorTitle') });
      return;
    }
    if (!finalSecurityQuestion || !securityAnswer) {
      toast({ variant: 'destructive', title: t('toasts.securityQuestionErrorTitle'), description: t('toasts.securityQuestionErrorDescription') });
      return;
    }
    
    if (!passwordForSave) {
        toast({ variant: 'destructive', title: t('toasts.errorTitle'), description: t('toasts.providePasswordError') });
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
      toast({ title: t('toasts.successTitle'), description: t('toasts.securityQuestionSuccessDescription') });
      setSecurityQuestionDialogOpen(false);
      setPasswordForSave('');
      setSecurityAnswer('');

    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast({ variant: 'destructive', title: t('toasts.errorTitle'), description: t('toasts.incorrectPasswordError') });
      } else {
        toast({ variant: 'destructive', title: t('toasts.errorTitle'), description: t('toasts.genericError') });
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
        toast({ title: t('toasts.filtersSuccess') });
    } catch (error) {
        console.error("Error updating filter settings:", error);
        toast({ variant: 'destructive', title: t('toasts.errorTitle'), description: t('toasts.filtersError') });
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
        toast({ title: t(`toasts.personalizationSuccess.${settingName}`) });
    } catch (error) {
        console.error(`Error updating ${settingName}:`, error);
        toast({ variant: 'destructive', title: t('toasts.errorTitle'), description: t(`toasts.personalizationError.${settingName}`) });
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
          toast({ variant: 'destructive', title: t('toasts.fileTooLargeTitle'), description: t('toasts.fileTooLargeDescription') });
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

        toast({ title: t('toasts.avatarSuccessTitle'), description: t('toasts.avatarSuccessDescription') });
    } catch (error: any) {
        console.error("Error updating profile picture:", error);
        toast({ variant: 'destructive', title: t('toasts.errorTitle'), description: t('toasts.avatarErrorDescription') });
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

  if (isTranslationLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('account.title')}</CardTitle>
          <CardDescription>
            {t('account.description')}
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
                <Label>{t('account.avatarLabel')}</Label>
                <p className="text-sm text-muted-foreground">{t('account.avatarDescription')}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>{t('buttons.edit')}</Button>
            <Input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/png, image/jpeg, image/gif" />
          </div>

          {/* Display Name */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="displayName">{t('account.displayNameLabel')}</Label>
              <p id="displayName" className="text-lg font-medium">{displayName}</p>
            </div>
            <Dialog open={isDisplayNameDialogOpen} onOpenChange={setDisplayNameDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">{t('buttons.edit')}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('account.displayNameDialogTitle')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 py-4">
                  <Label htmlFor="displayNameInput">{t('account.displayNameDialogLabel')}</Label>
                  <Input id="displayNameInput" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t('buttons.cancel')}</Button>
                  </DialogClose>
                  <Button onClick={handleDisplayNameSave}>{t('buttons.save')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Texting ID */}
           <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="textingId">{t('account.textingIdLabel')}</Label>
              <p id="textingId" className="text-lg font-medium font-mono">{textingId || 'Not set'}</p>
            </div>
            <Dialog open={isTextingIdDialogOpen} onOpenChange={setTextingIdDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={hasCustomizedId}>{t('buttons.edit')}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('account.textingIdDialogTitle')}</DialogTitle>
                  <CardDescription>{t('account.textingIdDialogDescription')}</CardDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                  <Label htmlFor="textingIdInput">{t('account.textingIdDialogLabel')}</Label>
                  <Input id="textingIdInput" placeholder="xxxx-xxxx" value={textingIdInput} onChange={handleTextingIdChange} maxLength={9}/>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t('buttons.cancel')}</Button>
                  </DialogClose>
                  <Button onClick={handleTextingIdSave}>{t('buttons.save')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Username / Email */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="username">{t('account.emailLabel')}</Label>
              <p id="username" className="text-lg font-medium font-mono tracking-wider">
                {showEmail ? user?.email : obscureEmail(user?.email)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEmail(!showEmail)}>{showEmail ? t('buttons.hide') : t('buttons.show')}</Button>
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
                <Label>{t('account.passwordLabel')}</Label>
                <p className="text-lg font-mono tracking-widest">••••••••</p>
                </div>
                <Dialog open={isPasswordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline">{t('buttons.edit')}</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                    <DialogTitle>{t('account.passwordDialogTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                    <div className='space-y-2'>
                        <Label htmlFor="currentPassword">{t('account.passwordDialogCurrentLabel')}</Label>
                        <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor="newPassword">{t('account.passwordDialogNewLabel')}</Label>
                        <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    </div>
                    </div>
                    <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">{t('buttons.cancel')}</Button>
                    </DialogClose>
                    <Button onClick={handlePasswordSave}>{t('buttons.save')}</Button>
                    </DialogFooter>
                </DialogContent>
                </Dialog>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>{t('personalization.title')}</CardTitle>
            <CardDescription>{t('personalization.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Label htmlFor="theme-select">{t('personalization.themeLabel')}</Label>
                    <p className="text-sm text-muted-foreground">{t('personalization.themeDescription')}</p>
                </div>
                <Select value={personalization.theme} onValueChange={(value) => handlePersonalizationChange('theme', value)}>
                    <SelectTrigger id="theme-select" className="w-[180px]">
                        <SelectValue placeholder={t('personalization.themePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                        {themes.map(theme => (
                            <SelectItem key={theme.value} value={theme.value}>{theme.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center justify-between">
                <div>
                    <Label htmlFor="language-select">{t('personalization.languageLabel')}</Label>
                    <p className="text-sm text-muted-foreground">{t('personalization.languageDescription')}</p>
                </div>
                 <Select value={personalization.language} onValueChange={(value) => handlePersonalizationChange('language', value)}>
                    <SelectTrigger id="language-select" className="w-[180px]">
                        <SelectValue placeholder={t('personalization.languagePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                        {languages.map(lang => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('filters.title')}</CardTitle>
          <CardDescription>
            {t('filters.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <Label htmlFor="filter-links">{t('filters.linksLabel')}</Label>
                    <p className="text-sm text-muted-foreground">{t('filters.linksDescription')}</p>
                </div>
                <Switch id="filter-links" checked={chatFilters.blockLinks || false} onCheckedChange={(value) => handleFilterChange('blockLinks', value)} />
            </div>
            <div className="flex items-center justify-between">
                <div>
                    <Label htmlFor="filter-profanity">{t('filters.profanityLabel')}</Label>
                    <p className="text-sm text-muted-foreground">{t('filters.profanityDescription')}</p>
                </div>
                <Switch id="filter-profanity" checked={chatFilters.blockProfanity || false} onCheckedChange={(value) => handleFilterChange('blockProfanity', value)} />
            </div>
        </CardContent>
      </Card>

      {!isGoogleUser && (
      <Card>
        <CardHeader>
          <CardTitle>{t('security.title')}</CardTitle>
          <CardDescription>
            {t('security.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
           <div>
              <Label>{t('security.questionLabel')}</Label>
              <p className="text-lg font-medium">{savedSecurityQuestion || 'Not set'}</p>
            </div>
          <Dialog open={isSecurityQuestionDialogOpen} onOpenChange={setSecurityQuestionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">{savedSecurityQuestion ? t('buttons.edit') : t('buttons.set')}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{savedSecurityQuestion ? t('security.editDialogTitle') : t('security.setDialogTitle')}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="question" className="text-right">
                    {t('security.dialogQuestionLabel')}
                  </Label>
                  <Select onValueChange={setSecurityQuestion} value={securityQuestion}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder={t('security.dialogQuestionPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {presetQuestions.map((q, i) => (
                        <SelectItem key={i} value={q}>{q}</SelectItem>
                      ))}
                      <SelectItem value="custom">{t('security.dialogQuestionCustom')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {securityQuestion === 'custom' && (
                  <div className="grid grid-cols-4 items-center gap-4">
                     <Label htmlFor="custom-question" className="text-right col-span-1">
                      {t('security.dialogCustomQuestionLabel')}
                    </Label>
                    <Input id="custom-question" className="col-span-3" placeholder={t('security.dialogCustomQuestionPlaceholder')} value={customSecurityQuestion} onChange={(e) => setCustomSecurityQuestion(e.target.value)} />
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="answer" className="text-right">
                    {t('security.dialogAnswerLabel')}
                  </Label>
                  <Input id="answer" className="col-span-3" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="case-sensitive" className="text-right">
                    {t('security.dialogCaseSensitiveLabel')}
                  </Label>
                  <Switch id="case-sensitive" checked={isCaseSensitive} onCheckedChange={setCaseSensitive} />
                </div>
                {!isGoogleUser && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password-confirm" className="text-right">
                      {t('security.dialogPasswordLabel')}
                    </Label>
                    <Input id="password-confirm" type="password" className="col-span-3" placeholder={t('security.dialogPasswordPlaceholder')} value={passwordForSave} onChange={(e) => setPasswordForSave(e.target.value)} />
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t('buttons.cancel')}</Button>
                </DialogClose>
                <Button onClick={handleSecurityQuestionSave}>{t('buttons.saveChanges')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      )}

      <Dialog open={isAvatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('account.avatarDialogTitle')}</DialogTitle>
                <CardDescription>
                    {t('account.avatarDialogDescription')}
                </CardDescription>
            </DialogHeader>
            <div className="flex justify-center items-center py-4">
                {newAvatarPreview && (
                  <Image src={newAvatarPreview} alt="New avatar preview" width={128} height={128} className="rounded-full aspect-square object-cover" />
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setAvatarDialogOpen(false)}>{t('buttons.cancel')}</Button>
                <Button onClick={handleAvatarSave}>{t('buttons.saveAndSet')}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
