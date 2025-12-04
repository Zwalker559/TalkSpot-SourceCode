
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDoc, serverTimestamp, limit, startAt, endAt, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, X, Send, Trash2, UserSearch } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type ChatRequest = {
  id: string;
  from: string;
  to: string;
  status: 'pending' | 'accepted' | 'denied';
  fromUser?: {
    displayName: string;
    photoURL?: string;
    textingId: string;
  };
  toUser?: {
      displayName: string;
      photoURL?: string;
      textingId: string;
  }
};

type UserLookupResult = {
    uid: string;
    displayName: string;
    textingId: string;
    photoURL?: string;
    visibility: 'public' | 'private';
}

export default function RequestsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [searchInput, setSearchInput] = useState('');
  const [incomingRequests, setIncomingRequests] = useState<ChatRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ChatRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<UserLookupResult[]>([]);
  const [isPopoverOpen, setPopoverOpen] = useState(false);

  // Fetch search results for public users
   useEffect(() => {
    if (!searchInput.trim() || !firestore) {
      setSearchResults([]);
      setPopoverOpen(false);
      return;
    }

    const performSearch = async () => {
      try {
        const lookupsRef = collection(firestore, 'user_lookups');
        
        // Query for users whose display name starts with the search input.
        const q = query(
          lookupsRef,
          orderBy('displayName'),
          startAt(searchInput),
          endAt(searchInput + '\uf8ff'),
          limit(10) // Fetch a bit more to have a chance to find public users
        );

        const querySnapshot = await getDocs(q);
        const results: UserLookupResult[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data() as UserLookupResult;
            // Client-side filter for visibility and self-exclusion
            if (data.visibility === 'public' && doc.id !== user?.uid) {
                results.push({
                    uid: doc.id,
                    ...data
                });
            }
        });

        setSearchResults(results.slice(0, 3)); // Limit to top 3 public results
        setPopoverOpen(results.length > 0);
      } catch (error) {
        console.error("Error searching for users:", error);
        // Don't show a toast for search errors as it can be disruptive
        setSearchResults([]);
        setPopoverOpen(false);
      }
    };

    const debounceSearch = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceSearch);

  }, [searchInput, firestore, user?.uid]);


  // Fetch incoming requests
  useEffect(() => {
    if (!user || !firestore) return;
    const q = query(collection(firestore, 'requests'), where('to', '==', user.uid), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const requests: ChatRequest[] = [];
      for (const reqDoc of snapshot.docs) {
        const data = reqDoc.data() as ChatRequest;
        const fromUserDoc = await getDoc(doc(firestore, 'users', data.from));
        if (fromUserDoc.exists()) {
            requests.push({
                id: reqDoc.id,
                ...data,
                fromUser: fromUserDoc.data() as ChatRequest['fromUser'],
            });
        }
      }
      setIncomingRequests(requests);
    });
    return () => unsubscribe();
  }, [user, firestore]);

  // Fetch outgoing requests
  useEffect(() => {
    if (!user || !firestore) return;
    const q = query(collection(firestore, 'requests'), where('from', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const requests: ChatRequest[] = [];
       for (const reqDoc of snapshot.docs) {
        const data = reqDoc.data() as ChatRequest;
        if (data.status === 'denied') {
            // Clean up denied requests after a short delay to allow user to see the status
            setTimeout(() => deleteDoc(doc(firestore, 'requests', reqDoc.id)), 5000);
        }
        const toUserDoc = await getDoc(doc(firestore, 'users', data.to));
        if (toUserDoc.exists()) {
            requests.push({
                id: reqDoc.id,
                ...data,
                toUser: toUserDoc.data() as ChatRequest['toUser'],
            });
        }
      }
      setOutgoingRequests(requests.filter(r => r.status !== 'accepted')); // Don't show accepted requests here
    });
    return () => unsubscribe();
  }, [user, firestore]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setPopoverOpen(false);
    if (!user || !firestore || !searchInput.trim()) return;
    
    setIsLoading(true);

    try {
      const lookupsRef = collection(firestore, 'user_lookups');
      // Normalize search input for case-insensitivity in exact match
      const trimmedSearch = searchInput.trim();
      
      const qId = query(lookupsRef, where('textingId', '==', trimmedSearch));
      const qName = query(lookupsRef, where('displayName', '==', trimmedSearch));
      
      const [idSnapshot, nameSnapshot] = await Promise.all([getDocs(qId), getDocs(qName)]);
      
      const allResults = [...idSnapshot.docs, ...nameSnapshot.docs];

      if (allResults.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'No user found with that ID or Username.' });
        setIsLoading(false);
        return;
      }
      
      // Remove duplicates if a user's display name and texting ID are the same
      const uniqueResults = Array.from(new Set(allResults.map(doc => doc.id)))
        .map(id => allResults.find(doc => doc.id === id)!);

      if (uniqueResults.length > 1) {
        toast({ variant: 'destructive', title: 'Error', description: 'Multiple users found. Please use the unique Texting ID.' });
        setIsLoading(false);
        return;
      }

      const recipient = uniqueResults[0].data();

      if (recipient.uid === user.uid) {
          toast({ variant: 'destructive', title: 'Error', description: "You cannot send a request to yourself." });
          setIsLoading(false);
          return;
      }

      // Check if a request (pending, accepted) or conversation already exists in either direction
      const existingRequestQuery1 = query(collection(firestore, 'requests'), where('from', '==', user.uid), where('to', '==', recipient.uid));
      const existingRequestQuery2 = query(collection(firestore, 'requests'), where('from', '==', recipient.uid), where('to', '==', user.uid));
      
      const [snapshot1, snapshot2] = await Promise.all([getDocs(existingRequestQuery1), getDocs(existingRequestQuery2)]);
      
      if (snapshot1.docs.length > 0 || snapshot2.docs.length > 0) {
          toast({ variant: 'destructive', title: 'Request already exists', description: "You already have a pending or accepted chat with this user."});
          setIsLoading(false);
          return;
      }


      await addDoc(collection(firestore, 'requests'), {
        from: user.uid,
        to: recipient.uid,
        status: 'pending',
      });

      toast({ title: 'Success', description: 'Chat request sent!' });
      setSearchInput('');
    } catch (error: any) {
      console.error("Error sending request: ", error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  const handleRequestResponse = async (request: ChatRequest, newStatus: 'accepted' | 'denied') => {
    if (!user || !firestore) return;

    const requestRef = doc(firestore, 'requests', request.id);

    try {
        if (newStatus === 'accepted') {
            const currentUserDoc = await getDoc(doc(firestore, 'users', user.uid));
            const fromUserDoc = await getDoc(doc(firestore, 'users', request.from));

            if (!currentUserDoc.exists() || !fromUserDoc.exists()) {
                throw new Error("Could not find user profiles.");
            }
            
            const currentUserData = currentUserDoc.data();
            const fromUserData = fromUserDoc.data();

            const conversationRef = await addDoc(collection(firestore, 'conversations'), {
                participants: [user.uid, request.from],
                participantDetails: {
                    [user.uid]: {
                        displayName: currentUserData.displayName,
                        photoURL: currentUserData.photoURL,
                        textingId: currentUserData.textingId,
                    },
                    [request.from]: {
                        displayName: fromUserData.displayName,
                        photoURL: fromUserData.photoURL,
                        textingId: fromUserData.textingId,
                    }
                },
                lastMessage: 'Chat request accepted!',
                lastMessageTimestamp: serverTimestamp(),
                lastMessageSenderId: user.uid,
            });

            // Delete the request instead of updating it
            await deleteDoc(requestRef);
            toast({ title: 'Request Accepted', description: 'You can now chat with this user.' });
            router.push(`/dashboard?conversationId=${conversationRef.id}`);

        } else { // 'denied'
             // Just delete the request
            await deleteDoc(requestRef);
            toast({ title: 'Request Denied' });
        }
    } catch (error: any) {
        console.error("Error handling request response: ", error);
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
};

  const cancelOutgoingRequest = async (requestId: string) => {
      if(!firestore) return;
      try {
        await deleteDoc(doc(firestore, 'requests', requestId));
        toast({title: 'Request Cancelled'});
      } catch (error) {
        console.error("Error cancelling request: ", error);
        toast({ variant: 'destructive', title: 'Error', description: "Could not cancel the request." });
      }
  }
  
  const handleResultClick = (result: UserLookupResult) => {
    setSearchInput(result.displayName);
    setPopoverOpen(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Send a Chat Request</CardTitle>
          <CardDescription>Enter a user's Username or Texting ID. Public users will appear as you type.</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={isPopoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
                <form onSubmit={handleSendRequest} className="flex items-center gap-2">
                    <div className="relative w-full">
                       <UserSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input
                          id="search-input"
                          placeholder="Username or xxxx-xxxx"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          className="pl-8"
                          autoComplete="off"
                        />
                    </div>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Sending...' : <> <Send className="mr-2 h-4 w-4" /> Send Request</>}
                    </Button>
                </form>
            </PopoverTrigger>
             <PopoverContent 
                className="w-[--radix-popover-trigger-width] p-0" 
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
             >
                <div className="flex flex-col space-y-1 p-1">
                    {searchResults.map((result) => (
                        <div key={result.uid} onClick={() => handleResultClick(result)} className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={result.photoURL} />
                                <AvatarFallback>{result.displayName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="font-medium text-sm">{result.displayName}</span>
                                <span className="text-xs text-muted-foreground font-mono">{result.textingId}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      <Tabs defaultValue="incoming">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="incoming">Incoming</TabsTrigger>
            <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
        </TabsList>
        <TabsContent value="incoming">
             <Card>
                <CardHeader>
                    <CardTitle>Incoming Requests</CardTitle>
                    <CardDescription>People who want to chat with you.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {incomingRequests.length > 0 ? (
                        incomingRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={req.fromUser?.photoURL} />
                                    <AvatarFallback>{req.fromUser?.displayName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{req.fromUser?.displayName}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="icon" variant="outline" className="text-green-500 hover:text-green-600 hover:bg-green-500/10" onClick={() => handleRequestResponse(req, 'accepted')}>
                                    <Check className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => handleRequestResponse(req, 'denied')}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-4">No incoming requests.</p>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="outgoing">
             <Card>
                <CardHeader>
                    <CardTitle>Outgoing Requests</CardTitle>
                    <CardDescription>People you want to chat with.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     {outgoingRequests.length > 0 ? (
                        outgoingRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={req.toUser?.photoURL} />
                                    <AvatarFallback>{req.toUser?.displayName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{req.toUser?.displayName}</p>
                                    <p className="text-sm text-muted-foreground">Status: {req.status}</p>
                                </div>
                            </div>
                           <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => cancelOutgoingRequest(req.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-4">No outgoing requests.</p>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
