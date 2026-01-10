"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from '@/components/ui/label';
import { BIBLE_BOOKS, TRANSLATIONS, type Book } from '@/lib/bible';
import { Search } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

export function VerseSelector({ defaultValues, books }: { defaultValues: { book: string; chapter: string; translation: string }, books: Book[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [translation, setTranslation] = useState(defaultValues.translation);
  const [book, setBook] = useState(defaultValues.book);
  const [chapter, setChapter] = useState(defaultValues.chapter);
  
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const maxChapters = useMemo(() => {
      const selectedBook = books.find(b => b.commonName === book);
      return selectedBook?.numberOfChapters || 1;
  }, [books, book]);

  useEffect(() => {
    if (parseInt(chapter) > maxChapters) {
      setChapter('1');
    }
  }, [book, chapter, maxChapters]);

  const handleTranslationChange = (newTranslation: string) => {
    setTranslation(newTranslation);
    // When translation changes, reload the page with the new translation to get the right book list
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set('translation', newTranslation);
    router.push(`${pathname}?${current.toString()}`);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set('book', book);
    current.set('chapter', chapter);
    current.set('translation', translation);
    const search = current.toString();
    const query = search ? `?${search}` : "";
    router.push(`${pathname}${query}`);
  };

  if (!isClient) {
    return (
        <Card className="animate-in fade-in duration-500">
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2">
                        <Label htmlFor="translation" className="font-headline">Translation</Label>
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="book" className="font-headline">Book</Label>
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="chapter" className="font-headline">Chapter</Label>
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="animate-in fade-in duration-500">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="translation" className="font-headline">Translation</Label>
            <Select value={translation} onValueChange={handleTranslationChange}>
              <SelectTrigger id="translation">
                <SelectValue placeholder="Select translation" />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATIONS.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.englishName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="book" className="font-headline">Book</Label>
            <Select value={book} onValueChange={setBook}>
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
            />
          </div>
          <Button type="submit" className="w-full">
            <Search className="mr-2 h-4 w-4" />
            Load Chapter
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
