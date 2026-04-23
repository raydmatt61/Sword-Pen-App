
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
                <Button variant="outline" size="icon" className="h-10 w-10 md:h-9 md:w-9 relative">
                    <BookmarkIcon className="h-5 w-5 md:h-4 md:w-4" />
                    {bookmarks && bookmarks.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold border-2 border-background">
                            {bookmarks.length}
                        </span>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
                <SheetHeader className="p-6 border-b">
                    <div className="flex items-center justify-between pr-12">
                        <SheetTitle className="font-headline text-2xl flex items-center gap-2">
                            <BookmarkIcon className="h-6 w-6 text-primary" />
                            My Bookmarks
                        </SheetTitle>
                    </div>
                    <SheetDescription className="text-base">
                        Quickly access your favorite verses across all translations.
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4 pb-20">
                        {!bookmarks || bookmarks.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <BookmarkIcon className="h-16 w-16 mx-auto mb-4 opacity-10" />
                                <p className="text-lg">No bookmarks yet.</p>
                                <p className="text-sm">Click the bookmark icon next to a verse to save it.</p>
                            </div>
                        ) : (
                            bookmarks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((b) => (
                                <div key={b.id} className="group relative border-2 rounded-xl p-5 bg-card hover:shadow-lg transition-all border-stone-100 hover:border-primary/20">
                                    <div className="flex justify-between items-start mb-3">
                                        <button 
                                            onClick={() => handleNavigate(b)}
                                            className="text-left font-headline font-bold text-xl text-primary hover:underline flex items-center gap-1.5"
                                        >
                                            {b.reference}
                                            <ExternalLink className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => toggleBookmark(b)}
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-widest bg-secondary px-2.5 py-1 rounded text-primary border border-primary/10">
                                            {b.translation.toUpperCase()}
                                        </span>
                                    </div>
                                    {b.text && (
                                        <p className="font-body text-base text-stone-700 leading-relaxed italic line-clamp-4 bg-stone-50/50 p-3 rounded-lg border border-stone-50">
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
