
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { type Annotation, type BibleChapterResponse, type ChapterContentItem } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { BookText, Save, Trash2, StickyNote, Highlighter, Underline, Palette, X } from 'lucide-react';
import { AiInsightGenerator } from './ai-insight-generator';
import { cn } from '@/lib/utils';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import Balancer from 'react-wrap-balancer';
import { useToast } from '@/hooks/use-toast';

const highlightColors = [
    { class: 'hl-yellow', color: '#fff59d' },
    { class: 'hl-green', color: '#c8e6c9' },
    { class: 'hl-blue', color: '#bbdefb' },
    { class: 'hl-pink', color: '#f8bbd0' },
];
const underlineColors = [
    { class: 'ul-red', color: '#e53935' },
    { class: 'ul-purple', color: '#8e24aa' },
    { class: 'ul-orange', color: '#fb8c00' },
];

function AnnotationToolbar({ onHighlight, onUnderline, onNote, onDelete }) {
    return (
        <div className="flex items-center justify-center gap-1 p-1 bg-background border rounded-lg shadow-md w-full">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Highlighter /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1">
                     <div className="flex gap-1">
                        {highlightColors.map(h => <button key={h.class} onClick={() => onHighlight(h.class)} className="h-6 w-6 rounded" style={{ backgroundColor: h.color }} title={`Highlight ${h.class.split('-')[1]}`}></button>)}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onHighlight(null)}><X className="h-4 w-4"/></Button>
                     </div>
                </PopoverContent>
            </Popover>
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Underline /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1">
                    <div className="flex gap-1 items-center">
                        {underlineColors.map(u => <button key={u.class} onClick={() => onUnderline(u.class)} className="h-6 w-6 rounded flex items-center justify-center" style={{ backgroundColor: u.color }} title={`Underline ${u.class.split('-')[1]}`}><div className="w-4 h-0.5 bg-white"></div></button>)}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onUnderline(null)}><X className="h-4 w-4"/></Button>
                    </div>
                </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNote}><StickyNote /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}><Trash2 /></Button>
        </div>
    )
}

function VerseComponent({
    verse,
    annotations,
    onTextSelect,
    onAnnotationClick,
}: {
    verse: Extract<ChapterContentItem, { type: 'verse' }>;
    annotations: Annotation[];
    onTextSelect: (e: React.MouseEvent<HTMLParagraphElement>) => void;
    onAnnotationClick: (annotation: Annotation) => void;
}) {
    const verseText = useMemo(() => verse.content.map(c => typeof c === 'string' ? c : (c.text || '')).join(''), [verse.content]);
    
    const renderedContent = useMemo(() => {
        const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start);
        let lastIndex = 0;
        const parts: React.ReactNode[] = [];

        sortedAnnotations.forEach((annotation, i) => {
            if (annotation.start > lastIndex) {
                parts.push(verseText.substring(lastIndex, annotation.start));
            }
            parts.push(
                <span
                    key={annotation.id}
                    className={cn("annotated-text", annotation.highlight, annotation.underline, annotation.note && "border-b-2 border-dashed border-primary")}
                    onClick={(e) => { e.stopPropagation(); onAnnotationClick(annotation); }}
                >
                    {verseText.substring(annotation.start, annotation.end)}
                </span>
            );
            lastIndex = annotation.end;
        });

        if (lastIndex < verseText.length) {
            parts.push(verseText.substring(lastIndex));
        }

        return parts;
    }, [verseText, annotations, onAnnotationClick]);

    return (
        <p className="text-lg leading-relaxed font-body" data-verse-number={verse.number} onMouseUp={onTextSelect}>
            <sup className="font-headline font-bold text-primary mr-2 select-none">{verse.number}</sup>
            {renderedContent}
        </p>
    );
}


export function BibleDisplay({ chapterData }: { chapterData: BibleChapterResponse }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [selection, setSelection] = useState<{ range: Range, verseNum: string } | null>(null);
    const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
    const [note, setNote] = useState('');
    const noteDirty = useMemo(() => activeAnnotation && note !== (activeAnnotation.note || ''), [activeAnnotation, note]);

    const displayRef = useRef<HTMLDivElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    const bookId = chapterData.book.id;
    const chapterNum = chapterData.chapter.number;
    const translationId = chapterData.translation.id;
    const fullReference = `${chapterData.book.name} ${chapterNum}`;

    // Fetch Annotations
    const annotationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        const annotationsPath = `users/${user.uid}/annotations`;
        return collection(firestore, annotationsPath);
    }, [user, firestore]);

    const { data: annotations, isLoading: annotationsLoading } = useCollection<Annotation>(annotationsQuery);

    const chapterAnnotations = useMemo(() => {
        if (!annotations) return {};
        const annotationMap: Record<string, Annotation[]> = {};
        annotations.filter(a => a.book === bookId && a.chapter === chapterNum && a.translation === translationId)
        .forEach(a => {
            if (!annotationMap[a.verse]) {
                annotationMap[a.verse] = [];
            }
            annotationMap[a.verse].push(a);
        });
        return annotationMap;
    }, [annotations, bookId, chapterNum, translationId]);

    const getVerseTextNode = (element: Node | null): { textNode: Node, verseNum: string } | null => {
        while (element) {
            if (element.nodeType === Node.ELEMENT_NODE) {
                const verseNum = (element as HTMLElement).getAttribute('data-verse-number');
                if (verseNum) {
                    // Find the text node within the verse paragraph, skipping the <sup> tag
                    const childNodes = Array.from(element.childNodes);
                    const textNode = childNodes.find(n => n.nodeType === Node.TEXT_NODE || (n.nodeName === 'SPAN' && (n as HTMLSpanElement).classList.contains('annotated-text')));
                    return textNode ? { textNode: element, verseNum } : null;
                }
            }
            element = element.parentElement;
        }
        return null;
    };
    
    const handleTextSelect = useCallback((e) => {
        if (!user) return;
        const sel = window.getSelection();

        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);

            // Find the parent paragraph with data-verse-number
            let verseEl = range.startContainer.parentElement;
            while(verseEl && !verseEl.hasAttribute('data-verse-number')) {
                verseEl = verseEl.parentElement;
            }

            if (!verseEl || !displayRef.current?.contains(verseEl)) {
                 setSelection(null);
                 return;
            };
            const verseNum = verseEl.getAttribute('data-verse-number');

            if (verseNum) {
                setSelection({ range, verseNum });
                setActiveAnnotation(null);
            }
        } else {
            // This logic allows clicking away to deselect.
            if (!toolbarRef.current?.contains(e.target as Node)) {
                setSelection(null);
            }
        }
    }, [user]);

    const createOrUpdateAnnotation = async (data: Partial<Omit<Annotation, 'id' | 'userId' | 'createdAt'>>) => {
        if (!user || !firestore) return;
        
        let annotationToUpdate: Annotation | null = activeAnnotation;

        // If no active annotation, create a new one from selection
        if (!annotationToUpdate && selection) {
            const { range, verseNum } = selection;
            
            // Calculate offsets relative to the start of the verse's text content
            const verseElement = range.startContainer.parentElement?.closest('[data-verse-number]');
            if (!verseElement) return;

            const allText = Array.from(verseElement.childNodes).map(node => node.textContent).join('');
            const supLength = verseElement.querySelector('sup')?.textContent?.length || 0;
            const preSelectionRange = document.createRange();
            preSelectionRange.selectNodeContents(verseElement);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            const start = preSelectionRange.toString().length - supLength;
            
            const text = range.toString();
            const end = start + text.length;

            const newAnnotation: Omit<Annotation, 'id'> = {
                userId: user.uid,
                translation: translationId,
                book: bookId,
                chapter: chapterNum,
                verse: parseInt(verseNum),
                start,
                end,
                text,
                ...data
            };

            const newDocRef = doc(collection(firestore, `users/${user.uid}/annotations`));
            annotationToUpdate = { ...newAnnotation, id: newDocRef.id };
            setDocumentNonBlocking(newDocRef, { ...newAnnotation, createdAt: serverTimestamp() }, { merge: true });
            setActiveAnnotation(null); // Reset after creation
            setSelection(null);
        }
        // If there is an active annotation, update it
        else if (annotationToUpdate) {
             const docRef = doc(firestore, `users/${user.uid}/annotations`, annotationToUpdate.id);
             setDocumentNonBlocking(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
             setActiveAnnotation(null); // Reset after update
        }
        
        setSelection(null);
    };

    const handleDeleteAnnotation = () => {
        if (activeAnnotation && firestore && user) {
            const docRef = doc(firestore, `users/${user.uid}/annotations`, activeAnnotation.id);
            deleteDocumentNonBlocking(docRef);
            setActiveAnnotation(null);
            setSelection(null);
        }
    }
    
    const handleSaveNote = () => {
        if (!activeAnnotation || !noteDirty) return;
        createOrUpdateAnnotation({ note });
        toast({ title: "Note Saved", description: "Your annotation note has been saved." });
        setActiveAnnotation(null);
        setSelection(null);
    }

    const handleAnnotationClick = (annotation: Annotation) => {
        setActiveAnnotation(annotation);
        setNote(annotation.note || '');
        setSelection(null);
    };

    const verses = chapterData.chapter.content.filter(item => item.type === 'verse') as Extract<ChapterContentItem, { type: 'verse' }>[];

    return (
        <div className="mt-6 grid md:grid-cols-3 gap-6 animate-in fade-in duration-500" ref={displayRef}>
            
            <div className="md:col-span-1">
                <div className="sticky top-[116px] z-10 flex flex-col gap-6">
                     <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-xl">
                                Annotation
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             {!user ? <p className="text-sm text-muted-foreground">Sign in to annotate verses.</p> :
                             !activeAnnotation && !selection ? <p className="text-sm text-muted-foreground">Select text or an annotation to see details.</p> :
                             !activeAnnotation && selection ? <p className="font-bold font-headline text-primary">New selection in v. {selection.verseNum}</p> :
                             activeAnnotation ?
                             (
                                <div className="flex flex-col gap-4">
                                    <p className="font-bold font-headline text-primary">{fullReference}:{activeAnnotation.verse}</p>
                                    <blockquote className="p-2 border-l-4 border-muted bg-muted/20 rounded-r-lg">
                                        <Balancer>{activeAnnotation.text}</Balancer>
                                    </blockquote>
                                    <Textarea
                                        placeholder="Your thoughts on this selection..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        className="font-body text-base"
                                        rows={5}
                                    />
                                    <div className="flex flex-col gap-2">
                                        <Button onClick={handleSaveNote} size="sm" disabled={!noteDirty}><Save className="mr-2"/>Save Note</Button>
                                         <Button onClick={handleDeleteAnnotation} size="sm" variant="destructive"><Trash2 className="mr-2"/>Delete Annotation</Button>
                                    </div>
                                    {note && (
                                        <AiInsightGenerator
                                            verse={`${fullReference}:${activeAnnotation.verse} ("${activeAnnotation.text}")`}
                                            annotation={note}
                                        />
                                    )}
                                </div>
                             )
                             : null
                             }
                        </CardContent>
                        {selection && (
                           <CardFooter ref={toolbarRef}>
                               <AnnotationToolbar 
                                   onHighlight={(style) => createOrUpdateAnnotation({ highlight: style || undefined })}
                                   onUnderline={(style) => createOrUpdateAnnotation({ underline: style || undefined })}
                                   onNote={() => createOrUpdateAnnotation({note: ''})}
                                   onDelete={handleDeleteAnnotation}
                               />
                           </CardFooter>
                        )}
                    </Card>
                </div>
            </div>
            <div className="md:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-3xl">{fullReference}</CardTitle>
                         <p className="text-sm text-muted-foreground">{chapterData.translation.name}</p>
                    </CardHeader>
                    <CardContent onMouseUp={handleTextSelect}>
                        <div className="space-y-2 select-text">
                             {chapterData.chapter.content.map((item, index) => {
                                if (item.type === 'heading') {
                                    return <h4 key={`h-${index}`} className="text-xl font-headline font-bold pt-4 select-none"><Balancer>{item.content.join(' ')}</Balancer></h4>
                                }
                                if (item.type === 'verse') {
                                    return <VerseComponent 
                                                key={item.number} 
                                                verse={item} 
                                                annotations={chapterAnnotations[item.number] || []}
                                                onTextSelect={handleTextSelect}
                                                onAnnotationClick={handleAnnotationClick}
                                            />
                                }
                                return null;
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

    
