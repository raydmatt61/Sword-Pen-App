
"use client";

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book, CrossRefChapterResponse } from '@/lib/bible';
import { TRANSLATIONS } from '@/lib/bible';
import { Card, CardContent } from '@/components/ui/card';
import { AuthManager } from '@/components/auth-manager';
import { SettingsDialog } from '@/components/settings-dialog';
import { FontSizeAdjuster } from '@/components/font-size-adjuster';
import { AnnotationWrapper } from '@/components/annotation-wrapper';
import { AnnotationProvider } from '@/contexts/annotation-context';
import { BookmarkProvider } from '@/contexts/bookmark-context';
import { useToast } from '@/hooks/use-toast';
import { SearchDialog } from '@/components/search-dialog';
import { getPageData } from '@/app/actions';
import { Logo } from '@/components/logo';
import { BookmarksSheet } from '@/components/bookmarks-sheet';

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
    if (chapterData && chapterData.translation.id !== initialTranslationId) {
        toast({
            title: "Translation Fallback",
            description: `Displaying in BSB as ${initialTranslationId} was unavailable.`,
        });
    }
  }, [chapterData, initialTranslationId, toast]);

  const navigate = useCallback((newValues: Partial<{ book: string; chapter: string; translation: string; verse: string }>) => {
    const current = new URLSearchParams(searchParams.toString());
    if (newValues.book || newValues.chapter) current.delete('verse');
    for (const [key, value] of Object.entries(newValues)) {
        if (value) current.set(key, value);
    }
    router.push(`${pathname}?${current.toString()}`);
  }, [router, pathname, searchParams]);

  const handleChapterNav = useCallback((direction: 'prev' | 'next') => {
    let currentChapter = parseInt(initialChapter);
    if (direction === 'prev' && currentChapter > 1) currentChapter--;
    if (direction === 'next' && currentChapter < maxChapters) currentChapter++;
    navigate({ chapter: currentChapter.toString() });
  }, [initialChapter, maxChapters, navigate]);
  
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [initialBook, initialChapter, initialTranslationId]);

  useEffect(() => {
    if (verseParam && chapterData && contentRef.current) {
        const verseElement = contentRef.current.querySelector(`div[data-verse-number="${verseParam}"]`);
        if (verseElement) {
            verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            verseElement.classList.add('verse-highlight');
            const timeoutId = setTimeout(() => verseElement.classList.remove('verse-highlight'), 2500);
            return () => clearTimeout(timeoutId);
        }
    }
  }, [verseParam, chapterData]);

  return (
    <AnnotationProvider key={providerKey} chapterData={chapterData}>
      <BookmarkProvider>
        <main className="flex flex-col h-screen overflow-hidden">
          <header className="flex items-center justify-between border-b px-2 py-1 md:px-4 md:py-2 shrink-0">
            <div className="flex items-center gap-2 md:gap-3">
              <Logo className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
              <div>
                <h1 className="text-lg md:text-2xl font-headline font-bold text-primary leading-none">
                  The Sword and Pen
                </h1>
                <p className="hidden md:block text-[10px] text-muted-foreground mt-1 font-headline uppercase tracking-wider">
                  Digital Scripture Study Tool
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <SearchDialog translationId={initialTranslationId} navigate={navigate} />
              <BookmarksSheet navigate={navigate} />
              <FontSizeAdjuster />
              <SettingsDialog />
              <AuthManager />
            </div>
          </header>

          <div className="sticky top-0 z-20 flex flex-row items-center gap-2 bg-background/80 backdrop-blur-sm px-2 py-1.5 md:px-4 md:py-2 border-b shrink-0">
            <div className="flex-[3] min-w-0">
              <VerseSelector
                  defaultValues={{ book: initialBook, chapter: initialChapter, translation: initialTranslationId }}
                  books={books}
                  translations={TRANSLATIONS}
                  onChapterNav={handleChapterNav}
                  navigate={navigate}
                  maxVerses={maxVerses}
              />
            </div>
            <div className="flex-[2] min-w-0">
              {chapterData && <AnnotationWrapper />}
            </div>
          </div>

          <div ref={contentRef} className="flex-grow overflow-y-auto p-2 md:p-4">
            {!chapterData ? (
              <Card className="mt-6">
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground text-sm">
                    Could not load chapter <span className="font-bold">{initialBook} {initialChapter}</span>.
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
      </BookmarkProvider>
    </AnnotationProvider>
  );
}

function ChapterLoader({ book, chapter, translationId }: { book: string; chapter: string; translationId: string; }) {
  const [pageData, setPageData] = useState<{ books: Book[]; chapterData: BibleChapterResponse | null; crossRefs: CrossRefChapterResponse | null; } | null>(null);
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

  if (isLoading || !pageData) return <FullPageSkeleton />;

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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!searchParams.has('book')) {
      const saved = localStorage.getItem(LAST_LOCATION_KEY);
      if (saved) {
        try {
          const loc = JSON.parse(saved);
          router.replace(`${pathname}?book=${loc.book}&chapter=${loc.chapter}&translation=${loc.translationId}`);
        } catch { setIsReady(true); }
      } else setIsReady(true);
    } else setIsReady(true);
  }, [searchParams, router, pathname]);
  
  useEffect(() => {
    if (searchParams.has('book')) {
      localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ book, chapter, translationId: translationUrlParam }));
    }
  }, [book, chapter, translationUrlParam, searchParams]);
  
  if (!isReady) return <FullPageSkeleton />;
  return <ChapterLoader key={queryKey} book={book} chapter={chapter} translationId={translationUrlParam} />
}

export default function Home() {
  return (
    <Suspense fallback={<FullPageSkeleton />}>
      <PageWithSearchParams />
    </Suspense>
  );
}

function FullPageSkeleton() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center animate-pulse">
        <Logo className="h-24 w-24 md:h-32 md:w-32 text-primary mb-8" />
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-primary tracking-tight">The Sword and Pen</h1>
        <p className="mt-2 text-muted-foreground uppercase tracking-[0.3em] text-[10px] md:text-xs font-headline">
          Scripture • Study • Insights
        </p>
      </div>
    </div>
  );
}
