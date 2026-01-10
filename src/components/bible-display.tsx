"use client";

import { useState } from 'react';
import type { BibleChapterResponse } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Edit, Save, BookText, ChevronDown } from 'lucide-react';
import { AiInsightGenerator } from './ai-insight-generator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type Annotations = {
  [verse: number]: string;
};

export function BibleDisplay({ chapterData }: { chapterData: BibleChapterResponse }) {
  const [chapterNotes, setChapterNotes] = useState('');
  const [annotations, setAnnotations] = useState<Annotations>({});
  const [editingVerse, setEditingVerse] = useState<number | null>(null);
  const [currentNote, setCurrentNote] = useState('');

  const handleEdit = (verse: number) => {
    setEditingVerse(verse);
    setCurrentNote(annotations[verse] || '');
  };

  const handleSave = (verse: number) => {
    setAnnotations(prev => ({...prev, [verse]: currentNote}));
    setEditingVerse(null);
    setCurrentNote('');
  };

  const handleCancel = () => {
    setEditingVerse(null);
    setCurrentNote('');
  }

  return (
    <div className="mt-6 space-y-8 animate-in fade-in duration-500">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">{chapterData.reference}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {chapterData.verses.map((verse) => (
              <div key={verse.verse} className="flex flex-col gap-2 border-l-2 border-transparent py-2 pl-4 transition-colors hover:bg-card">
                <p className="text-lg leading-relaxed font-body">
                  <sup className="font-headline font-bold text-primary mr-2">{verse.verse}</sup>
                  {verse.text}
                </p>
                {editingVerse === verse.verse ? (
                  <div className="space-y-2 mt-2 p-4 bg-muted/50 rounded-md">
                    <Label htmlFor={`note-${verse.verse}`} className="font-headline">Your personal note</Label>
                    <Textarea 
                      id={`note-${verse.verse}`}
                      placeholder="Add your thoughts, questions, or reflections..."
                      value={currentNote}
                      onChange={(e) => setCurrentNote(e.target.value)}
                      className="font-body"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(verse.verse)}>
                        <Save className="mr-2" /> Save Note
                      </Button>
                       <Button size="sm" variant="ghost" onClick={handleCancel}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mt-2">
                    {annotations[verse.verse] ? (
                      <p className="text-muted-foreground italic font-body text-sm flex-1 pt-1 border-l-2 border-accent pl-3">
                         {annotations[verse.verse]}
                      </p>
                    ) : <div className="flex-1"></div>}
                    <div className="flex gap-2 items-center flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(verse.verse)}>
                        <Edit className="mr-2" /> {annotations[verse.verse] ? 'Edit Note' : 'Add Note'}
                      </Button>
                      {annotations[verse.verse] && (
                        <AiInsightGenerator verse={verse.text} annotation={annotations[verse.verse]} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <Collapsible>
          <div className="flex items-center justify-between">
            <CardHeader>
              <CardTitle className="font-headline text-2xl flex items-center gap-3">
                <BookText className="text-primary" />
                Chapter Notes
              </CardTitle>
            </CardHeader>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-4 data-[state=open]:rotate-180 transition-transform">
                <ChevronDown className="h-5 w-5" />
                <span className="sr-only">Toggle Chapter Notes</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <Textarea 
                placeholder="Write your notes for the entire chapter here..."
                value={chapterNotes}
                onChange={(e) => setChapterNotes(e.target.value)}
                rows={5}
                className="font-body"
              />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
