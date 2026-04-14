
"use client";

import { useState, useMemo } from 'react';
import { BookOpen, Calendar as CalendarIcon, Plus, Trash2, Edit2, Search, Heart, Quote } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from './ui/sheet';
import { useJournal } from '@/contexts/journal-context';
import { ScrollArea } from './ui/scroll-area';
import { useUser } from '@/firebase';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAnnotationContext } from '@/contexts/annotation-context';

export function JournalSheet() {
    const { entries, addOrUpdateEntry, deleteEntry } = useJournal();
    const { chapterData } = useAnnotationContext();
    const { user } = useUser();
    
    const [isOpen, setIsOpen] = useState(false);
    const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');

    if (!user) return null;

    const filteredEntries = useMemo(() => {
        if (!entries) return [];
        return entries
            .filter(e => 
                (e.thoughts?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                 e.prayer?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                 e.reference?.toLowerCase().includes(searchQuery.toLowerCase()))
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [entries, searchQuery]);

    const handleNewEntry = () => {
        const currentRef = chapterData ? `${chapterData.book.name} ${chapterData.chapter.number}` : "";
        setEditingEntry({
            date: format(new Date(), 'yyyy-MM-dd'),
            reference: currentRef,
            thoughts: '',
            prayer: ''
        });
        setIsEntryDialogOpen(true);
    };

    const handleEditEntry = (entry: any) => {
        setEditingEntry({ ...entry });
        setIsEntryDialogOpen(true);
    };

    const handleSaveEntry = () => {
        if (!editingEntry.date) return;
        addOrUpdateEntry(editingEntry);
        setIsEntryDialogOpen(false);
    };

    return (
        <>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" title="Prayer Journal">
                        <BookOpen className="h-4 w-4" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
                    <SheetHeader className="p-6 border-b">
                        <div className="flex items-center justify-between">
                            <SheetTitle className="font-headline text-2xl flex items-center gap-2">
                                <BookOpen className="h-6 w-6 text-primary" />
                                My Journal
                            </SheetTitle>
                            <Button size="sm" onClick={handleNewEntry} className="gap-1">
                                <Plus className="h-4 w-4" /> New
                            </Button>
                        </div>
                        <SheetDescription>
                            Reflect on Scripture and record your prayers.
                        </SheetDescription>
                        <div className="relative mt-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search thoughts, prayers, or verses..." 
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </SheetHeader>
                    
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-4">
                            {filteredEntries.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-10" />
                                    <p>No journal entries found.</p>
                                    <p className="text-xs">Start your spiritual journey by adding your first entry.</p>
                                </div>
                            ) : (
                                filteredEntries.map((e) => (
                                    <div key={e.id} className="group border rounded-xl p-4 bg-card hover:shadow-md transition-all space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2 text-primary font-bold">
                                                <CalendarIcon className="h-4 w-4" />
                                                <span className="font-headline text-sm">
                                                    {format(new Date(e.date + 'T12:00:00'), 'MMMM d, yyyy')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditEntry(e)}>
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteEntry(e.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>

                                        {e.reference && (
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary text-primary font-bold text-xs">
                                                <Quote className="h-3 w-3" />
                                                {e.reference}
                                            </div>
                                        )}

                                        {e.thoughts && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Thoughts</p>
                                                <p className="font-body text-sm text-stone-700 leading-relaxed italic line-clamp-3">
                                                    "{e.thoughts}"
                                                </p>
                                            </div>
                                        )}

                                        {e.prayer && (
                                            <div className="space-y-1 bg-stone-50 p-2 rounded-lg border border-stone-100">
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                                                    <Heart className="h-3 w-3 fill-accent/20" />
                                                    Prayer
                                                </div>
                                                <p className="font-body text-sm text-stone-800 leading-relaxed">
                                                    {e.prayer}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            <Dialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="font-headline text-2xl flex items-center gap-2">
                            {editingEntry?.id ? 'Edit Entry' : 'New Journal Entry'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date">Date</Label>
                                <Input 
                                    id="date" 
                                    type="date" 
                                    value={editingEntry?.date || ''} 
                                    onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reference">Scripture Reference</Label>
                                <Input 
                                    id="reference" 
                                    placeholder="e.g. John 3:16" 
                                    value={editingEntry?.reference || ''} 
                                    onChange={(e) => setEditingEntry({ ...editingEntry, reference: e.target.value })} 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="thoughts">Thoughts & Reflections</Label>
                            <Textarea 
                                id="thoughts" 
                                placeholder="What is God speaking to you through this scripture?" 
                                className="min-h-[100px] font-body"
                                value={editingEntry?.thoughts || ''} 
                                onChange={(e) => setEditingEntry({ ...editingEntry, thoughts: e.target.value })} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="prayer" className="flex items-center gap-1.5">
                                <Heart className="h-3.5 w-3.5 text-accent" />
                                Your Prayer
                            </Label>
                            <Textarea 
                                id="prayer" 
                                placeholder="Write your prayer or requests here..." 
                                className="min-h-[100px] font-body"
                                value={editingEntry?.prayer || ''} 
                                onChange={(e) => setEditingEntry({ ...editingEntry, prayer: e.target.value })} 
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsEntryDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveEntry}>Save Entry</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
