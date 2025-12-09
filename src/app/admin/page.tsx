

'use client';

import { MoreHorizontal, UserX, Edit, Trash2, PlusCircle, Image as ImageIcon, FileText, Link as LinkIcon, MessageSquare, Upload, Maximize, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEffect, useState, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { resetPassword } from '@/ai/flows/reset-password-flow';


type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'User' | 'Sub-Manager' | 'Lead-Manager';
  status?: 'Active' | 'Suspended';
  textingId: string;
};

type Promotion = {
    id: string;
    title: string;
    type: 'text' | 'image';
    content: string;
    actionType: 'url' | 'popup' | 'enlarge';
    linkUrl?: string;
    popupContent?: string;
    status: 'active' | 'disabled';
    displayWeight: number;
    createdAt?: any;
}

const ROLES = ['User', 'Sub-Manager', 'Lead-Manager'];

function UserManagementTool() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Dialog states
  const [isSuspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [userToSuspend, setUserToSuspend] = useState<UserProfile | null>(null);
  
  const [isRemoveDialogOpen, setRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<UserProfile | null>(null);

  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [newDisplayName, setNewDisplayName] = useState('');

  const [isPasswordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');


  useEffect(() => {
    if (!firestore) return;
    setLoading(true);
    
    const usersColRef = collection(firestore, 'users');
    const unsubscribe = onSnapshot(usersColRef, (snapshot) => {
      const userList: UserProfile[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        userList.push({
          uid: doc.id,
          displayName: data.displayName || 'No Name',
          email: data.email || 'No Email',
          photoURL: data.photoURL,
          role: data.role || 'User',
          status: data.status || 'Active',
          textingId: data.textingId,
        });
      });
      setUsers(userList);
      setLoading(false);
    }, (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: usersColRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);

  // Get current user's role to determine permissions
    useEffect(() => {
        if (currentUser && firestore) {
            const userDocRef = doc(firestore, 'users', currentUser.uid);
            const unsubscribe = onSnapshot(userDocRef, (doc) => {
                if (doc.exists()) {
                    setCurrentUserRole(doc.data().role);
                }
            }, (serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'get',
                });
                errorEmitter.emit('permission-error', permissionError);
            });
            return () => unsubscribe();
        }
    }, [currentUser, firestore]);

  const canManage = (targetUser: UserProfile) => {
    if (!currentUserRole || currentUser?.uid === targetUser.uid) return false;
    if (currentUserRole === 'Lead-Manager') {
        return targetUser.role !== 'Lead-Manager';
    }
    if (currentUserRole === 'Sub-Manager' && targetUser.role === 'User') {
        return true; 
    }
    return false;
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'users', userId);
    const data = { role: newRole };
    updateDoc(userDocRef, data)
      .then(() => {
        toast({ title: 'Success', description: 'User role updated.' });
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleSuspendClick = (user: UserProfile) => {
    setUserToSuspend(user);
    setSuspendDialogOpen(true);
  }

  const handleRemoveClick = (user: UserProfile) => {
    setUserToRemove(user);
    setRemoveDialogOpen(true);
  }

  const handleEditClick = (user: UserProfile) => {
    setUserToEdit(user);
    setNewDisplayName(user.displayName);
    setEditDialogOpen(true);
  }

  const handlePasswordClick = (user: UserProfile) => {
    setUserToEdit(user);
    setPasswordDialogOpen(true);
  };


  const confirmSuspendUser = async () => {
    if (!firestore || !userToSuspend) return;
    const newStatus = userToSuspend.status === 'Active' ? 'Suspended' : 'Active';
    const userDocRef = doc(firestore, 'users', userToSuspend.uid);
    const data = { status: newStatus };
    updateDoc(userDocRef, data)
        .then(() => {
            toast({ title: 'Success', description: `User has been ${newStatus.toLowerCase()}.` });
        })
        .catch((serverError) => {
             const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setSuspendDialogOpen(false);
            setUserToSuspend(null);
        });
  }

  const confirmRemoveUser = async () => {
     if (!firestore || !userToRemove) return;

    const batch = writeBatch(firestore);
    const userDocRef = doc(firestore, 'users', userToRemove.uid);
    const lookupDocRef = doc(firestore, 'user_lookups', userToRemove.uid);
    
    batch.delete(userDocRef);
    batch.delete(lookupDocRef);
    
    batch.commit()
      .then(() => {
        toast({ title: 'User Removed', description: `${userToRemove.displayName} has been removed.` });
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `batch delete on /users/${userToRemove.uid} and /user_lookups/${userToRemove.uid}`,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setRemoveDialogOpen(false);
        setUserToRemove(null);
      });
  };
  
  const handleSaveChanges = async () => {
    if (!firestore || !userToEdit) return;
    if (!newDisplayName.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Display name cannot be empty.' });
        return;
    }
    
    const userDocRef = doc(firestore, 'users', userToEdit.uid);
    const lookupDocRef = doc(firestore, 'user_lookups', userToEdit.uid);

    const batch = writeBatch(firestore);
    const data = { displayName: newDisplayName };
    batch.update(userDocRef, data);
    batch.update(lookupDocRef, data);

    batch.commit()
        .then(() => {
             toast({ title: 'Success', description: 'User details updated.' });
             setEditDialogOpen(false);
             setUserToEdit(null);
        })
        .catch((err) => {
            const permissionError = new FirestorePermissionError({
                path: `/users/${userToEdit.uid} and /user_lookups/${userToEdit.uid}`,
                operation: 'update',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
  };
  
  const handlePasswordSave = async () => {
    if (!userToEdit || !newPassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'Password cannot be empty.' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 6 characters long.' });
      return;
    }

    try {
      await resetPassword({ uid: userToEdit.uid, newPassword });
      toast({ title: 'Success', description: `Password for ${userToEdit.displayName} has been updated.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update password.' });
    } finally {
      // This will run regardless of success or failure
      setPasswordDialogOpen(false);
      setUserToEdit(null);
      setNewPassword('');
    }
  };


  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>
          View, edit, and manage all user accounts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                <TableRow>
                    <TableCell colSpan={4} className="text-center">Loading users...</TableCell>
                </TableRow>
            ) : (
                users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.photoURL} />
                        <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="font-medium">
                        {user.displayName}
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                     <Badge variant={user.role.includes('Manager') ? 'secondary' : 'outline'}>
                        {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'Active' ? 'default' : 'destructive'} className={user.status === 'Active' ? 'bg-green-500/20 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-500/30' : ''}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost" disabled={!canManage(user)}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEditClick(user)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Name
                        </DropdownMenuItem>
                         {currentUserRole === 'Lead-Manager' && (
                             <DropdownMenuItem onClick={() => handlePasswordClick(user)}>
                                <Lock className="mr-2 h-4 w-4" />
                                Edit Password
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleSuspendClick(user)}>
                            <UserX className="mr-2 h-4 w-4" />
                            {user.status === 'Active' ? 'Suspend' : 'Un-suspend'}
                        </DropdownMenuItem>
                         <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Change Role</DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    <DropdownMenuRadioGroup value={user.role} onValueChange={(newRole) => handleRoleChange(user.uid, newRole)}>
                                        {ROLES.map(role => (
                                             <DropdownMenuRadioItem key={role} value={role} disabled={(role === 'Lead-Manager' && currentUserRole !== 'Lead-Manager') || (role === 'Sub-Manager' && currentUserRole !== 'Lead-Manager')}>{role}</DropdownMenuRadioItem>
                                        ))}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                         </DropdownMenuSub>
                         <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/20 focus:text-destructive" onClick={() => handleRemoveClick(user)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <AlertDialog open={isSuspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    You are about to {userToSuspend?.status === 'Active' ? 'suspend' : 'un-suspend'} the user '{userToSuspend?.displayName}'. A suspended user cannot log in.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmSuspendUser} className={userToSuspend?.status === 'Active' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
                    {userToSuspend?.status === 'Active' ? 'Suspend Account' : 'Re-activate Account'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    <AlertDialog open={isRemoveDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Permanently Remove User?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action is irreversible. It will delete the user's profile from Firestore. To fully remove the user from authentication, a server-side function is required. Are you sure you want to proceed?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmRemoveUser} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
                    Remove User
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User: {userToEdit?.displayName}</DialogTitle>
          <DialogDescription>
            Make changes to the user's profile.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="displayName" className="text-right">
              Display Name
            </Label>
            <Input
              id="displayName"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveChanges}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
     <Dialog open={isPasswordDialogOpen} onOpenChange={setPasswordDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Password for: {userToEdit?.displayName}</DialogTitle>
           <DialogDescription>
            Enter a new password for the user.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newPassword" className="text-right">
              New Password
            </Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePasswordSave}>Save Password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function SponsorManagementTool() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);


    // Dialog states
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [promoToDelete, setPromoToDelete] = useState<Promotion | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [type, setType] = useState<'text' | 'image'>('text');
    const [content, setContent] = useState('');
    const [actionType, setActionType] = useState<'url' | 'popup' | 'enlarge'>('url');
    const [linkUrl, setLinkUrl] = useState('');
    const [popupContent, setPopupContent] = useState('');
    const [displayWeight, setDisplayWeight] = useState(1);
    const [imageBase64, setImageBase64] = useState<string | null>(null);


    useEffect(() => {
        if (!firestore) return;
        setLoading(true);
        const sponsorshipsColRef = collection(firestore, 'Sponsorships');
        const unsubscribe = onSnapshot(sponsorshipsColRef, snapshot => {
            const promoList: Promotion[] = [];
            snapshot.forEach(doc => {
                promoList.push({ id: doc.id, ...doc.data() } as Promotion);
            });
            // Sort by creation date, newest first
            setPromotions(promoList.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
            setLoading(false);
        }, (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: sponsorshipsColRef.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [firestore, toast]);
    
    const resetForm = () => {
        setTitle('');
        setType('text');
        setContent('');
        setActionType('url');
        setLinkUrl('');
        setPopupContent('');
        setDisplayWeight(1);
        setEditingPromo(null);
        setImageBase64(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const handleAddClick = () => {
        resetForm();
        setFormOpen(true);
    };
    
    const handleEditClick = (promo: Promotion) => {
        setEditingPromo(promo);
        setTitle(promo.title);
        setType(promo.type);
        setContent(promo.type === 'text' ? promo.content : '');
        if (promo.type === 'image') {
            setImageBase64(promo.content);
        } else {
            setImageBase64(null);
        }
        setActionType(promo.actionType || 'url');
        setLinkUrl(promo.linkUrl || '');
        setPopupContent(promo.popupContent || '');
        setDisplayWeight(promo.displayWeight);
        setFormOpen(true);
    }

    const handleDeleteClick = (promo: Promotion) => {
        setPromoToDelete(promo);
        setDeleteDialogOpen(true);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit
                toast({
                    variant: 'destructive',
                    title: 'Image too large',
                    description: 'Please upload an image smaller than 1MB.',
                });
                return;
            }
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const result = loadEvent.target?.result as string;
                setImageBase64(result);
                setContent(''); // Clear text content when image is uploaded
            };
            reader.readAsDataURL(file);
        }
    }


    const confirmDelete = async () => {
        if (!firestore || !promoToDelete) return;
        const docRef = doc(firestore, 'Sponsorships', promoToDelete.id);
        deleteDoc(docRef)
            .then(() => {
                toast({ title: "Promotion Deleted" });
                 setDeleteDialogOpen(false);
                setPromoToDelete(null);
            })
            .catch((serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
                 setDeleteDialogOpen(false);
                setPromoToDelete(null);
            });
    }

    const handleStatusToggle = async (promo: Promotion) => {
        if (!firestore) return;
        const newStatus = promo.status === 'active' ? 'disabled' : 'active';
        const docRef = doc(firestore, 'Sponsorships', promo.id);
        const data = { status: newStatus };
        updateDoc(docRef, data)
            .then(() => {
                toast({ title: 'Status Updated', description: `Promotion is now ${newStatus}.` });
            })
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'update',
                    requestResourceData: data,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };
    
   const handleSave = () => {
        if (!firestore) return;

        if (!title.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Title is required.' });
            return;
        }
        
        let finalContent: string;
        let finalActionType = actionType;

        if (type === 'image') {
            if (!imageBase64) {
                toast({ variant: 'destructive', title: 'Error', description: 'An image is required for image-type promotions.' });
                return;
            }
            finalContent = imageBase64;
             if (actionType !== 'url' && actionType !== 'popup' && actionType !== 'enlarge') {
              finalActionType = 'enlarge';
            }
        } else { // type === 'text'
            if (!content.trim()) {
                toast({ variant: 'destructive', title: 'Error', description: 'Ad Text is required for text-type promotions.' });
                return;
            }
            finalContent = content;
            if (finalActionType === 'enlarge') {
                finalActionType = 'popup';
            }
        }
        
        const promoData: Omit<Promotion, 'id' | 'createdAt'> & { createdAt?: any } = {
            title,
            type,
            content: finalContent,
            actionType: finalActionType,
            linkUrl: finalActionType === 'url' ? linkUrl : '',
            popupContent: finalActionType === 'popup' ? popupContent : '',
            displayWeight: Number(displayWeight) || 1,
            status: editingPromo?.status || 'active',
        };

        const onComplete = () => {
            toast({ title: editingPromo ? 'Promotion Updated' : 'Promotion Added' });
            setFormOpen(false);
            resetForm();
        };

        const onError = (serverError: any) => {
             const permissionError = new FirestorePermissionError({
                path: editingPromo ? doc(firestore, 'Sponsorships', editingPromo.id).path : collection(firestore, 'Sponsorships').path,
                operation: editingPromo ? 'update' : 'create',
                requestResourceData: promoData,
            });
            errorEmitter.emit('permission-error', permissionError);
        };

        if (editingPromo) {
            const docRef = doc(firestore, 'Sponsorships', editingPromo.id);
            updateDoc(docRef, promoData as any).then(onComplete).catch(onError);
        } else {
            promoData.createdAt = serverTimestamp();
            const collRef = collection(firestore, 'Sponsorships');
            addDoc(collRef, promoData).then(onComplete).catch(onError);
        }
    }


    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Sponsors & Promotions</CardTitle>
                        <CardDescription>Manage advertisements that appear in the app.</CardDescription>
                    </div>
                    <Button onClick={handleAddClick}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Promotion
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Weight</TableHead>
                                <TableHead><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
                            ) : promotions.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center">No promotions yet.</TableCell></TableRow>
                            ) : (
                                promotions.map(promo => {
                                    const isInvalidImageSrc = promo.type === 'image' && (!promo.content || (!promo.content.startsWith('data:image') && !promo.content.startsWith('http')));
                                    return (
                                    <TableRow key={promo.id}>
                                        <TableCell className="font-medium flex items-center gap-3">
                                            {promo.type === 'image' ? (
                                                isInvalidImageSrc ? (
                                                     <div className="w-10 h-10 flex items-center justify-center bg-destructive/20 rounded-md">
                                                        <ImageIcon className="h-5 w-5 text-destructive" />
                                                    </div>
                                                ) : (
                                                    <Image src={promo.content} alt={promo.title} width={40} height={40} className="rounded-md object-cover aspect-square"/>
                                                )
                                            ) : (
                                                <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-md">
                                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                            )}
                                            {promo.title}
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{promo.type}</Badge></TableCell>
                                        <TableCell><Badge variant="secondary">{promo.actionType}</Badge></TableCell>
                                        <TableCell>
                                             <Badge variant={promo.status === 'active' ? 'default' : 'destructive'} className={promo.status === 'active' ? 'bg-green-500/20 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-500/30' : ''}>
                                                {promo.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{promo.displayWeight}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleEditClick(promo)}>
                                                        <Edit className="mr-2 h-4 w-4"/>Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusToggle(promo)}>
                                                        <UserX className="mr-2 h-4 w-4" />{promo.status === 'active' ? 'Disable' : 'Enable'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteClick(promo)}>
                                                        <Trash2 className="mr-2 h-4 w-4"/>Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                )})
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingPromo ? 'Edit' : 'Add'} Promotion</DialogTitle>
                        <DialogDescription>Fill out the details for the promotion.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] pr-6">
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer Sale" />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Tabs defaultValue={type} onValueChange={(v) => setType(v as 'text' | 'image')} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4"/>Text</TabsTrigger>
                                        <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4"/>Image</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                           <div className="space-y-2">
                                {type === 'image' ? (
                                    <>
                                        <Label htmlFor="content">Image</Label>
                                        <div className="flex flex-col items-center gap-4">
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleImageUpload}
                                                className="hidden"
                                                accept="image/png, image/jpeg, image/gif"
                                            />
                                            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                                <Upload className="mr-2 h-4 w-4" />
                                                Upload Image
                                            </Button>
                                            {imageBase64 && (
                                                <div className="mt-2 p-2 border rounded-md w-full aspect-video relative">
                                                    <Image src={imageBase64} alt="Image preview" layout="fill" objectFit="contain" className="rounded-md" />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Label htmlFor="content">Ad Text</Label>
                                        <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder={'Your ad text here...'} />
                                    </>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="action-type">Click Action</Label>
                                <Select value={actionType} onValueChange={(v) => setActionType(v as 'url' | 'popup' | 'enlarge')}>
                                    <SelectTrigger id="action-type">
                                        <SelectValue placeholder="Select an action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="url"><LinkIcon className="mr-2 h-4 w-4" />Open URL</SelectItem>
                                        <SelectItem value="popup"><MessageSquare className="mr-2 h-4 w-4" />Show Pop-up</SelectItem>
                                        {type === 'image' && <SelectItem value="enlarge"><Maximize className="mr-2 h-4 w-4"/>Enlarge Image</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>
                            {actionType === 'url' && (
                                <div className="space-y-2">
                                    <Label htmlFor="linkUrl">Link URL</Label>
                                    <Input id="linkUrl" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com/product" />
                                </div>
                            )}
                            {actionType === 'popup' && (
                                <div className="space-y-2">
                                    <Label htmlFor="popupContent">Pop-up Content</Label>
                                    <Textarea id="popupContent" value={popupContent} onChange={(e) => setPopupContent(e.target.value)} placeholder="Enter the informational text for the pop-up..." />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="displayWeight">Display Weight</Label>
                                <Input id="displayWeight" type="number" min="1" value={displayWeight} onChange={(e) => setDisplayWeight(Number(e.target.value))} />
                                <p className="text-sm text-muted-foreground">A higher number means a higher chance of being displayed.</p>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>Cancel</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Promotion?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the promotion "{promoToDelete?.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

export default function AdminDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (user && firestore) {
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          setUserRole(doc.data().role);
        }
      });
      return () => unsubscribe();
    }
  }, [user, firestore]);

  if (!userRole) {
    // Still loading user role, show a loader or nothing
    return null;
  }


  if (!['Lead-Manager', 'Sub-Manager'].includes(userRole)) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground">
                You do not have permission to view this page.
            </p>
        </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Access administrative tools and manage your application.
        </p>
      </div>

      <Tabs defaultValue="user-management" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="user-management">User Management</TabsTrigger>
          <TabsTrigger value="sponsors">Sponsors</TabsTrigger>
        </TabsList>
        <TabsContent value="user-management" className="mt-6">
          <UserManagementTool />
        </TabsContent>
        <TabsContent value="sponsors" className="mt-6">
           <SponsorManagementTool />
        </TabsContent>
      </Tabs>
    </div>
  );
}

    
