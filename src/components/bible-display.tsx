
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
        // Original annotation rendering logic for BSB, WEB, etc.
        const flattenContent = (content: any, isInsideWoj = false): { text: string, isWoj: boolean }[] => {
            if (!content) return [];
            if (typeof content === 'string') return [{ text: content, isWoj: isInsideWoj }];

            if (!Array.isArray(content)) {
                const itemIsWoj = content.type === 'woj' || (Array.isArray(content.class) && content.class.includes('w-of-j')) || isInsideWoj;
                if (content.text && typeof content.text === 'string') return [{ text: content.text, isWoj: itemIsWoj }];
                if (content.content) return flattenContent(content.content, itemIsWoj);
                return [];
            }
            
            const isWordBased = content.length > 0 && content.every(
                (item: any) => typeof item === 'object' && item !== null && (item.type === 'word' || item.type === 'note' || item.type === 'woj')
            );
            
            let segments: { text: string, isWoj: boolean }[] = [];
            content.forEach((item, index) => {
                if (typeof item === 'string') {
                    segments.push({ text: item, isWoj: isInsideWoj });
                } else if (item && item.type !== 'note') {
                    const itemIsWoj = item.type === 'woj' || (Array.isArray(item.class) && item.class.includes('w-of-j')) || isInsideWoj;
                    if (item.text && typeof item.text === 'string') {
                        segments.push({ text: item.text, isWoj: itemIsWoj });
                    } else if (item.content) {
                        segments.push(...flattenContent(item.content, itemIsWoj));
                    }
                }
                
                if (isWordBased && index < content.length - 1) {
                    const nextItem = content[index + 1];
                    if (nextItem && nextItem.type !== 'note') {
                        segments.push({ text: ' ', isWoj: isInsideWoj });
                    }
                }
            });
            return segments;
        };

        const segments = flattenContent(verse.content);
        const flatText = segments.map(s => s.text).join('');
        const sortedAnnotations = [...annotations].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
        
        if (!flatText) {
            return null;
        }

        const chars = flatText.split('').map(char => ({
            char,
            isWoj: false,
            annotations: [] as Annotation[],
        }));
        
        let charIndex = 0;
        for (const segment of segments) {
            for (let i = 0; i < segment.text.length; i++) {
                if (chars[charIndex]) {
                    chars[charIndex].isWoj = segment.isWoj;
                }
                charIndex++;
            }
        }
        
        sortedAnnotations.forEach(ann => {
            for (let i = ann.start; i < ann.end; i++) {
                if (chars[i]) chars[i].annotations.push(ann);
            }
        });

        const finalRender: React.ReactNode[] = [];
        let i = 0;
        while (i < chars.length) {
            const charInfo = chars[i];
            const currentAnnotationClasses = charInfo.annotations.map(a => cn(a.highlight, a.underline, a.note && "border-b-2 border-dashed border-primary")).join(' ');
            const isCurrentWoj = charInfo.isWoj;

            let j = i;
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
        const verseContainer = supElement.parentElement;
        if (!verseContainer) return;

        const selection = window.getSelection();
        if (!selection) return;

        const range = document.createRange();
        range.selectNodeContents(verseContainer);
        range.setStartAfter(supElement);
        
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
    };

    const textClasses = cn(
        "font-body",
        fontSize === 'sm' && 'text-sm leading-relaxed',
        fontSize === 'md' && 'text-base leading-relaxed',
        fontSize === 'lg' && 'text-lg leading-relaxed',
        fontSize === 'xl' && 'text-xl leading-relaxed',
        fontSize === '2xl' && 'text-2xl leading-relaxed',
    );

    return (
        <div className="flex flex-row items-start" data-verse-number={verse.number}>
            <sup 
                className="font-headline font-bold text-primary mr-2 select-none cursor-pointer"
                onClick={handleVerseNumberClick}
            >
                {verse.number}
            </sup>
            <p className={textClasses}>
                {renderedContent}
            </p>
        </div>
    );
}

export function BibleDisplay({ chapterData, onChapterNav, currentChapter, maxChapters }: { 
    chapterData: BibleChapterResponse, 
    onChapterNav: (direction: 'prev' | 'next') => void,
    currentChapter: number,
    maxChapters: number
}) {
    const { 
        setSelection,
        setActiveAnnotation,
        fontSize,
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
        document.addEventListener('selectionchange', handleTextSelect);
        return () => {
            document.removeEventListener('selectionchange', handleTextSelect);
        };
    }, [user, setSelection, setActiveAnnotation]);
    
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
        if (item.type === 'para-break' || item['para-break']) {
            return <div key={`p-br-${index}`} className="h-4" />;
        }
        return null;
    };
    
    const textClasses = cn(
        "font-body",
        fontSize === 'sm' && 'text-sm leading-relaxed',
        fontSize === 'md' && 'text-base leading-relaxed',
        fontSize === 'lg' && 'text-lg leading-relaxed',
        fontSize === 'xl' && 'text-xl leading-relaxed',
        fontSize === '2xl' && 'text-2xl leading-relaxed',
    );


    return (
        <div ref={emblaRef} className="pt-4 relative overflow-hidden">
            <div className="flex">
                <div className="min-w-0 flex-shrink-0 flex-grow-0 basis-full">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="font-headline text-3xl">{fullReference}</CardTitle>
                                    <p className="text-sm text-muted-foreground">{chapterData.translation.name}</p>
                                </div>
                                <div className="md:hidden flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        type="button"
                                        onClick={() => onChapterNav('prev')}
                                        disabled={currentChapter <= 1}
                                        aria-label="Previous Chapter"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        type="button"
                                        onClick={() => onChapterNav('next')}
                                        disabled={currentChapter >= maxChapters}
                                        aria-label="Next Chapter"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-0">
                            <div ref={bibleContentRef} className={cn("select-text bible-content", textClasses)}>
                                {chapterData.chapter.htmlContent ? (
                                    <div
                                        className="space-y-4 verse-html-content"
                                        dangerouslySetInnerHTML={{ __html: chapterData.chapter.htmlContent }}
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        {chapterData.chapter.content.map(renderContentItem)}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="pt-6 flex flex-col items-start gap-4">
                            {chapterData.copyright && (
                                <p className="text-xs text-muted-foreground italic">{chapterData.copyright}</p>
                            )}
                            <div className="w-full md:hidden flex justify-center gap-2 pt-4">
                                 <Button
                                    variant="outline"
                                    size="icon"
                                    type="button"
                                    onClick={() => onChapterNav('prev')}
                                    disabled={currentChapter <= 1}
                                    aria-label="Previous Chapter"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    type="button"
                                    onClick={() => onChapterNav('next')}
                                    disabled={currentChapter >= maxChapters}
                                    aria-label="Next Chapter"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
