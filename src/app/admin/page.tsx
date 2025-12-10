
'use client';

import { MoreHorizontal, UserX, Edit, Trash2, PlusCircle, Image as ImageIcon, FileText, Link as LinkIcon, MessageSquare, Upload, Maximize, Lock, Building2, Eye } from 'lucide-react';
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
import { collection, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { resetPassword } from '@/ai/flows/reset-password-flow';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';


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
  logoUrl?: string;
  actionType: 'url' | 'popup' | 'enlarge';
  linkUrl?: string;
  popupContent?: string;
  status: 'active' | 'disabled';
  displayWeight: number;
  location: 'header' | 'sidebar' | 'both';
};


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
      toast({ variant: 'destructive', title: 'Error', description: `Failed to update password: ${error.message}` });
    } finally {
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
    const [isEditDialogOpen, setEditDialogOpen] = useState(false);
    const [currentPromo, setCurrentPromo] = useState<Partial<Promotion> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!firestore) return;
        const promoColRef = collection(firestore, 'Sponsorships');
        const unsubscribe = onSnapshot(promoColRef, (snapshot) => {
            const promoList: Promotion[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Promotion));
            setPromotions(promoList.sort((a,b) => b.displayWeight - a.displayWeight));
        });
        return () => unsubscribe();
    }, [firestore]);
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 500 * 1024) { // 500KB limit
                toast({ variant: 'destructive', title: "File too large", description: 'Please select an image smaller than 500KB for Base64 encoding.' });
                return;
            }
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const dataUrl = loadEvent.target?.result as string;
                handleDialogInputChange('content', dataUrl);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEdit = (promo: Promotion) => {
        setCurrentPromo(promo);
        setEditDialogOpen(true);
    };

    const handleAddNew = () => {
        setCurrentPromo({
            title: '',
            type: 'text',
            content: '',
            logoUrl: '',
            actionType: 'url',
            linkUrl: '',
            popupContent: '',
            location: 'both',
            status: 'active',
            displayWeight: 1
        });
        setEditDialogOpen(true);
    };

    const handleSave = async () => {
        if (!firestore || !currentPromo) return;

        try {
            const promoData = { ...currentPromo };
            if (promoData.id) {
                const docRef = doc(firestore, 'Sponsorships', promoData.id);
                delete promoData.id;
                await setDoc(docRef, promoData, { merge: true });
                toast({ title: "Promotion Updated" });
            } else {
                await addDoc(collection(firestore, 'Sponsorships'), {
                    ...promoData,
                    createdAt: serverTimestamp()
                });
                toast({ title: "Promotion Added" });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error Saving Promotion', description: error.message });
        } finally {
            setEditDialogOpen(false);
            setCurrentPromo(null);
        }
    };
    
    const handleDelete = async (promoId: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'Sponsorships', promoId));
            toast({ title: 'Promotion Deleted' });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error Deleting Promotion', description: error.message });
        }
    };

    const handleDialogInputChange = (field: keyof Promotion, value: any) => {
        if (currentPromo) {
             setCurrentPromo({ ...currentPromo, [field]: value });
        }
    }

    return (
        <>
            <Card>
                <CardHeader className='flex-row items-center justify-between'>
                    <div>
                        <CardTitle>Sponsors & Promotions</CardTitle>
                        <CardDescription>
                            Manage advertisements displayed in the app.
                        </CardDescription>
                    </div>
                    <Button onClick={handleAddNew}>
                        <PlusCircle className='mr-2' /> Add New
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {promotions.map((promo) => (
                                <TableRow key={promo.id}>
                                    <TableCell className='font-medium'>{promo.title}</TableCell>
                                    <TableCell><Badge variant="outline">{promo.type}</Badge></TableCell>
                                    <TableCell><Badge variant="outline">{promo.location}</Badge></TableCell>
                                    <TableCell><Badge variant={promo.status === 'active' ? 'default' : 'secondary'}>{promo.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(promo)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(promo.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{currentPromo?.id ? 'Edit Promotion' : 'Add New Promotion'}</DialogTitle>
                    </DialogHeader>
                    {currentPromo && (
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Editor Column */}
                            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                                <div className="space-y-2">
                                    <Label htmlFor="promo-title">Title</Label>
                                    <Input id="promo-title" value={currentPromo.title} onChange={(e) => handleDialogInputChange('title', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="promo-type">Type</Label>
                                    <Select value={currentPromo.type} onValueChange={(v) => handleDialogInputChange('type', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="image">Image</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="promo-content">{currentPromo.type === 'image' ? 'Image URL or Base64' : 'Text Content'}</Label>
                                    <Textarea id="promo-content" value={currentPromo.content} onChange={(e) => handleDialogInputChange('content', e.target.value)} />
                                     {currentPromo.type === 'image' && (
                                        <>
                                            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                                <Upload className="mr-2 h-4 w-4" /> Upload Image
                                            </Button>
                                            <Input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/png, image/jpeg, image/gif" />
                                        </>
                                     )}
                                </div>
                                {currentPromo.type === 'text' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="promo-logoUrl">Logo URL or Base64</Label>
                                        <Input id="promo-logoUrl" value={currentPromo.logoUrl || ''} onChange={(e) => handleDialogInputChange('logoUrl', e.target.value)} />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="promo-actionType">Action Type</Label>
                                    <Select value={currentPromo.actionType} onValueChange={(v) => handleDialogInputChange('actionType', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="url">Open URL</SelectItem>
                                            <SelectItem value="popup">Show Popup</SelectItem>
                                            <SelectItem value="enlarge">Enlarge Image</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {currentPromo.actionType === 'url' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="promo-linkUrl">Link URL</Label>
                                        <Input id="promo-linkUrl" value={currentPromo.linkUrl || ''} onChange={(e) => handleDialogInputChange('linkUrl', e.target.value)} />
                                    </div>
                                )}
                                {currentPromo.actionType === 'popup' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="promo-popupContent">Popup Content</Label>
                                        <Textarea id="promo-popupContent" value={currentPromo.popupContent || ''} onChange={(e) => handleDialogInputChange('popupContent', e.target.value)} />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="promo-location">Location</Label>
                                    <Select value={currentPromo.location} onValueChange={(v) => handleDialogInputChange('location', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="header">Header</SelectItem>
                                            <SelectItem value="sidebar">Sidebar</SelectItem>
                                            <SelectItem value="both">Both</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="promo-displayWeight">Display Weight</Label>
                                    <Input id="promo-displayWeight" type="number" value={currentPromo.displayWeight} onChange={(e) => handleDialogInputChange('displayWeight', Number(e.target.value))} />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch id="promo-status" checked={currentPromo.status === 'active'} onCheckedChange={(c) => handleDialogInputChange('status', c ? 'active' : 'disabled')} />
                                    <Label htmlFor="promo-status">Status ({currentPromo.status})</Label>
                                </div>
                            </div>
                            {/* Preview Column */}
                            <div className="space-y-4 py-4">
                                <h3 className="font-medium text-lg flex items-center"><Eye className="mr-2" /> Live Preview</h3>
                                <div className="space-y-6 rounded-lg border p-4 bg-muted/30">
                                    {/* Header Preview */}
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Header Preview</Label>
                                        <Card className="overflow-hidden bg-muted/50 mt-1">
                                            <CardContent className="flex items-center justify-center p-0 aspect-[16/2] relative">
                                                {currentPromo.type === 'image' ? (
                                                    currentPromo.content ? <Image src={currentPromo.content} alt="Header Preview" fill style={{ objectFit: "cover" }} /> : <div className="flex items-center text-muted-foreground"><ImageIcon className="mr-2"/>No Image</div>
                                                ) : (
                                                    <div className="text-center p-2 flex flex-col items-center justify-center gap-1">
                                                        {currentPromo.logoUrl && <Image src={currentPromo.logoUrl} alt="logo" width={24} height={24} className="rounded-sm object-contain" />}
                                                        <h3 className="font-semibold text-sm">{currentPromo.title || 'Title'}</h3>
                                                        <p className="text-xs text-foreground/80">{currentPromo.content || 'Content'}</p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                    {/* Sidebar Preview */}
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Sidebar Preview</Label>
                                        <Card className="overflow-hidden bg-muted/50 mt-1 w-40 mx-auto">
                                            <CardContent className="flex items-center justify-center p-0 aspect-square relative">
                                                {currentPromo.type === 'image' ? (
                                                     currentPromo.content ? <Image src={currentPromo.content} alt="Sidebar Preview" fill style={{ objectFit: "cover" }} /> : <div className="flex items-center text-muted-foreground"><ImageIcon className="mr-2"/>No Image</div>
                                                ) : (
                                                    <div className="text-center p-2 flex flex-col items-center justify-center gap-1">
                                                        {currentPromo.logoUrl && <Image src={currentPromo.logoUrl} alt="logo" width={32} height={32} className="rounded-sm object-contain mb-1" />}
                                                        <h3 className="font-semibold text-base leading-tight">{currentPromo.title || 'Title'}</h3>
                                                        <p className="text-xs text-foreground/80 mt-1">{currentPromo.content || 'Content'}</p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        </div>
                     )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
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
