
"use client";

import { useMemo, useEffect, useRef } from 'react';
import { type Annotation, type BibleChapterResponse, type ChapterContentItem } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Balancer from 'react-wrap-balancer';
import { useAnnotationContext } from '@/contexts/annotation-context';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';


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
    
    // Recursively extracts text content, ignoring notes.
    const getVerseText = (content: any[]): string => {
        return content.map(item => {
            if (typeof item === 'string') return item;
            if (item.type === 'note') return ''; // Ignore notes
            if (item.text) return item.text;
            if (Array.isArray(item.content)) return getVerseText(item.content); // Recurse for nested content
            return '';
        }).join('');
    };

    const verseText = useMemo(() => getVerseText(verse.content as any[]), [verse.content]);
    
    const renderedContent = useMemo(() => {
        const sortedAnnotations = [...annotations].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
        let lastIndex = 0;
        const parts: React.ReactNode[] = [];

        sortedAnnotations.forEach((annotation) => {
            const start = annotation.start ?? 0;
            const end = annotation.end ?? 0;

            if (start > lastIndex) {
                parts.push(verseText.substring(lastIndex, start));
            }
            parts.push(
                <span
                    key={annotation.id}
                    className={cn("annotated-text", annotation.highlight, annotation.underline, annotation.note && "border-b-2 border-dashed border-primary")}
                    onClick={(e) => { e.stopPropagation(); onAnnotationClick(annotation); }}
                >
                    {verseText.substring(start, end)}
                </span>
            );
            lastIndex = end;
        });

        if (lastIndex < verseText.length) {
            parts.push(verseText.substring(lastIndex));
        }

        return parts;
    }, [verseText, annotations, onAnnotationClick]);
    
    const handleVerseNumberClick = (event: React.MouseEvent<HTMLElement>) => {
        const supElement = event.currentTarget;
        const pElement = supElement.parentElement;
        if (!pElement) return;

        const selection = window.getSelection();
        if (!selection) return;

        const range = document.createRange();
        // Skip the sup element (the first child) and select the rest
        const textNodes = Array.from(pElement.childNodes).filter(node => node !== supElement);
        if (textNodes.length > 0) {
            range.setStart(textNodes[0], 0);
            const lastNode = textNodes[textNodes.length - 1];
            range.setEnd(lastNode, lastNode.textContent?.length || 0);
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Manually trigger the selection change handler
            document.dispatchEvent(new Event('selectionchange'));
        }
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

export function BibleDisplay({ chapterData }: { chapterData: BibleChapterResponse }) {
    const { 
        setSelection,
        setActiveAnnotation,
    } = useAnnotationContext();
    const { user } = useUser();
    const firestore = useFirestore();
    const bibleContentRef = useRef<HTMLDivElement>(null);


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

    return (
        <div className="pt-4 relative">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-3xl">{fullReference}</CardTitle>
                        <p className="text-sm text-muted-foreground">{chapterData.translation.name}</p>
                </CardHeader>
                <CardContent>
                    <div ref={bibleContentRef} className={cn("space-y-2 select-text bible-content")}>
                            {chapterData.chapter.content.map((item, index) => {
                            if (item.type === 'heading') {
                                return <h4 key={`h-${index}`} className="text-xl font-headline font-bold pt-4 select-none"><Balancer>{item.content.join(' ')}</Balancer></h4>
                            }
                            if (item.type === 'verse') {
                                return <VerseComponent 
                                            key={item.number} 
                                            verse={item} 
                                            annotations={chapterAnnotations[item.number] || []}
                                            onAnnotationClick={handleAnnotationClick}
                                        />
                            }
                            return null;
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
