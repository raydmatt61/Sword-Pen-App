
"use client";

import { useMemo, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { type Annotation, type BibleChapterResponse, type ChapterContentItem, type CrossRefChapterResponse, type CrossRef } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Balancer from 'react-wrap-balancer';
import { useAnnotationContext } from '@/contexts/annotation-context';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, StickyNote, Link2 as LinkIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { BIBLE_ABBR_BOOKS } from '@/lib/bible';


function VerseComponent({
    verse,
    annotations,
    crossReferences,
    onAnnotationClick,
    chapterData,
    navigate,
}: {
    verse: Extract<ChapterContentItem, { type: 'verse' }>;
    annotations: Annotation[];
    crossReferences: CrossRef[];
    onAnnotationClick: (annotation: Annotation) => void;
    chapterData: BibleChapterResponse;
    navigate: (newValues: Partial<{ book: string; chapter: string; translation: string }>) => void;
}) {
    const { fontSize } = useAnnotationContext();
    const [isCrossRefOpen, setIsCrossRefOpen] = useState(false);

    const verseNotes = useMemo(() => {
        const notes = new Set<string>();
        annotations.forEach(ann => {
            if (ann.note && ann.note.trim() !== '') {
                notes.add(ann.note);
            }
        });
        return Array.from(notes);
    }, [annotations]);


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
            const currentAnnotationClasses = charInfo.annotations.map(a => cn(a.highlight, a.underline, a.note && a.note.trim() !== '' && "border-b-2 border-dashed border-primary")).join(' ');
            const isCurrentWoj = charInfo.isWoj;

            let j = i;
            while (j < chars.length && chars[j].isWoj === isCurrentWoj && chars[j].annotations.map(a => a.id).join(',') === charInfo.annotations.map(a => a.id).join(',')) {
                j++;
            }

            const segmentText = chars.slice(i, j).map(c => c.char).join('');
            const mainAnnotation = charInfo.annotations[0];
            const hasNote = mainAnnotation?.note && mainAnnotation.note.trim() !== '';

            const segmentSpan = (
                <span 
                    key={i} 
                    className={cn(currentAnnotationClasses, isCurrentWoj && 'words-of-jesus', hasNote && 'cursor-help')}
                    onClick={mainAnnotation ? (e) => { e.stopPropagation(); onAnnotationClick(mainAnnotation); } : undefined}
                >
                    {segmentText}
                </span>
            );

            if (hasNote) {
                finalRender.push(
                    <Tooltip key={`t-${i}`} delayDuration={100}>
                        <TooltipTrigger asChild>
                            {segmentSpan}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm font-body whitespace-pre-wrap shadow-lg">
                            {mainAnnotation.note}
                        </TooltipContent>
                    </Tooltip>
                );
            } else {
                finalRender.push(segmentSpan);
            }
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
        range.selectNodeContents(pElement);
        
        // Find all icons between the verse number and the verse text
        const iconNodes = Array.from(pElement.querySelectorAll('sup ~ button, sup ~ span[data-dialog-trigger]'));

        if (iconNodes.length > 0) {
            // Set the start of the range to be after the last icon
            const lastIcon = iconNodes[iconNodes.length - 1];
            range.setStartAfter(lastIcon);
        } else {
            // If no icons, start the range after the verse number itself
            range.setStartAfter(supElement);
        }
        
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
    };

    const handleRefClick = (bookAbbr: string, chapter: number) => {
        const bookName = BIBLE_ABBR_BOOKS[bookAbbr];
        if (bookName) {
            navigate({ book: bookName, chapter: String(chapter) });
            setIsCrossRefOpen(false); // Close dialog on navigation
        }
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
        <div data-verse-number={verse.number}>
            <p className={textClasses}>
                <sup 
                    className="font-headline font-bold text-primary mr-2 select-none cursor-pointer"
                    onClick={handleVerseNumberClick}
                >
                    {verse.number}
                </sup>
                {verseNotes.length > 0 && (
                     <Dialog>
                        <DialogTrigger asChild>
                             <button data-dialog-trigger className="relative -top-1 mx-1 p-1 align-middle text-muted-foreground hover:text-primary rounded-full hover:bg-secondary">
                                <StickyNote className="h-4 w-4" />
                                <span className="sr-only">View notes for verse {verse.number}</span>
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Notes for {chapterData.book.name} {chapterData.chapter.number}:{verse.number}</DialogTitle>
                            </DialogHeader>
                             <div className="py-4 font-body whitespace-pre-wrap space-y-4 text-sm max-h-[60vh] overflow-y-auto">
                                {verseNotes.map((note, index) => (
                                    <div key={index} className="border-l-4 border-primary/70 pl-4 bg-secondary/30 py-2 rounded-r-md">{note}</div>
                                ))}
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
                {crossReferences && crossReferences.length > 0 && (
                     <Dialog open={isCrossRefOpen} onOpenChange={setIsCrossRefOpen}>
                        <DialogTrigger asChild>
                             <button className="relative -top-1 mx-1 p-1 align-middle text-muted-foreground hover:text-primary rounded-full hover:bg-secondary">
                                <LinkIcon className="h-4 w-4" />
                                <span className="sr-only">View cross-references for verse {verse.number}</span>
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Cross-References for {chapterData.book.name} {chapterData.chapter.number}:{verse.number}</DialogTitle>
                            </DialogHeader>
                             <ScrollArea className="py-4 text-sm max-h-[60vh] -mx-6">
                                 <div className="px-6 space-y-2">
                                    {crossReferences.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((cr, index) => {
                                        const refString = `${cr.book} ${cr.chapter}:${cr.verse}${cr.endVerse ? `-${cr.endVerse}` : ''}`;
                                        return (
                                            <div key={index} className="flex items-center gap-4">
                                                <Button
                                                    variant="link"
                                                    className="p-0 h-auto font-body"
                                                    onClick={() => handleRefClick(cr.book, cr.chapter)}
                                                >
                                                    {refString}
                                                </Button>
                                                <div className="flex-1 h-px bg-border"></div>
                                                <span className="text-xs text-muted-foreground">{(cr.score ?? 0).toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>
                )}
                {renderedContent}
            </p>
        </div>
    );
}

export function BibleDisplay({ chapterData, crossRefs, onChapterNav, navigate, currentChapter, maxChapters }: { 
    chapterData: BibleChapterResponse, 
    crossRefs: CrossRefChapterResponse | null,
    onChapterNav: (direction: 'prev' | 'next') => void,
    navigate: (newValues: Partial<{ book: string, chapter: string, translation: string }>) => void,
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

    const crossRefMap = useMemo(() => {
        if (!crossRefs || !crossRefs.chapter || !crossRefs.chapter.content) return {};
        const map: Record<string, CrossRef[]> = {};
        crossRefs.chapter.content.forEach(v => {
            map[String(v.verse)] = v.references;
        });
        return map;
    }, [crossRefs]);


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
                        crossReferences={crossRefMap[item.number] || []}
                        onAnnotationClick={handleAnnotationClick}
                        chapterData={chapterData}
                        navigate={navigate}
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
        <TooltipProvider>
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
                                    <div className="space-y-2">
                                        {chapterData.chapter.content.map(renderContentItem)}
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-6 flex flex-col items-start gap-4">
                                {chapterData.translation.id === 'engnet' ? (
                                    <p className="text-xs text-muted-foreground">
                                        NET Bible® Copyright | For full NET Bible notes, please see{' '}
                                        <a href="https://netbible.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                                            netbible.org
                                        </a>
                                        . | Donations appreciated to support free services at{' '}
                                        <a href="https://bible.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                                            Bible.org
                                        </a>
                                        .
                                    </p>
                                ) : chapterData.translation.id === 'BSB' ? (
                                    <p className="text-xs text-muted-foreground">
                                        The Berean Bible and Majority Bible texts are officially dedicated to the public domain as of April 30, 2023.
                                    </p>
                                ) : chapterData.translation.id === 'KJV' || chapterData.translation.id === 'ASV' ? (
                                     <p className="text-xs text-muted-foreground">
                                        This work is in the Public Domain.
                                    </p>
                                ) : chapterData.translation.id === 'WEB' ? (
                                    <p className="text-xs text-muted-foreground">
                                        The World English Bible is in the Public Domain. That means that it is not copyrighted. However, "World English Bible" is a Trademark of{' '}
                                        <a href="https://eBible.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                                            eBible.org
                                        </a>
                                        .
                                    </p>
                                ) : (
                                    chapterData.copyright && (
                                        <p className="text-xs text-muted-foreground italic">{chapterData.copyright}</p>
                                    )
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
        </TooltipProvider>
    );
}
