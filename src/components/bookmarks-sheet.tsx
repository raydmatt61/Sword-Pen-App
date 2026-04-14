
"use client";

import { Bookmark as BookmarkIcon, Trash2, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from './ui/sheet';
import { useBookmarkContext } from '@/contexts/bookmark-context';
import { ScrollArea } from './ui/scroll-area';
import { useUser } from '@/firebase';
import { useState } from 'react';

export function BookmarksSheet({ navigate }: { navigate: (values: any) => void }) {
    const { bookmarks, toggleBookmark } = useBookmarkContext();
    const { user } = useUser();
    const [isOpen, setIsOpen] = useState(false);

    if (!user) return null;

    const handleNavigate = (b: any) => {
        navigate({ book: b.book, chapter: String(b.chapter), verse: String(b.verse) });
        setIsOpen(false);
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 relative">
                    <BookmarkIcon className="h-4 w-4" />
                    {bookmarks && bookmarks.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground font-bold">
                            {bookmarks.length}
                        </span>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
                <SheetHeader className="p-6 border-b">
                    <SheetTitle className="font-headline text-2xl flex items-center gap-2">
                        <BookmarkIcon className="h-6 w-6 text-primary" />
                        My Bookmarks
                    </SheetTitle>
                    <SheetDescription>
                        Quickly access your favorite verses across all translations.
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-3">
                        {!bookmarks || bookmarks.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <BookmarkIcon className="h-12 w-12 mx-auto mb-4 opacity-10" />
                                <p>No bookmarks yet.</p>
                                <p className="text-xs">Click the bookmark icon next to a verse to save it.</p>
                            </div>
                        ) : (
                            bookmarks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((b) => (
                                <div key={b.id} className="group relative border rounded-xl p-4 bg-card hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <button 
                                            onClick={() => handleNavigate(b)}
                                            className="text-left font-headline font-bold text-lg text-primary hover:underline flex items-center gap-1"
                                        >
                                            {b.reference}
                                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            onClick={() => toggleBookmark(b)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                                            {b.translation}
                                        </span>
                                    </div>
                                    {b.text && (
                                        <p className="font-body text-sm text-stone-600 line-clamp-3 italic">
                                            "{b.text}"
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
