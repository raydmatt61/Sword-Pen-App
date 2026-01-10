
import { Suspense } from 'react';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book, Translation as TranslationType } from '@/lib/bible';
import { BIBLE_BOOKS_ABBR, TRANSLATIONS } from '@/lib/bible';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthManager } from '@/components/auth-manager';
import { QrCodeGenerator } from '@/components/qr-code-generator';

async function getChapter(
  book: string,
  chapter: string,
  translation: string
): Promise<BibleChapterResponse | null> {
  let attempts = 0;
  const maxRetries = 3;
  const delay = 1000; // 1 second

  while (attempts < maxRetries) {
    try {
      // CRITICAL FIX: Ensure we use the abbreviation for the API call.
      const bookId = BIBLE_BOOKS_ABBR[book] || book;
      const response = await fetch(
        `https://bible.helloao.org/api/${translation}/${bookId}/${chapter}.json`
      );

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            // Add a check to ensure the response is valid JSON with expected structure
            if (data && data.chapter && data.chapter.content) {
                return data;
            }
        } else {
             console.error(`API Error: Expected JSON but received ${contentType} for ${translation}/${bookId}/${chapter}`);
        }
      } else {
        console.error(`API Error for ${translation}/${bookId}/${chapter}: ${response.status} ${response.statusText}`);
      }
      // If not ok or not JSON, fall through to retry
    } catch (error) {
      console.error('Failed to fetch chapter (attempt ' + (attempts + 1) + '):', error);
      // Fall through to retry
    }
    
    attempts++;
    if (attempts < maxRetries) {
      await new Promise(res => setTimeout(res, delay));
    }
  }

  console.error(`Failed to fetch chapter after ${maxRetries} attempts.`);
  return null;
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

  if (!chapterData) {
    const translationName = TRANSLATIONS.find(t => t.id === translation)?.englishName || translation;
    return (
      <Card className="mt-6 animate-in fade-in duration-500">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Could not load chapter <span className="font-bold">{book} {chapter}</span> in the <span className="font-bold">{translationName}</span> translation.
            This may be due to a network issue or the translation not being available for this book. Please try a different selection.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <BibleDisplay chapterData={chapterData} />;
}

async function getBooks(translation: string): Promise<Book[]> {
  try {
    const booksRes = await fetch(`https://bible.helloao.org/api/${translation}/books.json`);
    if (!booksRes.ok) {
      console.error(`Failed to fetch books for ${translation}: ${booksRes.status}`);
      return [];
    }
    // Check content type before parsing as JSON
    const contentType = booksRes.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        const booksData = await booksRes.json();
        return booksData.books || [];
    } else {
        console.error(`Expected JSON but received ${contentType} for ${translation}`);
        return [];
    }
  } catch (error) {
    console.error(`Error fetching books for ${translation}:`, error);
    return [];
  }
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
  const translation = searchParams?.translation || 'BSB';
  const book = searchParams?.book || 'John';
  const chapter = searchParams?.chapter || '1';

  // Fetch the list of books for the selected (or default) translation.
  const books = await getBooks(translation);
  
  // If for some reason the books list is empty, we can't proceed.
  // We can show an error or a limited UI. For now, we'll pass an empty array.

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
        <div className="flex items-center gap-2">
            <QrCodeGenerator />
            <AuthManager />
        </div>
      </header>

      <VerseSelector 
        defaultValues={{ book, chapter, translation }}
        books={books}
        translations={TRANSLATIONS}
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
