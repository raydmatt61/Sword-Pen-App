"use client";

import { useState } from 'react';
import type { BibleChapterResponse, Verse } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { BookText, PlusCircle } from 'lucide-react';
import { AiInsightGenerator } from './ai-insight-generator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

function VerseAnnotation({ verse, fullReference }: { verse: Verse; fullReference: string }) {
  const [annotation, setAnnotation] = useState('');

  return (
    <Collapsible>
      <div className="flex flex-col gap-2 border-l-2 border-transparent py-2 pl-4 transition-colors hover:border-primary/50">
        <p className="text-lg leading-relaxed font-body">
          <sup className="font-headline font-bold text-primary mr-2">{verse.verse}</sup>
          {verse.text}
        </p>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Note
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="flex flex-col gap-2 pt-2">
            <Textarea
              placeholder={`Your notes for ${fullReference}:${verse.verse}...`}
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value)}
              className="font-body text-base"
            />
             {annotation && (
                <div className="self-end">
                    <AiInsightGenerator
                        verse={`${fullReference}:${verse.verse} - ${verse.text}`}
                        annotation={annotation}
                    />
                </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}


export function BibleDisplay({ chapterData }: { chapterData: BibleChapterResponse }) {
    const [chapterNotes, setChapterNotes] = useState('');

    return (
        <div className="mt-6 grid md:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <div className="md:col-span-1">
                <div className="sticky top-6 z-10">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl flex items-center gap-3">
                                <BookText className="text-primary" />
                                Chapter Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             <Textarea
                                placeholder={`Write your notes for ${chapterData.reference} here...`}
                                value={chapterNotes}
                                onChange={(e) => setChapterNotes(e.target.value)}
                                rows={10}
                                className="font-body text-base"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
            <div className="md:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-3xl">{chapterData.reference}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {chapterData.verses.map((verse) => (
                                <VerseAnnotation key={verse.verse} verse={verse} fullReference={chapterData.reference} />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}