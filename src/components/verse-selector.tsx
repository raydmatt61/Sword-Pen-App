
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { Book, Translation } from '@/lib/bible';
import { ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';
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
    const newBookData = books.find(b => b.commonName === newBook);
    const chapterAsNum = parseInt(chapter, 10);
    if (newBookData && chapterAsNum > newBookData.numberOfChapters) {
      setChapter('1');
    }
  };

  const currentMaxChaptersForSelectedBook = useMemo(() => {
    return books.find(b => b.commonName === book)?.numberOfChapters || maxChapters;
  }, [book, books, maxChapters]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    navigate({ book, chapter, translation });
    if(isMobile) {
      setIsSheetOpen(false);
    }
  };
  
  const renderControls = (isMobileLayout = false) => {
    const selectorControls = (
        <>
            <Select value={book} onValueChange={handleBookChange} disabled={books.length === 0}>
                <SelectTrigger id="book" aria-label="Book" className="md:w-[150px]"><SelectValue placeholder="Select book" /></SelectTrigger>
                <SelectContent>{books.map(b => <SelectItem key={b.id} value={b.commonName}>{b.commonName}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={chapter} onValueChange={setChapter} disabled={books.length === 0}>
                <SelectTrigger id="chapter" aria-label="Chapter" className="md:w-[70px]"><SelectValue placeholder="Ch." /></SelectTrigger>
                <SelectContent>{Array.from({ length: currentMaxChaptersForSelectedBook }, (_, i) => i + 1).map(chapNum => <SelectItem key={chapNum} value={String(chapNum)}>{chapNum}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={translation} onValueChange={setTranslation}>
                <SelectTrigger id="translation" aria-label="Translation" className="md:w-[90px]"><SelectValue placeholder="Translation" /></SelectTrigger>
                <SelectContent>{translations.map(t => <SelectItem key={t.id} value={t.id}>{t.id}</SelectItem>)}</SelectContent>
            </Select>
        </>
    );

    if (isMobileLayout) {
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {selectorControls}
                </div>
                <div className="flex gap-2 w-full">
                    <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('prev')} disabled={parseInt(defaultValues.chapter) <= 1} aria-label="Previous Chapter"><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('next')} disabled={parseInt(defaultValues.chapter) >= maxChapters} aria-label="Next Chapter"><ChevronRight className="h-4 w-4" /></Button>
                    <Button type="submit" className="flex-grow" disabled={books.length === 0}>
                        Go
                        <ChevronsRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </form>
        )
    }

    return (
     <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
            {selectorControls}
             <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('prev')} disabled={parseInt(defaultValues.chapter) <= 1} aria-label="Previous Chapter">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" type="button" onClick={() => onChapterNav('next')} disabled={parseInt(defaultValues.chapter) >= maxChapters} aria-label="Next Chapter">
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Button type="submit" size="icon" disabled={books.length === 0} aria-label="Go to selection">
                <ChevronsRight className="h-4 w-4" />
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
