
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from '@/components/ui/label';
import type { Book, Translation } from '@/lib/bible';
import { Search, ChevronLeft, ChevronRight, Rewind } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

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
  
  const [translation, setTranslation] = useState(defaultValues.translation);
  const [book, setBook] = useState(defaultValues.book);
  const [chapter, setChapter] = useState(defaultValues.chapter);
  
  const [isClient, setIsClient] = useState(false);
  const [previousLocation, setPreviousLocation] = useState<BibleLocation | null>(null);

  useEffect(() => {
    setIsClient(true);
    const storedPrevLocation = sessionStorage.getItem(PREVIOUS_LOCATION_KEY);
    if (storedPrevLocation) {
        setPreviousLocation(JSON.parse(storedPrevLocation));
    }
  }, []);
  
  const maxChapters = useMemo(() => {
      // Find book by commonName or id, as the value might be either depending on the context
      const selectedBook = books.find(b => b.commonName === book || b.id === book);
      return selectedBook?.numberOfChapters || 1;
  }, [books, book]);

  useEffect(() => {
    // This effect ensures the component's state is synchronized with the props from the server.
    setTranslation(defaultValues.translation);
    setBook(defaultValues.book);
    setChapter(defaultValues.chapter);
  }, [defaultValues]);

  useEffect(() => {
    if (parseInt(chapter) > maxChapters) {
      setChapter('1');
    }
  }, [book, chapter, maxChapters]);

  const saveCurrentLocationAsPrevious = () => {
    const currentLocation = {
        book: searchParams.get('book') || defaultValues.book,
        chapter: searchParams.get('chapter') || defaultValues.chapter,
        translation: searchParams.get('translation') || defaultValues.translation,
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
    router.push(`${pathname}?${current.toString()}`);
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
  };

  if (!isClient) {
    return (
        <Card className="animate-in fade-in duration-500">
            <CardContent className="pt-2">
                <div className="flex flex-col sm:flex-row gap-2 items-end">
                    <div className="grid grid-cols-2 gap-2 w-full">
                        <div className="space-y-2">
                            <Label htmlFor="book" className="font-headline">Book</Label>
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="chapter" className="font-headline">Chapter</Label>
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </div>
                    <div className="w-full sm:w-auto">
                        <Skeleton className="h-10 w-full sm:w-auto sm:px-12" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="animate-in fade-in duration-500">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 items-end">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full">
                 <div className="space-y-2">
                    <Label htmlFor="translation" className="font-headline">Translation</Label>
                    <Select value={translation} onValueChange={setTranslation} disabled={translations.length === 0}>
                    <SelectTrigger id="translation">
                        <SelectValue placeholder="Select translation" />
                    </SelectTrigger>
                    <SelectContent>
                        {translations.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>
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
                    <Input
                        id="chapter"
                        type="number"
                        value={chapter}
                        onChange={(e) => setChapter(e.target.value)}
                        min="1"
                        max={maxChapters}
                        required
                        disabled={books.length === 0}
                    />
                </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
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
      </CardContent>
    </Card>
  );
}
