'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction
} from '@/components/ui/alert-dialog';
import Image from 'next/image';
import { Newspaper } from 'lucide-react';
import Autoplay from "embla-carousel-autoplay";


type Promotion = {
    id: string;
    title: string;
    type: 'text' | 'image';
    content: string;
    actionType: 'url' | 'popup' | 'enlarge';
    linkUrl?: string;
    popupContent?: string;
    status: 'active' | 'disabled';
    displayWeight: number;
}

export default function PromotionsCarousel() {
    const firestore = useFirestore();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [isPopupOpen, setPopupOpen] = useState(false);
    const [popupData, setPopupData] = useState<{ title: string, content: string }>({ title: '', content: '' });
    const [isImagePopupOpen, setImagePopupOpen] = useState(false);
    const [imagePopupData, setImagePopupData] = useState<{ title: string, src: string }>({ title: '', src: '' });

    useEffect(() => {
        if (!firestore) return;

        const q = query(collection(firestore, 'Sponsorships'), where('status', '==', 'active'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const activePromos: Promotion[] = [];
            snapshot.forEach(doc => {
                activePromos.push({ id: doc.id, ...doc.data() } as Promotion);
            });
            // Simple sort by display weight
            setPromotions(activePromos.sort((a,b) => b.displayWeight - a.displayWeight));
        });

        return () => unsubscribe();
    }, [firestore]);
    
    const handlePromoClick = (promo: Promotion) => {
        if (promo.actionType === 'url' && promo.linkUrl) {
            window.open(promo.linkUrl, '_blank');
        } else if (promo.actionType === 'popup' && promo.popupContent) {
            setPopupData({ title: promo.title, content: promo.popupContent });
            setPopupOpen(true);
        } else if (promo.actionType === 'enlarge' && promo.type === 'image') {
            setImagePopupData({ title: promo.title, src: promo.content });
            setImagePopupOpen(true);
        }
    };


    if (promotions.length === 0) {
        return null; // Don't render anything if there are no active promotions
    }

    return (
        <>
            <Carousel 
                className="w-full"
                opts={{
                    loop: true,
                }}
                 plugins={[
                    Autoplay({
                        delay: 3000,
                        stopOnInteraction: true,
                    }),
                ]}
            >
                <CarouselContent>
                    {promotions.map((promo) => (
                        <CarouselItem key={promo.id} onClick={() => handlePromoClick(promo)} className="cursor-pointer">
                            <Card className="overflow-hidden bg-muted/50 border-dashed">
                                <CardContent className="flex items-center justify-center p-2 aspect-[16/7]">
                                    {promo.type === 'image' ? (
                                        <div className="relative w-full h-full">
                                            <Image src={promo.content} alt={promo.title} layout="fill" objectFit="cover" className="rounded-md" />
                                        </div>
                                    ) : (
                                        <div className="text-center p-4 flex flex-col items-center justify-center">
                                            <Newspaper className="h-10 w-10 mb-4 text-muted-foreground" />
                                            <h3 className="font-bold text-xl">{promo.title}</h3>
                                            <p className="text-md text-foreground/90">{promo.content}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                {promotions.length > 1 && (
                    <>
                        <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2" />
                        <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2" />
                    </>
                )}
            </Carousel>

             <AlertDialog open={isPopupOpen} onOpenChange={setPopupOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{popupData.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {popupData.content}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setPopupOpen(false)}>Close</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={isImagePopupOpen} onOpenChange={setImagePopupOpen}>
                <AlertDialogContent className="max-w-3xl">
                     <AlertDialogHeader>
                        <AlertDialogTitle>{imagePopupData.title}</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="flex justify-center items-center p-4">
                        <Image src={imagePopupData.src} alt={imagePopupData.title} width={800} height={600} className="rounded-md max-w-full h-auto" />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setImagePopupOpen(false)}>Close</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
