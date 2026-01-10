import { Suspense } from 'react';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse } from '@/lib/bible';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

async function getChapter(
  book: string,
  chapter: string,
  translation: string
): Promise<BibleChapterResponse | null> {
  try {
    const response = await fetch(
      `https://bible-api.com/${book}+${chapter}?translation=${translation}`,
      { cache: 'no-store' }
    );
    if (!response.ok) {
      if (response.status !== 404) {
        console.error(`API Error: ${response.status} ${response.statusText}`);
      }
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch chapter:', error);
    return null;
  }
}

async function ChapterLoader({
  book,
  chapter,
  translation,
}: {
  book: string;
  chapter: string;
  translation: string;
}) {
  const chapterData = await getChapter(book, chapter, translation);

  if (!chapterData || chapterData.verses.length === 0) {
    return (
      <Card className="mt-6 animate-in fade-in duration-500">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Select a book and chapter to begin, or check your selection.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <BibleDisplay chapterData={chapterData} />;
}

export default function Home({
  searchParams,
}: {
  searchParams?: {
    book?: string;
    chapter?: string;
    translation?: string;
  };
}) {
  const book = searchParams?.book || 'John';
  const chapter = searchParams?.chapter || '3';
  const translation = searchParams?.translation || 'bsb';

  return (
    <main className="container mx-auto px-4 py-8 md:py-12">
      <header className="text-center mb-8 animate-in fade-in duration-500">
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-primary">
          Verse Insights
        </h1>
        <p className="text-lg text-muted-foreground mt-2 font-headline">
          Deepen your biblical understanding with AI-powered insights.
        </p>
      </header>

      <VerseSelector defaultValues={{ book, chapter, translation }} />

      <Suspense fallback={<BibleDisplaySkeleton />}>
        <ChapterLoader book={book} chapter={chapter} translation={translation} />
      </Suspense>
    </main>
  );
}

function BibleDisplaySkeleton() {
  return (
    <Card className="mt-6">
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardContent>
    </Card>
  );
}
