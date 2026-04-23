
"use server";

import { generateVerseInsights as generateVerseInsightsFlow } from "@/ai/flows/generate-verse-insights";
import { API_BIBLE_IDS_SEARCH, BIBLE_BOOKS_ABBR, BIBLE_BOOK_NUMBERS, TRANSLATIONS, OLD_TESTAMENT_BOOK_NAMES, NEW_TESTAMENT_BOOK_NAMES } from "@/lib/bible";
import type { GenerateVerseInsightsInput, GenerateVerseInsightsOutput, SearchResultVerse, BibleChapterResponse, Book, CrossRefChapterResponse, ChapterContentItem, VerseContent, FormattedText } from "@/lib/bible";

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
    const apiKey = "n-eVwCRekVC0-oL2B6_s3";

    try {
        const response = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/search?query=${encodeURIComponent(query)}&sort=relevance`, {
            headers: { 'api-key': apiKey }
        });

        if (!response.ok) {
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
                text: v.text, 
                bookId: v.bookId,
            }))
        };

    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error("Failed to perform search due to an unexpected error.");
    }
}

export async function generateVerseInsights(input: GenerateVerseInsightsInput): Promise<GenerateVerseInsightsOutput> {
  try {
    return await generateVerseInsightsFlow(input);
  } catch (error) {
    throw new Error("Failed to generate AI insights.");
  }
}

/**
 * Utility function to collapse verse content into logical segments.
 */
function collapseVerseContent(content: VerseContent[]): VerseContent[] {
    if (!content || content.length === 0) return [];

    const result: VerseContent[] = [];
    let lastTextItem: FormattedText | null = null;

    for (let i = 0; i < content.length; i++) {
        const item = content[i];
        const currentIsPlainText = typeof item === 'string' || (typeof item === 'object' && item !== null && 'text' in item && !('noteId' in item) && !('strongs' in item));

        if (!currentIsPlainText) {
            result.push(item);
            lastTextItem = null;
            continue;
        }

        const currentObj = typeof item === 'string' ? { text: item } : { ...item } as FormattedText;
        
        if (lastTextItem) {
            const lastText = lastTextItem.text;
            const currentText = currentObj.text;
            const lastChar = lastText.slice(-1);
            const firstChar = currentText.charAt(0);

            let needsSpace = false;
            if (lastChar && firstChar) {
                const isLastSpace = /\s/.test(lastChar);
                const isFirstSpace = /\s/.test(firstChar);
                const isLastPunct = /[.,!?:;’”)}\]'’]/.test(lastChar);
                const isFirstPunct = /[.,!?:;’”)}\]'’]/.test(firstChar);
                const isLastOpener = /[(\["'‘“]/.test(lastChar);

                if (!isLastSpace && !isFirstSpace) {
                    if (!isLastOpener && !isFirstPunct) needsSpace = true;
                    if (isLastPunct && /[a-zA-Z0-9]/.test(firstChar)) needsSpace = true;
                }
            }

            const isJesusEqual = !!lastTextItem.wordsOfJesus === !!currentObj.wordsOfJesus;

            if (isJesusEqual) {
                lastTextItem.text += (needsSpace ? ' ' : '') + currentText;
            } else {
                if (needsSpace) lastTextItem.text += ' ';
                result.push(currentObj);
                lastTextItem = currentObj;
            }
        } else {
            result.push(currentObj);
            lastTextItem = currentObj;
        }
    }

    return result;
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

async function getChapterFromBolls(translationCode: string, book: string, chapter: string): Promise<BibleChapterResponse | null> {
    const bookNumber = BIBLE_BOOK_NUMBERS[book as keyof typeof BIBLE_BOOK_NUMBERS];
    if (!bookNumber) return null;

    try {
        const url = `https://bolls.life/get-chapter/${translationCode}/${bookNumber}/${chapter}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const bollsVerses: any[] = await response.json();
        if (!bollsVerses || bollsVerses.length === 0) return null;
        
        const isOT = OLD_TESTAMENT_BOOK_NAMES.includes(book);
        const prefix = isOT ? 'H' : 'G';

        const chapterContent: ChapterContentItem[] = [];
        
        bollsVerses.forEach((v, index) => {
            if (index > 0 && index % 8 === 0) {
                chapterContent.push({ type: 'line_break' });
            }

            const segments: VerseContent[] = [];
            const parts = v.text.split(/(<S>\d+<\/S>)/);
            
            parts.forEach(part => {
                if (!part) return;
                const strongsMatch = part.match(/<S>(\d+)<\/S>/);
                if (strongsMatch) {
                    const number = strongsMatch[1];
                    const fullStrongs = prefix + number;
                    
                    if (segments.length > 0) {
                        const lastIndex = segments.length - 1;
                        const last = segments[lastIndex];
                        if (typeof last === 'string') {
                            const words = last.split(/(\s+)/);
                            const lastWord = words.pop() || "";
                            const preceding = words.join("");
                            if (preceding) {
                                segments[lastIndex] = preceding;
                                segments.push({ text: lastWord, strongs: fullStrongs });
                            } else {
                                segments[lastIndex] = { text: lastWord, strongs: fullStrongs };
                            }
                        } else if (typeof last === 'object' && 'text' in last && !('noteId' in last)) {
                            (last as FormattedText).strongs = fullStrongs;
                        }
                    }
                } else {
                    segments.push(part.replace(/<[^>]+>/g, ''));
                }
            });

            chapterContent.push({
                type: 'verse',
                number: v.verse,
                content: collapseVerseContent(segments)
            });
        });

        const translationName = TRANSLATIONS.find(t => t.id === translationCode)?.name || translationCode;

        return {
            book: { name: book, id: BIBLE_BOOKS_ABBR[book] },
            chapter: { number: parseInt(chapter, 10), content: chapterContent },
            translation: { name: translationName, id: translationCode },
            copyright: `Public Domain (or as specified by ${translationCode}). Data from bolls.life.`
        };
    } catch (error) { return null; }
}

async function getCrossReferences(book: string, chapter: string): Promise<CrossRefChapterResponse | null> {
  const bookNameAliases: Record<string, string> = { 'Song of Songs': 'Song of Solomon' };
  const canonicalBook = bookNameAliases[book] || book;
  const bookId = BIBLE_BOOKS_ABBR[canonicalBook] || canonicalBook;

  try {
    const response = await fetch(`https://bible.helloao.org/api/d/open-cross-ref/${bookId}/${chapter}.json`);
    if (response.ok) {
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }
  } catch (error) {}
  return null;
}

async function getChapterFromApiBible(book: string, chapter: string, translationId: keyof typeof API_BIBLE_IDS): Promise<BibleChapterResponse | null> {
  const bibleId = API_BIBLE_IDS[translationId];
  const bookAbbr = BIBLE_BOOKS_ABBR[book];
  if (!bookAbbr) return null;

  const chapterId = `${bookAbbr}.${chapter}`;
  const apiKey = "n-eVwCRekVC0-oL2B6_s3"; 
  
  try {
    const response = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/passages/${chapterId}?content-type=json&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=false`, { 
        headers: { 'api-key': apiKey } 
    });
    if (!response.ok) return null;

    const json = await response.json();
    const data = json.data;
    
    // The Bible API returns a nested JSON structure. We need to traverse it to extract text and verse markers.
    let contentData = data.content;
    if (typeof contentData === 'string') {
        try { contentData = JSON.parse(contentData); } catch { return null; }
    }
    
    const chapterContent: ChapterContentItem[] = [];
    let currentVerseNumber: number | null = null;
    let currentVerseContent: VerseContent[] = [];

    const flushVerse = () => {
        if (currentVerseNumber !== null && currentVerseContent.length > 0) {
            chapterContent.push({ 
                type: 'verse', 
                number: currentVerseNumber, 
                content: collapseVerseContent(currentVerseContent) 
            });
            currentVerseContent = [];
        }
    };

    const processItems = (items: any[], isWoc = false) => {
        if (!items || !Array.isArray(items)) return;
        items.forEach(item => {
            if (item.type === 'tag') {
                if (item.name === 'verse' && item.attrs?.number) {
                    flushVerse();
                    currentVerseNumber = parseInt(item.attrs.number, 10);
                } else if (item.name === 'para') {
                    // Start of a paragraph usually flushes the previous verse if we're at a verse boundary
                    if (item.attrs?.style === 'h') {
                        flushVerse();
                        const headingText = (item.items || []).map((i: any) => i.text || '').join('').trim();
                        if (headingText) chapterContent.push({ type: 'heading', content: [headingText] });
                    } else {
                        chapterContent.push({ type: 'line_break' });
                        processItems(item.items, isWoc);
                    }
                } else if (item.name === 'char') {
                    const isNewWoc = isWoc || (item.attrs?.style === 'woc');
                    processItems(item.items, isNewWoc);
                } else {
                    processItems(item.items, isWoc);
                }
            } else if (item.type === 'text' && typeof item.text === 'string' && currentVerseNumber !== null) {
                let text = item.text;
                // Filter out verse numbers that might be baked into the text node
                if (currentVerseContent.length === 0) {
                    text = text.replace(/^\s*\d+\s*/, '');
                }
                if (text) {
                    currentVerseContent.push({ text, wordsOfJesus: isWoc });
                }
            }
        });
    };
    
    if (contentData) processItems(contentData);
    flushVerse();

    return {
      book: { name: book, id: bookAbbr },
      chapter: { number: parseInt(chapter, 10), content: chapterContent },
      translation: { name: TRANSLATIONS.find(t => t.id === translationId)?.name || translationId, id: translationId },
      copyright: data.copyright,
    };
  } catch (error) { 
    console.error("API Error:", error);
    return null; 
  }
}

async function getChapter(book: string, chapter: string, translationId: string, isFallbackAttempt = false): Promise<BibleChapterResponse | null> {
  let chapterData: BibleChapterResponse | null = null;

  // Use Bolls for BSB and KJV to get Strongs
  if (translationId === 'BSB' || translationId === 'KJV') {
    chapterData = await getChapterFromBolls(translationId, book, chapter);
  } 
  
  if (!chapterData && API_BIBLE_TRANSLATIONS.includes(translationId)) {
    chapterData = await getChapterFromApiBible(book, chapter, translationId as keyof typeof API_BIBLE_IDS);
  } 
  
  if (!chapterData) {
    const bookId = BIBLE_BOOKS_ABBR[book] || book;
    try {
        const response = await fetch(`https://bible.helloao.org/api/${translationId}/${bookId}/${chapter}.json`);
        if (response.ok) {
            const data = await response.json();
            if (data?.chapter?.content) {
                chapterData = data as BibleChapterResponse;
                chapterData.chapter.content.forEach(item => {
                    if (item.type === 'verse' && item.content) item.content = collapseVerseContent(item.content);
                });
            }
        }
    } catch (error) {}
  }

  if (chapterData) return chapterData;
  if (!isFallbackAttempt && translationId !== 'BSB') return await getChapter(book, chapter, 'BSB', true);
  return null;
}

async function getBooks(translationId: string): Promise<Book[]> {
    const bibleId = API_BIBLE_IDS[translationId as keyof typeof API_BIBLE_IDS] || 'a556c5305ee15c3f-01'; 
    const apiKey = "n-eVwCRekVC0-oL2B6_s3";
    
    try {
        const res = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/books?include-chapters=true`, { headers: { 'api-key': apiKey } });
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data || []).map((book: any) => {
            const testament = OLD_TESTAMENT_BOOK_NAMES.includes(book.name) ? 'OT' : 'NT';
            return { id: book.id, commonName: book.name, numberOfChapters: book.chapters.length, testament };
        }).filter((b: any) => b.testament);
    } catch (error) { return []; }
}

export async function getPageData(book: string, chapter: string, translationId: string) {
    const [booksData, chapterContent, crossRefData] = await Promise.all([
        getBooks(translationId),
        getChapter(book, chapter, translationId),
        getCrossReferences(book, chapter),
    ]);
    return { books: booksData, chapterData: chapterContent, crossRefs: crossRefData };
}
