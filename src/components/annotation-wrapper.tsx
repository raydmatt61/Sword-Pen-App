
"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { useUser } from '@/firebase';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Trash2, StickyNote, Highlighter, Underline, X } from 'lucide-react';
import { AiInsightGenerator } from './ai-insight-generator';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAnnotationContext } from '@/contexts/annotation-context';
import { cn } from '@/lib/utils';

const highlightColors = [
    { class: 'hl-yellow', color: '#fef08a' },
    { class: 'hl-green', color: '#bbf7d0' },
    { class: 'hl-blue', color: '#bfdbfe' },
    { class: 'hl-purple', color: '#e9d5ff' },
];
const underlineColors = [
    { class: 'ul-red', color: '#991b1b' },
    { class: 'ul-blue', color: '#2563eb' },
    { class: 'ul-orange', color: '#ea580c' },
];

export function AnnotationWrapper() {
    const { user } = useUser();
    const { toast } = useToast();

    const {
        selection,
        setSelection,
        activeAnnotation,
        createOrUpdateAnnotation,
        deleteAnnotation,
        resetAnnotationState,
        chapterData
    } = useAnnotationContext();

    const [isEditingNote, setIsEditingNote] = useState(false);
    const [note, setNote] = useState('');
    const noteDirty = useMemo(() => activeAnnotation && note !== (activeAnnotation.note || ''), [activeAnnotation, note]);

    const toolbarRef = useRef<HTMLDivElement>(null);
    const fullReference = chapterData ? `${chapterData.book.name} ${chapterData.chapter.number}` : "";

    const handleDelete = () => {
        if (activeAnnotation) {
            deleteAnnotation(activeAnnotation);
        }
        resetAnnotationState();
    }
    
    const handleSaveNote = () => {
        if (!activeAnnotation || !noteDirty) return;
        createOrUpdateAnnotation({ note });
        toast({ title: "Note Saved", description: "Your annotation note has been saved." });
        setIsEditingNote(false);
    }

    const handleCancelEdit = () => {
        setNote(activeAnnotation?.note || '');
        setIsEditingNote(false);
    }
    
    useEffect(() => {
        if (activeAnnotation) {
            setNote(activeAnnotation.note || '');
            setSelection(null);
        } else {
            setIsEditingNote(false);
        }
    }, [activeAnnotation, setSelection]);

    const onHighlight = (style: string | null) => {
        if (!selection && !activeAnnotation) return;
        createOrUpdateAnnotation({ highlight: style ?? undefined });
    };

    const onUnderline = (style: string | null) => {
        if (!selection && !activeAnnotation) return;
        createOrUpdateAnnotation({ underline: style ?? undefined });
    };

    const onNote = () => {
        if (activeAnnotation) {
            setIsEditingNote(true);
        } else if (selection) {
            createOrUpdateAnnotation({ note: '' });
        }
    };
    
    const showToolbar = (selection || activeAnnotation) && user;

    return (
        <div className="relative flex items-center justify-center p-1 md:p-2 border rounded-lg bg-background/50 min-h-[36px] md:min-h-[48px] w-full">
            {!showToolbar ? (
                <p className="text-[10px] md:text-xs text-muted-foreground text-center leading-tight">
                    {!user ? "Sign in" : "Select text to annotate"}
                </p>
            ) : (
               <div ref={toolbarRef} id="annotation-toolbar" className="w-full">
                   <div className="flex items-center justify-center gap-0.5 md:gap-1 p-0.5 bg-background border rounded-lg shadow-sm w-full overflow-x-auto">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 md:h-8 md:w-8"><Highlighter className="h-4 w-4" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1" align="start">
                                <div className="flex gap-1">
                                    {highlightColors.map(h => <button key={h.class} onClick={() => onHighlight(h.class)} className="h-6 w-6 rounded" style={{ backgroundColor: h.color }}></button>)}
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onHighlight(null)}><X className="h-4 w-4"/></Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 md:h-8 md:w-8"><Underline className="h-4 w-4" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1" align="start">
                                <div className="flex gap-1 items-center">
                                    {underlineColors.map(u => <button key={u.class} onClick={() => onUnderline(u.class)} className="h-6 w-6 rounded flex items-center justify-center" style={{ backgroundColor: u.color }}><div className="w-4 h-0.5 bg-white"></div></button>)}
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onUnderline(null)}><X className="h-4 w-4"/></Button>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Popover open={isEditingNote} onOpenChange={(open) => {
                            if (!open) handleCancelEdit();
                            setIsEditingNote(open);
                        }}>
                            <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 md:h-8 md:w-8" onClick={onNote} disabled={!activeAnnotation && !selection}>
                                        <StickyNote className="h-4 w-4" />
                                    </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Annotation Note</h4>
                                        {(activeAnnotation || selection) && (
                                        <p className="text-sm text-muted-foreground">
                                            For {fullReference}:{activeAnnotation?.verse || selection?.verseElements[0].dataset.verseNumber}.
                                        </p>
                                        )}
                                    </div>
                                    <Textarea
                                        placeholder="Your thoughts..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        className="font-body text-sm"
                                        rows={4}
                                        autoFocus
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <Button onClick={handleSaveNote} size="sm" disabled={!noteDirty}>Save</Button>
                                        <Button onClick={handleCancelEdit} size="sm" variant="ghost">Cancel</Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {activeAnnotation?.note && (
                            <AiInsightGenerator
                                verse={`${fullReference}:${activeAnnotation.verse} ("${activeAnnotation.text}")`}
                                annotation={activeAnnotation.note}
                            />
                        )}

                        <Button variant="ghost" size="icon" className="h-6 w-6 md:h-8 md:w-8 text-destructive" onClick={handleDelete} disabled={!activeAnnotation}><Trash2 className="h-4 w-4" /></Button>
                   </div>
               </div>
            )}
             {showToolbar && (
                <Button variant="ghost" size="icon" onClick={resetAnnotationState} className="h-4 w-4 md:h-6 md:w-6 absolute -top-1 -right-1 md:top-0.5 md:right-0.5 bg-background border rounded-full shadow-sm">
                    <X className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="sr-only">Close</span>
                </Button>
            )}
        </div>
    );
}
