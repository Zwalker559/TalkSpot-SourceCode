'use client';

import { MoreHorizontal, UserX, Edit, Trash2, PlusCircle, Image as ImageIcon, FileText, Link as LinkIcon, MessageSquare, Upload, Maximize, Lock, Building2 } from 'lucide-react';
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
import { collection, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { resetPassword } from '@/ai/flows/reset-password-flow';
import promotionsData from '@/lib/promotions.json';
import { updatePromotions } from './actions';


type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'User' | 'Sub-Manager' | 'Lead-Manager';
  status?: 'Active' | 'Suspended';
  textingId: string;
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
  const [newDisplayName, setNewDisplayName]_useState('');

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
    const { toast } = useToast();
    const [jsonContent, setJsonContent] = useState(JSON.stringify(promotionsData, null, 2));
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
      setIsSaving(true);
      const result = await updatePromotions(jsonContent);
      if (result.success) {
        toast({
          title: "Promotions Saved",
          description: "The promotions file has been updated. The app will reload to apply changes.",
        });
        // The server action will trigger a hot reload in development.
      } else {
        toast({
          variant: "destructive",
          title: "Error Saving Promotions",
          description: result.message,
        });
      }
      setIsSaving(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sponsors & Promotions</CardTitle>
                <CardDescription>
                    Manage advertisements by editing the promotions JSON directly. After saving, the app will reload to show your changes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="promotions-json">promotions.json</Label>
                   <Textarea
                        id="promotions-json"
                        value={jsonContent}
                        onChange={(e) => setJsonContent(e.target.value)}
                        className="h-96 font-mono text-xs"
                        placeholder="Enter valid JSON for promotions..."
                    />
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Promotions"}
                </Button>
            </CardContent>
        </Card>
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
