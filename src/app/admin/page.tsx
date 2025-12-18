
'use client';

import { MoreHorizontal, UserX, Edit, Trash2, PlusCircle, Image as ImageIcon, FileText, Link as LinkIcon, MessageSquare, Upload, Maximize, Lock, Building2, Eye, Star, FileDown, ShieldCheck, History, Send, Wrench, Info } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { useEffect, useState, useRef, useMemo } from 'react';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase/errors';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, setDoc, addDoc, serverTimestamp, getDoc, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { resetPassword } from '@/ai/flows/reset-password-flow';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';
import { format, subDays } from 'date-fns';
import { createAuditLog, clearAuditLogs, deleteUserFully, sendGlobalNotice, clearGlobalNotice, repairOrphanedUsers } from './actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';


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
  actionType: 'url' | 'popup' | 'enlarge' | 'none';
  linkUrl?: string;
  popupContent?: string;
  status: 'active' | 'disabled';
  displayWeight: number;
  location: 'header' | 'sidebar' | 'both';
  imageFit?: 'cover' | 'contain';
  createdAt?: any;
};

type AuditLog = {
    id: string;
    actorUid: string;
    actorDisplayName: string;
    action: string;
    timestamp: any;
    targetInfo?: {
        type: string;
        uid?: string;
        displayName?: string;
    };
    details?: Record<string, any>;
};

type GlobalNotice = {
    message: string;
    active: boolean;
    updatedAt?: any;
    updatedBy?: string;
};


const ROLES = ['User', 'Sub-Manager', 'Lead-Manager', 'Co-Owner', 'Owner'];
const ROLE_HIERARCHY: { [key: string]: number } = {
  'User': 0,
  'Sub-Manager': 1,
  'Lead-Manager': 2,
  'Co-Owner': 3,
  'Owner': 4,
};


function UserManagementTool({ currentUserRole, currentUser }: { currentUserRole: string, currentUser: any }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [isRemoveDialogOpen, setRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<UserProfile | null>(null);

  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [isRepairDialogOpen, setRepairDialogOpen] = useState(false);
  
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
          textingId: data.textingId || 'N/A',
        });
      });
      setUsers(userList);
      setLoading(false);
    }, (error) => {
        console.error("Error listening to users collection:", error);
        setLoading(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: usersColRef.path,
            operation: 'list',
        } satisfies SecurityRuleContext));
    });

    return () => unsubscribe();
  }, [firestore]);


 const canManage = (targetUser: UserProfile) => {
    if (!currentUserRole || !targetUser.role || !currentUser || currentUser.uid === targetUser.uid) {
        return false;
    }
    const currentUserLevel = ROLE_HIERARCHY[currentUserRole] || 0;
    const targetUserLevel = ROLE_HIERARCHY[targetUser.role] || 0;
    
    return currentUserLevel > targetUserLevel;
  };

  const canChangeRoleTo = (targetRole: string) => {
      if (!currentUserRole) return false;
      const currentUserLevel = ROLE_HIERARCHY[currentUserRole] || 0;
      const targetRoleLevel = ROLE_HIERARCHY[targetRole] || 0;

      // Owner and Co-Owner can't be assigned from the UI
      if (['Owner', 'Co-Owner'].includes(targetRole) && currentUserRole !== 'Owner') {
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
    if (!firestore || !userToEdit || !currentUser || !currentUser.displayName) return;

    try {
        const batch = writeBatch(firestore);
        const userDocRef = doc(firestore, 'users', userToEdit.uid);
        const lookupDocRef = doc(firestore, 'user_lookups', userToEdit.uid);

        const updates: any = {};
        const lookupUpdates: any = {};
        
        const createLog = (action: any, details: Record<string, any>) => {
             createAuditLog({
                actorUid: currentUser.uid,
                actorDisplayName: currentUser.displayName,
                action,
                targetInfo: { type: 'user', uid: userToEdit.uid, displayName: userToEdit.displayName },
                details
            });
        }

        // Display Name
        if (editDisplayName !== userToEdit.displayName && editDisplayName.trim()) {
            updates.displayName = editDisplayName;
            lookupUpdates.displayName = editDisplayName;
            createLog('user.edit.display_name', { from: userToEdit.displayName, to: editDisplayName });
        }

        // Texting ID
        if (editTextingId !== userToEdit.textingId) {
            updates.textingId = editTextingId;
            lookupUpdates.textingId = editTextingId;
            createLog('user.edit.texting_id', { from: userToEdit.textingId, to: editTextingId });
        }

        // Role
        if (editRole !== userToEdit.role && canEditRoles) {
            updates.role = editRole;
            createLog('user.edit.role', { from: userToEdit.role, to: editRole });
        }

        // Status & Suspension Reason
        if (editStatus !== (userToEdit.status || 'Active')) {
            updates.status = editStatus;
            if (editStatus === 'Suspended') {
                if (!editSuspensionReason.trim()) {
                    toast({ variant: 'destructive', title: 'Error', description: 'A reason is required to suspend a user.' });
                    return;
                }
                updates.suspensionReason = editSuspensionReason;
                createLog('user.edit.status.suspended', { reason: editSuspensionReason });
            } else {
                updates.suspensionReason = ''; // Clear reason on activation
                createLog('user.edit.status.activated', {});
            }
        }
        
        if (Object.keys(updates).length > 0) {
            batch.update(userDocRef, updates);
        }
        if (Object.keys(lookupUpdates).length > 0) {
            batch.update(lookupDocRef, lookupUpdates);
        }
        
        await batch.commit();

        // Password Reset - done after batch commit
        if (editNewPassword && canEditPassword) {
             if (editNewPassword.length < 6) {
                toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 6 characters long.' });
                return;
            }
            await resetPassword({ uid: userToEdit.uid, newPassword: editNewPassword });
            // Log this action separately as it's a critical, distinct event.
            await createAuditLog({
                actorUid: currentUser.uid,
                actorDisplayName: currentUser.displayName,
                action: 'user.edit.password_reset',
                targetInfo: { type: 'user', uid: userToEdit.uid, displayName: editDisplayName || userToEdit.displayName },
                details: {} // No need to pass sensitive info here
            });
        }
        
        toast({ title: 'Success', description: 'User details updated.' });
        setEditDialogOpen(false);
        setUserToEdit(null);

    } catch (error: any) {
        console.error("Failed to save user changes:", error);
        toast({ variant: 'destructive', title: 'Error', description: `Failed to update: ${error.message}` });
    }
  };

  const confirmRemoveUser = async () => {
    if (!firestore || !userToRemove || !currentUser || !currentUser.displayName) return;
  
    // Log the deletion attempt *before* starting the process
    await createAuditLog({
        actorUid: currentUser.uid,
        actorDisplayName: currentUser.displayName,
        action: 'user.delete',
        targetInfo: { type: 'user', uid: userToRemove.uid, displayName: userToRemove.displayName }
    });
  
    try {
        await deleteUserFully({ uidToDelete: userToRemove.uid });
        toast({ title: 'User Fully Deleted', description: `${userToRemove.displayName} has been removed from Auth and Firestore.` });
    } catch (serverError: any) {
        console.error("Error removing user:", serverError)
        toast({ variant: 'destructive', title: 'Error', description: `Could not fully remove user: ${serverError.message}` });
    } finally {
        setRemoveDialogOpen(false);
        setUserToRemove(null);
    }
  };

  const handleRepairOrphanedUsers = async () => {
    if (!currentUser) return;
    try {
      const result = await repairOrphanedUsers({ actorUid: currentUser.uid });
      toast({
        title: 'Repair Complete',
        description: `Successfully removed ${result.deletedCount} orphaned user(s).`,
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Repair Failed', description: error.message });
    } finally {
      setRepairDialogOpen(false);
    }
  };
  
  // Determine permissions for the edit dialog
  const canEditRoles = currentUserRole && ['Owner', 'Co-Owner', 'Lead-Manager'].includes(currentUserRole);
  const canEditPassword = currentUserRole && ['Owner', 'Co-Owner'].includes(currentUserRole);
  const canRepair = currentUserRole && ['Owner', 'Co-Owner'].includes(currentUserRole);

  if (loading) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-2/3 mt-2" />
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div>
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-32 mt-1" />
                                </div>
                            </div>
                            <Skeleton className="h-8 w-20" />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
  }

  return (
    <>
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            View, edit, and manage all user accounts.
          </CardDescription>
        </div>
        {canRepair && (
          <Button variant="outline" onClick={() => setRepairDialogOpen(true)}>
            <Wrench className="mr-2 h-4 w-4" />
            Repair
          </Button>
        )}
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
            {users.length > 0 ? (
                users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.photoURL} />
                        <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
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
            ) : (
                <TableRow>
                    <TableCell colSpan={4} className="text-center">No users found.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <AlertDialog open={isRepairDialogOpen} onOpenChange={setRepairDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Repair Orphaned Users?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action will scan for and remove all Firestore data associated with users that no longer exist in Firebase Authentication. This is useful for cleaning up after manual deletions or data inconsistencies. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRepairOrphanedUsers}>
                    Yes, Run Repair
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>


    <AlertDialog open={isRemoveDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Permanently Remove User?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action is irreversible. It will permanently delete the user from Authentication and all associated data in Firestore (profile, conversations, etc.). Are you sure?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmRemoveUser} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
                    Yes, Delete User
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

function SponsorManagementTool({ currentUser }: { currentUser: any }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditDialogOpen, setEditDialogOpen] = useState(false);
    const [currentPromo, setCurrentPromo] = useState<Partial<Promotion> | null>(null);
    const [isPreviewOpen, setPreviewOpen] = useState(false);
    const imageContentInputRef = useRef<HTMLInputElement>(null);
    const logoUrlInputRef = useRef<HTMLInputElement>(null);

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
        imageFit: 'cover',
    };

    useEffect(() => {
        if (!firestore) return;
        setLoading(true);
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
            setLoading(false);
        }, (err) => {
            console.error("Error listening to Sponsorships:", err);
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: promoColRef.path,
                operation: 'list',
            } satisfies SecurityRuleContext));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore]);
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'content' | 'logoUrl') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 500 * 1024) { // 500KB limit
                toast({ variant: 'destructive', title: "File too large", description: 'Please select an image smaller than 500KB for Base64 encoding.' });
                return;
            }
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const dataUrl = loadEvent.target?.result as string;
                handleDialogInputChange(field, dataUrl);
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
            actionType: 'none',
            linkUrl: '',
            popupContent: '',
            location: 'both',
            status: 'active',
            displayWeight: 1,
            imageFit: 'cover'
        });
        setEditDialogOpen(true);
    };

    const handleSave = async () => {
        if (!firestore || !currentPromo || !currentUser || !currentUser.displayName) return;
    
        try {
            const isNew = !currentPromo.id;
            
            const promoDataToSave: Omit<Promotion, 'id' | 'createdAt'> & { createdAt?: any } = {
                title: currentPromo.title || '',
                type: currentPromo.type || 'text',
                content: currentPromo.content || '',
                logoUrl: currentPromo.logoUrl || '',
                actionType: currentPromo.actionType || 'none',
                linkUrl: currentPromo.linkUrl || '',
                popupContent: currentPromo.popupContent || '',
                status: currentPromo.status || 'disabled',
                displayWeight: currentPromo.displayWeight || 0,
                location: currentPromo.location || 'both',
                imageFit: currentPromo.imageFit || 'cover',
            };
    
            if (isNew) {
                promoDataToSave.createdAt = Timestamp.now();
                const promoRef = await addDoc(collection(firestore, 'Sponsorships'), promoDataToSave);
                
                await createAuditLog({
                    actorUid: currentUser.uid,
                    actorDisplayName: currentUser.displayName,
                    action: 'promotion.create',
                    targetInfo: { type: 'promotion', uid: promoRef.id, displayName: promoDataToSave.title },
                    details: promoDataToSave
                });

                toast({ title: "Promotion Added" });
            } else {
                const docRef = doc(firestore, 'Sponsorships', currentPromo.id!);
                const originalDocSnap = await getDoc(docRef);
                const originalData = originalDocSnap.data();

                const serializableOriginalData = originalData ? JSON.parse(JSON.stringify(originalData)) : {};

                await setDoc(docRef, promoDataToSave, { merge: true });
                
                await createAuditLog({
                    actorUid: currentUser.uid,
                    actorDisplayName: currentUser.displayName,
                    action: 'promotion.edit',
                    targetInfo: { type: 'promotion', uid: currentPromo.id, displayName: currentPromo.title },
                    details: { from: serializableOriginalData, to: promoDataToSave }
                });
                
                toast({ title: "Promotion Updated" });
            }
        } catch (error: any) {
            console.error("Error saving promotion:", error);
            toast({ variant: 'destructive', title: 'Error Saving Promotion', description: error.message });
        } finally {
            setEditDialogOpen(false);
            setCurrentPromo(null);
        }
    };
    
    const handleDelete = async (promoId: string, promoTitle: string) => {
        if (!firestore || !currentUser || !currentUser.displayName) return;
      
        await createAuditLog({
          actorUid: currentUser.uid,
          actorDisplayName: currentUser.displayName,
          action: 'promotion.delete',
          targetInfo: { type: 'promotion', uid: promoId, displayName: promoTitle },
        });
      
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

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <Skeleton className="h-4 w-1/4" />
                                <Skeleton className="h-4 w-1/4" />
                                <Skeleton className="h-4 w-1/4" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
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
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(promo.id, promo.title)} disabled={promo.id === 'fallback'}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
                                        <Label htmlFor="promo-logoUrl">Logo (Optional)</Label>
                                        <Card>
                                            <CardContent className="p-2 space-y-2">
                                                <Textarea id="promo-logoUrl" placeholder="https://... or data:image/..." value={currentPromo.logoUrl || ''} onChange={(e) => handleDialogInputChange('logoUrl', e.target.value)} />
                                                <Button variant="outline" size="sm" onClick={() => logoUrlInputRef.current?.click()}>
                                                    <Upload className="mr-2 h-4 w-4" /> Upload Logo
                                                </Button>
                                                <Input type="file" ref={logoUrlInputRef} onChange={(e) => handleImageUpload(e, 'logoUrl')} className="hidden" accept="image/png, image/jpeg, image/gif" />
                                            </CardContent>
                                        </Card>
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
                                                <Button variant="outline" size="sm" onClick={() => imageContentInputRef.current?.click()}>
                                                    <Upload className="mr-2 h-4 w-4" /> Upload Image
                                                </Button>
                                                <span className="text-xs text-muted-foreground">Or paste URL above.</span>
                                            </div>
                                             <Input type="file" ref={imageContentInputRef} onChange={(e) => handleImageUpload(e, 'content')} className="hidden" accept="image/png, image/jpeg, image/gif" />
                                        </CardContent>
                                    </Card>
                                     <div className="space-y-2">
                                        <Label htmlFor="promo-imageFit">Image Fit</Label>
                                        <Select value={currentPromo.imageFit || 'cover'} onValueChange={(v) => handleDialogInputChange('imageFit', v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="cover">Cover (Fill container, may crop)</SelectItem>
                                                <SelectItem value="contain">Contain (Show full image)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="promo-actionType">Action Type</Label>
                                <Select value={currentPromo.actionType} onValueChange={(v) => handleDialogInputChange('actionType', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="url">Open URL</SelectItem>
                                        <SelectItem value="popup">Show Popup</SelectItem>
                                        {currentPromo.type === 'image' && <SelectItem value="enlarge">Enlarge Image</SelectItem>}
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
                                                    currentPromo.content ? <Image src={currentPromo.content} alt="Header Preview" fill style={{ objectFit: currentPromo.imageFit || 'cover' }} /> : <div className="flex items-center text-muted-foreground"><ImageIcon className="mr-2"/>No Image</div>
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
                                                     currentPromo.content ? <Image src={currentPromo.content} alt="Sidebar Preview" fill style={{ objectFit: currentPromo.imageFit || 'cover' }} /> : <div className="flex items-center text-muted-foreground"><ImageIcon className="mr-2"/>No Image</div>
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

function AuditLogTool({ currentUser }: { currentUser: any }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isClearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [isDownloadDialogOpen, setDownloadDialogOpen] = useState(false);
    
    // Download filter states
    const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);
    const [allActions, setAllActions] = useState<string[]>([]);
    
    const [filterUsers, setFilterUsers] = useState(false);
    const [filterActions, setFilterActions] = useState(false);
    const [filterTime, setFilterTime] = useState(false);

    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [selectedActions, setSelectedActions] = useState<string[]>([]);
    const [selectedTimeRange, setSelectedTimeRange] = useState('all');

    useEffect(() => {
        if (!firestore) return;
        setLoading(true);

        const logsQuery = query(collection(firestore, 'audit_logs'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
            const fetchedLogs: AuditLog[] = [];
            if (snapshot && !snapshot.empty) {
                snapshot.docs.forEach(doc => {
                    fetchedLogs.push({ id: doc.id, ...doc.data() } as AuditLog);
                });
            }
            setLogs(fetchedLogs);
            
            if (fetchedLogs.length > 0) {
                const uniqueUsers = new Map<string, string>();
                const uniqueActions = new Set<string>();
                fetchedLogs.forEach(log => {
                    if (log.actorUid && !uniqueUsers.has(log.actorUid)) {
                        uniqueUsers.set(log.actorUid, log.actorDisplayName);
                    }
                    if (log.targetInfo?.uid && !uniqueUsers.has(log.targetInfo.uid)) {
                         uniqueUsers.set(log.targetInfo.uid, log.targetInfo.displayName || 'Unknown');
                    }
                    uniqueActions.add(log.action);
                });
                setAllUsers(Array.from(uniqueUsers, ([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name)));
                setAllActions(Array.from(uniqueActions).sort());
            }

            setLoading(false);
        }, (error) => {
            console.error("Error fetching audit logs:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch audit logs.' });
            setLoading(false);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'audit_logs',
                operation: 'list',
            } satisfies SecurityRuleContext));
        });

        return () => unsubscribe();
    }, [firestore, toast]);
    
    const handleClearLogs = async () => {
        if (!currentUser) return;
        try {
            await clearAuditLogs({ actorUid: currentUser.uid });
            toast({ title: 'Success', description: 'Audit logs have been cleared.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setClearConfirmOpen(false);
        }
    };
    
    const handleDownload = () => {
        let filteredLogs = [...logs];

        if (filterUsers && selectedUsers.length > 0) {
            filteredLogs = filteredLogs.filter(log => selectedUsers.includes(log.actorUid) || (log.targetInfo?.uid && selectedUsers.includes(log.targetInfo.uid)));
        }
        if (filterActions && selectedActions.length > 0) {
            filteredLogs = filteredLogs.filter(log => selectedActions.includes(log.action));
        }
        if (filterTime && selectedTimeRange !== 'all') {
            let startDate: Date;
            switch(selectedTimeRange) {
                case '24h': startDate = subDays(new Date(), 1); break;
                case '7d': startDate = subDays(new Date(), 7); break;
                case '30d': startDate = subDays(new Date(), 30); break;
                default: startDate = new Date(0); 
            }
            filteredLogs = filteredLogs.filter(log => log.timestamp?.toDate() >= startDate);
        }

        const dataStr = JSON.stringify(filteredLogs, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', `audit_logs_${new Date().toISOString()}.json`);
        linkElement.click();
        
        setDownloadDialogOpen(false);
    };

    const renderDetail = (key: string, value: any) => {
        if (typeof value === 'object' && value !== null) {
            return (
                <div key={key} className="pl-4">
                    <span className="font-semibold">{key}:</span>
                    <div className="pl-4 border-l ml-2">
                        {Object.entries(value).map(([k, v]) => renderDetail(k, v))}
                    </div>
                </div>
            );
        }
        return (
            <div key={key}>
                <span className="font-semibold">{key}:</span> {String(value)}
            </div>
        )
    }

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                </CardHeader>
                <CardContent className="space-y-2">
                     {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Audit Logs</CardTitle>
                        <CardDescription>Records of all administrative actions taken by staff.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setDownloadDialogOpen(true)} disabled={logs.length === 0}><FileDown className="mr-2"/> Download</Button>
                        <Button variant="destructive" onClick={() => setClearConfirmOpen(true)} disabled={logs.length === 0}><Trash2 className="mr-2"/> Clear All Logs</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No audit logs found.</p>
                    ) : (
                        <Accordion type="single" collapsible className="w-full">
                            {logs.map(log => (
                                <AccordionItem value={log.id} key={log.id}>
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-4 text-sm w-full">
                                            <div className="flex items-center gap-2 w-1/4">
                                                <ShieldCheck className="h-4 w-4 text-muted-foreground"/>
                                                <span className="font-semibold">{log.actorDisplayName}</span>
                                            </div>
                                             <div className="w-2/4">
                                                <Badge variant="outline">{log.action}</Badge>
                                             </div>
                                            <div className="text-muted-foreground text-xs w-1/4 text-right">
                                                {log.timestamp ? format(log.timestamp.toDate(), 'PPP p') : 'No date'}
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="bg-muted/50 p-4 rounded-md">
                                        <ScrollArea className="max-h-60">
                                            <div className="text-xs font-mono space-y-2 pr-4">
                                                <h4 className="font-semibold text-sm mb-2">Log Details</h4>
                                                <p><span className="font-semibold">Actor ID:</span> {log.actorUid}</p>
                                                {log.targetInfo?.type && <p><span className="font-semibold">Target Type:</span> {log.targetInfo.type}</p>}
                                                {log.targetInfo?.uid && <p><span className="font-semibold">Target ID:</span> {log.targetInfo.uid}</p>}
                                                {log.targetInfo?.displayName && <p><span className="font-semibold">Target Name:</span> {log.targetInfo.displayName}</p>}
                                                {log.details && (
                                                <div>
                                                    <p className="font-semibold mt-2">Changes:</p>
                                                    <div className="pl-4 border-l ml-2 space-y-1 mt-1">
                                                        {Object.entries(log.details).map(([key, value]) => renderDetail(key, value))}
                                                    </div>
                                                </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={isClearConfirmOpen} onOpenChange={setClearConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action is irreversible and will permanently delete all audit logs. This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearLogs} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Yes, delete all logs</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
             <Dialog open={isDownloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Download Audit Logs</DialogTitle>
                        <DialogDescription>Select categories and options to filter your JSON download.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* User Filter */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Checkbox id="filter-user-cat" checked={filterUsers} onCheckedChange={(c) => setFilterUsers(c as boolean)} />
                                <Label htmlFor="filter-user-cat" className="font-medium">Filter by User</Label>
                            </div>
                            {filterUsers && allUsers.length > 0 && (
                                <ScrollArea className="h-32 w-full rounded-md border p-2 ml-6">
                                    {allUsers.map(user => (
                                        <div key={user.id} className="flex items-center gap-2 mb-1">
                                            <Checkbox 
                                                id={`user-${user.id}`}
                                                checked={selectedUsers.includes(user.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedUsers(prev => checked ? [...prev, user.id] : prev.filter(id => id !== user.id))
                                                }}
                                            />
                                            <Label htmlFor={`user-${user.id}`}>{user.name}</Label>
                                        </div>
                                    ))}
                                </ScrollArea>
                            )}
                        </div>

                        {/* Action Filter */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Checkbox id="filter-action-cat" checked={filterActions} onCheckedChange={(c) => setFilterActions(c as boolean)} />
                                <Label htmlFor="filter-action-cat" className="font-medium">Filter by Action</Label>
                            </div>
                            {filterActions && allActions.length > 0 && (
                                <ScrollArea className="h-32 w-full rounded-md border p-2 ml-6">
                                    {allActions.map(action => (
                                        <div key={action} className="flex items-center gap-2 mb-1">
                                            <Checkbox 
                                                id={`action-${action}`}
                                                checked={selectedActions.includes(action)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedActions(prev => checked ? [...prev, action] : prev.filter(a => a !== action))
                                                }}
                                            />
                                            <Label htmlFor={`action-${action}`}>{action}</Label>
                                        </div>
                                    ))}
                                </ScrollArea>
                            )}
                        </div>
                        
                        {/* Time Filter */}
                         <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Checkbox id="filter-time-cat" checked={filterTime} onCheckedChange={(c) => setFilterTime(c as boolean)} />
                                <Label htmlFor="filter-time-cat" className="font-medium">Filter by Time Range</Label>
                            </div>
                            {filterTime && (
                               <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                                    <SelectTrigger className="w-[180px] ml-6">
                                        <SelectValue placeholder="Select a time range" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="24h">Last 24 hours</SelectItem>
                                        <SelectItem value="7d">Last 7 days</SelectItem>
                                        <SelectItem value="30d">Last 30 days</SelectItem>
                                        <SelectItem value="all">All time</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleDownload}><FileDown className="mr-2"/> Download JSON</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function NoticeManagementTool({ userRole, currentUser }: { userRole: string, currentUser: any }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [notice, setNotice] = useState<GlobalNotice | null>(null);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !userRole || !['Owner', 'Co-Owner'].includes(userRole)) {
            setIsLoading(false);
            return;
        };
        
        setIsLoading(true);
        const noticeRef = doc(firestore, 'site_config', 'global_notice');
        const unsubscribe = onSnapshot(noticeRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data() as GlobalNotice;
                setNotice(data);
                if (data.active) {
                    setMessage(data.message);
                } else {
                    setMessage('');
                }
            }
            setIsLoading(false);
        },
        (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: noticeRef.path,
                operation: 'get',
            } satisfies SecurityRuleContext));
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [firestore, userRole]);
    
    const handleSendNotice = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            await sendGlobalNotice({ actorUid: currentUser.uid, message });
            toast({ title: 'Success', description: 'Global notice has been sent.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearNotice = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            await clearGlobalNotice({ actorUid: currentUser.uid });
            toast({ title: 'Success', description: 'Global notice has been cleared.' });
            setMessage('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
             <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                     <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-10 w-1/4" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Global Notice</CardTitle>
                <CardDescription>Send a message that appears as a banner for all users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 {notice?.active && (
                    <div className="p-4 bg-muted/50 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                             <h4 className="font-semibold">Current Active Notice</h4>
                             {notice.updatedBy && notice.updatedAt && (
                                <p className="text-xs text-muted-foreground">
                                    Sent by {notice.updatedBy} on {format(notice.updatedAt.toDate(), 'PPP')}
                                </p>
                             )}
                        </div>
                        <p className="text-sm p-4 bg-background rounded-md">{notice.message}</p>
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="notice-message">{notice?.active ? 'Update or Clear Notice' : 'Send a New Notice'}</Label>
                    <Textarea
                        id="notice-message"
                        placeholder="Enter your notice message here..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        disabled={isLoading}
                    />
                </div>
                <div className="flex justify-between items-center">
                    <Button onClick={handleSendNotice} disabled={isLoading || !message.trim()}>
                        <Send className="mr-2" /> {notice?.active ? 'Update Notice' : 'Send Notice'}
                    </Button>
                    {notice?.active && (
                        <Button variant="destructive" onClick={handleClearNotice} disabled={isLoading}>
                            <Trash2 className="mr-2" /> Clear Notice
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}


export default function AdminDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && firestore) {
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          setUserRole(doc.data().role || 'User');
        } else {
            setUserRole('User'); // Default to user if doc doesn't exist
        }
        setIsLoading(false);
      },
      (error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'get',
          } satisfies SecurityRuleContext));
          setIsLoading(false);
      });
      return () => unsubscribe();
    } else if (!user) {
        setIsLoading(false);
    }
  }, [user, firestore]);

  if (isLoading) {
    return (
        <div className="space-y-6">
             <div className="flex flex-col space-y-2">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
  }
  
  const isPrivileged = userRole === 'Owner' || userRole === 'Co-Owner';
  const isOwner = userRole === 'Owner';
  const hasAccess = userRole && ['Lead-Manager', 'Sub-Manager', 'Co-Owner', 'Owner'].includes(userRole);

  if (!hasAccess) {
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
        <TabsList className={`grid w-full ${isOwner ? 'grid-cols-4' : isPrivileged ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="user-management">User Management</TabsTrigger>
          <TabsTrigger value="sponsors">Sponsors</TabsTrigger>
          {isPrivileged && <TabsTrigger value="notices">Global Notice</TabsTrigger>}
          {isOwner && <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>}
        </TabsList>
        <TabsContent value="user-management" className="mt-6">
          {user && userRole && <UserManagementTool currentUserRole={userRole} currentUser={user} />}
        </TabsContent>
        <TabsContent value="sponsors" className="mt-6">
           {user && <SponsorManagementTool currentUser={user} />}
        </TabsContent>
        {isPrivileged && (
          <TabsContent value="notices" className="mt-6">
            {user && userRole && <NoticeManagementTool userRole={userRole} currentUser={user} />}
          </TabsContent>
        )}
        {isOwner && (
          <TabsContent value="audit-logs" className="mt-6">
            {user && <AuditLogTool currentUser={user}/>}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
