"use client";

import { useState } from 'react';
import type { BibleChapterResponse } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { BookText, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function BibleDisplay({ chapterData }: { chapterData: BibleChapterResponse }) {
  const [chapterNotes, setChapterNotes] = useState('');

  return (
    <div className="mt-6 space-y-8 animate-in fade-in duration-500">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">{chapterData.reference}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center gap-3">
            <BookText className="text-primary" />
            Chapter Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Textarea 
            placeholder="Write your notes for the entire chapter here..."
            value={chapterNotes}
            onChange={(e) => setChapterNotes(e.target.value)}
            rows={8}
            className="font-body text-base"
          />
        </CardContent>
      </Card>
    </div>
  );
}
