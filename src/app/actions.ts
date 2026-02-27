
"use server";

import { generateVerseInsights as generateVerseInsightsFlow } from "@/ai/flows/generate-verse-insights";
import { API_BIBLE_IDS_SEARCH, BIBLE_BOOKS_ABBR, BIBLE_BOOK_NUMBERS, TRANSLATIONS, OLD_TESTAMENT_BOOK_NAMES, NEW_TESTAMENT_BOOK_NAMES } from "@/lib/bible";
import type { GenerateVerseInsightsInput, GenerateVerseInsightsOutput, SearchResultVerse, StrongsDetail, BibleChapterResponse, Book, CrossRefChapterResponse, ChapterContentItem, VerseContent, FormattedText, VerseFootnoteReference } from "@/lib/bible";

// New types and action
interface SearchBibleInput {
    query: string;
    translationId: string;
}

interface SearchBibleOutput {
    verses: SearchResultVerse[];
}

export async function searchBible(input: SearchBibleInput): Promise<SearchBibleOutput | null> {
    const { query, translationId } = input;
    const bibleId = API_BIBLE_IDS_SEARCH[translationId as keyof typeof API_BIBLE_IDS_SEARCH];
    if (!bibleId) {
        throw new Error(`Search is not supported for the "${translationId}" translation.`);
    }
    const apiKey = process.env.NEXT_PUBLIC_API_BIBLE_KEY;
    if (!apiKey) {
        throw new Error("API key for Bible API is not configured.");
    }

    try {
        const response = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/search?query=${encodeURIComponent(query)}&sort=relevance`, {
            headers: { 'api-key': apiKey }
        });

        if (!response.ok) {
            console.error("api.bible search request failed:", response.status, response.statusText);
            const errorData = await response.json().catch(() => null);
            const message = errorData?.message || `The search service returned an error (${response.status}).`;
            throw new Error(message);
        }

        const json = await response.json();

        if (!json.data || !json.data.verses) {
            return { verses: [] };
        }

        return {
            verses: json.data.verses.map((v: any) => ({
                id: v.id,
                reference: v.reference,
                text: v.text, // Assuming the API returns HTML with <mark> tags
                bookId: v.bookId,
            }))
        };

    } catch (error) {
        console.error("Error in searchBible action:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Failed to perform search due to an unexpected error.");
    }
}

export async function getStrongsDetail(strongsNumber: string): Promise<StrongsDetail[] | null> {
    try {
        const upperCaseStrongs = strongsNumber.toUpperCase();
        // Force fresh fetch to avoid caching issues
        const bollsResponse = await fetch(`https://bolls.life/api/strongs/${upperCaseStrongs}`, { cache: 'no-store' });
        if (!bollsResponse.ok) {
            return null;
        }
        const data = await bollsResponse.json();

        // The API returns an object with the strongs number as the key
        const strongsData = data[upperCaseStrongs];

        if (!strongsData || data.error) {
            return null;
        }

        const detail: StrongsDetail = {
            strongsNumber: upperCaseStrongs,
            lemma: strongsData.lemma,
            transliteration: strongsData.xlit,
            pronunciation: strongsData.pron,
            shortDefinition: strongsData.strongs_def,
            kjvDefinition: strongsData.kjv_def,
            strongsDerivation: strongsData.derivation,
        };

        return [detail];

    } catch (error) {
        console.error("Error in getStrongsDetail action:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Failed to perform Strong's lookup due to an unexpected error.");
    }
}


export async function generateVerseInsights(input: GenerateVerseInsightsInput): Promise<GenerateVerseInsightsOutput> {
  try {
    const insights = await generateVerseInsightsFlow(input);
    return insights;
  } catch (error) {
    console.error("Error generating verse insights:", error);
    throw new Error("Failed to generate AI insights.");
  }
}

// Helper to collapse text fragments into single FormattedText objects with proper spacing
function collapseVerseContent(content: VerseContent[]): VerseContent[] {
    if (!content || content.length < 2) return content;

    const collapsed: VerseContent[] = [];
    let currentItem = content[0];

    for (let i = 1; i < content.length; i++) {
        const nextItem = content[i];

        // Only collapse if both are formatted text objects (or strings converted to them)
        // and have identical non-text properties (Jesus words, strongs)
        const currentObj = typeof currentItem === 'string' ? { text: currentItem } : currentItem as FormattedText;
        const nextObj = typeof nextItem === 'string' ? { text: nextItem } : nextItem as FormattedText;

        const isJesusEqual = !!currentObj.wordsOfJesus === !!nextObj.wordsOfJesus;
        const isStrongsEqual = !currentObj.strongs && !nextObj.strongs; // Only merge segments without Strong's to keep mapping clean
        
        // Footnotes and other special types shouldn't be merged
        const isSimpleMergeable = !('noteId' in currentObj) && !('noteId' in nextObj) && 
                                 !('heading' in currentObj) && !('heading' in nextObj) &&
                                 !('lineBreak' in currentObj) && !('lineBreak' in nextObj);

        if (isSimpleMergeable && isJesusEqual && isStrongsEqual) {
            const lastText = currentObj.text;
            const nextText = nextObj.text;

            // Logic to determine if a space is needed
            const needsSpace = !(
                lastText.endsWith(' ') || 
                lastText.endsWith('\n') ||
                nextText.startsWith(' ') || 
                nextText.startsWith('\n') ||
                /^[.,?!:;’”)}\]]/.test(nextText) // No space before most punctuation
            );

            currentObj.text = lastText + (needsSpace ? ' ' : '') + nextText;
            currentItem = currentObj;
        } else {
            collapsed.push(currentItem);
            currentItem = nextItem;
        }
    }
    collapsed.push(currentItem);
    return collapsed;
}

const API_BIBLE_IDS = {
    CSB: 'a556c5305ee15c3f-01',
    NIV: '78a9f6124f344018-01',
    NASB: 'b8ee27bcd1cae43a-01',
    KJV: 'de4e12af7f28f599-01',
    WEB: '72f4e6dc683324df-01',
    'engnet': '72f4e6dc683324df-01',
};
const API_BIBLE_TRANSLATIONS = Object.keys(API_BIBLE_IDS);

// Assumed from bolls.life API
type BollsVerse = {
    book: string;
    chapter: number;
    verse: number;
    text: string;
    text_strongs?: { w: string; s?: string; woc?: '1' }[]; 
};

async function getKJVChapterFromBolls(
  book: string,
  chapter: string
): Promise<BibleChapterResponse | null> {
    const bookNumber = BIBLE_BOOK_NUMBERS[book as keyof typeof BIBLE_BOOK_NUMBERS];
    if (!bookNumber) return null;

    try {
        const url = `https://bolls.life/get-chapter/KJV/${bookNumber}/${chapter}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch KJV data for ${book} ${chapter} from bolls.life. URL: ${url}`);
            return null;
        }
        
        const bollsVerses: BollsVerse[] = await response.json();
        if (!bollsVerses || bollsVerses.length === 0) return null;
        
        const chapterContent: ChapterContentItem[] = bollsVerses.map(v => {
            const verseContent: VerseContent[] = [];
            if (v.text_strongs && Array.isArray(v.text_strongs)) {
                v.text_strongs.forEach(sw => {
                    const formattedText: FormattedText = { text: sw.w };
                    if (sw.s && sw.s !== "0") {
                        formattedText.strongs = [sw.s];
                    }
                    if (sw.woc === '1') {
                        formattedText.wordsOfJesus = true;
                    }
                    verseContent.push(formattedText);
                });
            } else {
                verseContent.push(v.text);
            }

            return {
                type: 'verse',
                number: v.verse,
                content: collapseVerseContent(verseContent)
            };
        });

        return {
            book: { name: book, id: BIBLE_BOOKS_ABBR[book] },
            chapter: { number: parseInt(chapter, 10), content: chapterContent },
            translation: { name: 'King James Version', id: 'KJV' },
            copyright: "Public Domain. Modified by bolls.life."
        };

    } catch (error) {
        console.error("Error fetching/processing KJV from bolls.life", error);
        return null;
    }
}


async function getCrossReferences(
  book: string,
  chapter: string,
): Promise<CrossRefChapterResponse | null> {
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
            if(!text) return null;
            return JSON.parse(text) as CrossRefChapterResponse;
        }
    }
  } catch (error) {}
  return null;
}


async function getChapterFromApiBible(
  book: string,
  chapter: string,
  translationId: keyof typeof API_BIBLE_IDS
): Promise<BibleChapterResponse | null> {
  const bibleId = API_BIBLE_IDS[translationId];
  const bookAbbr = BIBLE_BOOKS_ABBR[book];
  if (!bookAbbr) return null;

  const chapterId = `${bookAbbr}.${chapter}`;
  const apiKey = process.env.NEXT_PUBLIC_API_BIBLE_KEY;

  if (!apiKey) return null;
  
  try {
    const response = await fetch(
      `https://rest.api.bible/v1/bibles/${bibleId}/passages/${chapterId}?content-type=json&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true`,
      { headers: { 'api-key': apiKey } }
    );

    if (!response.ok) return null;

    const json = await response.json();
    const data = json.data;

    let content_data;
    if (typeof data.content === 'string') {
      try {
        content_data = JSON.parse(data.content);
      } catch (e) {
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
                
                if (item.name === 'para' && item.attrs?.style === 'h') flushVerse = true;
                
                if (flushVerse && currentVerseNumber !== null && currentVerseContent.length > 0) {
                     chapterContent.push({
                        type: 'verse',
                        number: currentVerseNumber,
                        content: collapseVerseContent(currentVerseContent)
                    });
                    currentVerseContent = [];
                    currentVerseNumber = null;
                }
                
                if(startNewVerse) currentVerseNumber = startNewVerse;

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
                if (item.items && Array.isArray(item.items)) processItems(item.items, isNewWoc);

            } else if (item.type === 'text' && typeof item.text === 'string') {
                if (currentVerseNumber !== null) {
                    const textToAdd = item.text;
                    if (textToAdd) {
                        const content: FormattedText = { text: textToAdd };
                        if (isWoc) content.wordsOfJesus = true;
                        currentVerseContent.push(content);
                    }
                }
            } else if (item.type === 'verse' && item.attrs?.number) {
                if (currentVerseNumber !== null && currentVerseContent.length > 0) {
                    chapterContent.push({ type: 'verse', number: currentVerseNumber, content: collapseVerseContent(currentVerseContent) });
                    currentVerseContent = [];
                }
                currentVerseNumber = parseInt(item.attrs.number, 10);
            }
        });
    };
    
    if (content_data && Array.isArray(content_data)) processItems(content_data);
    
    if (currentVerseNumber !== null && currentVerseContent.length > 0) {
        chapterContent.push({
            type: 'verse',
            number: currentVerseNumber,
            content: collapseVerseContent(currentVerseContent)
        });
    }

    return {
      book: { name: book, id: bookAbbr },
      chapter: { number: parseInt(chapter, 10), content: chapterContent },
      translation: {
        name: TRANSLATIONS.find(t => t.id === translationId)?.name || translationId,
        id: translationId,
      },
      copyright: data.copyright,
    };

  } catch (error) {
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

  if (translationId === 'KJV') {
    chapterData = await getKJVChapterFromBolls(book, chapter);
  } else if (API_BIBLE_TRANSLATIONS.includes(translationId)) {
    chapterData = await getChapterFromApiBible(book, chapter, translationId as keyof typeof API_BIBLE_IDS);
  } else {
    const bookNameAliases: Record<string, string> = { 'Song of Songs': 'Song of Solomon' };
    const canonicalBook = bookNameAliases[book] || book;
    const bookId = BIBLE_BOOKS_ABBR[canonicalBook] || canonicalBook;

    let attempts = 0;
    const maxRetries = 3;
    const delay = 1000;
    
    while (attempts < maxRetries && !chapterData) {
      try {
        const response = await fetch(`https://bible.helloao.org/api/${translationId}/${bookId}/${chapter}.json`);
        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
              const text = await response.text();
              if(text) {
                  const data = JSON.parse(text);
                  if (data && data.chapter && data.chapter.content) {
                      chapterData = data as BibleChapterResponse;
                      // Apply collapsing logic to the helloao data
                      chapterData.chapter.content.forEach(item => {
                        if (item.type === 'verse' && item.content) {
                            item.content = collapseVerseContent(item.content);
                        }
                      });
                  }
              }
          }
        }
      } catch (error) {}
      attempts++;
      if (attempts < maxRetries && !chapterData) await new Promise(res => setTimeout(res, delay));
    }
  }

  if (chapterData) return chapterData;
  if (!isFallbackAttempt && translationId !== 'BSB') {
      const fallbackChapter = await getChapter(book, chapter, 'BSB', true);
      if (fallbackChapter) return fallbackChapter;
  }
  return null;
}

async function fetchBooksForTranslation(translationId: string): Promise<Omit<Book, 'testament'>[] | null> {
    const bibleIdForSelectedTranslation = API_BIBLE_IDS[translationId as keyof typeof API_BIBLE_IDS];
    const bibleId = bibleIdForSelectedTranslation || 'a556c5305ee15c3f-01'; 
    const apiKey = process.env.NEXT_PUBLIC_API_BIBLE_KEY;

    if (!apiKey) return null;
    
    try {
        const booksRes = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/books?include-chapters=true&include-chapters-and-sections=true`, {
            headers: { 'api-key': apiKey }
        });

        if (!booksRes.ok) return null;
        
        const json = await booksRes.json();
        if (!json.data) return null;

        return json.data.map((book: any) => ({
            id: book.id,
            commonName: book.name,
            numberOfChapters: book.chapters.length,
        }));

    } catch (error) {
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
        return { ...book, testament: testament };
    }).filter(book => !!book.testament) as Book[];
}

export async function getPageData(book: string, chapter: string, translationId: string) {
    const [booksData, chapterContent, crossRefData] = await Promise.all([
        getBooks(translationId),
        getChapter(book, chapter, translationId),
        getCrossReferences(book, chapter),
    ]);

    return {
        books: booksData,
        chapterData: chapterContent,
        crossRefs: crossRefData
    };
}
