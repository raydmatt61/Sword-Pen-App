
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
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
        // Reset state when popover/dialog is closed
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
    setIsBookSelectorOpen(false); // closes popover/dialog
    setIsMobileSheetOpen(false); // closes sheet on mobile
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
    <Card className="animate-in fade-in duration-500">
      <CardContent className="pt-6">
         <div className="flex items-center gap-2">
            <Popover open={isBookSelectorOpen} onOpenChange={setIsBookSelectorOpen}>
                <PopoverTrigger asChild>
                     <Button variant="outline" className="w-[270px] justify-between">
                        <span>{defaultValues.book} {defaultValues.chapter}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                <SelectTrigger id="translation" aria-label="Translation" className="w-[90px]"><SelectValue placeholder="Translation" /></SelectTrigger>
                <SelectContent>{translations.map(t => <SelectItem key={t.id} value={t.id}>{t.id.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
            
             <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('prev')} disabled={parseInt(defaultValues.chapter) <= 1} aria-label="Previous Chapter">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('next')} disabled={parseInt(defaultValues.chapter) >= maxChaptersForCurrentBook} aria-label="Next Chapter">
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Popover open={isVerseSelectorOpen} onOpenChange={setIsVerseSelectorOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" type="button" aria-label="Go to verse" disabled={maxVerses === 0}>
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
            <Button variant="outline" size="icon" type="button" onClick={handleGoBack} aria-label="Go to last location">
                <History className="h-4 w-4" />
            </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderMobileControls = () => (
    <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
        <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
                {defaultValues.book} {defaultValues.chapter} ({defaultValues.translation.toUpperCase()})
            </Button>
        </SheetTrigger>
        <SheetContent side="bottom" onOpenAutoFocus={(e) => e.preventDefault()}>
            <SheetHeader>
                <SheetTitle>Select a Verse</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-4">
                 <Dialog open={isBookSelectorOpen} onOpenChange={setIsBookSelectorOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                            Book & Chapter
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
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
                        <Button variant="outline" className="w-full justify-between" disabled={maxVerses === 0}>
                            Go to Verse
                            <Hash className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Select a Verse</DialogTitle>
                        </DialogHeader>
                        <VerseSelectorGrid 
                            numberOfVerses={maxVerses} 
                            onSelect={(v) => {
                                handleVerseSelect(v);
                                setIsMobileSheetOpen(false); // also close the main sheet
                            }} 
                        />
                    </DialogContent>
                </Dialog>

                <Select value={defaultValues.translation} onValueChange={(t) => { navigate({ translation: t }); setIsMobileSheetOpen(false); }}>
                    <SelectTrigger><SelectValue placeholder="Translation" /></SelectTrigger>
                    <SelectContent>{translations.map(t => <SelectItem key={t.id} value={t.id}>{t.id.toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
                
                 <div className="flex gap-2 w-full">
                    <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('prev')} disabled={parseInt(defaultValues.chapter) <= 1} aria-label="Previous Chapter"><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('next')} disabled={parseInt(defaultValues.chapter) >= maxChaptersForCurrentBook} aria-label="Next Chapter"><ChevronRight className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" type="button" onClick={handleGoBack} aria-label="Go to last location">
                        <History className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </SheetContent>
    </Sheet>
  );

  if (!isClient) {
    return (
        <Card className="animate-in fade-in duration-500">
            <CardContent className="pt-6">
                 <Skeleton className="h-[40px] w-full" />
            </CardContent>
        </Card>
    );
  }

  return isMobile ? renderMobileControls() : renderDesktopControls();
}
