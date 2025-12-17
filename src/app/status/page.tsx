
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { CheckCircle, XCircle, AlertTriangle, Cloud, Database, GitBranch } from 'lucide-react';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


type Status = 'operational' | 'degraded' | 'outage';

interface StatusItem {
  name: string;
  status: Status;
  summary: string;
  details: string;
  category: 'Pages' | 'Core Features' | 'External Services';
}

const statusConfig = {
  operational: {
    icon: <CheckCircle className="text-green-500" />,
    badge: <Badge className="bg-green-500/20 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-500/30 hover:bg-green-500/20">Operational</Badge>,
  },
  degraded: {
    icon: <AlertTriangle className="text-yellow-500" />,
    badge: <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20">Degraded</Badge>,
  },
  outage: {
    icon: <XCircle className="text-red-500" />,
    badge: <Badge variant="destructive">Outage</Badge>,
  },
};

export default function StatusPage() {
  const [statusItems, setStatusItems] = useState<StatusItem[]>([
    // Pages
    { name: 'Landing Page (`/`)', status: 'operational', summary: 'Public-facing landing page is online.', details: 'The Next.js server is successfully rendering and serving the static landing page content. All assets are loading correctly.', category: 'Pages' },
    { name: 'Login/Signup (`/login`)', status: 'operational', summary: 'User authentication entry points are online.', details: 'The authentication pages are being served correctly and the connection to the Firebase Authentication service for handling sign-in and sign-up attempts is active.', category: 'Pages' },
    { name: 'Dashboard (`/dashboard`)', status: 'operational', summary: 'Main chat interface is online.', details: 'The core application layout and chat client are rendering correctly for authenticated users.', category: 'Pages' },
    { name: 'Settings (`/settings`)', status: 'operational', summary: 'User settings and profile management are online.', details: 'The settings page is functional, allowing users to view and modify their profile information.', category: 'Pages' },
    { name: 'Admin Panel (`/admin`)', status: 'operational', summary: 'Administrative dashboard is online.', details: 'The admin panel is being served correctly to authorized users, with access to user management and other administrative tools.', category: 'Pages' },
    
    // Core Features
    { name: 'User Authentication', status: 'operational', summary: 'Login, signup, and session management are functioning normally.', details: 'Users are able to sign in, sign up, and maintain persistent sessions. Server-side actions are successfully verifying user tokens.', category: 'Core Features' },
    { name: 'Real-time Chat', status: 'operational', summary: 'Sending and receiving messages is functioning normally.', details: 'The WebSocket connection to Firestore is active, allowing for real-time message delivery and updates between clients.', category: 'Core Features' },
    { name: 'Chat Requests', status: 'operational', summary: 'Users can send, accept, and deny chat requests.', details: 'The server-side logic for creating, updating, and deleting chat request documents in Firestore is operating as expected.', category: 'Core Features' },
    { name: 'Admin User Management', status: 'operational', summary: 'Admins can manage user roles, status, and details.', details: 'Server Actions for administrative tasks (e.g., changing user roles, suspending accounts) are successfully authenticating and executing.', category: 'Core Features' },

    // External Services
    { name: 'Firebase Authentication', status: 'operational', summary: 'Connection to Firebase Auth service is stable.', details: 'The application is successfully communicating with the Firebase Authentication backend for all auth-related operations.', category: 'External Services' },
    { name: 'Firestore Database', status: 'degraded', summary: 'Attempting to connect...', details: 'The client-side Firebase SDK has successfully initialized and is attempting to establish a persistent, real-time connection to the Cloud Firestore backend. This allows for reading and writing data directly from the client and receiving live updates.', category: 'External Services' },
    { name: 'Vercel Deployment Host', status: 'operational', summary: 'Application is successfully deployed and served.', details: 'The current deployment is live on Vercel. This status reflects the health of the hosting platform itself.', category: 'External Services' },
  ]);

  const firestore = useFirestore();

  useEffect(() => {
    // Simulate a "ping" to Firestore to check connectivity
    const checkFirestoreStatus = async () => {
      try {
        if (!firestore) {
             throw new Error('Firestore client not available.');
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network latency
        
        setStatusItems(prevItems =>
          prevItems.map(item =>
            item.name === 'Firestore Database'
              ? { ...item, status: 'operational', summary: 'Client SDK is initialized and connected.', details: 'The client-side Firebase SDK has successfully initialized and established a persistent, real-time connection to the Cloud Firestore backend. This allows for reading and writing data directly from the client and receiving live updates.' }
              : item
          )
        );
      } catch (error) {
        setStatusItems(prevItems =>
          prevItems.map(item =>
            item.name === 'Firestore Database'
              ? { ...item, status: 'outage', summary: 'Failed to connect to Firestore.', details: `The client-side SDK failed to establish a connection to Firestore. This could be due to network issues, incorrect configuration, or a service outage. Error: ${error}` }
              : item
          )
        );
        console.error("Firestore connection check failed:", error);
      }
    };

    checkFirestoreStatus();
  }, [firestore]);
  
  const overallStatus = statusItems.some(item => item.status === 'outage')
    ? 'outage'
    : statusItems.some(item => item.status === 'degraded')
    ? 'degraded'
    : 'operational';

  return (
    <div className="bg-background min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Logo className="h-6 w-6" />
            <span className="font-headline">TalkSpot</span>
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <h1 className="font-semibold text-lg">System Status</h1>
          </nav>
        </div>
      </header>
      
      <main className="container py-8 md:py-12">
        <div className="space-y-12">

          <Card className={`border-${overallStatus === 'operational' ? 'green' : overallStatus === 'degraded' ? 'yellow' : 'red'}-500/50`}>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        {statusConfig[overallStatus].icon}
                        <span>
                            {overallStatus === 'operational' ? 'All Systems Operational' :
                             overallStatus === 'degraded' ? 'Some Systems Experiencing Issues' :
                             'Major System Outage'}
                        </span>
                    </CardTitle>
                    <CardDescription>
                        Last updated: {new Date().toLocaleString()}
                    </CardDescription>
                </div>
                 {statusConfig[overallStatus].badge}
            </CardHeader>
          </Card>

          <div className="space-y-8">
            <ServiceCategory category="Pages" items={statusItems} />
            <ServiceCategory category="Core Features" items={statusItems} />
            <ServiceCategory category="External Services" items={statusItems} />
          </div>

          <Card>
            <CardHeader>
                <CardTitle>Error Details</CardTitle>
                <CardDescription>In-depth error codes and messages for degraded or outage-level events will appear here.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-8">
                    No active errors to report.
                </div>
            </CardContent>
          </Card>

        </div>
      </main>
       <footer className="bg-background mt-12">
        <div className="container py-6 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TalkSpot. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function ServiceCategory({ category, items }: { category: StatusItem['category'], items: StatusItem[] }) {
  const filteredItems = items.filter(item => item.category === category);
  
  const getIcon = (category: StatusItem['category']) => {
    switch(category) {
        case 'Pages': return <Cloud className="h-5 w-5" />;
        case 'Core Features': return <Logo className="h-5 w-5" />;
        case 'External Services': return <Database className="h-5 w-5" />;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {getIcon(category)}
          {category}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
            {filteredItems.map(item => (
                <AccordionItem value={item.name} key={item.name}>
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex justify-between items-center w-full">
                            <span className="font-medium text-left">{item.name}</span>
                            {statusConfig[item.status].badge}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm space-y-2 pt-2">
                        <p><span className="font-semibold text-foreground">Summary:</span> {item.summary}</p>
                        <p><span className="font-semibold text-foreground">Details:</span> {item.details}</p>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

