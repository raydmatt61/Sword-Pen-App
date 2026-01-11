
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from '@/components/ui/label';
import type { Book, Translation } from '@/lib/bible';
import { Search } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

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

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const maxChapters = useMemo(() => {
      // Find book by commonName or id, as the value might be either depending on the context
      const selectedBook = books.find(b => b.commonName === book || b.id === book);
      return selectedBook?.numberOfChapters || 1;
  }, [books, book]);

  useEffect(() => {
    if (parseInt(chapter) > maxChapters) {
      setChapter('1');
    }
  }, [book, chapter, maxChapters]);

  const handleValueChange = (type: 'book' | 'chapter', value: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set(type, value);
    // When translation or book changes, reset chapter to 1
    if (type === 'book') {
        current.set('chapter', '1');
    }
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2 col-span-1">
                        <Label htmlFor="book" className="font-headline">Book</Label>
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2 col-span-1">
                        <Label htmlFor="chapter" className="font-headline">Chapter</Label>
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <Skeleton className="h-10 w-full col-span-2 md:col-span-1" />
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="animate-in fade-in duration-500">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2 col-span-1">
            <Label htmlFor="book" className="font-headline">Book</Label>
            <Select value={book} onValueChange={(v) => handleValueChange('book', v)} disabled={books.length === 0}>
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
          <div className="space-y-2 col-span-1">
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
          <Button type="submit" className="w-full col-span-2 md:col-span-1" disabled={books.length === 0}>
            <Search className="mr-2 h-4 w-4" />
            Load Chapter
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
