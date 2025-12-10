

'use client';

import { MoreHorizontal, UserX, Edit, Trash2, PlusCircle, Image as ImageIcon, FileText, Link as LinkIcon, MessageSquare, Upload, Maximize, Lock, Building2, Eye, Star } from 'lucide-react';
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
import { collection, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, setDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
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
  role: 'User' | 'Sub-Manager' | 'Lead-Manager' | 'Co-Owner' | 'Owner';
  status?: 'Active' | 'Suspended';
  suspensionReason?: string;
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


const ROLES = ['User', 'Sub-Manager', 'Lead-Manager', 'Co-Owner', 'Owner'];
const ROLE_HIERARCHY: { [key: string]: number } = {
  'User': 0,
  'Sub-Manager': 1,
  'Lead-Manager': 2,
  'Co-Owner': 3,
  'Owner': 4,
};


function UserManagementTool() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Dialog states
  const [isRemoveDialogOpen, setRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<UserProfile | null>(null);

  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  
  // State for the unified edit dialog
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editTextingId, setEditTextingId] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState<'Active' | 'Suspended'>('Active');
  const [editSuspensionReason, setEditSuspensionReason] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');


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
          suspensionReason: data.suspensionReason || '',
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
    if (!currentUserRole || !targetUser.role || currentUser.uid === targetUser.uid) {
        return false;
    }
    const currentUserLevel = ROLE_HIERARCHY[currentUserRole];
    const targetUserLevel = ROLE_HIERARCHY[targetUser.role];
    
    return currentUserLevel > targetUserLevel;
  };

  const canChangeRoleTo = (targetRole: string) => {
      if (!currentUserRole) return false;
      const currentUserLevel = ROLE_HIERARCHY[currentUserRole];
      const targetRoleLevel = ROLE_HIERARCHY[targetRole];

      // Owner and Co-Owner can't be assigned from the UI
      if (['Owner', 'Co-Owner'].includes(targetRole)) {
          return false;
      }
      
      return currentUserLevel > targetRoleLevel;
  }
  
  const handleEditClick = (user: UserProfile) => {
    setUserToEdit(user);
    setEditDisplayName(user.displayName);
    setEditTextingId(user.textingId);
    setEditRole(user.role);
    setEditStatus(user.status || 'Active');
    setEditSuspensionReason(user.suspensionReason || '');
    setEditNewPassword('');
    setEditDialogOpen(true);
  }

  const handleRemoveClick = (user: UserProfile) => {
    setUserToRemove(user);
    setRemoveDialogOpen(true);
  }

  const handleSaveChanges = async () => {
    if (!firestore || !userToEdit) return;

    try {
        const batch = writeBatch(firestore);
        const userDocRef = doc(firestore, 'users', userToEdit.uid);
        const lookupDocRef = doc(firestore, 'user_lookups', userToEdit.uid);

        const updates: any = {};
        const lookupUpdates: any = {};

        // Display Name
        if (editDisplayName !== userToEdit.displayName && editDisplayName.trim()) {
            updates.displayName = editDisplayName;
            lookupUpdates.displayName = editDisplayName;
        }

        // Texting ID
        if (editTextingId !== userToEdit.textingId) {
            updates.textingId = editTextingId;
            lookupUpdates.textingId = editTextingId;
        }

        // Role
        if (editRole !== userToEdit.role && currentUserRole !== 'Sub-Manager') {
            updates.role = editRole;
        }

        // Status & Suspension Reason
        if (editStatus !== userToEdit.status) {
            updates.status = editStatus;
            if (editStatus === 'Suspended') {
                if (!editSuspensionReason.trim()) {
                    toast({ variant: 'destructive', title: 'Error', description: 'A reason is required to suspend a user.' });
                    return;
                }
                updates.suspensionReason = editSuspensionReason;
            } else {
                updates.suspensionReason = ''; // Clear reason on activation
            }
        }
        
        batch.update(userDocRef, updates);
        if (Object.keys(lookupUpdates).length > 0) {
            batch.update(lookupDocRef, lookupUpdates);
        }
        
        // Password Reset
        if (editNewPassword && (currentUserRole === 'Owner' || currentUserRole === 'Co-Owner')) {
             if (editNewPassword.length < 6) {
                toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 6 characters long.' });
                return;
            }
            await resetPassword({ uid: userToEdit.uid, newPassword: editNewPassword });
        }
        
        await batch.commit();

        toast({ title: 'Success', description: 'User details updated.' });
        setEditDialogOpen(false);
        setUserToEdit(null);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to update: ${error.message}` });
    }
  };

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
  
  // Determine permissions for the edit dialog
  const canEditRoles = currentUserRole && ['Owner', 'Co-Owner', 'Lead-Manager'].includes(currentUserRole);
  const canEditPassword = currentUserRole && ['Owner', 'Co-Owner'].includes(currentUserRole);

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
                     <Badge variant={['Owner', 'Co-Owner'].includes(user.role) ? 'destructive' : ['Lead-Manager'].includes(user.role) ? 'secondary' : 'outline'}>
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
                            Edit User
                        </DropdownMenuItem>
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit User: {userToEdit?.displayName}</DialogTitle>
          <DialogDescription>
            Make changes to the user's profile. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[60vh] overflow-y-auto pr-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="displayName" className="text-right">
              Display Name
            </Label>
            <Input
              id="displayName"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="textingId" className="text-right">
              Texting ID
            </Label>
            <Input
              id="textingId"
              value={editTextingId}
              onChange={(e) => setEditTextingId(e.target.value)}
              className="col-span-3 font-mono"
            />
          </div>

          {canEditRoles && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                  Role
                </Label>
                <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger className="col-span-3">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ROLES.map(role => (
                            <SelectItem key={role} value={role} disabled={!canChangeRoleTo(role)}>
                                {role}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Status
            </Label>
            <Select value={editStatus} onValueChange={(v) => setEditStatus(v as 'Active' | 'Suspended')}>
                <SelectTrigger className="col-span-3">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
            </Select>
          </div>

          {editStatus === 'Suspended' && (
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="suspensionReason" className="text-right pt-2">
                    Reason
                </Label>
                <Textarea 
                    id="suspensionReason"
                    placeholder="Reason for suspension..."
                    value={editSuspensionReason}
                    onChange={(e) => setEditSuspensionReason(e.target.value)}
                    className="col-span-3"
                />
              </div>
          )}
          
          {canEditPassword && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="newPassword" className="text-right">
                    New Password
                </Label>
                <Input 
                    id="newPassword"
                    type="password"
                    placeholder="Leave blank to keep unchanged"
                    value={editNewPassword}
                    onChange={(e) => setEditNewPassword(e.target.value)}
                    className="col-span-3"
                />
              </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveChanges}>Save Changes</Button>
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
    const [isPreviewOpen, setPreviewOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fallbackPromo: Promotion = {
        id: 'fallback',
        title: 'Your Ad Here',
        type: 'text',
        content: 'This is the default ad. Edit it in the admin panel.',
        actionType: 'popup',
        popupContent: 'This is fallback content.',
        status: 'active',
        location: 'both',
        displayWeight: 0,
    };

    useEffect(() => {
        if (!firestore) return;

        const promoColRef = collection(firestore, 'Sponsorships');
        const unsubscribe = onSnapshot(promoColRef, async (snapshot) => {
            let promoList: Promotion[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Promotion));

            const fallbackExists = promoList.some(p => p.id === 'fallback');
            if (!fallbackExists) {
                try {
                    await setDoc(doc(firestore, 'Sponsorships', 'fallback'), fallbackPromo);
                    promoList.push(fallbackPromo);
                } catch (e) {
                    console.error("Could not create fallback promo:", e);
                }
            }

            setPromotions(promoList.sort((a, b) => {
                if (a.id === 'fallback') return 1;
                if (b.id === 'fallback') return -1;
                return b.displayWeight - a.displayWeight;
            }));
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
            displayWeight: 1,
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
                            Manage advertisements displayed in the app. The fallback ad is used when no others are active.
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
                            {promotions.length > 0 ? (
                                promotions.map((promo) => (
                                    <TableRow key={promo.id} className={promo.id === 'fallback' ? 'bg-muted/30' : ''}>
                                        <TableCell className='font-medium flex items-center'>
                                            {promo.title}
                                            {promo.id === 'fallback' && (
                                                <Badge variant="outline" className="ml-2 flex items-center gap-1">
                                                    <Star className="h-3 w-3" />
                                                    Fallback
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{promo.type}</Badge></TableCell>
                                        <TableCell><Badge variant="outline">{promo.location}</Badge></TableCell>
                                        <TableCell><Badge variant={promo.status === 'active' ? 'default' : 'secondary'}>{promo.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(promo)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(promo.id)} disabled={promo.id === 'fallback'}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center">
                                        No Sponsorships found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{currentPromo?.id ? 'Edit Promotion' : 'Add New Promotion'}</DialogTitle>
                    </DialogHeader>
                    {currentPromo && (
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

                            {currentPromo.type === 'text' ? (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="promo-content">Text Content</Label>
                                        <Textarea id="promo-content" value={currentPromo.content} onChange={(e) => handleDialogInputChange('content', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="promo-logoUrl">Logo URL (Optional, Base64 or web URL)</Label>
                                        <Input id="promo-logoUrl" value={currentPromo.logoUrl || ''} onChange={(e) => handleDialogInputChange('logoUrl', e.target.value)} />
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-2">
                                    <Label>Image</Label>
                                    <Card>
                                        <CardContent className="p-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="promo-content" className="text-sm text-muted-foreground">Image URL or Base64</Label>
                                                 <Textarea id="promo-content" placeholder="https://... or data:image/..." value={currentPromo.content} onChange={(e) => handleDialogInputChange('content', e.target.value)} />
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                                    <Upload className="mr-2 h-4 w-4" /> Upload Image
                                                </Button>
                                                <span className="text-xs text-muted-foreground">Or paste URL above.</span>
                                            </div>
                                             <Input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/png, image/jpeg, image/gif" />
                                        </CardContent>
                                    </Card>
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
                            <div className="grid grid-cols-2 gap-4">
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
                                    <Input id="promo-displayWeight" type="number" value={currentPromo.displayWeight} onChange={(e) => handleDialogInputChange('displayWeight', e.target.valueAsNumber || 0)} />
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <Switch id="promo-status" checked={currentPromo.status === 'active'} onCheckedChange={(c) => handleDialogInputChange('status', c ? 'active' : 'disabled')} />
                                <Label htmlFor="promo-status">Status ({currentPromo.status})</Label>
                            </div>
                        </div>
                     )}
                    <DialogFooter className="sm:justify-between">
                         <Dialog open={isPreviewOpen} onOpenChange={setPreviewOpen}>
                            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                                <Eye className="mr-2" /> Live Preview
                            </Button>
                             <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                    <DialogTitle>Promotion Preview</DialogTitle>
                                     <DialogDescription>
                                        This is a live preview of how your ad will appear.
                                    </DialogDescription>
                                </DialogHeader>
                                {currentPromo && (
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
                                )}
                            </DialogContent>
                        </Dialog>
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                             <Button onClick={handleSave}>Save</Button>
                        </div>
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


  if (!['Lead-Manager', 'Sub-Manager', 'Co-Owner', 'Owner'].includes(userRole)) {
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

    