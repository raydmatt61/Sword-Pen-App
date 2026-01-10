"use client";

import { useState } from 'react';
import type { BibleChapterResponse } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { BookText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function BibleDisplay({ chapterData }: { chapterData: BibleChapterResponse }) {
  const [chapterNotes, setChapterNotes] = useState('');

  return (
    <div className="mt-6 flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="sticky top-6 z-10">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-3">
              <BookText className="text-primary" />
              Chapter Notes for {chapterData.reference}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Textarea 
              placeholder="Write your notes for the entire chapter here..."
              value={chapterNotes}
              onChange={(e) => setChapterNotes(e.target.value)}
              rows={4}
              className="font-body text-base"
            />
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">{chapterData.reference}</CardTitle>
        </CardHeader>
        <CardContent>
            <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-4">
                    {chapterData.verses.map((verse) => (
                    <div key={verse.verse} className="flex flex-col gap-2 border-l-2 border-transparent py-2 pl-4 transition-colors">
                        <p className="text-lg leading-relaxed font-body">
                        <sup className="font-headline font-bold text-primary mr-2">{verse.verse}</sup>
                        {verse.text}
                        </p>
                    </div>
                    ))}
                </div>
            </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
