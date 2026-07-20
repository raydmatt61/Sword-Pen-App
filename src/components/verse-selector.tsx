
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

const PREV_LOCATION_KEY = 'sword-and-pen-prev-location';

const BookSelectorGrid = ({ books, currentBook, onSelect }: { books: Book[], currentBook: string, onSelect: (bookName: string) => void }) => {
    const otBooks = useMemo(() => books.filter(b => b.testament === 'OT'), [books]);
    const ntBooks = useMemo(() => books.filter(b => b.testament === 'NT'), [books]);

    const handleSelect = (bookName: string) => {
        onSelect(bookName);
    };

    const renderBookGrid = (testamentBooks: Book[], title: string) => (
        <div>
            <p className="text-[10px] font-bold text-muted-foreground px-2 py-3 uppercase tracking-widest">{title}</p>
            <div className="grid grid-cols-5 gap-1 px-1">
                {testamentBooks.map(book => (
                    <Button
                        key={book.id}
                        variant={book.commonName === currentBook ? "secondary" : "ghost"}
                        size="sm"
                        className="h-9 px-2 justify-center font-bold text-xs"
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
            <div className="pb-4">
                {renderBookGrid(otBooks, "Old Testament")}
                <div className="mt-4 border-t border-stone-100" />
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
                        className="h-10 justify-center font-headline"
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
                        className="h-10 justify-center font-headline"
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
    const handleOpenMobileNav = () => setIsMobileSheetOpen(true);
    document.addEventListener('open-mobile-nav', handleOpenMobileNav);
    return () => document.removeEventListener('open-mobile-nav', handleOpenMobileNav);
  }, []);
  
  useEffect(() => {
    if (!isBookSelectorOpen) {
        const timer = setTimeout(() => {
            setSelectionStep('book');
            setTempBook(defaultValues.book);
        }, 200);
        return () => clearTimeout(timer);
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
    try {
        const savedLocationRaw = localStorage.getItem(PREV_LOCATION_KEY);
        if (savedLocationRaw) {
            const savedLocation = JSON.parse(savedLocationRaw);
            navigate({
                book: savedLocation.book,
                chapter: savedLocation.chapter,
                translation: savedLocation.translationId
            });
        }
    } catch (e) {
        console.warn("Go Back failed", e);
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
                 <Button variant="outline" className="w-[180px] justify-between h-10 border-stone-200 shadow-sm font-bold bg-white">
                    <span className="truncate">{defaultValues.book} {defaultValues.chapter}</span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0 shadow-2xl rounded-2xl border-stone-200">
                {selectionStep === 'book' ? (
                    <BookSelectorGrid books={books} currentBook={defaultValues.book} onSelect={handleBookSelect} />
                ) : (
                    <div>
                        <div className="p-3 border-b border-stone-100 flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectionStep('book')}><ChevronLeft className="h-4 w-4" /></Button>
                            <p className="font-bold text-sm tracking-tight">{tempBook}</p>
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
            <SelectTrigger id="translation" aria-label="Translation" className="w-[90px] h-10 border-stone-200 shadow-sm font-bold bg-white uppercase text-[11px] tracking-widest">
                <SelectValue placeholder="Tr" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-stone-200 shadow-xl">
                {translations.map(t => <SelectItem key={t.id} value={t.id} className="text-xs font-bold uppercase tracking-wider">{t.id}</SelectItem>)}
            </SelectContent>
        </Select>
        
         <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('prev')} disabled={parseInt(defaultValues.chapter) <= 1} className="h-10 w-10 border-stone-200 bg-white">
            <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('next')} disabled={parseInt(defaultValues.chapter) >= maxChaptersForCurrentBook} className="h-10 w-10 border-stone-200 bg-white">
            <ChevronRight className="h-4 w-4" />
        </Button>
        <Popover open={isVerseSelectorOpen} onOpenChange={setIsVerseSelectorOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" type="button" className="h-10 w-10 border-stone-200 bg-white" disabled={maxVerses === 0} title="Jump to Verse">
                    <Hash className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0 shadow-2xl rounded-2xl border-stone-200">
                <div className="p-3 border-b border-stone-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Jump to Verse</p>
                </div>
                <VerseSelectorGrid 
                    numberOfVerses={maxVerses} 
                    onSelect={handleVerseSelect} 
                />
            </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" type="button" onClick={handleGoBack} className="h-10 w-10 border-stone-200 bg-white" title="Go Back">
            <History className="h-4 w-4" />
        </Button>
    </div>
  );

  const renderMobileControls = () => (
    <div className="w-full flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setIsMobileSheetOpen(true)} className="flex-grow h-12 text-base px-4 justify-between font-bold border-2 border-primary/10 shadow-sm bg-white rounded-xl">
            <span className="truncate">
                {defaultValues.book} {defaultValues.chapter} ({defaultValues.translation.toUpperCase()})
            </span>
            <ChevronsUpDown className="h-5 w-5 opacity-50 shrink-0" />
        </Button>
        
        <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-[2.5rem] px-6 pb-14 h-[85vh] bg-background border-t-4 border-primary/5" onOpenAutoFocus={(e) => e.preventDefault()}>
                <SheetHeader className="mb-8 pt-4">
                    <SheetTitle className="text-3xl font-headline font-bold text-center tracking-tight text-primary">Scripture Library</SheetTitle>
                </SheetHeader>
                <div className="space-y-8">
                     <Dialog open={isBookSelectorOpen} onOpenChange={setIsBookSelectorOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full h-16 justify-between text-xl font-bold border-stone-200 shadow-sm rounded-2xl bg-white">
                                Book & Chapter
                                <ChevronsUpDown className="ml-2 h-6 w-6 shrink-0 opacity-50" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] rounded-3xl p-0 overflow-hidden shadow-2xl border-stone-200">
                            {selectionStep === 'book' ? (
                                <>
                                    <DialogHeader className="p-5 border-b border-stone-100 bg-stone-50">
                                        <DialogTitle className="text-xl font-bold">Old & New Testament</DialogTitle>
                                    </DialogHeader>
                                    <BookSelectorGrid books={books} currentBook={defaultValues.book} onSelect={handleBookSelect} />
                                </>
                            ) : (
                                <>
                                    <DialogHeader className="p-5 border-b border-stone-100 bg-stone-50">
                                        <DialogTitle className="flex items-center gap-3">
                                            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full" onClick={() => setSelectionStep('book')}><ChevronLeft className="h-6 w-6" /></Button>
                                            <span className="text-2xl font-bold">{tempBook}</span>
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
                            <Button variant="outline" className="w-full h-16 justify-between text-xl font-bold border-stone-200 shadow-sm rounded-2xl bg-white" disabled={maxVerses === 0}>
                                Jump to Verse
                                <Hash className="ml-2 h-6 w-6 shrink-0 opacity-50" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] rounded-3xl p-0 overflow-hidden shadow-2xl border-stone-200">
                            <DialogHeader className="p-5 border-b border-stone-100 bg-stone-50">
                                <DialogTitle className="text-xl font-bold uppercase tracking-widest">Select Verse</DialogTitle>
                            </DialogHeader>
                            <VerseSelectorGrid 
                                numberOfVerses={maxVerses} 
                                onSelect={(v) => {
                                    handleVerseSelect(v);
                                    setIsMobileSheetOpen(false);
                                    setIsVerseSelectorOpen(false);
                                }} 
                            />
                        </DialogContent>
                    </Dialog>

                    <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground ml-2">Translation</p>
                        <Select value={defaultValues.translation} onValueChange={(t) => { navigate({ translation: t }); setIsMobileSheetOpen(false); }}>
                            <SelectTrigger className="h-16 text-xl font-bold border-stone-200 rounded-2xl bg-white shadow-sm">
                                <SelectValue placeholder="Translation" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-stone-200 shadow-2xl max-h-[40vh]">
                                {translations.map(t => <SelectItem key={t.id} value={t.id} className="text-lg py-4 font-bold tracking-tight">{t.id.toUpperCase()} - {t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    
                     <div className="flex gap-4 w-full pt-8">
                        <Button variant="outline" size="icon" className="flex-1 h-20 border-2 rounded-2xl shadow-sm bg-white hover:bg-stone-50" onClick={() => { onChapterNav('prev'); setIsMobileSheetOpen(false); }} disabled={parseInt(defaultValues.chapter) <= 1}><ChevronLeft className="h-10 w-10" /></Button>
                        <Button variant="outline" size="icon" className="flex-1 h-20 border-2 rounded-2xl shadow-sm bg-white hover:bg-stone-50" onClick={() => { onChapterNav('next'); setIsMobileSheetOpen(false); }} disabled={parseInt(defaultValues.chapter) >= maxChaptersForCurrentBook}><ChevronRight className="h-10 w-10" /></Button>
                        <Button variant="outline" size="icon" className="flex-1 h-20 border-2 rounded-2xl shadow-sm bg-white hover:bg-stone-50" onClick={() => { handleGoBack(); setIsMobileSheetOpen(false); }}>
                            <History className="h-10 w-10" />
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    </div>
  );

  if (!isClient) {
    return (
        <div className="w-full">
             <Skeleton className="h-10 w-full rounded-xl" />
        </div>
    );
  }

  return isMobile ? renderMobileControls() : renderDesktopControls();
}
