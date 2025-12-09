
'use client';

import React, { useState, useEffect } from 'react';
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
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

type Promotion = {
  id: string;
  title: string;
  type: 'text' | 'image';
  content: string;
  logoUrl?: string;
  actionType: 'url' | 'popup' | 'enlarge';
  linkUrl?: string;
  popupContent?: string;
  status: 'active' | 'disabled';
  displayWeight: number;
  location: 'header' | 'sidebar' | 'both';
};

export default function SidebarPromotions() {
  const firestore = useFirestore();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [api, setApi] = useState<CarouselApi>();
  const [popupData, setPopupData] = useState<{ title: string; content: string } | null>(null);
  const [enlargeImage, setEnlargeImage] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore) return;

    const sponsorshipsColRef = collection(firestore, 'Sponsorships');
    const q = query(
      sponsorshipsColRef,
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const allActivePromos = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Promotion[];

        // Filter for location on the client side
        const sidebarPromos = allActivePromos.filter(promo => 
            promo.location === 'sidebar' || promo.location === 'both'
        );

        setPromotions(sidebarPromos.sort((a, b) => b.displayWeight - a.displayWeight));
        }, (error) => {
            console.error("Error fetching sidebar promotions:", error);
        }
    );

    return () => unsubscribe();
  }, [firestore]);

  const handlePromoClick = (e: React.MouseEvent, promo: Promotion) => {
    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const third = rect.width / 3;

    if (clickX < third) {
      api?.scrollPrev();
    } else if (clickX > 2 * third) {
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
          if (promo.type === 'image') setEnlargeImage(promo.content);
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
        <div className="p-2">
            <Carousel
                setApi={setApi}
                opts={{
                    align: 'start',
                    loop: true,
                }}
                plugins={[Autoplay({ delay: 8000, stopOnInteraction: true })]}
                className="w-full"
            >
                <CarouselContent>
                {promotions.map((promo) => (
                    <CarouselItem key={promo.id} onClick={(e) => handlePromoClick(e, promo)} className="cursor-pointer">
                        <Card className="overflow-hidden bg-muted/50">
                             <CardContent className="flex items-center justify-center p-0 aspect-square relative">
                                {promo.type === 'image' ? (
                                    <Image src={promo.content} alt={promo.title} layout="fill" objectFit="cover" className="rounded-md" />
                                ) : (
                                     <div className="text-center p-2 flex flex-col items-center justify-center gap-1">
                                        {promo.logoUrl && <Image src={promo.logoUrl} alt="logo" width={32} height={32} className="rounded-sm object-contain mb-1" />}
                                        <h3 className="font-semibold text-base leading-tight">{promo.title}</h3>
                                        <p className="text-xs text-foreground/80 mt-1">{promo.content}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </CarouselItem>
                ))}
                </CarouselContent>
            </Carousel>
        </div>
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
                {enlargeImage && <Image src={enlargeImage} alt="Enlarged promotion" width={1200} height={675} className="rounded-md object-contain"/>}
            </DialogContent>
        </Dialog>
    </>
  );
}
