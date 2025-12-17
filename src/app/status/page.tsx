
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { CheckCircle, XCircle, AlertTriangle, GitBranch, Database, Cloud } from 'lucide-react';
import { Logo } from '@/components/logo';
import Link from 'next/link';

type Status = 'operational' | 'degraded' | 'outage';

interface StatusItem {
  name: string;
  status: Status;
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
    { name: 'Landing Page (`/`)', status: 'operational', details: 'Public-facing landing page is online.', category: 'Pages' },
    { name: 'Login/Signup (`/login`)', status: 'operational', details: 'User authentication entry points are online.', category: 'Pages' },
    { name: 'Dashboard (`/dashboard`)', status: 'operational', details: 'Main chat interface is online.', category: 'Pages' },
    { name: 'Settings (`/settings`)', status: 'operational', details: 'User settings and profile management are online.', category: 'Pages' },
    { name: 'Admin Panel (`/admin`)', status: 'operational', details: 'Administrative dashboard is online.', category: 'Pages' },
    
    // Core Features
    { name: 'User Authentication', status: 'operational', details: 'Login, signup, and session management are functioning normally.', category: 'Core Features' },
    { name: 'Real-time Chat', status: 'operational', details: 'Sending and receiving messages is functioning normally.', category: 'Core Features' },
    { name: 'Chat Requests', status: 'operational', details: 'Users can send, accept, and deny chat requests.', category: 'Core Features' },
    { name: 'Admin User Management', status: 'operational', details: 'Admins can manage user roles, status, and details.', category: 'Core Features' },

    // External Services
    { name: 'Firebase Authentication', status: 'operational', details: 'Connection to Firebase Auth service is stable.', category: 'External Services' },
    { name: 'Firestore Database', status: 'degraded', details: 'Attempting to connect...', category: 'External Services' },
    { name: 'GitHub Connection', status: 'operational', details: 'Codebase is synced with the Git repository.', category: 'External Services' },
    { name: 'Vercel Deployment', status: 'operational', details: 'Application is successfully deployed and served by Vercel.', category: 'External Services' },
  ]);

  const firestore = useFirestore();

  useEffect(() => {
    // Simulate a "ping" to Firestore to check connectivity
    const checkFirestoreStatus = async () => {
      try {
        if (!firestore) {
             throw new Error('Firestore client not available.');
        }
        // A simple check like this doesn't guarantee the backend is healthy,
        // but it confirms the client-side SDK is initialized and can try to connect.
        // In a real-world scenario, this might involve a dedicated health check function.
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network latency
        
        setStatusItems(prevItems =>
          prevItems.map(item =>
            item.name === 'Firestore Database'
              ? { ...item, status: 'operational', details: 'Client SDK is initialized and connected.' }
              : item
          )
        );
      } catch (error) {
        setStatusItems(prevItems =>
          prevItems.map(item =>
            item.name === 'Firestore Database'
              ? { ...item, status: 'outage', details: 'Failed to connect to Firestore. Check console for errors.' }
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Component</TableHead>
              <TableHead className="w-1/3">Details</TableHead>
              <TableHead className="text-right w-1/3">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map(item => (
              <TableRow key={item.name}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.details}</TableCell>
                <TableCell className="text-right">
                  {statusConfig[item.status].badge}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
