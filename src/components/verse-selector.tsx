"use client";

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from '@/components/ui/label';
import { BIBLE_BOOKS, TRANSLATIONS, BOOK_CHAPTERS } from '@/lib/bible';
import { Search } from 'lucide-react';

export function VerseSelector({ defaultValues }: { defaultValues: { book: string; chapter: string; translation: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [book, setBook] = useState(defaultValues.book);
  const [chapter, setChapter] = useState(defaultValues.chapter);
  const [translation, setTranslation] = useState(defaultValues.translation);
  const [maxChapters, setMaxChapters] = useState(BOOK_CHAPTERS[defaultValues.book] || 1);

  useEffect(() => {
    setMaxChapters(BOOK_CHAPTERS[book] || 1);
    if (parseInt(chapter) > (BOOK_CHAPTERS[book] || 1)) {
      setChapter('1');
    }
  }, [book, chapter]);

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

  return (
    <Card className="animate-in fade-in duration-500">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="translation" className="font-headline">Translation</Label>
            <Select value={translation} onValueChange={setTranslation}>
              <SelectTrigger id="translation">
                <SelectValue placeholder="Select translation" />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATIONS.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
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
                {BIBLE_BOOKS.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
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
