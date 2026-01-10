
import { Suspense } from 'react';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book } from '@/lib/bible';
import { BIBLE_BOOKS_ABBR } from '@/lib/bible';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthManager } from '@/components/auth-manager';

async function getChapter(
  book: string,
  chapter: string,
  translation: string
): Promise<BibleChapterResponse | null> {
  try {
    const bookId = BIBLE_BOOKS_ABBR[book] || book;
    const response = await fetch(
      `https://bible.helloao.org/api/${translation}/${bookId}/${chapter}.json`
    );
    if (!response.ok) {
        console.error(`API Error: ${response.status} ${response.statusText}`);
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

  if (!chapterData || !chapterData.chapter || !chapterData.chapter.content) {
    return (
      <Card className="mt-6 animate-in fade-in duration-500">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Could not load chapter <span className="font-bold">{book} {chapter}</span> in the <span className="font-bold">{translation.toUpperCase()}</span> translation.
            This may be due to a network issue or the translation not being available for this book. Please try a different selection.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <BibleDisplay chapterData={chapterData} />;
}

export default async function Home({
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
  const translation = searchParams?.translation || 'BSB';

  const booksRes = await fetch(`https://bible.helloao.org/api/${translation}/books.json`);
  const books: Book[] = await booksRes.json().then(d => d.books);

  return (
    <main className="container mx-auto px-4 py-8 md:py-12">
       <header className="text-center mb-8 animate-in fade-in duration-500 flex justify-between items-center">
        <div></div>
        <div>
            <h1 className="text-4xl md:text-5xl font-headline font-bold text-primary">
            Verse Insights
            </h1>
            <p className="text-lg text-muted-foreground mt-2 font-headline">
            Deepen your biblical understanding with AI-powered insights.
            </p>
        </div>
        <AuthManager />
      </header>


      <VerseSelector 
        defaultValues={{ book, chapter, translation }}
        books={books}
      />

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
