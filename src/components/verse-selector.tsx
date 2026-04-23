
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Book, Translation } from '@/lib/bible';
import { ChevronsRight, ChevronLeft, ChevronRight, History, ChevronsUpDown, Hash } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

const LAST_LOCATION_KEY = 'verse-insights-last-location';

const BookSelectorGrid = ({ books, currentBook, onSelect }: { books: Book[], currentBook: string, onSelect: (bookName: string) => void }) => {
    const otBooks = useMemo(() => books.filter(b => b.testament === 'OT'), [books]);
    const ntBooks = useMemo(() => books.filter(b => b.testament === 'NT'), [books]);

    const handleSelect = (bookName: string) => {
        onSelect(bookName);
    };

    const renderBookGrid = (testamentBooks: Book[], title: string) => (
        <div>
            <p className="text-sm font-medium text-muted-foreground px-2 py-1.5">{title}</p>
            <div className="grid grid-cols-5 gap-1">
                {testamentBooks.map(book => (
                    <Button
                        key={book.id}
                        variant={book.commonName === currentBook ? "secondary" : "ghost"}
                        size="sm"
                        className="h-auto px-2 py-1.5 justify-center"
                        onClick={() => handleSelect(book.commonName)}
                    >
                        {book.id}
                    </Button>
                ))}
            </div>
        </div>
    );

    return (
        <ScrollArea className="h-96">
            <div className="p-2">
                {renderBookGrid(otBooks, "Old Testament")}
                <div className="mt-2" />
                {renderBookGrid(ntBooks, "New Testament")}
            </div>
        </ScrollArea>
    );
};

const ChapterSelectorGrid = ({ numberOfChapters, onSelect }: { numberOfChapters: number, onSelect: (chapter: number) => void }) => {
    return (
        <ScrollArea className="h-96">
            <div className="grid grid-cols-7 gap-1 p-2">
                {Array.from({ length: numberOfChapters }, (_, i) => i + 1).map(chapNum => (
                    <Button
                        key={chapNum}
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2 py-1.5 justify-center"
                        onClick={() => onSelect(chapNum)}
                    >
                        {chapNum}
                    </Button>
                ))}
            </div>
        </ScrollArea>
    );
};

const VerseSelectorGrid = ({ numberOfVerses, onSelect }: { numberOfVerses: number, onSelect: (verse: number) => void }) => {
    return (
        <ScrollArea className="h-96">
            <div className="grid grid-cols-7 gap-1 p-2">
                {Array.from({ length: numberOfVerses }, (_, i) => i + 1).map(verseNum => (
                    <Button
                        key={verseNum}
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2 py-1.5 justify-center"
                        onClick={() => onSelect(verseNum)}
                    >
                        {verseNum}
                    </Button>
                ))}
            </div>
        </ScrollArea>
    );
};


export function VerseSelector({ 
    defaultValues, 
    books,
    translations,
    onChapterNav,
    navigate,
    maxVerses
}: { 
    defaultValues: { book: string; chapter: string; translation: string; }, 
    books: Book[],
    translations: Translation[],
    onChapterNav: (direction: 'prev' | 'next') => void,
    navigate: (newValues: Partial<{ book: string, chapter: string, translation: string, verse: string }>) => void,
    maxVerses: number;
}) {
  
  const [tempBook, setTempBook] = useState(defaultValues.book);
  const [isBookSelectorOpen, setIsBookSelectorOpen] = useState(false);
  const [isVerseSelectorOpen, setIsVerseSelectorOpen] = useState(false);
  const [selectionStep, setSelectionStep] = useState<'book' | 'chapter'>('book');
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (!isBookSelectorOpen) {
        setTimeout(() => {
            setSelectionStep('book');
            setTempBook(defaultValues.book);
        }, 200);
    }
  }, [isBookSelectorOpen, defaultValues.book]);
  
  const handleBookSelect = (newBook: string) => {
    setTempBook(newBook);
    setSelectionStep('chapter');
  };

  const handleChapterSelect = (newChapter: number) => {
    navigate({ book: tempBook, chapter: String(newChapter) });
    setIsBookSelectorOpen(false); 
    setIsMobileSheetOpen(false); 
  };

  const handleGoBack = () => {
    const savedLocationRaw = localStorage.getItem(LAST_LOCATION_KEY);
    if (savedLocationRaw) {
        const savedLocation = JSON.parse(savedLocationRaw);
        navigate({
            book: savedLocation.book,
            chapter: savedLocation.chapter,
            translation: savedLocation.translationId
        });
    }
  };
  
  const handleVerseSelect = (verseNumber: number) => {
    navigate({ verse: String(verseNumber) });
    setIsVerseSelectorOpen(false);
  };
  
  const maxChaptersForCurrentBook = useMemo(() => books.find(b => b.commonName === defaultValues.book)?.numberOfChapters || 1, [books, defaultValues.book]);
  
  const renderDesktopControls = () => (
    <div className="flex items-center gap-2 animate-in fade-in duration-500">
        <Popover open={isBookSelectorOpen} onOpenChange={setIsBookSelectorOpen}>
            <PopoverTrigger asChild>
                 <Button variant="outline" className="w-[200px] justify-between h-9">
                    <span className="truncate">{defaultValues.book} {defaultValues.chapter}</span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0">
                {selectionStep === 'book' ? (
                    <BookSelectorGrid books={books} currentBook={defaultValues.book} onSelect={handleBookSelect} />
                ) : (
                    <div>
                        <div className="p-2 border-b flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectionStep('book')}><ChevronLeft /></Button>
                            <p className="font-medium">{tempBook}</p>
                        </div>
                        <ChapterSelectorGrid 
                            numberOfChapters={books.find(b => b.commonName === tempBook)?.numberOfChapters || 1} 
                            onSelect={handleChapterSelect} 
                        />
                    </div>
                )}
            </PopoverContent>
        </Popover>

        <Select value={defaultValues.translation} onValueChange={(t) => navigate({ translation: t })}>
            <SelectTrigger id="translation" aria-label="Translation" className="w-[80px] h-9 text-xs"><SelectValue placeholder="Tr" /></SelectTrigger>
            <SelectContent>{translations.map(t => <SelectItem key={t.id} value={t.id}>{t.id.toUpperCase()}</SelectItem>)}</SelectContent>
        </Select>
        
         <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('prev')} disabled={parseInt(defaultValues.chapter) <= 1} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('next')} disabled={parseInt(defaultValues.chapter) >= maxChaptersForCurrentBook} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
        </Button>
        <Popover open={isVerseSelectorOpen} onOpenChange={setIsVerseSelectorOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" type="button" className="h-9 w-9" disabled={maxVerses === 0}>
                    <Hash className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0">
                <VerseSelectorGrid 
                    numberOfVerses={maxVerses} 
                    onSelect={handleVerseSelect} 
                />
            </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" type="button" onClick={handleGoBack} className="h-9 w-9">
            <History className="h-4 w-4" />
        </Button>
    </div>
  );

  const renderMobileControls = () => (
    <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
        <SheetTrigger asChild>
            <Button variant="outline" className="w-full h-11 text-sm px-4 justify-between font-bold border-2 border-primary/20 shadow-sm">
                <span className="truncate">
                    {defaultValues.book} {defaultValues.chapter} ({defaultValues.translation.toUpperCase()})
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-12" onOpenAutoFocus={(e) => e.preventDefault()}>
            <SheetHeader className="mb-6">
                <SheetTitle className="text-xl font-headline">Study Navigation</SheetTitle>
            </SheetHeader>
            <div className="space-y-6">
                 <Dialog open={isBookSelectorOpen} onOpenChange={setIsBookSelectorOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full h-12 justify-between text-base font-medium">
                            Select Book & Chapter
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[90vw] rounded-xl">
                        {selectionStep === 'book' ? (
                            <>
                                <DialogHeader>
                                    <DialogTitle>Select a Book</DialogTitle>
                                </DialogHeader>
                                <BookSelectorGrid books={books} currentBook={defaultValues.book} onSelect={handleBookSelect} />
                            </>
                        ) : (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectionStep('book')}><ChevronLeft /></Button>
                                        <span>{tempBook}</span>
                                    </DialogTitle>
                                </DialogHeader>
                                <ChapterSelectorGrid 
                                    numberOfChapters={books.find(b => b.commonName === tempBook)?.numberOfChapters || 1} 
                                    onSelect={handleChapterSelect} 
                                />
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog open={isVerseSelectorOpen} onOpenChange={setIsVerseSelectorOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full h-12 justify-between text-base font-medium" disabled={maxVerses === 0}>
                            Go to Verse
                            <Hash className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[90vw] rounded-xl">
                        <DialogHeader>
                            <DialogTitle>Select a Verse</DialogTitle>
                        </DialogHeader>
                        <VerseSelectorGrid 
                            numberOfVerses={maxVerses} 
                            onSelect={(v) => {
                                handleVerseSelect(v);
                                setIsMobileSheetOpen(false);
                            }} 
                        />
                    </DialogContent>
                </Dialog>

                <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Translation</p>
                    <Select value={defaultValues.translation} onValueChange={(t) => { navigate({ translation: t }); setIsMobileSheetOpen(false); }}>
                        <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Translation" /></SelectTrigger>
                        <SelectContent>{translations.map(t => <SelectItem key={t.id} value={t.id}>{t.id.toUpperCase()}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                
                 <div className="flex gap-2 w-full pt-4">
                    <Button variant="outline" size="icon" className="flex-1 h-14" onClick={() => onChapterNav('prev')} disabled={parseInt(defaultValues.chapter) <= 1}><ChevronLeft className="h-6 w-6" /></Button>
                    <Button variant="outline" size="icon" className="flex-1 h-14" onClick={() => onChapterNav('next')} disabled={parseInt(defaultValues.chapter) >= maxChaptersForCurrentBook}><ChevronRight className="h-6 w-6" /></Button>
                    <Button variant="outline" size="icon" className="flex-1 h-14" onClick={handleGoBack}>
                        <History className="h-6 w-6" />
                    </Button>
                </div>
            </div>
        </SheetContent>
    </Sheet>
  );

  if (!isClient) {
    return (
        <div className="w-full animate-in fade-in duration-500">
             <Skeleton className="h-11 w-full" />
        </div>
    );
  }

  return isMobile ? renderMobileControls() : renderDesktopControls();
}
