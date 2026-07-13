
"use client";

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book, CrossRefChapterResponse } from '@/lib/bible';
import { TRANSLATIONS, BIBLE_BOOKS_ABBR } from '@/lib/bible';
import { Card, CardContent } from '@/components/ui/card';
import { AuthManager } from '@/components/auth-manager';
import { SettingsDialog } from '@/components/settings-dialog';
import { FontSizeAdjuster } from '@/components/font-size-adjuster';
import { AnnotationWrapper } from '@/components/annotation-wrapper';
import { AnnotationProvider, useAnnotationContext } from '@/contexts/annotation-context';
import { BookmarkProvider } from '@/contexts/bookmark-context';
import { JournalProvider } from '@/contexts/journal-context';
import { StudySessionProvider } from '@/contexts/study-session-context';
import { useToast } from '@/hooks/use-toast';
import { SearchDialog } from '@/components/search-dialog';
import { getPageData } from '@/app/actions';
import { Logo } from '@/components/logo';
import { BookmarksSheet } from '@/components/bookmarks-sheet';
import { JournalSheet } from '@/components/journal-sheet';
import { Navigation as NavigateIcon, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarInset, Sidebar } from '@/components/ui/sidebar';
import { StudySidePanel } from '@/components/study-side-panel';

const LAST_LOCATION_KEY = 'verse-insights-last-location';

function VerseIconToggle() {
    const { showVerseIcons, setShowVerseIcons } = useAnnotationContext();
    return (
        <Button 
            variant="outline" 
            size="icon" 
            className="h-10 w-10 md:h-9 md:w-9"
            onClick={() => setShowVerseIcons(!showVerseIcons)}
            title={showVerseIcons ? "Hide Study Icons" : "Show Study Icons"}
        >
            {showVerseIcons ? <Eye className="h-5 w-5 md:h-4 md:w-4" /> : <EyeOff className="h-5 w-5 md:h-4 md:w-4" />}
            <span className="sr-only">Toggle Verse Icons</span>
        </Button>
    );
}

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
  const lastNotificationRef = useRef("");

  const maxChapters = useMemo(() => {
    return books.find(b => b.commonName === initialBook)?.numberOfChapters || 1;
  }, [books, initialBook]);
  
  const maxVerses = useMemo(() => {
    if (!chapterData?.chapter?.content) return 0;
    const verses = chapterData.chapter.content.filter(item => item.type === 'verse');
    if (verses.length === 0) return 0;
    const lastVerse = verses[verses.length - 1];
    return lastVerse.type === 'verse' ? (lastVerse.number || 0) : 0;
  }, [chapterData]);

  useEffect(() => {
    if (!chapterData) return;
    
    const requestedId = initialTranslationId.toUpperCase().trim();
    const returnedId = chapterData.translation.id.toUpperCase().trim();
    const requestedBookAbbr = (BIBLE_BOOKS_ABBR[initialBook] || initialBook).toUpperCase().trim();
    const returnedBookAbbr = (chapterData.book.id || "").toUpperCase().trim();
    const requestedChapter = String(initialChapter);
    const returnedChapter = String(chapterData.chapter.number);

    const isResponseForCurrentRequest = requestedBookAbbr === returnedBookAbbr && requestedChapter === returnedChapter;
    if (!isResponseForCurrentRequest) return;

    const notificationKey = `${requestedBookAbbr}-${requestedChapter}-${requestedId}-${returnedId}`;
    if (lastNotificationRef.current === notificationKey) return;
    lastNotificationRef.current = notificationKey;
    
    const isDirectMatch = returnedId === requestedId;
    const isKnownMapping = (requestedId === 'CSB' && returnedId === 'HCSB') || (requestedId === 'HCSB' && returnedId === 'CSB');
    
    if (!isDirectMatch && !isKnownMapping) {
        toast({
            title: "Translation Fallback",
            description: `Displaying in ${returnedId} as ${requestedId} was unavailable.`,
        });
    }
  }, [chapterData, initialTranslationId, initialBook, initialChapter, toast]);

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
        <JournalProvider>
          <StudySessionProvider>
            <SidebarProvider defaultOpen={true}>
              <div className="flex h-screen w-full bg-background overflow-hidden">
                <SidebarInset className="flex flex-col flex-1 overflow-hidden">
                  <header className="flex items-center justify-between border-b px-4 py-3 shrink-0">
                    <div className="flex items-center gap-3">
                      <Logo className="h-8 w-8 text-primary" />
                      <div className="flex flex-col">
                        <h1 className="text-xl md:text-2xl font-headline font-bold text-primary leading-none">
                          The Sword and Pen
                        </h1>
                        <p className="text-[10px] text-muted-foreground mt-1 font-headline uppercase tracking-widest">
                          Digital Scripture Study Tool
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2">
                      <SearchDialog translationId={initialTranslationId} navigate={navigate} />
                      <VerseIconToggle />
                      <BookmarksSheet navigate={navigate} />
                      <JournalSheet />
                      <FontSizeAdjuster />
                      <SettingsDialog />
                      <AuthManager />
                    </div>
                  </header>

                  <div className="sticky top-0 z-20 flex flex-row items-center gap-4 bg-background/90 backdrop-blur-md px-4 py-2 border-b shrink-0 shadow-sm">
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

                  <div ref={contentRef} className="flex-grow overflow-y-auto p-4 md:p-8">
                    {!chapterData ? (
                      <Card className="mt-6 max-w-lg mx-auto border-none shadow-none bg-stone-100">
                        <CardContent className="pt-12 pb-12">
                          <p className="text-center text-muted-foreground text-sm font-headline uppercase tracking-widest">
                            Could not load chapter <span className="font-bold text-primary">{initialBook} {initialChapter}</span>.
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

                  <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3 md:hidden">
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="h-12 w-12 rounded-full shadow-xl bg-primary text-primary-foreground hover:scale-110 transition-transform"
                      onClick={() => {
                        const event = new CustomEvent('open-mobile-nav');
                        document.dispatchEvent(event);
                      }}
                    >
                      <NavigateIcon className="h-6 w-6" />
                    </Button>
                  </div>
                </SidebarInset>
                
                <Sidebar side="right" collapsible="none" className="hidden lg:landscape:block w-[350px] shrink-0 border-l">
                  <StudySidePanel />
                </Sidebar>
              </div>
            </SidebarProvider>
          </StudySessionProvider>
        </JournalProvider>
      </BookmarkProvider>
    </AnnotationProvider>
  );
}

function PageWithSearchParams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [initStatus, setInitStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pageData, setPageData] = useState<{ books: Book[]; chapterData: BibleChapterResponse | null; crossRefs: CrossRefChapterResponse | null; } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const book = searchParams.get('book') || 'John';
  const chapter = searchParams.get('chapter') || '1';
  const translation = searchParams.get('translation') || 'BSB';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const hasParams = searchParams.has('book') || searchParams.has('chapter');
    if (!hasParams) {
      try {
        const savedRaw = localStorage.getItem(LAST_LOCATION_KEY);
        if (savedRaw) {
          const loc = JSON.parse(savedRaw);
          if (loc?.book) {
            router.replace(`${pathname}?book=${loc.book}&chapter=${loc.chapter}&translation=${loc.translationId}`);
            return;
          }
        }
      } catch (e) {}
    }
  }, [isMounted, searchParams, router, pathname]);

  useEffect(() => {
    if (!isMounted) return;
    setInitStatus('loading');

    async function loadData() {
      try {
        const data = await getPageData(book, chapter, translation);
        if (isMounted) {
          if (data) {
            setPageData(data);
            setInitStatus('ready');
            try {
              localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ book, chapter, translationId: translation }));
            } catch (e) {}
          } else {
            setInitStatus('error');
          }
        }
      } catch (e) {
        console.error("Failed to load page data", e);
        if (isMounted) setInitStatus('error');
      }
    }
    loadData();
  }, [isMounted, book, chapter, translation]);

  if (!isMounted || initStatus === 'loading') {
    return <FullPageSkeleton />;
  }

  if (initStatus === 'error') {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-background p-6">
            <Logo className="h-16 w-16 text-primary mb-4 opacity-20" />
            <h2 className="text-xl font-headline font-bold mb-2">Connection Error</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
                We encountered an issue loading the Bible text. Please check your internet connection and try again.
            </p>
            <Button onClick={() => window.location.reload()}>Retry Loading</Button>
        </div>
    );
  }

  return (
    <PageContent 
      books={pageData?.books || []} 
      chapterData={pageData?.chapterData || null} 
      crossRefs={pageData?.crossRefs || null} 
      initialBook={book} 
      initialChapter={chapter} 
      initialTranslationId={translation} 
    />
  );
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
        <Logo className="h-24 w-24 md:h-32 md:w-32 text-primary mb-8 opacity-20" />
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-primary tracking-tight opacity-40">The Sword and Pen</h1>
        <p className="mt-2 text-muted-foreground uppercase tracking-[0.4em] text-[10px] md:text-xs font-headline opacity-30">
          Scripture • Study • Insights
        </p>
      </div>
    </div>
  );
}
