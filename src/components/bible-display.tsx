"use client";

import { useMemo, useEffect, useRef, useState, useCallback, Fragment } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { type Annotation, type BibleChapterResponse, type ChapterContentItem, type CrossRefChapterResponse, type CrossRef, type VerseContent, FormattedText, VerseFootnoteReference, BsbConcordanceEntry } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Balancer from 'react-wrap-balancer';
import { useAnnotationContext } from '@/contexts/annotation-context';
import { useUser } from '@/firebase';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, StickyNote, Link2 as LinkIcon, Loader2, X } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { BIBLE_ABBR_BOOKS } from '@/lib/bible';


function BsbConcordancePopup({ entry, children }: { entry: BsbConcordanceEntry, children: React.ReactNode }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-stone-900 text-stone-100 border-stone-800">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-bold font-mono tracking-wider",
                            (entry.lang === 'H' || entry.lang === 'A') ? "bg-amber-700 text-amber-100" : "bg-blue-800 text-blue-100"
                        )}>
                            {entry.strongs}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-stone-500 font-headline">
                            {entry.lang === 'H' ? 'Hebrew' : entry.lang === 'A' ? 'Aramaic' : 'Greek'}
                        </span>
                    </div>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <div className="text-xl font-bold text-stone-100 mb-1">{entry.word}</div>
                        <div className="text-2xl font-serif text-amber-500 mb-1">{entry.original}</div>
                        <div className="text-sm italic text-stone-400 font-serif">{entry.translit}</div>
                    </div>
                    
                    <div className="space-y-3 pt-2 border-t border-stone-800">
                        <div className="text-sm leading-relaxed text-stone-300">
                            <span className="text-[10px] font-bold uppercase text-stone-500 mr-2">Strong's</span>
                            {entry.strongsDef}
                        </div>
                        {entry.blbDef && entry.blbDef !== entry.strongsDef && (
                            <div className="text-sm leading-relaxed text-stone-400 pt-2 border-t border-stone-800/50">
                                <span className="text-[10px] font-bold uppercase text-stone-500 mr-2">BLB</span>
                                {entry.blbDef}
                            </div>
                        )}
                        <div className="text-[10px] font-mono text-stone-600 pt-2 border-t border-stone-800/50">
                            Morphology: {entry.morph}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
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
    const { fontSize, bsbConcordance } = useAnnotationContext();
    const [isCrossRefOpen, setIsCrossRefOpen] = useState(false);

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


    const renderedContent = useMemo(() => {
        const isBsb = chapterData.translation.id === 'BSB';
        const concordanceRef = isBsb && bsbConcordance ? `${chapterData.book.name} ${chapterData.chapter.number}:${verse.number}` : null;
        const bsbEntries = concordanceRef ? bsbConcordance![concordanceRef] : null;

        if (bsbEntries) {
            // Precise tokenization from example
            const rawText = verse.content.map(item => typeof item === 'string' ? item : (typeof item === 'object' && 'text' in item ? (item as FormattedText).text : '')).join('');
            const tokens = rawText.match(/(\s+|[^\s]+)/g) || [];
            let entryIdx = 0;
            
            return tokens.map((token, ti) => {
                if (/^\s+$/.test(token)) {
                    return <span key={`sp-${ti}`}>{token}</span>;
                }
                const clean = token.replace(/[.,;:!?"'—()\[\]*/]/g, "").trim();
                const entry = bsbEntries[entryIdx];

                if (entry && clean.length > 0) {
                    entryIdx++;
                    return (
                        <BsbConcordancePopup key={`w-${ti}`} entry={entry}>
                            <button className={cn(
                                "cursor-pointer hover:border-b hover:border-primary transition-colors",
                                entry.lang === 'H' || entry.lang === 'A' ? "text-amber-900 dark:text-amber-500" : "text-blue-900 dark:text-blue-500"
                            )}>
                                {token}
                            </button>
                        </BsbConcordancePopup>
                    );
                } else {
                    if (clean.length > 0) entryIdx++;
                    return <span key={`w-${ti}`}>{token}</span>;
                }
            });
        }

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
                            className={cn(highlightClasses, underlineClasses, hasNote && 'cursor-help border-b-2 border-dashed border-primary')}
                            onClick={primaryAnnotation ? (e) => { e.stopPropagation(); onAnnotationClick(primaryAnnotation); } : undefined}
                        >
                            {subText}
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
    }, [verse.content, annotations, onAnnotationClick, footnotesMap, chapterData, bsbConcordance]);
    
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

    const handleRefClick = (bookAbbr: string, chapter: number) => {
        const bookName = BIBLE_ABBR_BOOKS[bookAbbr];
        if (bookName) {
            navigate({ book: bookName, chapter: String(chapter) });
            setIsCrossRefOpen(false);
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
            <div className={textClasses}>
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
                <span className="verse-text-wrapper">{renderedContent}</span>
            </div>
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
        bsbConcordanceLoading
    } = useAnnotationContext();
    const { user } = useUser();
    const bibleContentRef = useRef<HTMLDivElement>(null);
    const [emblaRef, emblaApi] = useEmblaCarousel({ axis: 'x', watchDrag: true });

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
            const toolbar = document.getElementById('annotation-toolbar');
            if (toolbar && sel.anchorNode && toolbar.contains(sel.anchorNode)) return;
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
    
    const fullReference = `${chapterData.book.name} ${chapterData.chapter.number}`;

    const renderContentItem = (item: ChapterContentItem, index: number) => {
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
        if (item.type === 'line_break') {
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
                {bsbConcordanceLoading && (
                    <div className="absolute top-0 right-0 p-4 z-10">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                )}
                <div className="flex">
                    <div className="min-w-0 flex-shrink-0 flex-grow-0 basis-full">
                        <Card className="border-none shadow-none bg-transparent">
                            <CardHeader className="px-0 pt-0">
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
                            <CardContent className="p-0">
                                <div ref={bibleContentRef} className={cn("select-text bible-content", textClasses)}>
                                    <div className="space-y-2">
                                        {chapterData.chapter.content.map(renderContentItem)}
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="px-0 pt-6 flex flex-col items-start gap-4">
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
                                ) : chapterData.translation.id === 'NIV' ? (
                                    <div className="citation-box text-xs">
                                        <p className="citation-text">The Holy Bible, New International Version® NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by Permission of Biblica, Inc.® All rights reserved worldwide.</p>
                                        <div className="divider"></div>
                                        <p>To learn more, visit <a href="http://biblica.com" target="_blank" rel="noopener noreferrer">biblica.com</a> and <a href="http://facebook.com/Biblica" target="_blank" rel="noopener noreferrer">facebook.com/Biblica</a>.</p>
                                    </div>
                                ) : (
                                    chapterData.copyright && (
                                        <p className="text-xs text-muted-foreground italic">{chapterData.copyright}</p>
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
