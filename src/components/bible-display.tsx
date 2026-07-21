"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { type Annotation, type BibleChapterResponse, type ChapterContentItem, type CrossRefChapterResponse, type CrossRef, FormattedText, VerseFootnoteReference } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Balancer from 'react-wrap-balancer';
import { useAnnotationContext } from '@/contexts/annotation-context';
import { useBookmarkContext } from '@/contexts/bookmark-context';
import { useJournal } from '@/contexts/journal-context';
import { useUser } from '@/firebase';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, StickyNote, Link2 as LinkIcon, Bookmark as BookmarkIcon, ExternalLink, Loader2, BookOpen, Heart, Calendar as CalendarIcon } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { BIBLE_ABBR_BOOKS } from '@/lib/bible';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChapter } from '@/app/actions';
import { format, isValid } from 'date-fns';

function CrossReferenceItem({ cr, translationId, navigate }: { cr: CrossRef, translationId: string, navigate: any }) {
    const [preview, setPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const refString = `${cr.book} ${cr.chapter}:${cr.verse}${cr.endVerse ? `-${cr.endVerse}` : ''}`;

    const handlePreview = async () => {
        if (preview) return;
        setIsLoading(true);
        try {
            const data = await getChapter(cr.book, String(cr.chapter), translationId);
            if (data && data.chapter.content) {
                const verseItem = data.chapter.content.find(item => item.type === 'verse' && item.number === cr.verse);
                if (verseItem && verseItem.type === 'verse') {
                    const text = verseItem.content
                        .map(c => typeof c === 'string' ? c : (c as FormattedText).text)
                        .join(' ');
                    setPreview(text);
                } else {
                    setPreview("Verse text not found in the chapter data.");
                }
            }
        } catch (e) {
            setPreview("Failed to load preview.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-4 py-1">
            <Popover onOpenChange={(open) => open && handlePreview()}>
                <PopoverTrigger asChild>
                    <Button
                        variant="link"
                        className="p-0 h-auto font-body text-primary hover:underline"
                    >
                        {refString}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 shadow-xl border-stone-200">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <h4 className="font-headline font-bold text-sm text-primary">{refString} ({translationId})</h4>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-[10px] uppercase tracking-widest font-bold"
                                onClick={() => navigate({ book: BIBLE_ABBR_BOOKS[cr.book] || cr.book, chapter: String(cr.chapter), verse: String(cr.verse) })}
                            >
                                Go to Verse
                            </Button>
                        </div>
                        <ScrollArea className="max-h-32">
                            {isLoading ? (
                                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                            ) : (
                                <p className="font-body text-sm leading-relaxed text-stone-700 italic">
                                    {preview || "No preview available."}
                                </p>
                            )}
                        </ScrollArea>
                    </div>
                </PopoverContent>
            </Popover>
            <div className="flex-1 h-px bg-border/50"></div>
            <span className="text-[10px] font-bold text-muted-foreground opacity-50 uppercase tracking-widest">
                Score: {(cr.score ?? 0).toFixed(2)}
            </span>
        </div>
    );
}

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
    navigate: (newValues: Partial<{ book: string; chapter: string; translation: string; verse: string; }>) => void;
}) {
    const { fontSize, showVerseIcons } = useAnnotationContext();
    const { isBookmarked, toggleBookmark } = useBookmarkContext();
    const { entries } = useJournal();
    const { user } = useUser();
    const { toast } = useToast();

    const verseReference = `${chapterData.book.name} ${chapterData.chapter.number}:${verse.number}`;

    const footnotesMap = useMemo(() => {
        if (!chapterData.chapter.footnotes) return new Map<string, string>();
        return new Map(chapterData.chapter.footnotes.map(f => [f.id, f.text]));
    }, [chapterData.chapter.footnotes]);

    const verseNotes = useMemo(() => {
        const notes = new Set<string>();
        annotations.forEach(ann => {
            if (ann.note && ann.note.trim() !== '') {
                notes.add(ann.note);
            }
        });
        return Array.from(notes);
    }, [annotations]);

    const journalEntriesForVerse = useMemo(() => {
        if (!entries) return [];
        return entries.filter(e => e.reference === verseReference);
    }, [entries, verseReference]);

    const bookmarked = isBookmarked(chapterData.book.id, chapterData.chapter.number, verse.number, chapterData.translation.id);

    const handleBookmarkToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) {
            toast({
                title: "Sign in required",
                description: "You must be signed in to bookmark verses.",
                variant: "destructive"
            });
            return;
        }

        const verseText = verse.content
            .map(item => typeof item === 'string' ? item : (item as FormattedText).text)
            .filter(t => typeof t === 'string')
            .join(' ')
            .substring(0, 150) + '...';

        toggleBookmark({
            book: chapterData.book.id,
            chapter: chapterData.chapter.number,
            verse: verse.number,
            translation: chapterData.translation.id,
            reference: verseReference,
            text: verseText
        });

        toast({
            title: bookmarked ? "Bookmark Removed" : "Verse Bookmarked",
            description: `${verseReference} ${bookmarked ? 'removed from' : 'added to'} your collection.`,
        });
    };

    const renderedContent = useMemo(() => {
        let charOffset = 0;
        const finalNodes: React.ReactNode[] = [];
        const sortedAnnotations = [...annotations].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

        verse.content.forEach((item, itemIndex) => {
            if (item && typeof item === 'object' && 'noteId' in item) {
                const vfr = item as VerseFootnoteReference;
                const noteText = footnotesMap.get(vfr.noteId);
                if (noteText) {
                    finalNodes.push(
                        <Dialog key={`n-${itemIndex}`}>
                            <DialogTrigger asChild>
                                <button className="relative -top-1 mx-0.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-muted-foreground text-xs font-bold hover:bg-primary hover:text-primary-foreground">
                                    {vfr.noteId}
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader><DialogTitle>Footnote {vfr.noteId}</DialogTitle></DialogHeader>
                                <ScrollArea className="max-h-[60vh] pr-4">
                                    <div className="py-2" dangerouslySetInnerHTML={{ __html: noteText }} />
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    );
                }
            } else {
                const text = typeof item === 'string' ? item : (item as FormattedText).text;
                if (typeof text !== 'string' || text.length === 0) return;

                const ftItem = typeof item === 'object' ? (item as FormattedText) : null;
                const isWoj = ftItem?.wordsOfJesus;
                const strongs = ftItem?.strongs;

                const segmentStart = charOffset;
                const segmentEnd = segmentStart + text.length;
                const boundaries = new Set([0, text.length]);
                sortedAnnotations.forEach(ann => {
                    if (ann.start < segmentEnd && ann.end > segmentStart) {
                         boundaries.add(Math.max(0, ann.start - segmentStart));
                         boundaries.add(Math.min(text.length, ann.end - segmentStart));
                    }
                });

                const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
                const subSpans = sortedBoundaries.map((start, i) => {
                    const end = sortedBoundaries[i+1];
                    if (start >= end) return null;
                    const subText = text.substring(start, end);
                    if (!subText) return null;
                    const subMidpoint = segmentStart + start + (end - start) / 2;
                    const coveringAnnotations = sortedAnnotations.filter(a => a.start <= subMidpoint && a.end > subMidpoint);
                    const primaryAnnotation = coveringAnnotations.length > 0 
                        ? coveringAnnotations.reduce((prev, current) => ((prev.end - prev.start) > (current.end - current.start)) ? prev : current) 
                        : null;

                    const hasNote = primaryAnnotation?.note && primaryAnnotation.note.trim() !== '';
                    const highlightClasses = [...new Set(coveringAnnotations.map(a => a.highlight).filter(Boolean))].join(' ');
                    const underlineClasses = [...new Set(coveringAnnotations.map(a => a.underline).filter(Boolean))].join(' ');
                    
                    const span = (
                        <span
                            key={`s-${itemIndex}-${i}`}
                            className={cn(
                                highlightClasses, 
                                underlineClasses, 
                                hasNote && 'cursor-help border-b-2 border-dashed border-primary',
                                strongs && 'cursor-pointer text-primary hover:underline'
                            )}
                            onClick={(e) => {
                                if (strongs) {
                                    e.stopPropagation();
                                    window.open(`https://www.blueletterbible.org/lexicon/${strongs}/kjv/`, '_blank');
                                } else if (primaryAnnotation) {
                                    e.stopPropagation();
                                    onAnnotationClick(primaryAnnotation);
                                }
                            }}
                        >
                            {subText}
                            {strongs && (
                                <sup className="ml-0.5 text-[0.6em] font-bold opacity-60">
                                    {strongs}
                                </sup>
                            )}
                        </span>
                    );

                    if (hasNote) {
                        return (
                            <Tooltip key={`t-${itemIndex}-${i}`} delayDuration={100}>
                                <TooltipTrigger asChild>{span}</TooltipTrigger>
                                <TooltipContent className="max-w-sm font-body whitespace-pre-wrap shadow-lg">{primaryAnnotation.note}</TooltipContent>
                            </Tooltip>
                        );
                    }
                    return span;
                }).filter(Boolean);

                finalNodes.push(
                    <span key={`text-${itemIndex}`} className={cn(isWoj && 'words-of-jesus')}>
                        {subSpans}
                    </span>
                );
                charOffset += text.length;
            }
        });
        return finalNodes;
    }, [verse.content, annotations, onAnnotationClick, footnotesMap]);
    
    const handleVerseNumberClick = (event: React.MouseEvent<HTMLElement>) => {
        const supElement = event.currentTarget;
        const pElement = supElement.parentElement;
        if (!pElement) return;
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        const verseTextWrapper = pElement.querySelector('.verse-text-wrapper');
        if (!verseTextWrapper) return;
        range.selectNodeContents(verseTextWrapper);
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
    };

    const textClasses = cn(
        "font-body tracking-tight transition-all duration-300",
        !showVerseIcons ? "leading-[2.0]" : "leading-[1.8]",
        fontSize === 'sm' && 'text-[15px] md:text-sm',
        fontSize === 'md' && 'text-[18px] md:text-base',
        fontSize === 'lg' && 'text-[21px] md:text-lg',
        fontSize === 'xl' && 'text-[24px] md:text-xl',
        fontSize === '2xl' && 'text-[28px] md:text-2xl',
    );

    return (
        <div data-verse-number={verse.number} className={cn("block mb-4", textClasses)}>
            <sup 
                className="font-headline font-bold text-primary mr-2 select-none cursor-pointer align-baseline"
                onClick={handleVerseNumberClick}
            >
                {verse.number}
            </sup>
            
            {showVerseIcons && (
                <span className="inline-flex items-center gap-1.5 mr-3 align-baseline">
                    <button 
                        onClick={handleBookmarkToggle}
                        className={cn(
                            "p-1 rounded-full transition-all duration-300",
                            bookmarked ? "text-primary bg-primary/10" : "text-muted-foreground/40 hover:text-primary hover:bg-stone-200"
                        )}
                        title="Bookmark verse"
                    >
                        <BookmarkIcon className={cn("h-4 w-4 md:h-3.5 md:w-3.5", bookmarked && "fill-current")} />
                    </button>
                    {verseNotes.length > 0 && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <button 
                                    className="p-1.5 text-primary bg-primary/20 rounded-full hover:bg-primary/30 border border-primary/40 transition-all shadow-sm" 
                                    title="View notes"
                                >
                                    <StickyNote className="h-4 w-4 md:h-3.5 md:w-3.5 fill-current" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Notes for {verseReference}</DialogTitle>
                                </DialogHeader>
                                <div className="py-4 font-body whitespace-pre-wrap space-y-4 text-sm max-h-[60vh] overflow-y-auto">
                                    {verseNotes.map((note, index) => (
                                        <div key={index} className="border-l-4 border-primary/70 pl-4 bg-secondary/30 py-2 rounded-r-md">{note}</div>
                                    ))}
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                    {journalEntriesForVerse.length > 0 && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <button 
                                    className="p-1.5 text-accent bg-accent/20 rounded-full hover:bg-accent/30 border border-accent/40 transition-all shadow-sm" 
                                    title="Journal entries for this verse"
                                >
                                    <BookOpen className="h-4 w-4 md:h-3.5 md:w-3.5 fill-current" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <BookOpen className="h-5 w-5 text-accent" />
                                        Journal Entries: {verseReference}
                                    </DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="max-h-[60vh] py-4">
                                    <div className="space-y-4 pr-4">
                                        {journalEntriesForVerse.map((e) => {
                                            const dateObj = new Date(e.date + (e.date.includes('T') ? '' : 'T12:00:00'));
                                            const displayDate = isValid(dateObj) ? format(dateObj, 'MMMM d, yyyy') : 'Unknown Date';
                                            return (
                                                <div key={e.id} className="border rounded-xl p-4 bg-stone-50/50 space-y-3">
                                                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
                                                        <CalendarIcon className="h-3.5 w-3.5" />
                                                        {displayDate}
                                                    </div>
                                                    {e.thoughts && (
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Thoughts</p>
                                                            <p className="font-body text-sm text-stone-700 leading-relaxed italic">"{e.thoughts}"</p>
                                                        </div>
                                                    )}
                                                    {e.prayer && (
                                                        <div className="space-y-1 border-t pt-2 mt-2">
                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                                                                <Heart className="h-3 w-3 fill-accent/20" />
                                                                Prayer
                                                            </div>
                                                            <p className="font-body text-sm text-stone-800 leading-relaxed">{e.prayer}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    )}
                    {crossReferences && crossReferences.length > 0 && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="p-1 text-muted-foreground/40 hover:text-primary rounded-full hover:bg-stone-200 transition-colors" title="Cross-references">
                                    <LinkIcon className="h-4 w-4 md:h-3.5 md:w-3.5" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Cross-References for {verseReference}</DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="py-4 text-sm max-h-[60vh] -mx-6">
                                    <div className="px-6 space-y-2">
                                        {crossReferences.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((cr, index) => (
                                            <CrossReferenceItem 
                                                key={index} 
                                                cr={cr} 
                                                translationId={chapterData.translation.id}
                                                navigate={navigate}
                                            />
                                        ))}
                                    </div>
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    )}
                </span>
            )}

            <span className="verse-text-wrapper">{renderedContent}</span>
        </div>
    );
}

export function BibleDisplay({ chapterData, crossRefs, onChapterNav, navigate, currentChapter, maxChapters }: { 
    chapterData: BibleChapterResponse, 
    crossRefs: CrossRefChapterResponse | null,
    onChapterNav: (direction: 'prev' | 'next') => void,
    navigate: (newValues: Partial<{ book: string, chapter: string, translation: string, verse: string }>) => void,
    currentChapter: number,
    maxChapters: number
}) {
    const { 
        setSelection,
        setActiveAnnotation,
        fontSize,
        chapterAnnotations,
        showVerseIcons
    } = useAnnotationContext();
    const { user } = useUser();
    const isMobile = useIsMobile();
    const bibleContentRef = useRef<HTMLDivElement>(null);
    
    const [emblaRef, emblaApi] = useEmblaCarousel({ 
        axis: 'x', 
        watchDrag: false 
    });

    useEffect(() => {
        if (!emblaApi) return;
        const handleSwipe = () => {
          const progress = emblaApi.scrollProgress();
          emblaApi.scrollTo(0, true);
          if (progress < -0.1) onChapterNav('prev');
          else if (progress > 0.1) onChapterNav('next');
        };
        emblaApi.on('pointerUp', handleSwipe);
        return () => emblaApi.off('pointerUp', handleSwipe);
      }, [emblaApi, onChapterNav]);

    const crossRefMap = useMemo(() => {
        if (!crossRefs || !crossRefs.chapter || !crossRefs.chapter.content) return {};
        const map: Record<string, CrossRef[]> = {};
        crossRefs.chapter.content.forEach(v => {
            map[String(v.verse)] = v.references;
        });
        return map;
    }, [crossRefs]);


    const handleTextSelect = useCallback(() => {
        if (!user) {
             if (window.getSelection()) window.getSelection()?.removeAllRanges();
             setSelection(null);
             return;
        }
        const sel = window.getSelection();

        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            const contentContainer = bibleContentRef.current;
            if (!contentContainer || !contentContainer.contains(range.commonAncestorContainer)) {
                setSelection(null);
                return;
            };

            const allVerseElements = Array.from(contentContainer.querySelectorAll<HTMLElement>('[data-verse-number]'));
            if (allVerseElements.length === 0) return;

            let startNode = range.startContainer;
            let endNode = range.endContainer;

            const startVerseEl = startNode.nodeType === 3 ? startNode.parentElement?.closest('[data-verse-number]') : (startNode as Element).closest('[data-verse-number]');
            const endVerseEl = endNode.nodeType === 3 ? endNode.parentElement?.closest('[data-verse-number]') : (endNode as Element).closest('[data-verse-number]');

            if (!startVerseEl || !endVerseEl) {
                setSelection(null);
                return;
            }

            const startIndex = allVerseElements.findIndex(el => el === startVerseEl);
            const endIndex = allVerseElements.findIndex(el => el === endVerseEl);

            if (startIndex === -1 || endIndex === -1) {
                setSelection(null);
                return;
            }

            const selectedVerseElements = allVerseElements.slice(startIndex, endIndex + 1);
            if (selectedVerseElements.length > 0) {
                 setSelection({ range, verseElements: selectedVerseElements });
                 setActiveAnnotation(null);
            }
        } else if (sel && sel.isCollapsed) {
            // Updated logic: Don't clear selection if interacting with study tools (via data-study-tool attribute)
            const target = sel.anchorNode?.parentElement;
            if (target?.closest('[data-study-tool]')) {
                return;
            }
            setSelection(null);
        }
    }, [user, setSelection, setActiveAnnotation]);
    
    useEffect(() => {
        document.addEventListener('selectionchange', handleTextSelect);
        document.addEventListener('touchend', handleTextSelect);
        return () => {
            document.removeEventListener('selectionchange', handleTextSelect);
            document.removeEventListener('touchend', handleTextSelect);
        };
    }, [handleTextSelect]);
    
    const handleAnnotationClick = (annotation: Annotation) => {
        setActiveAnnotation(annotation);
    };
    
    const fullReference = `${chapterData.book.id} ${chapterData.chapter.number}`;

    const renderContentItem = (item: ChapterContentItem, index: number) => {
        if (item.type === 'heading') {
            return (
                <h4 key={`h-${index}`} className="text-lg md:text-xl font-headline font-bold pt-8 pb-3 select-none block text-stone-800">
                    <Balancer>{item.content.join(' ')}</Balancer>
                </h4>
            );
        }
        if (item.type === 'verse') {
            return (
                <VerseComponent 
                    key={`v-${item.number}-${index}`} 
                    verse={item as any} 
                    annotations={chapterAnnotations[item.number!] || []}
                    crossReferences={crossRefMap[item.number!] || []}
                    onAnnotationClick={handleAnnotationClick}
                    chapterData={chapterData}
                    navigate={navigate}
                />
            );
        }
        if (item.type === 'line_break') {
            return <div key={`p-br-${index}`} className="h-4 block w-full" />;
        }
        return null;
    };
    
    const textClasses = cn(
        "font-body tracking-tight transition-all duration-300",
        !showVerseIcons ? "leading-[2.0]" : "leading-[1.8]",
        fontSize === 'sm' && 'text-[15px] md:text-sm',
        fontSize === 'md' && 'text-[18px] md:text-base',
        fontSize === 'lg' && 'text-[21px] md:text-lg',
        fontSize === 'xl' && 'text-[24px] md:text-xl',
        fontSize === '2xl' && 'text-[28px] md:text-2xl',
    );

    const notesLink = useMemo(() => {
        if (chapterData.translation.id === 'NET') {
            return isMobile ? 'https://netbible.org/reader#' : 'https://netbible.org/bible';
        }
        return chapterData.notesUrl;
    }, [chapterData.translation.id, chapterData.notesUrl, isMobile]);

    const isNiv = chapterData.translation.id === 'NIV';

    return (
        <TooltipProvider>
            <div ref={emblaRef} className="relative overflow-hidden">
                <div className="flex">
                    <div className="min-w-0 flex-shrink-0 flex-grow-0 basis-full">
                        <Card className="border-none shadow-none bg-transparent">
                            <CardHeader className="px-0 pt-0 pb-8">
                                <div className="flex flex-col gap-1">
                                    <CardTitle className="font-headline text-5xl font-bold tracking-tight text-primary">{fullReference}</CardTitle>
                                    <p className="text-xs text-muted-foreground uppercase tracking-[0.4em] font-headline">{chapterData.translation.name}</p>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div ref={bibleContentRef} className={cn("select-text bible-content", textClasses)}>
                                    <div className="block pt-2">
                                        {chapterData.chapter.content.map(renderContentItem)}
                                    </div>
                                </div>

                                <div className="mt-24 flex items-center justify-between border-t border-stone-200 pt-12 pb-16">
                                    <Button
                                        variant="ghost"
                                        className="flex flex-col items-start gap-1 h-auto py-6 px-4 md:px-8 group rounded-xl hover:bg-stone-100 transition-all"
                                        onClick={() => onChapterNav('prev')}
                                        disabled={currentChapter <= 1}
                                    >
                                        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground group-hover:text-primary transition-colors font-bold">Previous</span>
                                        <div className="flex items-center gap-2 font-headline font-bold text-lg md:text-xl">
                                            <ChevronLeft className="h-5 w-5" />
                                            {chapterData.book.name} {currentChapter > 1 ? currentChapter - 1 : currentChapter}
                                        </div>
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        className="flex flex-col items-end gap-1 h-auto py-6 px-4 md:px-8 group rounded-xl hover:bg-stone-100 transition-all"
                                        onClick={() => onChapterNav('next')}
                                        disabled={currentChapter >= maxChapters}
                                    >
                                        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground group-hover:text-primary transition-colors font-bold">Next</span>
                                        <div className="flex items-center gap-2 font-headline font-bold text-lg md:text-xl text-right">
                                            {chapterData.book.name} {currentChapter < maxChapters ? currentChapter + 1 : currentChapter}
                                            <ChevronRight className="h-5 w-5" />
                                        </div>
                                    </Button>
                                </div>
                            </CardContent>
                            <CardFooter className="px-0 pt-6 flex flex-col items-start gap-6 pb-24 border-t border-stone-100">
                                {notesLink && (
                                    <a 
                                        href={notesLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 text-xs font-bold text-primary uppercase tracking-[0.2em] hover:bg-stone-100 px-4 py-3 rounded-xl border border-stone-200 transition-all shadow-sm"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        NET Bible Notes & Commentary
                                    </a>
                                )}
                                
                                {chapterData.copyright && (
                                    isNiv ? (
                                        <div className="citation-box mt-4">
                                            <p className="citation-text">
                                                {chapterData.copyright}
                                            </p>
                                            <div className="divider" />
                                            <a href="https://www.biblica.com/" target="_blank" rel="noopener noreferrer">
                                                Visit Biblica.com
                                            </a>
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-muted-foreground italic leading-relaxed uppercase tracking-wider max-w-2xl">
                                            {chapterData.copyright}
                                        </p>
                                    )
                                )}
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}