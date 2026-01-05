'use client';

import React from 'react';
import Image from 'next/image';
import Autoplay from 'embla-carousel-autoplay';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { SecurityRuleContext } from '@/firebase/errors';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';

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
};

export default function PromotionsCarousel() {
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [api, setApi] = React.useState<CarouselApi>();
  const [popupData, setPopupData] = React.useState<{ title: string; content: string } | null>(null);
  const [enlargeImage, setEnlargeImage] = React.useState<{src: string, title: string} | null>(null);
  const firestore = useFirestore();

  React.useEffect(() => {
    if (!firestore) return;

    const sponsorshipsColRef = collection(firestore, 'sponsorships');
    const q = query(sponsorshipsColRef, where('status', '==', 'active'));

    const unsubscribe = onSnapshot(q,
      async (snapshot) => {
        let activePromos: Promotion[] = [];
        snapshot.forEach(doc => {
            const data = doc.data() as Omit<Promotion, 'id'>;
            if (data.location === 'header' || data.location === 'both') {
                activePromos.push({ id: doc.id, ...data });
            }
        });

        if (activePromos.length === 0) {
            // No active promotions found, try to get the fallback
            try {
                const fallbackDoc = await getDoc(doc(firestore, 'sponsorships', 'fallback'));
                if (fallbackDoc.exists()) {
                    const fallbackData = fallbackDoc.data() as Omit<Promotion, 'id'>;
                    // Only use fallback if it's active and for the correct location
                    if (fallbackData.status === 'active' && (fallbackData.location === 'header' || fallbackData.location === 'both')) {
                         activePromos.push({ id: fallbackDoc.id, ...fallbackData });
                    }
                }
            } catch (error) {
                 console.error("Could not fetch fallback promotion:", error);
            }
        }

        setPromotions(activePromos.sort((a, b) => b.displayWeight - a.displayWeight));
      },
      (error) => {
        console.error("Error listening to sponsorships collection:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: q.path,
            operation: 'list',
        } satisfies SecurityRuleContext));
      }
    );

    return () => unsubscribe();
  }, [firestore]);

  const handlePromoClick = (e: React.MouseEvent, promo: Promotion) => {
    if (promo.actionType === 'none') return;
    
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const third = rect.width / 3;

    if (clickX < third) {
      api?.scrollPrev();
    } else if (clickX > rect.width - third) {
      api?.scrollNext();
    } else {
      // Center click
      switch (promo.actionType) {
        case 'url':
          if (promo.linkUrl) window.open(promo.linkUrl, '_blank', 'noopener,noreferrer');
          break;
        case 'popup':
          setPopupData({ title: promo.title, content: promo.popupContent || '' });
          break;
        case 'enlarge':
           if (promo.type === 'image') setEnlargeImage({src: promo.content, title: promo.title});
          break;
        default:
          break;
      }
    }
  };
  
   if (promotions.length === 0) {
    return null;
  }

  return (
    <>
      <Carousel
        setApi={setApi}
        opts={{
          loop: true,
        }}
        plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
        className="w-full"
      >
        <CarouselContent>
          {promotions.map((promo) => (
            <CarouselItem key={promo.id} onClick={(e) => handlePromoClick(e, promo)} className="cursor-pointer">
              <Card className="overflow-hidden bg-muted/50">
                 <CardContent className="flex items-center justify-center p-0 aspect-[16/2] relative">
                    {promo.type === 'image' ? (
                       <Image
                        src={promo.content}
                        alt={promo.title}
                        fill
                        style={{objectFit: promo.imageFit || 'cover'}}
                        className="rounded-md"
                      />
                    ) : (
                       <div className="text-center p-4 flex flex-col items-center justify-center gap-2">
                        {promo.logoUrl && (
                          <Image
                            src={promo.logoUrl}
                            alt="logo"
                            width={40}
                            height={40}
                            className="rounded-sm object-contain"
                          />
                        )}
                        <h3 className="font-bold text-lg">{promo.title}</h3>
                        <p className="text-sm text-foreground/90">{promo.content}</p>
                      </div>
                    )}
                 </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <Dialog open={!!popupData} onOpenChange={() => setPopupData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{popupData?.title}</DialogTitle>
            <DialogDescription>{popupData?.content}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!enlargeImage} onOpenChange={() => setEnlargeImage(null)}>
        <DialogContent className="max-w-3xl">
           <DialogHeader>
            <DialogTitle>{enlargeImage?.title}</DialogTitle>
            <DialogDescription>Enlarged view of the promotional image.</DialogDescription>
          </DialogHeader>
          {enlargeImage && <Image src={enlargeImage.src} alt="Enlarged promotion" width={1200} height={675} className="rounded-md object-contain"/>}
        </DialogContent>
      </Dialog>
    </>
  );
}
