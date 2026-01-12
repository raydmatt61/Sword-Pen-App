
"use client";

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book } from '@/lib/bible';
import { BIBLE_BOOKS_ABBR } from '@/lib/bible';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthManager } from '@/components/auth-manager';
import { QrCodeGenerator } from '@/components/qr-code-generator';
import { AnnotationWrapper } from '@/components/annotation-wrapper';
import { useIsMobile } from '@/hooks/use-mobile';
import { FontSizeAdjuster } from '@/components/font-size-adjuster';
import { AnnotationProvider } from '@/contexts/annotation-context';

async function getChapter(
  book: string,
  chapter: string,
): Promise<BibleChapterResponse | null> {
  let attempts = 0;
  const maxRetries = 3;
  const delay = 1000; // 1 second
  const translation = 'BSB';

  while (attempts < maxRetries) {
    try {
      const bookId = BIBLE_BOOKS_ABBR[book] || book;
      const response = await fetch(
        `https://bible.helloao.org/api/${translation}/${bookId}/${chapter}.json`
      );

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (data && data.chapter && data.chapter.content) {
                return data;
            }
        } else {
             console.error(`API Error: Expected JSON but received ${contentType} for ${translation}/${bookId}/${chapter}`);
             break;
        }
      } else {
        console.error(`API Error for ${translation}/${bookId}/${chapter}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to fetch chapter (attempt ' + (attempts + 1) + '):', error);
    }
    
    attempts++;
    if (attempts < maxRetries) {
      await new Promise(res => setTimeout(res, delay));
    }
  }

  console.error(`Failed to fetch chapter after ${maxRetries} attempts.`);
  return null;
}

async function fetchBooksForTranslation(): Promise<Book[] | null> {
    try {
        const booksRes = await fetch(`https://bible.helloao.org/api/BSB/books.json`);
        if (!booksRes.ok) {
            console.error(`Failed to fetch books for BSB: ${booksRes.status}`);
            return null;
        }
        const contentType = booksRes.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const booksData = await booksRes.json();
            return booksData.books || null;
        } else {
            console.error(`Expected JSON for books list but received ${contentType} for BSB`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching books for BSB:`, error);
        return null;
    }
}

async function getBooks(): Promise<Book[]> {
    const books = await fetchBooksForTranslation();
    return books || [];
}

function PageContent({ books, chapterData, initialBook, initialChapter }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const providerKey = `${initialBook}-${initialChapter}`;
  
  useEffect(() => {
    // Scroll to top when book or chapter changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [initialBook, initialChapter]);

  return (
    <AnnotationProvider key={providerKey}>
      <main className="flex flex-col h-screen">
        <header className="flex items-center justify-between border-b p-2 md:p-4">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xl md:text-2xl font-headline font-bold text-primary">
                The Sword & Pen
              </h1>
              <p className="text-xs text-muted-foreground mt-1 font-headline">
                Deepen your Bible study with annotations, notes and AI-powered insights.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isMobile && <FontSizeAdjuster />}
            <QrCodeGenerator />
            <AuthManager />
          </div>
        </header>

        <div className="sticky top-0 z-20 grid grid-cols-1 md:grid-cols-2 gap-4 bg-background/80 backdrop-blur-sm p-4 border-b">
          <VerseSelector
              defaultValues={{ book: initialBook, chapter: initialChapter }}
              books={books}
          />
          {chapterData && <AnnotationWrapper chapterData={chapterData} />}
        </div>

        <div ref={contentRef} className="flex-grow overflow-y-auto p-4">
          {!chapterData ? (
            <Card className="mt-6 animate-in fade-in duration-500">
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Could not load chapter <span className="font-bold">{initialBook} {initialChapter}</span>.
                  This may be due to a network issue. Please try a different selection.
                </p>
              </CardContent>
            </Card>
          ) : (
            <BibleDisplay chapterData={chapterData} />
          )}
        </div>
      </main>
    </AnnotationProvider>
  );
}

function ChapterLoader({ book, chapter }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [chapterData, setChapterData] = useState<BibleChapterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const booksData = await getBooks();
      const chapterContent = await getChapter(book, chapter);
      setBooks(booksData);
      setChapterData(chapterContent);
      setIsLoading(false);
    }
    loadData();
  }, [book, chapter]);

  if (isLoading) {
    return (
      <main className="flex flex-col h-screen">
         <header className="flex items-center justify-between border-b p-2 md:p-4">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xl md:text-2xl font-headline font-bold text-primary">
                The Sword & Pen
              </h1>
              <p className="text-xs text-muted-foreground mt-1 font-headline">
                Deepen your Bible study with annotations, notes and AI-powered insights.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-24" />
          </div>
        </header>
        
        <div className="sticky top-0 z-20 flex flex-col gap-4 bg-background/80 backdrop-blur-sm p-4 border-b">
           <Skeleton className="h-24 w-full" />
           <Skeleton className="h-48 w-full" />
        </div>
  
        <div className="flex-grow overflow-y-auto p-4">
           <BibleDisplaySkeleton />
        </div>
      </main>
    );
  }

  return <PageContent books={books} chapterData={chapterData} initialBook={book} initialChapter={chapter} />;
}

function PageWithSearchParams() {
  const searchParams = useSearchParams();
  const book = searchParams.get('book') || 'John';
  const chapter = searchParams.get('chapter') || '1';

  return <ChapterLoader book={book} chapter={chapter} />
}

export default function Home() {
  return (
    <Suspense fallback={<BibleDisplaySkeleton />}>
      <PageWithSearchParams />
    </Suspense>
  );
}

function BibleDisplaySkeleton() {
  return (
    <Card>
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
