
"use client";

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { BibleDisplay } from '@/components/bible-display';
import { VerseSelector } from '@/components/verse-selector';
import type { BibleChapterResponse, Book, Translation, CrossRefChapterResponse, ChapterContentItem, VerseContent, FormattedText, Footnote, VerseFootnoteReference, SearchResultVerse, BsbVerse, BsbContent } from '@/lib/bible';
import { BIBLE_BOOKS_ABBR, TRANSLATIONS, OLD_TESTAMENT_BOOK_NAMES, NEW_TESTAMENT_BOOK_NAMES, API_BIBLE_IDS_SEARCH, BSB_BOOK_FILENAME_MAP } from '@/lib/bible';
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

const API_BIBLE_IDS = {
    CSB: 'a556c5305ee15c3f-01',
    NIV: '78a9f6124f344018-01',
    NASB: 'b8ee27bcd1cae43a-01',
    KJV: 'de4e12af7f28f599-01',
    WEB: '72f4e6dc683324df-01',
    'engnet': '72f4e6dc683324df-01', // Using WEB as a proxy for now
};
const API_BIBLE_TRANSLATIONS = Object.keys(API_BIBLE_IDS);

async function getChapterFromKjvStrongsGithub(
  book: string,
  chapter: string
): Promise<BibleChapterResponse | null> {
    const KJV_BOOK_NAMES = [
        "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", 
        "1_Samuel", "2_Samuel", "1_Kings", "2_Kings", "1_Chronicles", "2_Chronicles", "Ezra", 
        "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song_of_Solomon", 
        "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", 
        "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", 
        "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1_Corinthians", 
        "2_Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1_Thessalonians", 
        "2_Thessalonians", "1_Timothy", "2_Timothy", "Titus", "Philemon", "Hebrews", "James", 
        "1_Peter", "2_Peter", "1_John", "2_John", "3_John", "Jude", "Revelation"
    ];

    // Handle book names like "1 Samuel" -> "1_Samuel"
    const bookForUrl = book.replace(/ /g, '_');
    const bookIndex = KJV_BOOK_NAMES.findIndex(b => b === bookForUrl);

    if (bookIndex === -1) {
        console.error(`Book not found in KJV mapping: ${book}`);
        return null;
    }

    const bookNumber = bookIndex + 1;
    const paddedBookNumber = String(bookNumber).padStart(2, '0');
    const bookNameForUrl = KJV_BOOK_NAMES[bookIndex];
    const paddedChapterNumber = String(chapter).padStart(3, '0');

    const url = `https://raw.githubusercontent.com/SoliDeoGloria/KJV-with-Strongs/master/A${paddedBookNumber}_${bookNameForUrl}/A${paddedBookNumber}_${bookNameForUrl}_${paddedChapterNumber}.json`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch KJV data for ${book} ${chapter} from GitHub. URL: ${url}`);
            return null;
        }

        const data = await response.json();
        
        const chapterContent: ChapterContentItem[] = [];
        const sortedVerseKeys = Object.keys(data.chapter).sort((a, b) => parseInt(a) - parseInt(b));

        for (const verseKey of sortedVerseKeys) {
            const verseData = data.chapter[verseKey];
            const verseText = verseData.verse;

            const verseContent: VerseContent[] = [];
            const words = verseText.split(' ');

            words.forEach((word) => {
                const match = word.match(/^(.*?)(<[GH]\d+>)$/);
                if (match) {
                    const [, text, strongsTag] = match;
                    const strongsNumber = strongsTag.substring(2, strongsTag.length - 1);
                    if (text) {
                        verseContent.push({ text: text, strongs: [strongsNumber] });
                    }
                } else {
                    verseContent.push(word);
                }
            });

            // Reconstruct with spaces and collapse consecutive strings
            const finalContent: VerseContent[] = [];
            let textBuffer = '';
            verseContent.forEach((item, index) => {
                const isLastItem = index === verseContent.length - 1;
                const space = isLastItem ? '' : ' ';

                if (typeof item === 'string') {
                    textBuffer += item + space;
                } else if (typeof item === 'object' && 'strongs' in item) {
                    if (textBuffer) {
                        finalContent.push(textBuffer.trimEnd());
                        textBuffer = '';
                    }
                    item.text += space;
                    finalContent.push(item);
                }
            });
            if (textBuffer) {
                finalContent.push(textBuffer.trimEnd());
            }

            chapterContent.push({
                type: 'verse',
                number: parseInt(verseData.verse_nr),
                content: finalContent
            });
        }
        
        const result: BibleChapterResponse = {
            book: {
                name: book,
                id: BIBLE_BOOKS_ABBR[book] || book,
            },
            chapter: {
                number: parseInt(chapter, 10),
                content: chapterContent,
            },
            translation: {
                name: 'King James Version',
                id: 'KJV',
            },
            copyright: 'King James Version with Strongs numbers. Public Domain.',
        };
        
        return result;

    } catch (error) {
        console.error("Error fetching or processing KJV data:", error);
        return null;
    }
}


async function getChapterFromBsbGithub(
  book: string,
  chapter: string
): Promise<BibleChapterResponse | null> {
  const bookFilenamePart = BSB_BOOK_FILENAME_MAP[book];
  if (!bookFilenamePart) {
    console.warn(`No BSB filename mapping for book: ${book}`);
    return null;
  }
  const url = `https://raw.githubusercontent.com/gapmiss/berean-study-bible-with-strongs/master/json/bsb_strongs_${bookFilenamePart}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`Failed to fetch BSB data for ${book} from GitHub. URL: ${url}`);
        return null;
    }
    const data: BsbVerse[] = await response.json();

    const chapterData = data.filter(
      (v) => v.chapter === parseInt(chapter, 10)
    );

    if (chapterData.length === 0) return null;
    
    const chapterContent: ChapterContentItem[] = [];
    let currentVerseNumber: number | null = null;
    let currentVerseContent: VerseContent[] = [];

    chapterData.forEach((verse) => {
        if (currentVerseNumber !== verse.verse) {
            if (currentVerseNumber !== null) {
                chapterContent.push({ type: 'verse', number: currentVerseNumber, content: currentVerseContent });
            }
            currentVerseNumber = verse.verse;
            currentVerseContent = [];
        }

        verse.content?.forEach((item: BsbContent) => {
            if (item.type === 'h') {
                chapterContent.push({ type: 'heading', content: [item.text || ''] });
            } else if (item.type === 'w') {
                const content: FormattedText = { text: item.text || '' };
                if (item.strongs) content.strongs = [item.strongs];
                if (item.woc) content.wordsOfJesus = true;
                currentVerseContent.push(content);
            } else if (item.type === 'br') {
                 chapterContent.push({ type: 'line_break' });
            }
        });
    });

     if (currentVerseNumber !== null) {
        chapterContent.push({ type: 'verse', number: currentVerseNumber, content: currentVerseContent });
    }

    return {
      book: { name: book, id: BIBLE_BOOKS_ABBR[book] || '' },
      chapter: { number: parseInt(chapter, 10), content: chapterContent },
      translation: { name: 'Berean Standard Bible', id: 'BSB' },
      copyright: 'The Berean Bible and Majority Bible texts are officially dedicated to the public domain as of April 30, 2023.',
    };
  } catch (error) {
    console.error(`Error fetching BSB data for ${book}:`, error);
    return null;
  }
}


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
    let currentVerseNumber: number | null = null;
    let currentVerseContent: VerseContent[] = [];

    const processItems = (items: any[], isWoc = false) => {
        if (!items || !Array.isArray(items)) return;

        items.forEach(item => {
            if (item.type === 'tag') {
                let flushVerse = false;
                let startNewVerse: number | null = null;

                if (item.name === 'verse' && item.attrs?.number) {
                    flushVerse = true;
                    startNewVerse = parseInt(item.attrs.number, 10);
                }
                
                if (item.name === 'para' && item.attrs?.style === 'h') {
                    flushVerse = true;
                }
                
                if (flushVerse && currentVerseNumber !== null && currentVerseContent.length > 0) {
                     chapterContent.push({
                        type: 'verse',
                        number: currentVerseNumber,
                        content: currentVerseContent
                    });
                    currentVerseContent = [];
                    currentVerseNumber = null;
                }
                
                if(startNewVerse) {
                    currentVerseNumber = startNewVerse;
                }

                if (item.name === 'para' && item.attrs?.style === 'h') {
                    const headingText = item.items?.map(i => i.text).join(' ').trim();
                    if(headingText) {
                         chapterContent.push({
                            type: 'heading',
                            content: [headingText],
                        });
                    }
                }
                
                const isNewWoc = isWoc || (item.name === 'char' && item.attrs?.style === 'woc');
                
                if (item.items && Array.isArray(item.items)) {
                    processItems(item.items, isNewWoc);
                }

            } else if (item.type === 'text' && typeof item.text === 'string') {
                if (currentVerseNumber !== null) {
                    const textToAdd = item.text;
                    if (textToAdd) {
                        const content: FormattedText = { text: textToAdd };
                        if (isWoc) content.wordsOfJesus = true;

                        if (Object.keys(content).length === 1 && content.text) {
                            currentVerseContent.push(textToAdd);
                        } else if (content.text) {
                            currentVerseContent.push(content);
                        }
                    }
                }
            } else if (item.type === 'verse' && item.attrs?.number) { // Handling verse numbers when they are not tags but part of content
                if (currentVerseNumber !== null && currentVerseContent.length > 0) {
                    chapterContent.push({ type: 'verse', number: currentVerseNumber, content: currentVerseContent });
                    currentVerseContent = [];
                }
                currentVerseNumber = parseInt(item.attrs.number, 10);
            }
        });
    };
    
    // Fallback for verse number when not in tags
    if (data.verseCount > 0 && content_data[0] && content_data[0].name === 'p') {
      const verseNumberMatch = data.reference.match(/:(\d+)/);
      if (verseNumberMatch) {
          currentVerseNumber = parseInt(verseNumberMatch[1], 10);
      }
    }


    if (content_data && Array.isArray(content_data)) {
        processItems(content_data);
    }
    
    if (currentVerseNumber !== null && currentVerseContent.length > 0) {
        chapterContent.push({
            type: 'verse',
            number: currentVerseNumber,
            content: currentVerseContent
        });
    }

    chapterContent.forEach(item => {
        if (item.type !== 'verse' || !item.content) return;
    
        const normalizedContent: VerseContent[] = item.content.map(c => 
            typeof c === 'string' ? { text: c } : c
        );
    
        if (normalizedContent.length < 2) {
            item.content = normalizedContent;
            return;
        }
    
        const collapsed: VerseContent[] = [normalizedContent[0]];
    
        for (let i = 1; i < normalizedContent.length; i++) {
            const current = normalizedContent[i];
            const last = collapsed[collapsed.length - 1];
    
            if (typeof current === 'object' && 'text' in current && typeof last === 'object' && 'text' in last) {
                 const currentFt = current as FormattedText;
                 const lastFt = last as FormattedText;
    
                 if (!!lastFt.wordsOfJesus === !!currentFt.wordsOfJesus && !lastFt.strongs && !currentFt.strongs) {
                     let separator = ' ';
                     if (lastFt.text.endsWith(' ') || /^\s/.test(currentFt.text) || /^[.,?!:;]/.test(currentFt.text)) {
                         separator = '';
                     }
                     lastFt.text += separator + currentFt.text;
                 } else {
                     collapsed.push(current);
                 }
            } else {
                collapsed.push(current);
            }
        }
        item.content = collapsed;
    });

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

  if (translationId === 'BSB') {
      chapterData = await getChapterFromBsbGithub(book, chapter);
  } else if (translationId === 'KJV') {
      chapterData = await getChapterFromKjvStrongsGithub(book, chapter);
  }

  if (!chapterData) {
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
                          chapterData.chapter.content.forEach(item => {
                            if (item.type !== 'verse' || !item.content) return;
                        
                            const normalizedContent: VerseContent[] = item.content.map(c => 
                                typeof c === 'string' ? { text: c } : c
                            );
                        
                            if (normalizedContent.length < 2) {
                                item.content = normalizedContent;
                                return;
                            }
                        
                            const collapsed: VerseContent[] = [normalizedContent[0]];
                        
                            for (let i = 1; i < normalizedContent.length; i++) {
                                const current = normalizedContent[i];
                                const last = collapsed[collapsed.length - 1];
                        
                                if (typeof current === 'object' && 'text' in current && typeof last === 'object' && 'text' in last) {
                                     const currentFt = current as FormattedText;
                                     const lastFt = last as FormattedText;
                        
                                     if (!!lastFt.wordsOfJesus === !!currentFt.wordsOfJesus && !lastFt.strongs && !currentFt.strongs) {
                                         let separator = ' ';
                                         if (lastFt.text.endsWith(' ') || /^\s/.test(currentFt.text) || /^[.,?!:;]/.test(currentFt.text)) {
                                             separator = '';
                                         }
                                         lastFt.text += separator + currentFt.text;
                                     } else {
                                         collapsed.push(current);
                                     }
                                } else {
                                    collapsed.push(current);
                                }
                            }
                            item.content = collapsed;
                        });
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

async function fetchBooksForTranslation(translationId: string): Promise<Omit<Book, 'testament'>[] | null> {
    const bibleIdForSelectedTranslation = API_BIBLE_IDS[translationId as keyof typeof API_BIBLE_IDS];
    // Default to CSB if the selected translation isn't available via api.bible, to ensure the book selector always works.
    const bibleId = bibleIdForSelectedTranslation || 'a556c5305ee15c3f-01'; 
    const apiKey = process.env.NEXT_PUBLIC_API_BIBLE_KEY;

    if (!apiKey) {
        console.error("API key for api.bible is not configured to fetch book list.");
        return null;
    }
    
    try {
        const booksRes = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/books?include-chapters=true&include-chapters-and-sections=true`, {
            headers: { 'api-key': apiKey }
        });

        if (!booksRes.ok) {
            console.error(`api.bible books request failed for ${bibleId}:`, booksRes.status, booksRes.statusText);
            return null;
        }
        
        const json = await booksRes.json();

        if (!json.data) {
            return null;
        }

        return json.data.map((book: any) => ({
            id: book.id,
            commonName: book.name,
            numberOfChapters: book.chapters.length,
        }));

    } catch (error) {
        console.error("Error fetching books from api.bible:", error);
        return null;
    }
}

async function getBooks(translationId: string): Promise<Book[]> {
    const booksFromApi = await fetchBooksForTranslation(translationId);
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
  const [books, setBooks] = useState<Book[]>([]);
  const [chapterData, setChapterData] = useState<BibleChapterResponse | null>(null);
  const [crossRefs, setCrossRefs] = useState<CrossRefChapterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [booksData, chapterContent, crossRefData] = await Promise.all([
        getBooks(translationId),
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
