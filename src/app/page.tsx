
"use client";

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book, Translation, CrossRefChapterResponse, SearchResultVerse } from '@/lib/bible';
import { TRANSLATIONS } from '@/lib/bible';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthManager } from '@/components/auth-manager';
import { QrCodeGenerator } from '@/components/qr-code-generator';
import { AnnotationWrapper } from '@/components/annotation-wrapper';
import { FontSizeAdjuster } from '@/components/font-size-adjuster';
import { AnnotationProvider } from '@/contexts/annotation-context';
import { useToast } from '@/hooks/use-toast';
import { SearchDialog } from '@/components/search-dialog';
import { StrongsLookupDialog } from '@/components/strongs-lookup-dialog';
import { getPageData } from '@/app/actions';

function PageContent({ books, chapterData, crossRefs, initialBook, initialChapter, initialTranslationId }: { 
    books: Book[], 
    chapterData: BibleChapterResponse | null, 
    crossRefs: CrossRefChapterResponse | null,
    initialBook: string, 
    initialChapter: string, 
    initialTranslationId: string 
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const providerKey = `${initialBook}-${initialChapter}-${initialTranslationId}`;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const verseParam = searchParams.get('verse');

  const maxChapters = useMemo(() => {
    return books.find(b => b.commonName === initialBook)?.numberOfChapters || 1;
  }, [books, initialBook]);
  
  const maxVerses = useMemo(() => {
    if (!chapterData?.chapter?.content) return 0;
    const verses = chapterData.chapter.content.filter(item => item.type === 'verse');
    if (verses.length === 0) return 0;
    const lastVerse = verses[verses.length - 1];
    return lastVerse.type === 'verse' ? lastVerse.number : 0;
  }, [chapterData]);

  useEffect(() => {
    // Only show toast if a fallback has actually occurred.
    if (chapterData && chapterData.translation.id !== initialTranslationId) {
        const isApiBibleTranslation = ['CSB', 'NIV', 'NASB'].includes(initialTranslationId);
        
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
  const navigate = useCallback((newValues: Partial<{ book: string; chapter: string; translation: string; verse: string }>) => {
    const current = new URLSearchParams(searchParamsString);
    
    const isNewBook = newValues.book && newValues.book !== current.get('book');
    const isNewChapter = newValues.chapter && newValues.chapter !== current.get('chapter');
    
    // If book or chapter changes, clear the verse param
    if (isNewBook || isNewChapter) {
        current.delete('verse');
    }

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

  useEffect(() => {
    // Scroll to verse if 'verse' param is present
    if (verseParam && chapterData && contentRef.current) {
        const verseElement = contentRef.current.querySelector(`div[data-verse-number="${verseParam}"]`);
        if (verseElement) {
            verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add highlight effect
            verseElement.classList.add('verse-highlight');
            const timeoutId = setTimeout(() => {
                verseElement.classList.remove('verse-highlight');
            }, 2500);

            // Cleanup timeout on component unmount or param change
            return () => clearTimeout(timeoutId);
        }
    }
  }, [verseParam, chapterData]);

  return (
    <AnnotationProvider key={providerKey} chapterData={chapterData}>
      <main className="flex flex-col h-screen">
        <header className="flex items-center justify-between border-b p-2 md:p-4">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xl md:text-2xl font-headline font-bold text-primary">
                Verse Insights
              </h1>
              <p className="text-xs text-muted-foreground mt-1 font-headline">
                Deepen your Bible study with annotations, notes and AI-powered insights.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SearchDialog translationId={initialTranslationId} navigate={navigate} />
            <StrongsLookupDialog navigate={navigate} />
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
                maxVerses={maxVerses}
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

function ChapterLoader({ book, chapter, translationId }: { book: string; chapter: string; translationId: string; }) {
  const [pageData, setPageData] = useState<{
      books: Book[];
      chapterData: BibleChapterResponse | null;
      crossRefs: CrossRefChapterResponse | null;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const data = await getPageData(book, chapter, translationId);
      setPageData(data);
      setIsLoading(false);
    }
    loadData();
  }, [book, chapter, translationId]);

  if (isLoading || !pageData) {
    return <FullPageSkeleton />;
  }

  return <PageContent books={pageData.books} chapterData={pageData.chapterData} crossRefs={pageData.crossRefs} initialBook={book} initialChapter={chapter} initialTranslationId={translationId} />;
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
              Verse Insights
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-headline">
              Deepen your Bible study with annotations, notes and AI-powered insights.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
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
