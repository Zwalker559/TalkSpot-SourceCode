import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Logo } from '@/components/logo';
import { ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const heroImage = PlaceHolderImages.find(p => p.id === 'landing-hero');

  return (
    <div className="flex flex-col min-h-screen bg-background/80 backdrop-blur-sm">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Logo className="h-6 w-6" />
            <span className="font-headline">TalkSpot</span>
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container grid lg:grid-cols-2 gap-12 items-center py-12 md:py-24 lg:py-32">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tighter">
              Connect Instantly. Chat Securely.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Welcome to TalkSpot, the modern real-time chat application. Connect with friends and colleagues using a unique ID system, ensuring your privacy and control over your conversations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Get Started for Free
                  <ArrowRight className="ml-2" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden shadow-2xl">
            {heroImage && (
              <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                width={1200}
                height={600}
                className="w-full h-auto object-cover"
                data-ai-hint={heroImage.imageHint}
                priority
              />
            )}
          </div>
        </section>

        <section className="bg-secondary/50 py-12 md:py-24">
          <div className="container text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-headline mb-4">About Us</h2>
            <p className="max-w-3xl mx-auto text-muted-foreground md:text-lg">
              TalkSpot was born from the idea that communication should be simple, direct, and secure. Our platform provides a seamless instant messaging experience, empowering users to connect with confidence. With features like a chat request system, media filtering, and robust account management, we put you in control of your digital interactions.
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-background">
        <div className="container py-6 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TalkSpot. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
