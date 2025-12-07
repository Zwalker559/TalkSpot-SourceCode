

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNowStrict } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreVertical, Search, Send, Trash2, MessageSquare } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Types
type ParticipantDetails = {
  [uid: string]: {
    displayName: string;
    photoURL?: string;
    textingId: string;
  };
};

type Conversation = {
  id: string;
  participants: string[];
  participantDetails: ParticipantDetails;
  lastMessage?: string;
  lastMessageTimestamp?: any;
  lastMessageSenderId?: string;
};

type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
  photoURL?: string;
  displayName?: string;
};

type ChatFilters = {
    blockLinks?: boolean;
    blockProfanity?: boolean;
}

const profanityList = [
    'anal', 'anus', 'arse', 'ass', 'ass-hat', 'ass-jabber', 'ass-pirate', 'assbag', 'assbandit', 'assbanger', 'assbite', 'assclown', 'asscock', 'asscracker', 'asses', 'assface', 'assfuck', 'assfucker', 'assgoblin', 'asshat', 'asshead', 'asshole', 'asshopper', 'assjacker', 'asslick', 'asslicker', 'assmaster', 'assmonkey', 'assmunch', 'assmuncher', 'assnigger', 'asspirate', 'assshit', 'assshole', 'asssucker', 'asswad', 'asswipe', 'axwound', 'bampot', 'bastard', 'beaner', 'bitch', 'bitch-ass', 'bitch-tits', 'bitcher', 'bitchin', 'bitching', 'bitchtits', 'bitchy', 'blow job', 'blowjob', 'bollocks', 'bollox', 'boner', 'brotherfucker', 'bullshit', 'bumblefuck', 'butt plug', 'butt-pirate', 'buttfucka', 'buttfucker', 'camel toe', 'carpetmuncher', 'chesticle', 'chinc', 'chink', 'choad', 'chode', 'clit', 'clit-face', 'clitfuck', 'clusterfuck', 'cock', 'cock-jockey', 'cock-sucker', 'cockass', 'cockbite', 'cockburger', 'cockface', 'cockfucker', 'cockhead', 'cockholster', 'cockjockey', 'cockknocker', 'cockmaster', 'cockmongler', 'cockmongruel', 'cockmonkey', 'cockmuncher', 'cocknose', 'cocknugget', 'cockshit', 'cocksmith', 'cocksmoke', 'cocksmoker', 'cocksniffer', 'cocksucker', 'cockwaffle', 'coochie', 'coochy', 'coon', 'cooter', 'cracker', 'cum', 'cumbubble', 'cumdumpster', 'cumguzzler', 'cumjockey', 'cummer', 'cummin', 'cumming', 'cums', 'cumshot', 'cumslut', 'cumstain', 'cumtart', 'cunillingus', 'cunnie', 'cunnilingus', 'cunt', 'cunt-struck', 'cuntass', 'cuntface', 'cunthole', 'cuntlick', 'cuntlicker', 'cuntlapping', 'cunts', 'cuntslut', 'cyalis', 'cyberfuc', 'cyberfuck', 'cyberfucked', 'cyberfucker', 'cyberfuckers', 'cyberfucking', 'dago', 'damn', 'deggo', 'dick', 'dick-sneeze', 'dickbag', 'dickbeaters', 'dickface', 'dickfuck', 'dickfucker', 'dickhead', 'dickhole', 'dickjuice', 'dickmilk', 'dickmonger', 'dickslap', 'dicksucker', 'dicksucking', 'dicktickler', 'dickwad', 'dickweasel', 'dickweed', 'dickwod', 'dike', 'dildo', 'dildos', 'dillhole', 'dingleberr', 'dingleberry', 'dink', 'dinks', 'dipshit', 'dirsa', 'dlck', 'dog-fucker', 'doggie style', 'doggiestyle', 'doggin', 'dogging', 'donkeyribber', 'doochbag', 'doosh', 'douche', 'douche-fag', 'douchebag', 'douchewaffle', 'dumass', 'dumb ass', 'dumbass', 'dumbfuck', 'dumbshit', 'dummy', 'dyke', 'fag', 'fagbag', 'fagfucker', 'faggit', 'faggot', 'faggotcock', 'faggs', 'fagot', 'fagots', 'fags', 'fatass', 'fellatio', 'feltch', 'fisted', 'fisting', 'flamer', 'fuck', 'fuck-ass', 'fuck-bitch', 'fuck-off', 'fuckass', 'fuckbag', 'fuckboy', 'fuckbrain', 'fuckbuddy', 'fuckbutt', 'fuckbutter', 'fucked', 'fucker', 'fuckers', 'fuckersucker', 'fuckface', 'fuckhead', 'fuckhole', 'fuckin', 'fucking', 'fuckme', 'fucknut', 'fucknutt', 'fuckoff', 'fucks', 'fuckstick', 'fucktard', 'fucktart', 'fuckup', 'fuckwad', 'fuckwit', 'fuckwitt', 'fudge packer', 'fudgepacker', 'fuk', 'fuker', 'fukker', 'fukkin', 'fuks', 'fukwhit', 'fukwit', 'fux', 'fuxor', 'g-spot', 'gangbang', 'gangbanged', 'gangbangs', 'gayass', 'gaybob', 'gaydo', 'gaylord', 'gaytard', 'gaywad', 'god-damned', 'goddamn', 'goddamned', 'goddamnit', 'gooch', 'gook', 'gringo', 'guido', 'handjob', 'hard on', 'heeb', 'hell', 'ho', 'hoar', 'hoare', 'hoe', 'hoer', 'homo', 'homoerotic', 'honkey', 'hooker', 'hore', 'horny', 'hot carl', 'hot chick', 'howdo', 'hump', 'humping', 'jack-off', 'jackass', 'jackoff', 'jerk-off', 'jigaboo', 'jism', 'jiz', 'jizm', 'jizz', 'kawk', 'kike', 'klootzak', 'knob', 'knob-end', 'knobead', 'knobed', 'knobend', 'knobhead', 'knobjock', 'knobjockey', 'kock', 'kondum', 'kondums', 'kum', 'kumer', 'kummer', 'kummin', 'kumming', 'kums', 'kunilingus', 'kunt', 'kyke', 'lmfao', 'lube', 'mcfagget', 'mick', 'minge', 'mothafuck', 'mothafucka', 'mothafuckas', 'mothafuckaz', 'mothafucked', 'mothafucker', 'mothafuckers', 'mothafuckin', 'mothafucking', 'mothafuckings', 'mothafucks', 'mother fucker', 'motherfuck', 'motherfucked', 'motherfucker', 'motherfuckers', 'motherfuckin', 'motherfucking', 'motherfuckings', 'motherfuckka', 'motherfucks', 'muff', 'muffdiver', 'munging', 'negro', 'nigga', 'niggah', 'niggas', 'niggaz', 'nigger', 'niggers', 'nutsack', 'paki', 'panooch', 'pecker', 'peckerhead', 'penis', 'penis-breath', 'penisfucker', 'penispuffer', 'piss', 'pissed', 'pissed off', 'pisser', 'pissers', 'pisses', 'pissflaps', 'pissin', 'pissing', 'pissoff', 'polesmoker', 'pollock', 'poon', 'poonani', 'poonany', 'poontang', 'porch monkey', 'porchmonkey', 'prick', 'punanny', 'punta', 'pussies', 'pussy', 'pussy-lipped', 'pussylips', 'pussys', 'puto', 'queaf', 'queef', 'queer', 'queerbait', 'queerhole', 'renob', 'rimjob', 'ruski', 'sadist', 'sand nigger', 'sandnigger', 'schlong', 'scrote', 'scrotum', 'shemale', 'shit', 'shit-dick', 'shitass', 'shitbag', 'shitbagger', 'shitblimp', 'shitbrain', 'shitbreath', 'shitcanned', 'shitcunt', 'shitdick', 'shite', 'shited', 'shitey', 'shitface', 'shitfaced', 'shitfuck', 'shitfucker', 'shitfull', 'shithead', 'shithole', 'shithouse', 'shiting', 'shitspitter', 'shits', 'shitstain', 'shitted', 'shitter', 'shitters', 'shittiest', 'shitting', 'shittings', 'shitty', 'skank', 'skeet', 'slut', 'slut-bag', 'slutbag', 'sluts', 'smegma', 'spic', 'spick', 'splooge', 'spunk', 'tard', 'teabagging', 'teets', 'teez', 'testical', 'testicle', 'thundercunt', 'tit', 'tit-wank', 'titfuck', 'tits', 'titty', 'tittyfuck', 'tittyfucker', 'tittywank', 'titwank', 'tosser', 'turd', 'twat', 'twat-lips', 'twathead', 'twatlips', 'twats', 'twatwaffle', 'unclefucker', 'va-j-j', 'vag', 'vagina', 'viagra', 'vulva', 'wank', 'wanker', 'wankjob', 'whore', 'whore-bag', 'whorebag', 'whoreface', 'wop'
];
const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;


function FilteredMessage({ text, filters, isOwnMessage }: { text: string; filters: ChatFilters; isOwnMessage: boolean }) {
    const [revealed, setRevealed] = useState(false);
    
    let reason = '';
    let isBlocked = false;

    if (filters.blockProfanity) {
        const words = text.toLowerCase().split(/\s+/);
        for (const word of words) {
            if (profanityList.includes(word.replace(/[^a-zA-Z0-9]/g, ''))) {
                isBlocked = true;
                reason = 'Profanity';
                break;
            }
        }
    }

    if (!isBlocked && filters.blockLinks) {
        if (urlRegex.test(text)) {
            isBlocked = true;
            reason = 'Link';
        }
    }

    if (isBlocked && !revealed && !isOwnMessage) {
        return (
            <span
                className="cursor-pointer bg-muted text-muted-foreground px-2 py-1 rounded-md"
                onClick={() => setRevealed(true)}
            >
                Message hidden (Contains potential {reason}). Click to view.
            </span>
        );
    }
    
    return <p className="text-sm break-words">{text}</p>;
}


function ChatEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center bg-muted/50 rounded-lg">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No conversation selected</p>
            <p className="text-sm text-muted-foreground">Select a chat from the sidebar to start messaging.</p>
        </div>
    )
}

function MessageBubble({ message, isOwnMessage, onMessageDelete, chatFilters }: { message: Message; isOwnMessage: boolean; onMessageDelete: (messageId: string) => void; chatFilters: ChatFilters }) {
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  return (
    <>
      <div className={`flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
        {!isOwnMessage && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={message.photoURL} />
            <AvatarFallback>{message.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
        )}
        <div
          className={`group relative max-w-xs rounded-lg px-3 py-2 lg:max-w-md ${
            isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}
        >
          <FilteredMessage text={message.text} filters={chatFilters} isOwnMessage={isOwnMessage} />

           {isOwnMessage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100">
                    <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setDeleteConfirmOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
       <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this message. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onMessageDelete(message.id); setDeleteConfirmOpen(false); }} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function ChatClient() {
  const { user } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeletingConvo, setDeletingConvo] = useState(false);
  const [chatFilters, setChatFilters] = useState<ChatFilters>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);


   useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  useEffect(() => {
    if (!user || !firestore) return;
    
    // Fetch user's settings
    const userDocRef = doc(firestore, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
        if(docSnap.exists()){
            const data = docSnap.data();
            setChatFilters(data.chatFilters || {});
        }
    });
    
    const q = query(
      collection(firestore, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribeConvos = onSnapshot(q, (snapshot) => {
      const convos: Conversation[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Conversation));

      // Sort conversations client-side
      convos.sort((a, b) => {
        const timeA = a.lastMessageTimestamp?.toDate() || 0;
        const timeB = b.lastMessageTimestamp?.toDate() || 0;
        return timeB - timeA;
      });

      setConversations(convos);
    });

    return () => {
        unsubscribeUser();
        unsubscribeConvos();
    }
  }, [user, firestore]);
  
  // Effect to select conversation from URL
  useEffect(() => {
    const convoId = searchParams.get('conversationId');
    if (convoId && conversations.length > 0) {
      const convoToSelect = conversations.find(c => c.id === convoId);
      if (convoToSelect) {
        setSelectedConvo(convoToSelect);
      }
    }
  }, [searchParams, conversations]);


  useEffect(() => {
    if (!selectedConvo || !firestore) {
      setMessages([]);
      return;
    };

    const messagesQuery = query(
      collection(firestore, 'conversations', selectedConvo.id, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map(docSnap => {
         const data = docSnap.data();
         const senderId = data.senderId;
         const participantDetail = selectedConvo.participantDetails[senderId];
         return {
            id: docSnap.id,
            ...data,
            displayName: participantDetail?.displayName || 'Unknown',
            photoURL: participantDetail?.photoURL,
         } as Message;
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [selectedConvo, firestore]);

  const handleSendMessage = async () => {
    if (!user || !firestore || !selectedConvo || !newMessage.trim()) return;

    try {
        const conversationRef = doc(firestore, 'conversations', selectedConvo.id);
        const messagesColRef = collection(conversationRef, 'messages');

        await addDoc(messagesColRef, {
            senderId: user.uid,
            text: newMessage.trim(),
            timestamp: serverTimestamp(),
        });

        await updateDoc(conversationRef, {
            lastMessage: newMessage.trim(),
            lastMessageSenderId: user.uid,
            lastMessageTimestamp: serverTimestamp(),
        });
        
        setNewMessage('');
    } catch(error: any) {
        console.error("Error sending message: ", error);
        toast({
            variant: 'destructive',
            title: 'Error sending message',
            description: error.message
        })
    }

  };

  const handleMessageDelete = async (messageId: string) => {
    if (!selectedConvo || !firestore) return;

    const messageRef = doc(firestore, 'conversations', selectedConvo.id, 'messages', messageId);
    try {
        await deleteDoc(messageRef);
        toast({ title: 'Message Deleted' });
        
        // If the deleted message was the last one, update the conversation's lastMessage
        if (messages.length > 1 && messages[messages.length - 1].id === messageId) {
             const newLastMessage = messages[messages.length - 2];
             const conversationRef = doc(firestore, 'conversations', selectedConvo.id);
             await updateDoc(conversationRef, {
                lastMessage: newLastMessage.text,
                lastMessageSenderId: newLastMessage.senderId,
                lastMessageTimestamp: newLastMessage.timestamp,
             });
        } else if (messages.length === 1) {
            const conversationRef = doc(firestore, 'conversations', selectedConvo.id);
             await updateDoc(conversationRef, {
                lastMessage: 'Chat started.',
                lastMessageSenderId: null,
                lastMessageTimestamp: serverTimestamp(),
             });
        }

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete message.' });
    }
  };


  const handleDeleteConversation = async () => {
    if (!selectedConvo || !firestore) return;
    setDeletingConvo(true);
  }

  const confirmDeleteConversation = async () => {
     if (!selectedConvo || !firestore) return;
     try {
        const batch = writeBatch(firestore);

        // 1. Delete all messages in the subcollection
        const messagesRef = collection(firestore, 'conversations', selectedConvo.id, 'messages');
        const messagesSnapshot = await getDocs(messagesRef);
        messagesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 2. Delete the conversation document itself
        const convoRef = doc(firestore, 'conversations', selectedConvo.id);
        batch.delete(convoRef);

        await batch.commit();
        
        toast({title: "Conversation deleted"});
        setSelectedConvo(null);
     } catch (error: any) {
        console.error("Error deleting conversation: ", error);
        toast({variant: 'destructive', title: "Error", description: "Could not delete conversation."});
     } finally {
        setDeletingConvo(false);
     }
  }


  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;
    return conversations.filter(convo => {
      const otherUserId = convo.participants.find(p => p !== user?.uid);
      if (!otherUserId) return false;
      const details = convo.participantDetails[otherUserId];
      return (
        details?.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        details?.textingId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [searchTerm, conversations, user]);

  const filterPreviewText = (text: string = '', fromSelf: boolean) => {
    if (fromSelf) return text;

    let filteredText = text;
    let isBlocked = false;

    if (chatFilters.blockProfanity) {
      const lowerCaseText = text.toLowerCase();
      const words = lowerCaseText.split(/\s+/);
      for (const word of words) {
        if (profanityList.includes(word.replace(/[^a-zA-Z0-9]/g, ''))) {
            isBlocked = true;
            break;
        }
      }
    }
    if (!isBlocked && chatFilters.blockLinks && urlRegex.test(text)) {
        isBlocked = true;
    }

    return isBlocked ? 'Message hidden' : filteredText;
  };


  return (
    <div className="grid grid-cols-[300px_1fr] h-full gap-4">
      {/* Sidebar */}
      <div className="flex flex-col border-r h-full">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search chats..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filteredConversations.map(convo => {
            const otherUserId = convo.participants.find(p => p !== user?.uid);
            if (!otherUserId) return null;

            const otherUserDetails = convo.participantDetails[otherUserId];
            const lastMessageTime = convo.lastMessageTimestamp
              ? formatDistanceToNowStrict(convo.lastMessageTimestamp.toDate(), { addSuffix: true })
              : '';
            
            const isLastMessageFromSelf = convo.lastMessageSenderId === user?.uid;
            const filteredLastMessage = filterPreviewText(convo.lastMessage, isLastMessageFromSelf);


            return (
              <div
                key={convo.id}
                className={`flex items-start gap-3 p-4 cursor-pointer border-b hover:bg-muted/50 ${selectedConvo?.id === convo.id ? 'bg-muted' : ''}`}
                onClick={() => setSelectedConvo(convo)}
              >
                <Avatar>
                  <AvatarImage src={otherUserDetails?.photoURL} />
                  <AvatarFallback>{otherUserDetails?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold truncate">{otherUserDetails?.displayName}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{lastMessageTime}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{otherUserDetails?.textingId}</p>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {isLastMessageFromSelf && 'You: '}
                    {filteredLastMessage}
                  </p>
                </div>
              </div>
            );
          })}
        </ScrollArea>
      </div>

      {/* Main Chat View */}
      <div className="flex flex-col h-full">
        {selectedConvo ? (
          <>
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarImage src={selectedConvo.participantDetails[selectedConvo.participants.find(p => p !== user?.uid)!]?.photoURL} />
                        <AvatarFallback>{selectedConvo.participantDetails[selectedConvo.participants.find(p => p !== user?.uid)!]?.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="font-semibold">{selectedConvo.participantDetails[selectedConvo.participants.find(p => p !== user?.uid)!]?.displayName}</p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleDeleteConversation} className="text-destructive-foreground bg-destructive/90 focus:bg-destructive focus:text-destructive-foreground">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Conversation
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} isOwnMessage={msg.senderId === user?.uid} onMessageDelete={handleMessageDelete} chatFilters={chatFilters} />
                ))}
                 <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="p-4 border-t">
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  autoComplete='off'
                />
                <Button type="submit">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <ChatEmptyState />
        )}
      </div>
      <AlertDialog open={isDeletingConvo} onOpenChange={setDeletingConvo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this entire conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteConversation} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
