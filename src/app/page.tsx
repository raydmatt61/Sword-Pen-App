"use client";

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book, Translation, ChapterContentItem, CrossRefChapterResponse } from '@/lib/bible';
import { BIBLE_BOOKS_ABBR, TRANSLATIONS, OLD_TESTAMENT_BOOK_NAMES, NEW_TESTAMENT_BOOK_NAMES, BIBLE_ABBR_BOOKS } from '@/lib/bible';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthManager } from '@/components/auth-manager';
import { QrCodeGenerator } from '@/components/qr-code-generator';
import { AnnotationWrapper } from '@/components/annotation-wrapper';
import { FontSizeAdjuster } from '@/components/font-size-adjuster';
import { AnnotationProvider } from '@/contexts/annotation-context';
import { useToast } from '@/hooks/use-toast';

async function getCrossReferences(
  book: string,
  chapter: string,
): Promise<CrossRefChapterResponse | null> {
  // Aliasing for different book names (e.g. Song of Songs vs Song of Solomon)
  const bookNameAliases: Record<string, string> = {
    'Song of Songs': 'Song of Solomon',
  };
  const canonicalBook = bookNameAliases[book] || book;
  const bookId = BIBLE_BOOKS_ABBR[canonicalBook] || canonicalBook;

  try {
    const response = await fetch(
      `https://bible.helloao.org/api/d/open-cross-ref/${bookId}/${chapter}.json`
    );

    if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const text = await response.text();
            if(!text) {
                // The API returned a 200 OK but the body was empty.
                console.warn(`Cross-reference API returned an empty response for ${bookId} ${chapter}.`);
                return null;
            }
            return JSON.parse(text) as CrossRefChapterResponse;
        } else {
            // The API returned a 200 OK but the content-type was not JSON.
            console.warn(`Cross-reference API returned an unexpected content type (${contentType}) for ${bookId} ${chapter}.`);
        }
    } else {
        // The API returned a non-200 status code.
        console.warn(`Cross-reference API returned status ${response.status} for ${bookId} ${chapter}.`);
    }
  } catch (error) {
    console.error(`Failed to fetch cross-references for ${bookId} ${chapter}:`, error);
  }
  return null;
}


async function getChapter(
  book: string,
  chapter: string,
  translationId: string,
  isFallbackAttempt = false
): Promise<BibleChapterResponse | null> {
  const bookNameAliases: Record<string, string> = {
    'Song of Songs': 'Song of Solomon',
  };
  const canonicalBook = bookNameAliases[book] || book;

  // Use labs.bible.org for NET, KJV, ASV. It is less reliable but has these translations.
  if (['engnet', 'KJV', 'ASV'].includes(translationId)) {
    let attempts = 0;
    const maxRetries = 3;
    const delay = 1000; // 1 second

    while (attempts < maxRetries) {
      try {
        const apiTranslation = translationId === 'engnet' ? 'NET' : translationId;
        const response = await fetch(`https://labs.bible.org/api/?passage=${canonicalBook}+${chapter}&type=json&translation=${apiTranslation}`);

        if (response.ok) {
          const responseText = await response.text();
          if (responseText) {
            const dataFromApi = JSON.parse(responseText);

            if (dataFromApi && Array.isArray(dataFromApi) && dataFromApi.length > 0) {
              const translationInfo = TRANSLATIONS.find(t => t.id === translationId);
              const bookAbbr = BIBLE_BOOKS_ABBR[canonicalBook];

              const chapterContent: ChapterContentItem[] = dataFromApi.map((verse: any) => {
                const cleanText = verse.text.replace(/<[^>]*>/g, '');
                return {
                  type: 'verse',
                  number: verse.verse,
                  content: [cleanText.trim()],
                  'para-break': verse.text.includes('<p>')
                };
              });

              const result: BibleChapterResponse = {
                book: {
                  name: dataFromApi[0].bookname,
                  id: bookAbbr || canonicalBook,
                },
                chapter: {
                  number: parseInt(dataFromApi[0].chapter, 10),
                  content: chapterContent,
                },
                translation: {
                  id: translationId,
                  name: translationInfo?.name || translationId,
                },
              };
              return result; // Success, exit the loop and function
            }
          }
          console.warn(`labs.bible.org returned empty or invalid data on attempt ${attempts + 1} for ${canonicalBook} ${chapter} (${translationId})`);
        } else {
          console.warn(`labs.bible.org API Error on attempt ${attempts + 1} for ${canonicalBook} ${chapter} (${translationId}): ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.warn(`Failed to fetch/parse chapter from labs.bible.org (attempt ${attempts + 1}):`, error);
      }

      attempts++;
      if (attempts < maxRetries) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
    
    // If all retries fail, attempt to fall back to a more reliable translation.
    if (!isFallbackAttempt) {
        console.warn(`Attempting to fall back to BSB translation for ${book} ${chapter}.`);
        const fallbackChapter = await getChapter(book, chapter, 'BSB', true);
        if (fallbackChapter) {
            return fallbackChapter;
        }
    }
    
    // If all attempts (including fallback) fail, return null.
    // The UI will handle displaying an error message.
    return null;
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
             console.warn(`API Warning: Expected JSON but received ${contentType} for ${translationId}/${bookId}/${chapter}. Will retry.`);
        }
      } else {
        console.warn(`API Warning for ${translationId}/${bookId}/${chapter}: ${response.status} ${response.statusText}. Will retry.`);
      }
    } catch (error) {
      console.warn('Failed to fetch chapter (attempt ' + (attempts + 1) + '):', error);
    }
    
    attempts++;
    if (attempts < maxRetries) {
      await new Promise(res => setTimeout(res, delay));
    }
  }

  // If all attempts fail for this API too, return null.
  return null;
}

async function fetchBooksForTranslation(): Promise<Omit<Book, 'testament'>[] | null> {
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
    const booksFromApi = await fetchBooksForTranslation();
    if (!booksFromApi) return [];
    
    return booksFromApi.map(book => {
        let testament: 'OT' | 'NT' | undefined = undefined;
        if (OLD_TESTAMENT_BOOK_NAMES.includes(book.commonName)) {
            testament = 'OT';
        } else if (NEW_TESTAMENT_BOOK_NAMES.includes(book.commonName)) {
            testament = 'NT';
        }
        return {
            ...book,
            testament: testament
        };
    }).filter(book => !!book.testament) as Book[];
}

function PageContent({ books, chapterData, crossRefs, initialBook, initialChapter, initialTranslationId }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const providerKey = `${initialBook}-${initialChapter}-${initialTranslationId}`;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const maxChapters = useMemo(() => {
    return books.find(b => b.commonName === initialBook)?.numberOfChapters || 1;
  }, [books, initialBook]);
  
  useEffect(() => {
    if (chapterData && chapterData.translation.id !== initialTranslationId) {
        toast({
            title: "Translation Fallback",
            description: `Could not load ${initialBook} ${initialChapter} in ${TRANSLATIONS.find(t=>t.id === initialTranslationId)?.name || initialTranslationId}. Displaying in BSB instead.`,
        });
    }
  }, [chapterData, initialTranslationId, initialBook, initialChapter, toast]);

  const searchParamsString = searchParams.toString();
  const navigate = useCallback((newValues: Partial<{ book: string; chapter: string; translation: string }>) => {
    const current = new URLSearchParams(searchParamsString);
    for (const [key, value] of Object.entries(newValues)) {
        if (value) {
            current.set(key, value);
        }
    }
    const newSearch = current.toString();
    router.push(`${pathname}?${newSearch}`);
  }, [router, pathname, searchParamsString]);

  const handleChapterNav = useCallback((direction: 'prev' | 'next') => {
    let currentChapter = parseInt(initialChapter);
    if (direction === 'prev' && currentChapter > 1) {
        currentChapter--;
    }
    if (direction === 'next' && currentChapter < maxChapters) {
        currentChapter++;
    }
    const newChapter = currentChapter.toString();
    navigate({ chapter: newChapter });
  }, [initialChapter, maxChapters, navigate]);
  
  useEffect(() => {
    // Scroll to top when book or chapter changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [initialBook, initialChapter, initialTranslationId]);

  return (
    <AnnotationProvider key={providerKey} chapterData={chapterData}>
      <main className="flex flex-col h-screen">
        <header className="flex items-center justify-between border-b p-2 md:p-4">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xl md:text-2xl font-headline font-bold text-primary">
                Sword and Pen Bible
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
                navigate={navigate}
            />
          </div>
          <div className="md:col-span-2">
            {chapterData && <AnnotationWrapper />}
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
              crossRefs={crossRefs}
              onChapterNav={handleChapterNav}
              navigate={navigate}
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
  const [crossRefs, setCrossRefs] = useState<CrossRefChapterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [booksData, chapterContent, crossRefData] = await Promise.all([
        getBooks(),
        getChapter(book, chapter, translationId),
        getCrossReferences(book, chapter),
      ]);
      setBooks(booksData);
      setChapterData(chapterContent);
      setCrossRefs(crossRefData);
      setIsLoading(false);
    }
    loadData();
  }, [book, chapter, translationId]);

  if (isLoading) {
    return <FullPageSkeleton />;
  }

  return <PageContent books={books} chapterData={chapterData} crossRefs={crossRefs} initialBook={book} initialChapter={chapter} initialTranslationId={translationId} />;
}

const LAST_LOCATION_KEY = 'verse-insights-last-location';

function PageWithSearchParams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const book = searchParams.get('book') || 'John';
  const chapter = searchParams.get('chapter') || '1';
  const translationUrlParam = searchParams.get('translation') || 'BSB';
  const queryKey = `${book}-${chapter}-${translationUrlParam}`;
  
  // This state is just to prevent a flash of default content on initial load
  // if there are no search params and we need to load from local storage.
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!searchParams.has('book')) {
      const savedLocationRaw = localStorage.getItem(LAST_LOCATION_KEY);
      if (savedLocationRaw) {
        try {
          const savedLocation = JSON.parse(savedLocationRaw);
          // Replace URL and let the component re-render with new params.
          router.replace(`${pathname}?book=${savedLocation.book}&chapter=${savedLocation.chapter}&translation=${savedLocation.translationId}`);
        } catch (e) {
          console.error("Failed to parse last location from localStorage", e);
          setIsReady(true);
        }
      } else {
        setIsReady(true);
      }
    } else {
      setIsReady(true);
    }
  }, [searchParams, router, pathname]);
  
  // Save to localStorage whenever the effective location changes.
  useEffect(() => {
    // Only save if the book param is present, to avoid overwriting on initial load before redirect.
    if (searchParams.has('book')) {
      const location = { book, chapter, translationId: translationUrlParam };
      localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location));
    }
  }, [book, chapter, translationUrlParam, searchParams]);
  
  const translation = TRANSLATIONS.find(t => t.id === translationUrlParam) || TRANSLATIONS[0];

  if (!isReady) {
    return <FullPageSkeleton />;
  }
  
  return <ChapterLoader key={queryKey} book={book} chapter={chapter} translationId={translation.id} />
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
              Sword and Pen Bible
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
    

    



    

    


    
