
"use client";

import { useMemo, useEffect, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { type Annotation, type BibleChapterResponse, type ChapterContentItem } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Balancer from 'react-wrap-balancer';
import { useAnnotationContext } from '@/contexts/annotation-context';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';


function VerseComponent({
    verse,
    annotations,
    onAnnotationClick,
}: {
    verse: Extract<ChapterContentItem, { type: 'verse' }>;
    annotations: Annotation[];
    onAnnotationClick: (annotation: Annotation) => void;
}) {
    const { fontSize } = useAnnotationContext();

    const renderedContent = useMemo(() => {
        // This function recursively processes the raw verse content (which can be nested)
        // and returns a flat string for calculating annotation offsets.
        const getFlatText = (content: any[]): string => {
            return content.flat(Infinity).map((item: any) => {
                if (typeof item === 'string') return item;
                if (item.type === 'note') return ''; // Exclude notes from flat text
                if (item.text) return item.text;
                if (item.content && typeof item.content === 'string') return item.content;
                if (item.content && Array.isArray(item.content)) {
                    return getFlatText(item.content);
                }
                return '';
            }).join('');
        };

        const flatText = getFlatText(verse.content as any[]);
        const sortedAnnotations = [...annotations].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

        // Create a character map to hold styling info for each character
        const chars = flatText.split('').map(char => ({
            char,
            isWoj: false,
            annotations: [] as Annotation[],
        }));

        // This function traverses the original content structure to mark "Words of Jesus"
        let currentIndex = 0;
        const processContent = (items: any[]) => {
            items.forEach(item => {
                if (typeof item === 'string') {
                    currentIndex += item.length;
                } else if (item.type === 'note') {
                   // Ignore notes completely, they are not part of the renderable text
                } else if (item.type === 'woj' || (Array.isArray(item.class) && item.class.includes('w-of-j'))) {
                    const subContent = Array.isArray(item.content) ? item.content : [item.content];
                    const subContentText = getFlatText(subContent);
                    for (let i = 0; i < subContentText.length; i++) {
                        if (chars[currentIndex + i]) {
                            chars[currentIndex + i].isWoj = true;
                        }
                    }
                    // Recursively process child content of woj to handle nested structures
                    processContent(subContent);
                } else if (item.text) {
                    currentIndex += item.text.length;
                } else if (Array.isArray(item.content)) {
                    processContent(item.content);
                } else if (item.content && typeof item.content === 'string') {
                    currentIndex += item.content.length;
                }
            });
        }
        processContent(verse.content as any[]);

        // Mark characters covered by annotations
        sortedAnnotations.forEach(ann => {
            for (let i = ann.start; i < ann.end; i++) {
                if(chars[i]) chars[i].annotations.push(ann);
            }
        });

        // Build the final render output by grouping characters with the same styling
        const finalRender: React.ReactNode[] = [];
        let i = 0;
        while (i < chars.length) {
            const charInfo = chars[i];
            const currentAnnotationClasses = charInfo.annotations.map(a => cn(a.highlight, a.underline, a.note && "border-b-2 border-dashed border-primary")).join(' ');
            const isCurrentWoj = charInfo.isWoj;

            let j = i;
            // Find end of current segment (same annotations and same WoJ status)
            while (j < chars.length && chars[j].isWoj === isCurrentWoj && chars[j].annotations.map(a => a.id).join(',') === charInfo.annotations.map(a => a.id).join(',')) {
                j++;
            }

            const segmentText = chars.slice(i, j).map(c => c.char).join('');
            const mainAnnotation = charInfo.annotations[0];

            finalRender.push(
                <span 
                    key={i} 
                    className={cn(currentAnnotationClasses, isCurrentWoj && 'words-of-jesus')}
                    onClick={mainAnnotation ? (e) => { e.stopPropagation(); onAnnotationClick(mainAnnotation); } : undefined}
                >
                    {segmentText}
                </span>
            );
            i = j;
        }
        return finalRender;

    }, [verse.content, annotations, onAnnotationClick]);
    
    const handleVerseNumberClick = (event: React.MouseEvent<HTMLElement>) => {
        const supElement = event.currentTarget;
        const pElement = supElement.parentElement;
        if (!pElement) return;

        const selection = window.getSelection();
        if (!selection) return;

        const range = document.createRange();
        // Select the entire content of the parent <p> element
        range.selectNodeContents(pElement);
        
        // Collapse the start of the range to be after the <sup> element
        // This programmatically deselects the verse number
        range.setStartAfter(supElement);
        
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Manually trigger the selection change handler
        document.dispatchEvent(new Event('selectionchange'));
    };


    return (
        <p className={cn(
            "font-body",
            fontSize === 'sm' && 'text-sm leading-relaxed',
            fontSize === 'md' && 'text-base leading-relaxed',
            fontSize === 'lg' && 'text-lg leading-relaxed',
            fontSize === 'xl' && 'text-xl leading-relaxed',
            fontSize === '2xl' && 'text-2xl leading-relaxed',
        )} data-verse-number={verse.number}>
            <sup 
                className="font-headline font-bold text-primary mr-2 select-none cursor-pointer"
                onClick={handleVerseNumberClick}
            >
                {verse.number}
            </sup>
            {renderedContent}
        </p>
    );
}

export function BibleDisplay({ chapterData, onChapterNav }: { chapterData: BibleChapterResponse, onChapterNav: (direction: 'prev' | 'next') => void }) {
    const { 
        setSelection,
        setActiveAnnotation,
    } = useAnnotationContext();
    const { user } = useUser();
    const firestore = useFirestore();
    const bibleContentRef = useRef<HTMLDivElement>(null);
    const [emblaRef, emblaApi] = useEmblaCarousel({ axis: 'x', watchDrag: true });

    useEffect(() => {
        if (!emblaApi) return;
    
        const handleSwipe = () => {
          const progress = emblaApi.scrollProgress();
          emblaApi.scrollTo(0, true); // Prevent snap-back
          
          if (progress < -0.1) { // Right swipe
            onChapterNav('prev');
          } else if (progress > 0.1) { // Left swipe
            onChapterNav('next');
          }
        };
    
        emblaApi.on('pointerUp', handleSwipe);
    
        return () => {
          emblaApi.off('pointerUp', handleSwipe);
        };
      }, [emblaApi, onChapterNav]);


    const bookId = chapterData.book.id;
    const chapterNum = chapterData.chapter.number;
    const translationId = chapterData.translation.id;

    const annotationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/annotations`);
    }, [user, firestore]);

    const { data: annotations } = useCollection<Annotation>(annotationsQuery);

    const chapterAnnotations = useMemo(() => {
        if (!annotations) return {};
        const annotationMap: Record<string, Annotation[]> = {};
        annotations.filter(a => a.book === bookId && a.chapter === chapterNum && a.translation === translationId)
        .forEach(a => {
            const key = String(a.verse);
            if (!annotationMap[key]) {
                annotationMap[key] = [];
            }
            annotationMap[key].push(a);
        });
        return annotationMap;
    }, [annotations, bookId, chapterNum, translationId]);


    const handleTextSelect = () => {
        if (!user) {
             if (window.getSelection()) window.getSelection()?.removeAllRanges();
             setSelection(null);
             return;
        }
        const sel = window.getSelection();

        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);

            let verseEl = range.startContainer.parentElement;
            while(verseEl && !verseEl.hasAttribute('data-verse-number')) {
                verseEl = verseEl.parentElement;
            }

            if (!verseEl || !verseEl.closest('.bible-content')) {
                 setSelection(null);
                 return;
            };
            const verseNum = verseEl.getAttribute('data-verse-number');

            if (verseNum) {
                // Check if the selection is within our bible content to avoid capturing other selections
                const contentContainer = document.querySelector('.bible-content');
                if (contentContainer && contentContainer.contains(range.commonAncestorContainer)) {
                    setSelection({ range, verseNum });
                    setActiveAnnotation(null);
                }
            }
        } else {
             // Only clear selection if there's no text selected anywhere on the page
             if (sel && sel.isCollapsed) {
                setSelection(null);
             }
        }
    };
    
    useEffect(() => {
        // Use document selectionchange event which is more reliable on mobile
        document.addEventListener('selectionchange', handleTextSelect);

        return () => {
            document.removeEventListener('selectionchange', handleTextSelect);
        };
    }, [user, setSelection, setActiveAnnotation]); // Rerun if user changes
    
    const handleAnnotationClick = (annotation: Annotation) => {
        setActiveAnnotation(annotation);
    };
    
    const fullReference = `${chapterData.book.name} ${chapterData.chapter.number}`;

    const renderContentItem = (item, index) => {
        if (item.type === 'heading') {
            return <h4 key={`h-${index}`} className="text-xl font-headline font-bold pt-4 select-none"><Balancer>{item.content.join(' ')}</Balancer></h4>;
        }
        if (item.type === 'verse') {
            return <VerseComponent 
                        key={item.number} 
                        verse={item} 
                        annotations={chapterAnnotations[item.number] || []}
                        onAnnotationClick={handleAnnotationClick}
                    />;
        }
        // The API sometimes includes paragraph breaks as their own items
        if (item.type === 'para-break' || item['para-break']) {
            return <div key={`p-br-${index}`} className="h-4" />;
        }
        return null;
    };


    return (
        <div ref={emblaRef} className="pt-4 relative overflow-hidden">
            <div className="flex">
                <div className="min-w-0 flex-shrink-0 flex-grow-0 basis-full">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-3xl">{fullReference}</CardTitle>
                                <p className="text-sm text-muted-foreground">{chapterData.translation.name}</p>
                        </CardHeader>
                        <CardContent className="pb-20 md:pb-6">
                            <div ref={bibleContentRef} className={cn("space-y-2 select-text bible-content")}>
                                {chapterData.chapter.content.map(renderContentItem)}
                            </div>
                        </CardContent>
                        <CardFooter className="md:hidden fixed bottom-4 right-4 left-4 z-30 p-0 bg-transparent justify-end">
                             <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    type="button" 
                                    onClick={() => onChapterNav('prev')}
                                    className="h-12 w-12 rounded-full shadow-lg bg-background/80 backdrop-blur-sm"
                                    aria-label="Previous Chapter"
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    type="button" 
                                    onClick={() => onChapterNav('next')}
                                    className="h-12 w-12 rounded-full shadow-lg bg-background/80 backdrop-blur-sm"
                                    aria-label="Next Chapter"
                                >
                                    <ChevronRight className="h-6 w-6" />
                                </Button>
                             </div>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}

    

    

