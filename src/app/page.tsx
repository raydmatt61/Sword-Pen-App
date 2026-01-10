import { Suspense } from 'react';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse } from '@/lib/bible';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

async function getChapter(
  book: string,
  chapter: string,
  translation: string,
  retries = 1
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
        if (retries > 0) {
            console.log(`Retrying fetch for ${book} ${chapter}...`);
            await new Promise(res => setTimeout(res, 1000)); // Wait 1 second before retrying
            return getChapter(book, chapter, translation, retries - 1);
        }
        return null;
    }
    const data = await response.json();
    // Sometimes the API returns an empty response for BSB, so we check for that.
    if (!data || !data.verses || data.verses.length === 0) {
        if (retries > 0) {
            console.log(`Retrying fetch for ${book} ${chapter} (empty response)...`);
            await new Promise(res => setTimeout(res, 1000));
            return getChapter(book, chapter, translation, retries - 1);
        }
        return null;
    }
    return data;
  } catch (error) {
    console.error('Failed to fetch chapter:', error);
    if (retries > 0) {
        console.log(`Retrying fetch for ${book} ${chapter} (catch block)...`);
        await new Promise(res => setTimeout(res, 1000));
        return getChapter(book, chapter, translation, retries - 1);
    }
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
            Could not load chapter. The selected translation may not be available for this book, or there was a network issue. Please try a different book, chapter, or translation.
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
