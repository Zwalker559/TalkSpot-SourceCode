
'use client';

import { MoreHorizontal, UserX, Edit, Trash2 } from 'lucide-react';
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
          <TabsTrigger value="coming-soon">Coming Soon</TabsTrigger>
        </TabsList>
        <TabsContent value="user-management" className="mt-6">
          <UserManagementTool />
        </TabsContent>
        <TabsContent value="coming-soon" className="mt-6">
           <Card>
            <CardHeader>
              <CardTitle>Future Tool</CardTitle>
              <CardDescription>
                This is a placeholder for a future administrative tool.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-12">
                This feature is coming soon!
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

    