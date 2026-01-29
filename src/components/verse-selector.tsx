
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { Book, Translation } from '@/lib/bible';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

export function VerseSelector({ 
    defaultValues, 
    books,
    translations,
    onChapterNav,
    maxChapters,
    navigate
}: { 
    defaultValues: { book: string; chapter: string; translation: string; }, 
    books: Book[],
    translations: Translation[],
    onChapterNav: (direction: 'prev' | 'next') => void,
    maxChapters: number,
    navigate: (newValues: Partial<{ book: string, chapter: string, translation: string }>) => void
}) {
  
  const [book, setBook] = useState(defaultValues.book);
  const [chapter, setChapter] = useState(defaultValues.chapter);
  const [translation, setTranslation] = useState(defaultValues.translation);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = useState(false);

  const currentMaxChaptersForSelectedBook = useMemo(() => {
    return books.find(b => b.commonName === book)?.numberOfChapters || maxChapters;
  }, [book, books, maxChapters]);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    setBook(defaultValues.book);
    setChapter(defaultValues.chapter);
    setTranslation(defaultValues.translation);
  }, [defaultValues]);
  
  const handleBookChange = (newBook: string) => {
    setBook(newBook);
    setChapter('1');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ book, chapter, translation });
    setIsSheetOpen(false);
  };
  
  const renderControls = (isMobileLayout = false) => {
    if (isMobileLayout) {
        return (
            <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-2">
                        <Select value={book} onValueChange={handleBookChange} disabled={books.length === 0}>
                            <SelectTrigger id="book-mobile" aria-label="Book"><SelectValue placeholder="Select book" /></SelectTrigger>
                            <SelectContent>{books.map(b => <SelectItem key={b.id} value={b.commonName}>{b.commonName}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={chapter} onValueChange={setChapter} disabled={books.length === 0}>
                            <SelectTrigger id="chapter-mobile" aria-label="Chapter"><SelectValue placeholder="Ch." /></SelectTrigger>
                            <SelectContent>{Array.from({ length: currentMaxChaptersForSelectedBook }, (_, i) => i + 1).map(chapNum => <SelectItem key={chapNum} value={String(chapNum)}>{chapNum}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <Select value={translation} onValueChange={setTranslation}>
                        <SelectTrigger id="translation-mobile" aria-label="Translation"><SelectValue placeholder="Translation" /></SelectTrigger>
                        <SelectContent>{translations.map(t => <SelectItem key={t.id} value={t.id}>{t.id}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex gap-2 w-full">
                        <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('prev')} disabled={parseInt(defaultValues.chapter) <= 1} aria-label="Previous Chapter"><ChevronLeft className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('next')} disabled={parseInt(defaultValues.chapter) >= maxChapters} aria-label="Next Chapter"><ChevronRight className="h-4 w-4" /></Button>
                        <Button type="submit" className="flex-grow" disabled={books.length === 0}>
                            <Search className="mr-2 h-4 w-4" /> Load
                        </Button>
                    </div>
                </div>
            </form>
        )
    }

    return (
     <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_auto_auto_auto] items-center gap-2">
            <Select value={book} onValueChange={handleBookChange} disabled={books.length === 0}>
                <SelectTrigger id="book" aria-label="Book"><SelectValue placeholder="Select book" /></SelectTrigger>
                <SelectContent>{books.map(b => <SelectItem key={b.id} value={b.commonName}>{b.commonName}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={chapter} onValueChange={setChapter} disabled={books.length === 0}>
                <SelectTrigger id="chapter" aria-label="Chapter"><SelectValue placeholder="Ch." /></SelectTrigger>
                <SelectContent>{Array.from({ length: currentMaxChaptersForSelectedBook }, (_, i) => i + 1).map(chapNum => <SelectItem key={chapNum} value={String(chapNum)}>{chapNum}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={translation} onValueChange={setTranslation}>
                <SelectTrigger id="translation" aria-label="Translation"><SelectValue placeholder="Translation" /></SelectTrigger>
                <SelectContent>{translations.map(t => <SelectItem key={t.id} value={t.id}>{t.id}</SelectItem>)}</SelectContent>
            </Select>

            <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('prev')} disabled={parseInt(defaultValues.chapter) <= 1} aria-label="Previous Chapter">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('next')} disabled={parseInt(defaultValues.chapter) >= maxChapters} aria-label="Next Chapter">
                <ChevronRight className="h-4 w-4" />
            </Button>

            <Button type="submit" size="icon" className="px-3" disabled={books.length === 0}>
                <Search className="h-4 w-4" />
                <span className="sr-only">Load</span>
            </Button>
        </div>
    </form>
  )};

  if (!isClient) {
    return (
        <Card className="animate-in fade-in duration-500">
            <CardContent className="pt-6">
                 <Skeleton className="h-[40px] w-full" />
            </CardContent>
        </Card>
    );
  }

  if (isMobile) {
    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                    {defaultValues.book} {defaultValues.chapter} ({defaultValues.translation})
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
                <SheetHeader>
                    <SheetTitle>Select a Verse</SheetTitle>
                    <SheetDescription>
                        Choose a book, chapter, and translation to read.
                    </SheetDescription>
                </SheetHeader>
                <div className="py-4">
                    {renderControls(true)}
                </div>
            </SheetContent>
        </Sheet>
    )
  }

  return (
    <Card className="animate-in fade-in duration-500">
      <CardContent className="pt-6">
        {renderControls(false)}
      </CardContent>
    </Card>
  );
}
