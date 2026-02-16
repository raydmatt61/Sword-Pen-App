
"use client";

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book, Translation, CrossRefChapterResponse, ChapterContentItem, VerseContent, FormattedText } from '@/lib/bible';
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
    CSB: 'a556c5305ee15c3f-01',
    NIV: '78a9f6124f344018-01',
    NASB: 'b8ee27bcd1cae43a-01',
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
                return null;
            }
            return JSON.parse(text) as CrossRefChapterResponse;
        }
    }
  } catch (error) {
    // Silently fail
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
    return null;
  }

  const chapterId = `${bookAbbr}.${chapter}`;
  const apiKey = process.env.NEXT_PUBLIC_API_BIBLE_KEY;

  if (!apiKey) {
    return null;
  }

  // Helper function to recursively parse the content items from api.bible
  const processApiBibleItems = (items: any[]): VerseContent[] => {
    if (!items || !Array.isArray(items)) return [];

    let results: VerseContent[] = [];

    items.forEach(item => {
        if (item.type === 'text' && typeof item.text === 'string') {
            results.push(item.text);
        } else if (item.type === 'tag' && item.name === 'char' && item.attrs?.style === 'woc') {
            // Recursively process "Words of Christ" content
            const wocContent = processApiBibleItems(item.items);
            wocContent.forEach(contentItem => {
                if (typeof contentItem === 'string') {
                    results.push({ text: contentItem, wordsOfJesus: true });
                } else if (typeof contentItem === 'object' && 'text' in contentItem && !('wordsOfJesus' in contentItem)) {
                    // This case handles nested structures
                    results.push({ ...contentItem, wordsOfJesus: true });
                } else {
                    results.push(contentItem); // Already has wordsOfJesus or is not a text node
                }
            });
        }
        // Note: This parser is simplified and doesn't handle all possible USX tags like footnotes.
        // It's focused on text and "Words of Jesus".
    });
    
    // Collapse adjacent strings and FormattedText objects
    if (results.length < 2) {
        return results;
    }

    const collapsed: VerseContent[] = [];
    if (results.length > 0) {
        collapsed.push(results[0]);
    }
    
    for (let i = 1; i < results.length; i++) {
        const current = results[i];
        const last = collapsed[collapsed.length - 1];

        if (typeof current === 'string' && typeof last === 'string') {
            collapsed[collapsed.length - 1] = last + current;
        } else if (
            typeof current === 'object' && 'text' in current && (current as any).wordsOfJesus &&
            typeof last === 'object' && 'text' in last && (last as any).wordsOfJesus
        ) {
            (last as FormattedText).text += (current as FormattedText).text;
        } else {
            collapsed.push(current);
        }
    }

    return collapsed;
  };

  try {
    const response = await fetch(
      `https://rest.api.bible/v1/bibles/${bibleId}/passages/${chapterId}?content-type=json&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true`,
      {
        headers: {
          'api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 403) {
        console.warn(`API.bible request failed with 403 Forbidden for translation ${translationId}. This likely means the API key is not authorized for this translation. Please visit https://api.bible to accept the terms for the translation.`);
      }
      return null;
    }

    const json = await response.json();
    const data = json.data;

    let content_data;
    if (typeof data.content === 'string') {
      try {
        content_data = JSON.parse(data.content);
      } catch (e) {
        console.error("Failed to parse api.bible content string", e);
        return null;
      }
    } else {
      content_data = data.content;
    }

    const chapterContent: ChapterContentItem[] = [];
    if (content_data && Array.isArray(content_data)) {
      content_data.forEach(item => {
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

              const verseContent = processApiBibleItems(p_item.items);

              chapterContent.push({
                type: 'verse',
                number: verseNumber,
                content: verseContent,
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
    // Fail silently
    return null;
  }
}


async function getChapter(
  book: string,
  chapter: string,
  translationId: string,
  isFallbackAttempt = false
): Promise<BibleChapterResponse | null> {
  let chapterData: BibleChapterResponse | null = null;

  if (API_BIBLE_TRANSLATIONS.includes(translationId)) {
    chapterData = await getChapterFromApiBible(book, chapter, translationId as keyof typeof API_BIBLE_IDS);
  } else {
    const bookNameAliases: Record<string, string> = {
      'Song of Songs': 'Song of Solomon',
    };
    const canonicalBook = bookNameAliases[book] || book;
    const bookId = BIBLE_BOOKS_ABBR[canonicalBook] || canonicalBook;

    let attempts = 0;
    const maxRetries = 3;
    const delay = 1000; // 1 second
    
    while (attempts < maxRetries && !chapterData) {
      try {
        const response = await fetch(
          `https://bible.helloao.org/api/${translationId}/${bookId}/${chapter}.json`
        );

        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
              const text = await response.text();
              if(text) {
                  const data = JSON.parse(text);
                  if (data && data.chapter && data.chapter.content) {
                      chapterData = data as BibleChapterResponse;
                  }
              }
          }
        }
      } catch (error) {
        // Silently catch fetch errors
      }
      
      attempts++;
      if (attempts < maxRetries && !chapterData) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  // If we got data, return it
  if (chapterData) {
      return chapterData;
  }

  // If we don't have data, and it's not already a fallback attempt, try falling back to BSB.
  if (!isFallbackAttempt && translationId !== 'BSB') {
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
            return null;
        }
        const contentType = booksRes.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const booksData = await booksRes.json();
            return booksData.books || null;
        } else {
            return null;
        }
    } catch (error) {
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
    // Only show toast if a fallback has actually occurred.
    if (chapterData && chapterData.translation.id !== initialTranslationId) {
        const isApiBibleTranslation = API_BIBLE_TRANSLATIONS.includes(initialTranslationId);
        
        if (isApiBibleTranslation) {
            // This case handles fallbacks from CSB, NIV, NASB which are likely permission issues.
            toast({
                title: "Translation Permission Issue",
                description: `Could not load ${initialTranslationId}. This may be a permission issue. Please ensure you have accepted the terms for this translation on api.bible. Displaying in BSB instead.`,
            });
        } else {
            // This handles fallbacks from other translations.
            toast({
                title: "Translation Fallback",
                description: `Could not load ${initialBook} ${initialChapter} in ${TRANSLATIONS.find(t=>t.id === initialTranslationId)?.name || initialTranslationId}. Displaying in BSB instead.`,
            });
        }
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
    

    

    



    