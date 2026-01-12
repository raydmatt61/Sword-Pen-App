
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from '@/components/ui/label';
import type { Book, Translation } from '@/lib/bible';
import { Search, ChevronLeft, ChevronRight, Rewind, BookOpenCheck } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

const PREVIOUS_LOCATION_KEY = 'previousBibleLocation';

type BibleLocation = {
    book: string;
    chapter: string;
    translation: string;
};

export function VerseSelector({ 
    defaultValues, 
    books,
    translations
}: { 
    defaultValues: { book: string; chapter: string; translation: string }, 
    books: Book[],
    translations: Translation[]
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [book, setBook] = useState(defaultValues.book);
  const [chapter, setChapter] = useState(defaultValues.chapter);
  const [translation, setTranslation] = useState(defaultValues.translation);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = useState(false);
  const [previousLocation, setPreviousLocation] = useState<BibleLocation | null>(null);

  useEffect(() => {
    setIsClient(true);
    const storedPrevLocation = sessionStorage.getItem(PREVIOUS_LOCATION_KEY);
    if (storedPrevLocation) {
        setPreviousLocation(JSON.parse(storedPrevLocation));
    }
  }, []);
  
  useEffect(() => {
    // This effect ensures the component's state is synchronized with the props from the server.
    setBook(defaultValues.book);
    setChapter(defaultValues.chapter);
    setTranslation(defaultValues.translation);
  }, [defaultValues]);
  
  const maxChapters = books.find(b => b.commonName === book)?.numberOfChapters || 1;

  const saveCurrentLocationAsPrevious = () => {
    const currentLocation = {
        book: searchParams.get('book') || defaultValues.book,
        chapter: searchParams.get('chapter') || defaultValues.chapter,
        translation: searchParams.get('translation') || 'BSB-Notes',
    };
    sessionStorage.setItem(PREVIOUS_LOCATION_KEY, JSON.stringify(currentLocation));
    setPreviousLocation(currentLocation);
  };

  const navigate = useCallback((newValues: { book?: string; chapter?: string; translation?: string }) => {
    saveCurrentLocationAsPrevious();
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    for (const [key, value] of Object.entries(newValues)) {
        if (value) {
            current.set(key, value);
        }
    }
    const newSearch = current.toString();
    router.push(`${pathname}?${newSearch}`);
  }, [router, pathname, searchParams]);

  const handleBookChange = (newBook: string) => {
    setBook(newBook);
    setChapter('1'); // Reset chapter when book changes
  };

  const handleChapterNav = (direction: 'prev' | 'next') => {
    let currentChapter = parseInt(chapter);
    if (direction === 'prev' && currentChapter > 1) {
        currentChapter--;
    }
    if (direction === 'next' && currentChapter < maxChapters) {
        currentChapter++;
    }
    const newChapter = currentChapter.toString();
    setChapter(newChapter);
    navigate({ chapter: newChapter });
  };

  const handleGoBack = () => {
    if (previousLocation) {
        navigate(previousLocation);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ book, chapter, translation });
    setIsSheetOpen(false);
  };
  
  const renderControls = () => (
     <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="grid grid-cols-2 gap-2 w-full">
            <div className="space-y-2">
                <Label htmlFor="book" className="font-headline">Book</Label>
                <Select value={book} onValueChange={handleBookChange} disabled={books.length === 0}>
                <SelectTrigger id="book">
                    <SelectValue placeholder="Select book" />
                </SelectTrigger>
                <SelectContent>
                    {books.map(b => (
                    <SelectItem key={b.id} value={b.commonName}>{b.commonName}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="chapter" className="font-headline">Chapter</Label>
                <Select value={chapter} onValueChange={(newChapter) => setChapter(newChapter)} disabled={books.length === 0}>
                  <SelectTrigger id="chapter">
                    <SelectValue placeholder="Select chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: maxChapters }, (_, i) => i + 1).map(chapNum => (
                      <SelectItem key={chapNum} value={String(chapNum)}>{chapNum}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    aria-label="List of Books"
                    title="View all books and chapters"
                >
                  <BookOpenCheck className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                  <SheetHeader>
                      <SheetTitle>Books of the Bible</SheetTitle>
                      <SheetDescription>A list of all books and their chapter counts.</SheetDescription>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100%-4rem)] mt-4">
                    <div className="pr-6">
                        {books.map((b, index) => (
                          <div key={b.id}>
                            <div className="flex justify-between items-center py-2">
                                <span className="font-medium">{b.commonName}</span>
                                <span className="text-sm text-muted-foreground">{b.numberOfChapters} Chapters</span>
                            </div>
                            {index < books.length - 1 && <Separator />}
                           </div>
                        ))}
                    </div>
                  </ScrollArea>
              </SheetContent>
            </Sheet>
            <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={handleGoBack}
                disabled={!previousLocation}
                aria-label="Previous Location"
                title="Go to previous location"
            >
                <Rewind className="h-4 w-4" />
            </Button>
            <Button 
                variant="outline" 
                size="icon" 
                type="button" 
                onClick={() => handleChapterNav('prev')}
                disabled={parseInt(chapter) <= 1}
                aria-label="Previous Chapter"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>
             <Button 
                variant="outline" 
                size="icon" 
                type="button" 
                onClick={() => handleChapterNav('next')}
                disabled={parseInt(chapter) >= maxChapters}
                aria-label="Next Chapter"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Button type="submit" className="flex-grow" disabled={books.length === 0}>
                <Search className="mr-2 h-4 w-4" />
                Load
            </Button>
        </div>
    </form>
  );

  if (!isClient) {
    return (
        <Card className="animate-in fade-in duration-500">
            <CardContent className="pt-6">
                 <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    );
  }

  if (isMobile) {
    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                    {defaultValues.book} {defaultValues.chapter}
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
                <SheetHeader>
                    <SheetTitle>Select a Verse</SheetTitle>
                    <SheetDescription>
                        Choose a book and chapter to read.
                    </SheetDescription>
                </SheetHeader>
                <div className="py-4">
                    {renderControls()}
                </div>
            </SheetContent>
        </Sheet>
    )
  }

  return (
    <Card className="animate-in fade-in duration-500">
      <CardContent className="pt-6">
        {renderControls()}
      </CardContent>
    </Card>
  );
}
