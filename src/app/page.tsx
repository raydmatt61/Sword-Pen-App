
"use client";

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book, Translation, CrossRefChapterResponse, ChapterContentItem, VerseContent } from '@/lib/bible';
import { BIBLE_BOOKS_ABBR, TRANSLATIONS, OLD_TESTAMENT_BOOK_NAMES, NEW_TESTAMENT_BOOK_NAMES } from '@/lib/bible';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthManager } from '@/components/auth-manager';
import { QrCodeGenerator } from '@/components/qr-code-generator';
import { AnnotationWrapper } from '@/components/annotation-wrapper';
import { FontSizeAdjuster } from '@/components/font-size-adjuster';
import { AnnotationProvider } from '@/contexts/annotation-context';
import { useToast } from '@/hooks/use-toast';

const API_BIBLE_IDS = {
    CSB: '55212e3cf5d04d49-01',
    NIV: 'de4e12af7f28f599-01',
    NASB: 'a6a7991bff536a0f-01',
};
const API_BIBLE_TRANSLATIONS = Object.keys(API_BIBLE_IDS);

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


async function getChapterFromApiBible(
  book: string,
  chapter: string,
  translationId: keyof typeof API_BIBLE_IDS
): Promise<BibleChapterResponse | null> {
  const bibleId = API_BIBLE_IDS[translationId];
  const bookAbbr = BIBLE_BOOKS_ABBR[book];
  if (!bookAbbr) {
    console.error(`Invalid book name for api.bible: ${book}`);
    return null;
  }

  const chapterId = `${bookAbbr}.${chapter}`;
  const apiKey = process.env.NEXT_PUBLIC_API_BIBLE_KEY || "n-eVwCRekVC0-oL2B6_s3"; // Fallback for client

  if (!apiKey) {
    console.error("API key for api.bible is not configured.");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.scripture.api.bible/v1/bibles/${bibleId}/chapters/${chapterId}?content-type=json&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=true`,
      {
        headers: {
          'api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error(`api.bible request failed for ${chapterId}: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(errorText);
      return null;
    }

    const json = await response.json();
    const data = json.data;

    const chapterContent: ChapterContentItem[] = [];
    if (data && Array.isArray(data.content)) {
      data.content.forEach(item => {
        if (item.type !== 'tag' || item.name !== 'para' || !Array.isArray(item.items)) {
          return;
        }

        if (item.attrs.style === 'h') {
          chapterContent.push({
            type: 'heading',
            content: [item.items[0]?.text || ''],
          });
        } else {
          item.items.forEach(p_item => {
            if (p_item.type === 'tag' && p_item.name === 'verse' && p_item.attrs?.number) {
              const verseNumber = parseInt(p_item.attrs.number, 10);
              if (isNaN(verseNumber)) return;

              const verseItems: VerseContent[] = [];
              if (Array.isArray(p_item.items)) {
                p_item.items.forEach(v_item => {
                  if (v_item.type === 'text' && typeof v_item.text === 'string') {
                    verseItems.push(v_item.text);
                  }
                });
              }

              const collapsedVerseItems: VerseContent[] = verseItems.join(' ').trim() ? [verseItems.join(' ').trim()] : [];

              chapterContent.push({
                type: 'verse',
                number: verseNumber,
                content: collapsedVerseItems,
              });
            }
          });
        }
      });
    }
    
    const result: BibleChapterResponse = {
      book: {
        name: book,
        id: bookAbbr,
      },
      chapter: {
        number: parseInt(chapter, 10),
        content: chapterContent,
      },
      translation: {
        name: TRANSLATIONS.find(t => t.id === translationId)?.name || translationId,
        id: translationId,
      },
      copyright: data.copyright,
    };

    return result;

  } catch (error) {
    console.error(`Failed to fetch or parse from api.bible for ${chapterId}:`, error);
    return null;
  }
}


async function getChapter(
  book: string,
  chapter: string,
  translationId: string,
  isFallbackAttempt = false
): Promise<BibleChapterResponse | null> {
  if (API_BIBLE_TRANSLATIONS.includes(translationId)) {
    return getChapterFromApiBible(book, chapter, translationId as keyof typeof API_BIBLE_IDS);
  }
  
  const bookNameAliases: Record<string, string> = {
    'Song of Songs': 'Song of Solomon',
  };
  const canonicalBook = bookNameAliases[book] || book;
  const bookId = BIBLE_BOOKS_ABBR[canonicalBook] || canonicalBook;

  let attempts = 0;
  const maxRetries = 3;
  const delay = 1000; // 1 second
  
  while (attempts < maxRetries) {
    try {
      const response = await fetch(
        `https://bible.helloao.org/api/${translationId}/${bookId}/${chapter}.json`
      );

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const text = await response.text();
            if(!text) {
                console.warn(`API returned an empty response for ${translationId}/${bookId}/${chapter}. Will retry.`);
            } else {
                const data = JSON.parse(text);
                if (data && data.chapter && data.chapter.content) {
                    return data as BibleChapterResponse;
                }
            }
        } else {
             console.warn(`API Warning: Expected JSON but received ${contentType} for ${translationId}/${bookId}/${chapter}. Will retry.`);
        }
      } else {
        if (response.status !== 404) { // Don't warn for 404s, which are expected for some translation/book combos
          console.warn(`API Error for ${translationId}/${bookId}/${chapter}: ${response.status} ${response.statusText}. Will retry.`);
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch chapter (attempt ${attempts + 1}):`, error);
    }
    
    attempts++;
    if (attempts < maxRetries) {
      await new Promise(res => setTimeout(res, delay));
    }
  }

  // If all attempts fail, try to fall back to a more reliable translation if this wasn't already a fallback attempt.
  if (!isFallbackAttempt && translationId !== 'BSB') {
      console.warn(`Failed to load ${book} ${chapter} in ${translationId}. Attempting to fall back to BSB translation.`);
      const fallbackChapter = await getChapter(book, chapter, 'BSB', true);
      if (fallbackChapter) {
          return fallbackChapter;
      }
  }

  // If all attempts (including fallback) fail, return null.
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
    if (chapterData && chapterData.translation.id !== initialTranslationId && !API_BIBLE_TRANSLATIONS.includes(initialTranslationId)) {
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
                  Could not load chapter <span className="font-bold">{initialBook} {initialChapter}</span> ({TRANSLATIONS.find(t=>t.id === initialTranslationId)?.name || initialTranslationId}).
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
    

    



    

    


    

    
