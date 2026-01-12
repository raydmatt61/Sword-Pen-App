
"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { useUser } from '@/firebase';
import { type BibleChapterResponse } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Trash2, StickyNote, Highlighter, Underline, X, Pencil, Ban } from 'lucide-react';
import { AiInsightGenerator } from './ai-insight-generator';
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
    const { isDrawingMode } = useAnnotationContext();
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
    const { toast } = useToast();

    const {
        selection,
        setSelection,
        activeAnnotation,
        setActiveAnnotation,
        isDrawingMode,
        setIsDrawingMode,
        triggerSaveDrawing,
        createOrUpdateAnnotation,
        deleteAnnotation,
        resetAnnotationState,
    } = useAnnotationContext();

    const [isEditingNote, setIsEditingNote] = useState(false);
    const [note, setNote] = useState('');
    const noteDirty = useMemo(() => activeAnnotation && note !== (activeAnnotation.note || ''), [activeAnnotation, note]);

    const toolbarRef = useRef<HTMLDivElement>(null);
    const fullReference = `${chapterData.book.name} ${chapterData.chapter.number}`;

    const handleDelete = () => {
        if (activeAnnotation) {
            deleteAnnotation(activeAnnotation);
        }
        resetAnnotationState();
    }
    
    const handleSaveNote = () => {
        if (!activeAnnotation || !noteDirty) return;
        createOrUpdateAnnotation({ note }, chapterData);
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
                        <Button onClick={triggerSaveDrawing} size="sm"><Save className="mr-2"/>Save Drawing</Button>
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
                       onHighlight={(style) => createOrUpdateAnnotation({ highlight: style || undefined }, chapterData)}
                       onUnderline={(style) => createOrUpdateAnnotation({ underline: style || undefined }, chapterData)}
                       onNote={() => {
                            if (activeAnnotation) {
                                setIsEditingNote(true);
                            } else {
                               createOrUpdateAnnotation({note: ''}, chapterData);
                            }
                       }}
                       onDraw={handleDrawingMode}
                       onDelete={handleDelete}
                   />
               </CardFooter>
            )}
        </Card>
    );
}
