
"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book, Translation, ChapterContentItem } from '@/lib/bible';
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
  const bookNameAliases: Record<string, string> = {
    'Song of Songs': 'Song of Solomon',
  };
  const canonicalBook = bookNameAliases[book] || book;

  // Use labs.bible.org for NET translation
  if (translationId === 'engnet') {
    try {
      const response = await fetch(`https://labs.bible.org/api/?passage=${canonicalBook}+${chapter}&type=json&formatting=full`);
      if (!response.ok) {
        console.error(`labs.bible.org API Error for ${canonicalBook} ${chapter}: ${response.status} ${response.statusText}`);
        return null;
      }
      const netData = await response.json();
      if (!netData || !Array.isArray(netData) || netData.length === 0) {
        console.error(`labs.bible.org returned no data for ${canonicalBook} ${chapter}`);
        return null;
      }
      
      const translationInfo = TRANSLATIONS.find(t => t.id === 'engnet');
      const bookAbbr = BIBLE_BOOKS_ABBR[canonicalBook];

      // Join all verse HTML content into a single string for paragraph rendering,
      // prepending the verse number to each verse's text.
      const fullHtmlContent = netData.map((verse: any) => 
        `<sup class="font-headline font-bold text-primary mr-1 select-none">${verse.verse}</sup> ${verse.text}`
      ).join(' ');
      const copyright = netData.length > 0 ? netData[0].copyright : undefined;


      const result: BibleChapterResponse = {
        book: {
          name: netData[0].bookname,
          id: bookAbbr || canonicalBook,
        },
        chapter: {
          number: parseInt(netData[0].chapter, 10),
          content: [], // Individual verses not needed for this display method
          htmlContent: fullHtmlContent
        },
        translation: {
          id: 'engnet',
          name: translationInfo?.name || 'New English Translation',
        },
        copyright: copyright,
      };
      return result;
    } catch (error) {
      console.error('Failed to fetch NET chapter from labs.bible.org:', error);
      return null;
    }
  }

  // Original logic for other translations
  let attempts = 0;
  const maxRetries = 3;
  const delay = 1000; // 1 second
  
  while (attempts < maxRetries) {
    try {
      const bookId = BIBLE_BOOKS_ABBR[canonicalBook] || canonicalBook;
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

async function fetchBooksForTranslation(): Promise<Book[] | null> {
    const bookListTranslation = 'BSB'; // Always use BSB for a reliable book list
    try {
        const booksRes = await fetch(`https://bible.helloao.org/api/${bookListTranslation}/books.json`);
        if (!booksRes.ok) {
            console.error(`Failed to fetch books for ${bookListTranslation}: ${booksRes.status}`);
            return null;
        }
        const contentType = booksRes.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const booksData = await booksRes.json();
            return booksData.books || null;
        } else {
            console.error(`Expected JSON for books list but received ${contentType} for ${bookListTranslation}`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching books for ${bookListTranslation}:`, error);
        return null;
    }
}

async function getBooks(): Promise<Book[]> {
    const books = await fetchBooksForTranslation();
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

        <div className="sticky top-0 z-20 grid grid-cols-1 md:grid-cols-5 gap-4 bg-background/80 backdrop-blur-sm p-4 border-b">
          <div className="md:col-span-3">
            <VerseSelector
                defaultValues={{ book: initialBook, chapter: initialChapter, translation: initialTranslationId }}
                books={books}
                translations={TRANSLATIONS}
                onChapterNav={handleChapterNav}
                maxChapters={maxChapters}
                navigate={navigate}
            />
          </div>
          <div className="md:col-span-2">
            {chapterData && <AnnotationWrapper chapterData={chapterData} />}
          </div>
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
            <BibleDisplay
              chapterData={chapterData}
              onChapterNav={handleChapterNav}
              currentChapter={parseInt(initialChapter)}
              maxChapters={maxChapters}
            />
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
      const booksData = await getBooks();
      const chapterContent = await getChapter(book, chapter, effectiveTranslation.id);
      setBooks(booksData);
      setChapterData(chapterContent);
      setIsLoading(false);
    }
    loadData();
  }, [book, chapter, effectiveTranslation]);

  if (isLoading) {
    return <FullPageSkeleton />;
  }

  return <PageContent books={books} chapterData={chapterData} initialBook={book} initialChapter={chapter} initialTranslationId={translationId} />;
}

const LAST_LOCATION_KEY = 'verse-insights-last-location';

function PageWithSearchParams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // On first client-side render, check if we need to load from localStorage.
  useEffect(() => {
    // Only run if there are no query params in the URL.
    if (isInitialLoad && !searchParams.has('book')) {
      const savedLocationRaw = localStorage.getItem(LAST_LOCATION_KEY);
      if (savedLocationRaw) {
        try {
            const savedLocation = JSON.parse(savedLocationRaw);
            // Replace the current URL with the one from storage.
            // This will trigger a re-render where searchParams will have a value.
            router.replace(`${pathname}?book=${savedLocation.book}&chapter=${savedLocation.chapter}&translation=${savedLocation.translationId}`);
        } catch (e) {
            console.error("Failed to parse last location from localStorage", e);
            setIsInitialLoad(false);
        }
      } else {
        // If no saved location, we are done with initial load checks.
        setIsInitialLoad(false);
      }
    } else if (isInitialLoad && searchParams.has('book')) {
       // If params exist on initial load, we are also done.
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, searchParams, router, pathname]);

  const book = searchParams.get('book') || 'John';
  const chapter = searchParams.get('chapter') || '1';
  const translationUrlParam = searchParams.get('translation') || 'BSB';

  // Save to localStorage whenever the effective location changes.
  useEffect(() => {
    // Only save if the book param is present, to avoid overwriting on initial load before redirect.
    if (searchParams.has('book')) {
      const location = { book, chapter, translationId: translationUrlParam };
      localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location));
    }
  }, [book, chapter, translationUrlParam, searchParams]);
  
  const translation = TRANSLATIONS.find(t => t.id === translationUrlParam) || TRANSLATIONS[0];
  
  // If we are on the initial load and there are no search params, we are about to redirect.
  // Show the skeleton to prevent rendering the default content ("John 1") for a split second.
  if (isInitialLoad && !searchParams.has('book')) {
    return <FullPageSkeleton />;
  }
  
  return <ChapterLoader book={book} chapter={chapter} translationId={translation.id} />
}


export default function Home() {
  return (
    <Suspense fallback={<FullPageSkeleton />}>
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

function FullPageSkeleton() {
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
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-10 w-24" />
        </div>
      </header>
      
      <div className="sticky top-0 z-20 grid grid-cols-1 md:grid-cols-5 gap-4 bg-background/80 backdrop-blur-sm p-4 border-b">
        <div className="md:col-span-3">
          <Skeleton className="h-[40px] w-full" />
        </div>
        <div className="md:col-span-2">
          <Skeleton className="h-[56px] w-full" />
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-4">
         <BibleDisplaySkeleton />
      </div>
    </main>
  );
}

    