
"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { type Annotation, type BibleChapterResponse } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Trash2, StickyNote, Highlighter, Underline, X, Pencil, Ban } from 'lucide-react';
import { AiInsightGenerator } from './ai-insight-generator';
import { cn } from '@/lib/utils';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import Balancer from 'react-wrap-balancer';
import { useToast } from '@/hooks/use-toast';
import { useAnnotationContext } from '@/contexts/annotation-context';

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

function AnnotationToolbar({ onHighlight, onUnderline, onNote, onDelete, onDraw }) {
    const { isDrawingMode, setIsDrawingMode } = useAnnotationContext();
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDraw} data-active={isDrawingMode}><Pencil /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}><Trash2 /></Button>
        </div>
    )
}

export function AnnotationWrapper({ chapterData }: { chapterData: BibleChapterResponse }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const {
        selection, setSelection,
        activeAnnotation, setActiveAnnotation,
        isDrawingMode, setIsDrawingMode,
        setSaveDrawing,
    } = useAnnotationContext();

    const [isEditingNote, setIsEditingNote] = useState(false);
    const [note, setNote] = useState('');
    const noteDirty = useMemo(() => activeAnnotation && note !== (activeAnnotation.note || ''), [activeAnnotation, note]);

    const toolbarRef = useRef<HTMLDivElement>(null);

    const bookId = chapterData.book.id;
    const chapterNum = chapterData.chapter.number;
    const translationId = chapterData.translation.id;
    const fullReference = `${chapterData.book.name} ${chapterNum}`;

    const resetAnnotationState = () => {
        setActiveAnnotation(null);
        setSelection(null);
        setNote('');
        setIsEditingNote(false);
        setIsDrawingMode(false);
    };

    const createOrUpdateAnnotation = async (data: Partial<Omit<Annotation, 'id' | 'userId'>>) => {
        if (!user || !firestore) return;
        
        // Disallow updates if in drawing mode but not saving a drawing
        if (isDrawingMode && !data.drawingDataUrl) return;

        let annotationToUpdate: Annotation | null = activeAnnotation;

        // If there's no active annotation, but we have a selection, create a new one.
        if (!annotationToUpdate && selection) {
            const { range, verseNum } = selection;
            const verseElement = range.startContainer.parentElement?.closest('[data-verse-number]');
            if (!verseElement) return;
            
            // This is a new annotation based on text selection
            const allText = Array.from(verseElement.childNodes).map(node => node.textContent).join('');
            const supLength = verseElement.querySelector('sup')?.textContent?.length || 0;
            const preSelectionRange = document.createRange();
            preSelectionRange.selectNodeContents(verseElement);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            const start = preSelectionRange.toString().length - supLength;
            
            const text = range.toString();
            if (!text && !data.drawingDataUrl) return; // Don't create empty annotations
            const end = start + text.length;

            const newAnnotation: Omit<Annotation, 'id' | 'userId'> = {
                userId: user.uid,
                translation: translationId,
                book: bookId,
                chapter: chapterNum,
                verse: parseInt(verseNum),
                start: start || 0,
                end: end || 0,
                text: text || '',
                ...data
            };

            const newDocRef = doc(collection(firestore, `users/${user.uid}/annotations`));
            setDocumentNonBlocking(newDocRef, { ...newAnnotation, createdAt: serverTimestamp() });

        } else if (annotationToUpdate) {
            // We're updating an existing annotation
             const docRef = doc(firestore, `users/${user.uid}/annotations`, annotationToUpdate.id);
             setDocumentNonBlocking(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
        } else if (data.drawingDataUrl && !annotationToUpdate && !selection) {
            // This is a new drawing annotation without a text selection, attached to the whole chapter
            const newAnnotation: Omit<Annotation, 'id' | 'userId'> = {
                userId: user.uid,
                translation: translationId,
                book: bookId,
                chapter: chapterNum,
                verse: 0, // Indicates chapter-level drawing
                start: 0,
                end: 0,
                text: 'Handwritten Note',
                ...data
            };
            const newDocRef = doc(collection(firestore, `users/${user.uid}/annotations`));
            setDocumentNonBlocking(newDocRef, { ...newAnnotation, createdAt: serverTimestamp() });
        } else {
            return; // No valid condition to create or update
        }

        resetAnnotationState();
    };

    const handleDeleteAnnotation = () => {
        if (activeAnnotation && firestore && user) {
            const docRef = doc(firestore, `users/${user.uid}/annotations`, activeAnnotation.id);
            deleteDocumentNonBlocking(docRef);
            resetAnnotationState();
        } else if (selection) {
            resetAnnotationState();
        }
    }
    
    const handleSaveNote = () => {
        if (!activeAnnotation || !noteDirty) return;
        createOrUpdateAnnotation({ note });
        toast({ title: "Note Saved", description: "Your annotation note has been saved." });
        setIsEditingNote(false);
        resetAnnotationState();
    }

    const handleCancelEdit = () => {
        setNote(activeAnnotation?.note || '');
        setIsEditingNote(false);
    }
    
    const handleDrawingMode = () => {
        setSelection(null);
        setActiveAnnotation(null);
        setIsDrawingMode(!isDrawingMode);
    }

    const handleSaveDrawing = () => {
        setSaveDrawing(true); // This will trigger the canvas to save
    }

    // Effect to update local note state when active annotation changes
    useEffect(() => {
        if (activeAnnotation) {
            setNote(activeAnnotation.note || '');
            setIsEditingNote(false);
            setSelection(null);
            setIsDrawingMode(false); // Turn off drawing mode when an annotation is clicked
        }
    }, [activeAnnotation, setSelection, setIsDrawingMode]);

    return (
        <Card>
            <CardHeader className="py-2 px-4 flex-row items-center justify-between">
                <CardTitle className="font-headline text-xl">
                    Annotation
                </CardTitle>
                {(activeAnnotation || selection || isDrawingMode) && (
                    <Button variant="ghost" size="icon" onClick={resetAnnotationState} className="h-6 w-6">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close annotation</span>
                    </Button>
                )}
            </CardHeader>
            <CardContent className="p-2 md:p-4">
                 {!user ? <p className="text-sm text-muted-foreground">Sign in to annotate verses.</p> :
                 isDrawingMode ? (
                     <div className="flex flex-col gap-2">
                        <p className="text-sm text-primary font-bold font-headline">Drawing Mode</p>
                        <p className="text-xs text-muted-foreground">Draw directly on the text. Your drawing will be saved as a new annotation for this chapter.</p>
                        <Button onClick={handleSaveDrawing} size="sm"><Save className="mr-2"/>Save Drawing</Button>
                    </div>
                 ) :
                 !activeAnnotation && !selection ? <p className="text-sm text-muted-foreground">Select text, an annotation, or enter drawing mode.</p> :
                 !activeAnnotation && selection ? <p className="font-bold font-headline text-primary">New selection in v. {selection.verseNum}</p> :
                 activeAnnotation ?
                 (
                    <div className="flex flex-col gap-2">
                        {activeAnnotation.text && (
                            <>
                                <p className="font-bold font-headline text-primary text-sm">{fullReference}:{activeAnnotation.verse}</p>
                                <blockquote className="p-2 border-l-4 border-muted bg-muted/20 rounded-r-lg text-sm">
                                    <Balancer>{activeAnnotation.text}</Balancer>
                                </blockquote>
                            </>
                        )}
                        {isEditingNote ? (
                            <>
                                <Textarea
                                    placeholder="Your thoughts on this selection..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="font-body text-sm"
                                    rows={3}
                                />
                                <div className="flex gap-2">
                                    <Button onClick={handleSaveNote} size="sm" disabled={!noteDirty}><Save className="mr-2"/>Save</Button>
                                    <Button onClick={handleCancelEdit} size="sm" variant="ghost"><Ban className="mr-2"/>Cancel</Button>
                                </div>
                            </>
                        ) : (
                            <>
                                {activeAnnotation.note ? (
                                    <p className="font-body text-sm p-2 whitespace-pre-wrap">{activeAnnotation.note}</p>
                                ) : (
                                   !activeAnnotation.drawingDataUrl && <p className="text-xs text-muted-foreground p-2">No note for this annotation.</p>
                                )}
                                <div className="flex flex-col gap-2">
                                    {!activeAnnotation.drawingDataUrl && <Button onClick={() => setIsEditingNote(true)} size="sm" variant="outline"><Pencil className="mr-2"/>{activeAnnotation.note ? 'Edit Note' : 'Add Note'}</Button>}
                                </div>
                            </>
                        )}
                         {(activeAnnotation.note && !isEditingNote) && (
                            <AiInsightGenerator
                                verse={`${fullReference}:${activeAnnotation.verse} ("${activeAnnotation.text}")`}
                                annotation={activeAnnotation.note}
                            />
                        )}
                    </div>
                 )
                 : null
                 }
            </CardContent>
             {(selection || activeAnnotation || isDrawingMode) && user && (
               <CardFooter ref={toolbarRef} className="p-2">
                   <AnnotationToolbar 
                       onHighlight={(style) => createOrUpdateAnnotation({ highlight: style || undefined })}
                       onUnderline={(style) => createOrUpdateAnnotation({ underline: style || undefined })}
                       onNote={() => {
                            if (activeAnnotation) {
                                setIsEditingNote(true);
                            } else {
                               createOrUpdateAnnotation({note: ''});
                            }
                       }}
                       onDraw={handleDrawingMode}
                       onDelete={handleDeleteAnnotation}
                   />
               </CardFooter>
            )}
        </Card>
    );
}
