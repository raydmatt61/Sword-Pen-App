"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { useUser, useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Trash2, StickyNote, Highlighter, Underline, X, Copy, Plus } from 'lucide-react';
import { AiInsightGenerator } from './ai-insight-generator';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAnnotationContext } from '@/contexts/annotation-context';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { ScrollArea } from './ui/scroll-area';

const defaultHighlightColors = [
    { class: 'hl-yellow', color: '#fef08a', label: 'General' },
    { class: 'hl-blue', color: '#bfdbfe', label: 'Promise' },
    { class: 'hl-green', color: '#bbf7d0', label: 'Obedience' },
    { class: 'hl-purple', color: '#e9d5ff', label: 'Reward' },
    { class: 'hl-pink', color: '#fbcfe8', label: 'Love' },
    { class: 'hl-orange', color: '#fed7aa', label: 'Warning' },
    { class: 'hl-teal', color: '#99f6e4', label: 'Mystery' },
    { class: 'hl-yellow', color: '#fde68a', label: 'Grace' },
];

const extraColors = [
    { name: 'Amber', color: '#fbbf24', class: 'hl-orange' },
    { name: 'Indigo', color: '#818cf8', class: 'hl-blue' },
    { name: 'Rose', color: '#fb7185', class: 'hl-pink' },
    { name: 'Lime', color: '#a3e635', class: 'hl-green' },
    { name: 'Cyan', color: '#22d3ee', class: 'hl-teal' },
    { name: 'Violet', color: '#a78bfa', class: 'hl-purple' },
];

const underlineColors = [
    { class: 'ul-red', color: '#991b1b' },
    { class: 'ul-blue', color: '#2563eb' },
    { class: 'ul-orange', color: '#ea580c' },
    { class: 'ul-green', color: '#15803d' },
    { class: 'ul-purple', color: '#7e22ce' },
    { class: 'ul-teal', color: '#0f766e' },
];

export function AnnotationWrapper() {
    const { user } = useUser();
    const firestore = useFirestore();
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
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryLabel, setNewCategoryLabel] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState(extraColors[0]);

    // Fetch custom categories from Firestore
    const categoriesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/categories`);
    }, [user, firestore]);
    const { data: customCategories } = useCollection(categoriesQuery);

    const allHighlightColors = useMemo(() => {
        const custom = (customCategories || []).map(cat => ({
            class: cat.class,
            color: cat.color,
            label: cat.label,
            isCustom: true
        }));
        return [...defaultHighlightColors, ...custom];
    }, [customCategories]);

    const noteDirty = useMemo(() => activeAnnotation && note !== (activeAnnotation.note || ''), [activeAnnotation, note]);

    const toolbarRef = useRef<HTMLDivElement>(null);
    const fullReference = chapterData ? `${chapterData.book.name} ${chapterData.chapter.number}` : "";

    const handleDelete = () => {
        if (activeAnnotation) deleteAnnotation(activeAnnotation);
        resetAnnotationState();
    }
    
    const handleSaveNote = () => {
        if (!activeAnnotation && !selection) return;
        createOrUpdateAnnotation({ note: note.trim() });
        toast({ title: "Note Saved", description: "Your annotation note has been updated." });
        setIsEditingNote(false);
    }

    const handleCancelEdit = () => {
        setNote(activeAnnotation?.note || '');
        setIsEditingNote(false);
    }

    const handleCopySelection = () => {
        if (!chapterData) return;

        let textToCopy = "";
        let reference = "";

        if (activeAnnotation) {
            textToCopy = activeAnnotation.text;
            reference = `${chapterData.book.name} ${chapterData.chapter.number}:${activeAnnotation.verse}`;
        } else if (selection) {
            textToCopy = selection.range.toString();
            const verseNumbers = selection.verseElements.map(el => parseInt(el.getAttribute('data-verse-number') || '0')).sort((a, b) => a - b);
            
            if (verseNumbers.length > 0) {
                const startVerse = verseNumbers[0];
                const endVerse = verseNumbers[verseNumbers.length - 1];
                reference = `${chapterData.book.name} ${chapterData.chapter.number}:${startVerse}${startVerse === endVerse ? '' : `-${endVerse}`}`;
            }
        }

        if (textToCopy && reference) {
            const fullText = `"${textToCopy}" - ${reference} (${chapterData.translation.id})`;
            navigator.clipboard.writeText(fullText).then(() => {
                toast({
                    title: "Selection Copied",
                    description: "The selected text and reference have been copied to your clipboard.",
                });
            });
        }
    };
    
    useEffect(() => {
        if (activeAnnotation) {
            setNote(activeAnnotation.note || '');
            setSelection(null);
        } else {
            setIsEditingNote(false);
            setNote('');
        }
    }, [activeAnnotation, setSelection]);

    const onHighlight = (style: string | null) => {
        if (!selection && !activeAnnotation) return;
        createOrUpdateAnnotation({ highlight: style || "" });
    };

    const onUnderline = (style: string | null) => {
        if (!selection && !activeAnnotation) return;
        createOrUpdateAnnotation({ underline: style || "" });
    };

    const onNote = () => {
        if (activeAnnotation) {
            setIsEditingNote(true);
        } else if (selection) {
            createOrUpdateAnnotation({ note: '' });
        }
    };

    const handleCreateCategory = async () => {
        if (!newCategoryLabel.trim()) {
            toast({ variant: "destructive", title: "Label Required", description: "Please enter a name for your category." });
            return;
        }
        if (!user || !firestore) return;

        const newCatRef = doc(collection(firestore, `users/${user.uid}/categories`));
        const categoryData = {
            id: newCatRef.id,
            userId: user.uid,
            label: newCategoryLabel.trim(),
            class: newCategoryColor.class,
            color: newCategoryColor.color
        };

        // Save the definition to Firestore
        setDocumentNonBlocking(newCatRef, categoryData);

        // Apply it to current selection
        onHighlight(newCategoryColor.class);
        
        toast({ title: "Category Created", description: `Added "${newCategoryLabel}" highlight category.` });
        setIsAddingCategory(false);
        setNewCategoryLabel('');
    };
    
    const showToolbar = (selection || activeAnnotation) && user;

    return (
        <div className="relative flex items-center justify-center p-1 md:p-2 border rounded-lg bg-background/50 min-h-[52px] md:min-h-[56px] w-full" data-study-tool="wrapper">
            {!showToolbar ? (
                <p className={cn(
                    "font-bold text-muted-foreground/80 text-center leading-tight uppercase tracking-[0.05em] select-none",
                    "text-[10px] md:text-[11px]"
                )}>
                    {!user ? "Sign in" : "Select text to annotate"}
                </p>
            ) : (
               <div ref={toolbarRef} id="annotation-toolbar" className="w-full">
                   <div className="flex items-center justify-center gap-0.5 md:gap-1 p-0.5 bg-background border rounded-lg shadow-sm w-full overflow-x-auto">
                        <Popover onOpenChange={(open) => !open && setIsAddingCategory(false)}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 md:h-8 md:w-8" title="Highlight" data-study-tool="button"><Highlighter className="h-4 w-4" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2 shadow-xl border-stone-200" align="start" data-study-tool="content">
                                <ScrollArea className="max-h-80">
                                    {!isAddingCategory ? (
                                        <div className="flex flex-col gap-1">
                                            {allHighlightColors.map((h, i) => (
                                                <button 
                                                    key={`${h.class}-${i}`} 
                                                    onClick={() => onHighlight(h.class)} 
                                                    className="flex items-center gap-3 w-full px-2.5 py-2 rounded-md hover:bg-stone-100 transition-all text-left group"
                                                    data-study-tool="button"
                                                >
                                                    <div className="h-4 w-4 rounded-full border border-stone-300 shadow-sm group-hover:scale-110 transition-transform" style={{ backgroundColor: h.color }} />
                                                    <span className="text-sm font-bold text-stone-700">{h.label}</span>
                                                </button>
                                            ))}
                                            <div className="h-px bg-stone-100 my-1" />
                                            <button 
                                                onClick={() => onHighlight(null)} 
                                                className="flex items-center gap-3 w-full px-2.5 py-2 rounded-md hover:bg-destructive/5 text-destructive transition-all text-left"
                                                data-study-tool="button"
                                            >
                                                <X className="h-4 w-4" />
                                                <span className="text-sm font-bold">Clear Highlight</span>
                                            </button>
                                            <div className="h-px bg-stone-100 my-1" />
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-9 w-full justify-start font-bold text-xs text-muted-foreground uppercase tracking-wider" 
                                                onClick={(e) => { e.stopPropagation(); setIsAddingCategory(true); }}
                                                data-study-tool="button"
                                            >
                                                <Plus className="mr-2 h-3 w-3" /> New Category
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 p-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-xs uppercase tracking-widest text-primary">New Category</h4>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsAddingCategory(false)} data-study-tool="button"><X className="h-3 w-3" /></Button>
                                            </div>
                                            <Input 
                                                placeholder="Category Name" 
                                                value={newCategoryLabel}
                                                onChange={(e) => setNewCategoryLabel(e.target.value)}
                                                className="h-8 text-sm"
                                                autoFocus
                                                data-study-tool="input"
                                            />
                                            <div className="grid grid-cols-6 gap-2">
                                                {extraColors.map((c) => (
                                                    <button
                                                        key={c.name}
                                                        onClick={() => setNewCategoryColor(c)}
                                                        className={cn(
                                                            "h-6 w-6 rounded-full border border-stone-200 transition-all hover:scale-125",
                                                            newCategoryColor.name === c.name && "ring-2 ring-primary ring-offset-1 scale-110"
                                                        )}
                                                        style={{ backgroundColor: c.color }}
                                                        title={c.name}
                                                        data-study-tool="button"
                                                    />
                                                ))}
                                            </div>
                                            <Button className="w-full h-8 text-xs font-bold" onClick={handleCreateCategory} data-study-tool="button">
                                                Create & Apply
                                            </Button>
                                        </div>
                                    )}
                                </ScrollArea>
                            </PopoverContent>
                        </Popover>
                        
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 md:h-8 md:w-8" title="Underline" data-study-tool="button"><Underline className="h-4 w-4" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" align="start" data-study-tool="content">
                                <div className="flex flex-wrap gap-2 max-w-[160px]">
                                    {underlineColors.map(u => (
                                        <button 
                                            key={u.class} 
                                            onClick={() => onUnderline(u.class)} 
                                            className="h-6 w-6 rounded border shadow-sm flex items-center justify-center hover:scale-110 transition-transform" 
                                            style={{ borderColor: u.color }}
                                            data-study-tool="button"
                                        >
                                            <div className="w-4 h-0.5" style={{ backgroundColor: u.color }}></div>
                                        </button>
                                    ))}
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onUnderline(null)} data-study-tool="button"><X className="h-4 w-4"/></Button>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Popover open={isEditingNote} onOpenChange={(open) => {
                            if (!open) handleCancelEdit();
                            setIsEditingNote(open);
                        }}>
                            <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 md:h-8 md:w-8" onClick={onNote} disabled={!activeAnnotation && !selection} title="Edit Note" data-study-tool="button">
                                        <StickyNote className={cn("h-4 w-4", activeAnnotation?.note && "text-primary")} />
                                    </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 shadow-xl border-stone-200" data-study-tool="content">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Annotation Note</h4>
                                        {(activeAnnotation || selection) && (
                                        <p className="text-sm text-muted-foreground">
                                            For {fullReference}:{activeAnnotation?.verse || (selection ? selection.verseElements[0].dataset.verseNumber : '')}.
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
                                        data-study-tool="input"
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <Button onClick={handleSaveNote} size="sm" disabled={!noteDirty && activeAnnotation !== null} data-study-tool="button">Save Changes</Button>
                                        <Button onClick={handleCancelEdit} size="sm" variant="ghost" data-study-tool="button">Cancel</Button>
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

                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 md:h-8 md:w-8" 
                            onClick={handleCopySelection} 
                            title="Copy Selection"
                            data-study-tool="button"
                        >
                            <Copy className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="icon" className="h-6 w-6 md:h-8 md:w-8 text-destructive" onClick={handleDelete} disabled={!activeAnnotation} title="Delete Annotation" data-study-tool="button"><Trash2 className="h-4 w-4" /></Button>
                   </div>
               </div>
            )}
             {showToolbar && (
                <Button variant="ghost" size="icon" onClick={resetAnnotationState} className="h-4 w-4 md:h-6 md:w-6 absolute -top-1 -right-1 md:top-0.5 md:right-0.5 bg-background border rounded-full shadow-sm" title="Clear Selection">
                    <X className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
            )}
        </div>
    );
}
