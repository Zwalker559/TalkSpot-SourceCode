
'use client';

import { MoreHorizontal, UserX, Edit, Trash2, PlusCircle, Image as ImageIcon, FileText, Link, MessageSquare } from 'lucide-react';
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
import { useEffect, useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


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
    actionType: 'url' | 'popup';
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


  useEffect(() => {
    if (!firestore) return;
    setLoading(true);
    
    const unsubscribe = onSnapshot(collection(firestore, 'users'), (snapshot) => {
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
            });
            return () => unsubscribe();
        }
    }, [currentUser, firestore]);

  const canManage = (targetUserRole: string) => {
    if (!currentUserRole) return false;
    if (currentUserRole === 'Lead-Manager') {
        return true; // Lead-Manager can manage anyone
    }
    if (currentUserRole === 'Sub-Manager' && targetUserRole === 'User') {
        return true; // Sub-Manager can only manage Users
    }
    return false;
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'users', userId);
    try {
      await updateDoc(userDocRef, { role: newRole });
      toast({ title: 'Success', description: 'User role updated.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update user role.' });
    }
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

  const confirmSuspendUser = async () => {
    if (!firestore || !userToSuspend) return;
    const newStatus = userToSuspend.status === 'Active' ? 'Suspended' : 'Active';
    const userDocRef = doc(firestore, 'users', userToSuspend.uid);
    try {
        await updateDoc(userDocRef, { status: newStatus });
        toast({ title: 'Success', description: `User has been ${newStatus.toLowerCase()}.` });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update user status.' });
    } finally {
        setSuspendDialogOpen(false);
        setUserToSuspend(null);
    }
  }

  const confirmRemoveUser = async () => {
     if (!firestore || !userToRemove) return;

    try {
        const batch = writeBatch(firestore);

        // Delete from users collection
        const userDocRef = doc(firestore, 'users', userToRemove.uid);
        batch.delete(userDocRef);

        // Delete from user_lookups collection
        const lookupDocRef = doc(firestore, 'user_lookups', userToRemove.uid);
        batch.delete(lookupDocRef);
        
        await batch.commit();

        toast({ title: 'User Removed', description: `${userToRemove.displayName} has been removed.` });
    } catch (error) {
        console.error("Error removing user:", error);
        toast({ variant: 'destructive', title: 'Error', description: "Could not remove user. Note: True user deletion from Auth requires a server-side function." });
    } finally {
        setRemoveDialogOpen(false);
        setUserToRemove(null);
    }
  };
  
  const handleSaveChanges = async () => {
    if (!firestore || !userToEdit) return;
    if (!newDisplayName.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Display name cannot be empty.' });
        return;
    }
    
    const userDocRef = doc(firestore, 'users', userToEdit.uid);
    const lookupDocRef = doc(firestore, 'user_lookups', userToEdit.uid);

    try {
      const batch = writeBatch(firestore);
      batch.update(userDocRef, { displayName: newDisplayName });
      batch.update(lookupDocRef, { displayName: newDisplayName });
      await batch.commit();

      toast({ title: 'Success', description: 'User details updated.' });
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Could not update user details.' });
    } finally {
      setEditDialogOpen(false);
      setUserToEdit(null);
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
                        <Button aria-haspopup="true" size="icon" variant="ghost" disabled={currentUser?.uid === user.uid || !canManage(user.role)}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEditClick(user)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
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
    </>
  );
}

function SponsorManagementTool() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog states
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [promoToDelete, setPromoToDelete] = useState<Promotion | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [type, setType] = useState<'text' | 'image'>('text');
    const [content, setContent] = useState('');
    const [actionType, setActionType] = useState<'url' | 'popup'>('url');
    const [linkUrl, setLinkUrl] = useState('');
    const [popupContent, setPopupContent] = useState('');
    const [displayWeight, setDisplayWeight] = useState(1);

    useEffect(() => {
        if (!firestore) return;
        setLoading(true);
        const unsubscribe = onSnapshot(collection(firestore, 'promotions'), snapshot => {
            const promoList: Promotion[] = [];
            snapshot.forEach(doc => {
                promoList.push({ id: doc.id, ...doc.data() } as Promotion);
            });
            // Sort by creation date, newest first
            setPromotions(promoList.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [firestore]);
    
    const resetForm = () => {
        setTitle('');
        setType('text');
        setContent('');
        setActionType('url');
        setLinkUrl('');
        setPopupContent('');
        setDisplayWeight(1);
        setEditingPromo(null);
    }

    const handleAddClick = () => {
        resetForm();
        setFormOpen(true);
    };
    
    const handleEditClick = (promo: Promotion) => {
        setEditingPromo(promo);
        setTitle(promo.title);
        setType(promo.type);
        setContent(promo.content);
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

    const confirmDelete = async () => {
        if (!firestore || !promoToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'promotions', promoToDelete.id));
            toast({ title: "Promotion Deleted" });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete promotion.' });
        } finally {
            setDeleteDialogOpen(false);
            setPromoToDelete(null);
        }
    }

    const handleStatusToggle = async (promo: Promotion) => {
        if (!firestore) return;
        const newStatus = promo.status === 'active' ? 'disabled' : 'active';
        try {
            await updateDoc(doc(firestore, 'promotions', promo.id), { status: newStatus });
            toast({ title: 'Status Updated', description: `Promotion is now ${newStatus}.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update status.' });
        }
    };
    
    const handleSave = async () => {
        if (!firestore) return;
        if (!title || !content) {
            toast({ variant: 'destructive', title: 'Error', description: 'Title and Content are required.'});
            return;
        }

        const promoData: Omit<Promotion, 'id'> = {
            title,
            type,
            content,
            actionType,
            linkUrl: actionType === 'url' ? linkUrl : '',
            popupContent: actionType === 'popup' ? popupContent : '',
            displayWeight: Number(displayWeight) || 1,
            status: editingPromo?.status || 'active',
            createdAt: editingPromo?.createdAt || serverTimestamp(),
        };

        try {
            if (editingPromo) {
                // When updating, we don't want to overwrite the original createdAt timestamp
                const { createdAt, ...updateData } = promoData;
                await updateDoc(doc(firestore, 'promotions', editingPromo.id), updateData);
                toast({ title: 'Promotion Updated' });
            } else {
                await addDoc(collection(firestore, 'promotions'), promoData);
                toast({ title: 'Promotion Added' });
            }
            setFormOpen(false);
            resetForm();
        } catch (error: any) {
            console.error("Failed to save promotion:", error);
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save promotion: ${error.message}` });
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
                                promotions.map(promo => (
                                    <TableRow key={promo.id}>
                                        <TableCell className="font-medium flex items-center gap-3">
                                            {promo.type === 'image' ? (
                                                <Image src={promo.content} alt={promo.title} width={40} height={40} className="rounded-md object-cover aspect-square"/>
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
                                ))
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
                            <Label htmlFor="content">{type === 'image' ? 'Image URL' : 'Ad Text'}</Label>
                             <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder={type === 'image' ? 'https://example.com/image.png' : 'Your ad text here...'} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="action-type">Click Action</Label>
                            <Select value={actionType} onValueChange={(v) => setActionType(v as 'url' | 'popup')}>
                                <SelectTrigger id="action-type">
                                    <SelectValue placeholder="Select an action" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="url"><Link className="mr-2 h-4 w-4" />Open URL</SelectItem>
                                    <SelectItem value="popup"><MessageSquare className="mr-2 h-4 w-4" />Show Pop-up</SelectItem>
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
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
