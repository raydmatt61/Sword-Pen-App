
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import type { Book, Translation } from '@/lib/bible';
import { ChevronsRight, ChevronLeft, ChevronRight, History, ChevronsUpDown } from 'lucide-react';
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


export function VerseSelector({ 
    defaultValues, 
    books,
    translations,
    onChapterNav,
    navigate
}: { 
    defaultValues: { book: string; chapter: string; translation: string; }, 
    books: Book[],
    translations: Translation[],
    onChapterNav: (direction: 'prev' | 'next') => void,
    navigate: (newValues: Partial<{ book: string, chapter: string, translation: string }>) => void
}) {
  
  const [tempBook, setTempBook] = useState(defaultValues.book);
  const [isBookSelectorOpen, setIsBookSelectorOpen] = useState(false);
  
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    setTempBook(defaultValues.book);
  }, [defaultValues.book]);
  
  const handleBookSelect = (newBook: string) => {
    if (isMobile) {
        setTempBook(newBook);
        setIsBookSelectorOpen(false);
    } else {
        navigate({ book: newBook, chapter: '1' });
        setIsBookSelectorOpen(false);
    }
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
  
  const currentBookData = useMemo(() => books.find(b => b.commonName === (isMobile ? tempBook : defaultValues.book)), [books, tempBook, defaultValues.book, isMobile]);
  const maxChaptersForCurrentBook = currentBookData?.numberOfChapters || 1;

  const handleSubmitMobile = () => {
    navigate({ book: tempBook, chapter: '1' });
  };
  
  const renderDesktopControls = () => (
    <Card className="animate-in fade-in duration-500">
      <CardContent className="pt-6">
         <div className="flex items-center gap-2">
            <Popover open={isBookSelectorOpen} onOpenChange={setIsBookSelectorOpen}>
                <PopoverTrigger asChild>
                     <Button variant="outline" className="w-[180px] justify-between">
                        <span>{defaultValues.book}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] p-0">
                    <BookSelectorGrid books={books} currentBook={defaultValues.book} onSelect={handleBookSelect} />
                </PopoverContent>
            </Popover>

            <Select value={defaultValues.chapter} onValueChange={(c) => navigate({ chapter: c })}>
                <SelectTrigger id="chapter" aria-label="Chapter" className="w-[80px]"><SelectValue placeholder="Ch." /></SelectTrigger>
                <SelectContent>{Array.from({ length: maxChaptersForCurrentBook }, (_, i) => i + 1).map(chapNum => <SelectItem key={chapNum} value={String(chapNum)}>{chapNum}</SelectItem>)}</SelectContent>
            </Select>

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
            <Button variant="outline" size="icon" type="button" onClick={handleGoBack} aria-label="Go to last location">
                <History className="h-4 w-4" />
            </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderMobileControls = () => (
    <Sheet>
        <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
                {defaultValues.book} {defaultValues.chapter} ({defaultValues.translation.toUpperCase()})
            </Button>
        </SheetTrigger>
        <SheetContent side="bottom">
            <SheetHeader>
                <SheetTitle>Select a Verse</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-4">
                 <Dialog open={isBookSelectorOpen} onOpenChange={setIsBookSelectorOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                            {tempBook}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Select a Book</DialogTitle>
                        </DialogHeader>
                        <BookSelectorGrid books={books} currentBook={tempBook} onSelect={handleBookSelect} />
                    </DialogContent>
                </Dialog>

                <div className="grid grid-cols-2 gap-2">
                    <Select value={defaultValues.chapter} onValueChange={(c) => navigate({ chapter: c })}>
                        <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
                        <SelectContent>{Array.from({ length: maxChaptersForCurrentBook }, (_, i) => i + 1).map(chapNum => <SelectItem key={chapNum} value={String(chapNum)}>{chapNum}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={defaultValues.translation} onValueChange={(t) => navigate({ translation: t })}>
                        <SelectTrigger><SelectValue placeholder="Translation" /></SelectTrigger>
                        <SelectContent>{translations.map(t => <SelectItem key={t.id} value={t.id}>{t.id.toUpperCase()}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                 <div className="flex gap-2 w-full">
                    <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('prev')} disabled={parseInt(defaultValues.chapter) <= 1} aria-label="Previous Chapter"><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('next')} disabled={parseInt(defaultValues.chapter) >= maxChaptersForCurrentBook} aria-label="Next Chapter"><ChevronRight className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" type="button" onClick={handleGoBack} aria-label="Go to last location">
                        <History className="h-4 w-4" />
                    </Button>
                    <Button onClick={handleSubmitMobile} className="flex-grow" disabled={books.length === 0 || tempBook === defaultValues.book}>
                        Go to {tempBook}
                        <ChevronsRight className="ml-2 h-4 w-4" />
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
