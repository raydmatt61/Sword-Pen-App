
"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book, Translation } from '@/lib/bible';
import { BIBLE_BOOKS_ABBR, TRANSLATIONS } from '@/lib/bible';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthManager } from '@/components/auth-manager';
import { QrCodeGenerator } from '@/components/qr-code-generator';
import { AnnotationWrapper } from '@/components/annotation-wrapper';
import { FontSizeAdjuster } from '@/components/font-size-adjuster';
import { AnnotationProvider } from '@/contexts/annotation-context';

async function getChapter(
  book: string,
  chapter: string,
  translationId: string,
): Promise<BibleChapterResponse | null> {
  let attempts = 0;
  const maxRetries = 3;
  const delay = 1000; // 1 second
  
  while (attempts < maxRetries) {
    try {
      const bookId = BIBLE_BOOKS_ABBR[book] || book;
      const response = await fetch(
        `https://bible.helloao.org/api/${translationId}/${bookId}/${chapter}.json`
      );

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (data && data.chapter && data.chapter.content) {
                return data;
            }
        } else {
             console.error(`API Error: Expected JSON but received ${contentType} for ${translationId}/${bookId}/${chapter}`);
             break;
        }
      } else {
        console.error(`API Error for ${translationId}/${bookId}/${chapter}: ${response.status} ${response.statusText}`);
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

async function fetchBooksForTranslation(translationId: string): Promise<Book[] | null> {
    try {
        const booksRes = await fetch(`https://bible.helloao.org/api/${translationId}/books.json`);
        if (!booksRes.ok) {
            console.error(`Failed to fetch books for ${translationId}: ${booksRes.status}`);
            return null;
        }
        const contentType = booksRes.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const booksData = await booksRes.json();
            return booksData.books || null;
        } else {
            console.error(`Expected JSON for books list but received ${contentType} for ${translationId}`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching books for ${translationId}:`, error);
        return null;
    }
}

async function getBooks(translationId: string): Promise<Book[]> {
    const books = await fetchBooksForTranslation(translationId);
    return books || [];
}

function PageContent({ books, chapterData, initialBook, initialChapter, initialTranslationId }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const providerKey = `${initialBook}-${initialChapter}-${initialTranslationId}`;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const maxChapters = books.find(b => b.commonName === initialBook)?.numberOfChapters || 1;

  const navigate = useCallback((newValues: Partial<{ book: string; chapter: string; translation: string }>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    for (const [key, value] of Object.entries(newValues)) {
        if (value) {
            current.set(key, value);
        }
    }
    const newSearch = current.toString();
    router.push(`${pathname}?${newSearch}`);
  }, [router, pathname, searchParams]);

  const handleChapterNav = (direction: 'prev' | 'next') => {
    let currentChapter = parseInt(initialChapter);
    if (direction === 'prev' && currentChapter > 1) {
        currentChapter--;
    }
    if (direction === 'next' && currentChapter < maxChapters) {
        currentChapter++;
    }
    const newChapter = currentChapter.toString();
    navigate({ chapter: newChapter });
  };
  
  useEffect(() => {
    // Scroll to top when book or chapter changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [initialBook, initialChapter, initialTranslationId]);

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
            <FontSizeAdjuster />
            <QrCodeGenerator />
            <AuthManager />
          </div>
        </header>

        <div className="sticky top-0 z-20 grid grid-cols-1 md:grid-cols-2 gap-4 bg-background/80 backdrop-blur-sm p-4 border-b">
          <VerseSelector
              defaultValues={{ book: initialBook, chapter: initialChapter, translation: initialTranslationId }}
              books={books}
              translations={TRANSLATIONS}
              onChapterNav={handleChapterNav}
              maxChapters={maxChapters}
              navigate={navigate}
          />
          {chapterData && <AnnotationWrapper chapterData={chapterData} />}
        </div>

        <div ref={contentRef} className="flex-grow overflow-y-auto p-4">
          {!chapterData ? (
            <Card className="mt-6 animate-in fade-in duration-500">
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Could not load chapter <span className="font-bold">{initialBook} {initialChapter}</span> ({initialTranslationId}).
                  This may be due to a network issue or the chapter not being available in this translation. Please try a different selection.
                </p>
              </CardContent>
            </Card>
          ) : (
            <BibleDisplay chapterData={chapterData} onChapterNav={handleChapterNav} />
          )}
        </div>
      </main>
    </AnnotationProvider>
  );
}

function ChapterLoader({ book, chapter, translationId }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [chapterData, setChapterData] = useState<BibleChapterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveTranslation = TRANSLATIONS.find(t => t.id === translationId) || TRANSLATIONS[0];

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const booksData = await getBooks(effectiveTranslation.id);
      const chapterContent = await getChapter(book, chapter, effectiveTranslation.id);
      setBooks(booksData);
      setChapterData(chapterContent);
      setIsLoading(false);
    }
    loadData();
  }, [book, chapter, effectiveTranslation]);

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

  return <PageContent books={books} chapterData={chapterData} initialBook={book} initialChapter={chapter} initialTranslationId={translationId} />;
}

function PageWithSearchParams() {
  const searchParams = useSearchParams();
  const book = searchParams.get('book') || 'John';
  const chapter = searchParams.get('chapter') || '1';
  const translationUrlParam = searchParams.get('translation') || 'BSB';

  const translation = TRANSLATIONS.find(t => t.id === translationUrlParam) || TRANSLATIONS[0];
  
  return <ChapterLoader book={book} chapter={chapter} translationId={translation.id} />
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
