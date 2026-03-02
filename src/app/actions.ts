
"use server";

import { generateVerseInsights as generateVerseInsightsFlow } from "@/ai/flows/generate-verse-insights";
import { API_BIBLE_IDS_SEARCH, BIBLE_BOOKS_ABBR, BIBLE_BOOK_NUMBERS, TRANSLATIONS, OLD_TESTAMENT_BOOK_NAMES, NEW_TESTAMENT_BOOK_NAMES } from "@/lib/bible";
import type { GenerateVerseInsightsInput, GenerateVerseInsightsOutput, SearchResultVerse, StrongsDetail, BibleChapterResponse, Book, CrossRefChapterResponse, ChapterContentItem, VerseContent, FormattedText, VerseFootnoteReference } from "@/lib/bible";

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

export async function getStrongsDetail(strongsNumber: string): Promise<StrongsDetail[] | null> {
    const cleanStrongs = strongsNumber.trim().toUpperCase();
    if (!cleanStrongs) return null;

    async function fetchFromBolls(code: string) {
        // We try multiple variants of the Bolls Strong's API to ensure maximum coverage
        const urls = [
            `https://bolls.life/api/strongs/${code}/`,
            `https://bolls.life/api/strongs/BSB/${code}/`,
            `https://bolls.life/api/strongs/KJV/${code}/`
        ];

        for (const url of urls) {
            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();
                    // The API returns an object where keys are Strong's numbers (e.g., {"G2424": {...}})
                    // We iterate keys to find the first valid non-error entry
                    for (const key in data) {
                        const entry = data[key];
                        if (entry && !entry.error && (entry.lemma || entry.strongs_def)) {
                            return entry;
                        }
                    }
                }
            } catch (e) {}
        }
        return null;
    }

    let strongsData = await fetchFromBolls(cleanStrongs);
    
    // Fallback logic for Greek/Hebrew if prefix was missing from user input
    if (!strongsData) {
        const numOnly = cleanStrongs.replace(/^[GH]/, '');
        if (/^\d+$/.test(numOnly)) {
            if (!cleanStrongs.startsWith('G')) {
                strongsData = await fetchFromBolls('G' + numOnly);
            }
            if (!strongsData && !cleanStrongs.startsWith('H')) {
                strongsData = await fetchFromBolls('H' + numOnly);
            }
        }
    }
    
    if (!strongsData) return null;

    return [{
        strongsNumber: cleanStrongs,
        lemma: strongsData.lemma || '',
        transliteration: strongsData.xlit || '',
        pronunciation: strongsData.pron || '',
        shortDefinition: strongsData.strongs_def || '',
        kjvDefinition: strongsData.kjv_def || '',
        strongsDerivation: strongsData.derivation || '',
    }];
}

export async function generateVerseInsights(input: GenerateVerseInsightsInput): Promise<GenerateVerseInsightsOutput> {
  try {
    return await generateVerseInsightsFlow(input);
  } catch (error) {
    throw new Error("Failed to generate AI insights.");
  }
}

function parseBollsStrongTags(text: string, prefix: 'G' | 'H'): VerseContent[] {
    const content: VerseContent[] = [];
    const regex = /([^<]+)|(<S>(\d+)<\/S>)|(<[^>]+>)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match[1]) { 
            content.push(match[1]);
        } else if (match[2]) {
            const strongsNum = prefix + match[3];
            const lastIdx = content.length - 1;
            
            if (lastIdx >= 0) {
                const lastItem = content[lastIdx];
                if (typeof lastItem === 'string') {
                    content[lastIdx] = { text: lastItem, strongs: [strongsNum] };
                } else if (typeof lastItem === 'object' && 'text' in lastItem && !('noteId' in lastItem)) {
                    const ft = lastItem as FormattedText;
                    if (!ft.strongs) ft.strongs = [];
                    if (!ft.strongs.includes(strongsNum)) ft.strongs.push(strongsNum);
                } else {
                    content.push({ text: '', strongs: [strongsNum] });
                }
            } else {
                content.push({ text: '', strongs: [strongsNum] });
            }
        }
    }

    if (content.length === 0 && text) content.push(text);
    return content;
}

function collapseVerseContent(content: VerseContent[]): VerseContent[] {
    if (!content || content.length === 0) return [];

    const result: VerseContent[] = [];
    let lastTextItem: FormattedText | null = null;

    for (let i = 0; i < content.length; i++) {
        const item = content[i];
        const currentIsText = typeof item === 'string' || (typeof item === 'object' && item !== null && 'text' in item && !('noteId' in item));

        if (!currentIsText) {
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
                const isLastPunct = /[.,!?:;’”)}\]'’]/.test(lastChar);
                const isFirstPunct = /[.,!?:;’”)}\]'’]/.test(firstChar);
                const isLastSpace = /\s/.test(lastChar);
                const isFirstSpace = /\s/.test(firstChar);
                const isLastOpener = /[(\["'‘“]/.test(lastChar);

                // Standard word-to-word spacing
                if (!isLastSpace && !isFirstSpace && !isLastOpener && !isFirstPunct) {
                    needsSpace = true;
                }
                
                // Fix punctuation-to-word cases (e.g., "The elder,To" -> "The elder, To")
                if (isLastPunct && !isLastSpace && !isFirstSpace && /[a-zA-Z0-9]/.test(firstChar)) {
                    needsSpace = true;
                }
            }

            const isJesusEqual = !!lastTextItem.wordsOfJesus === !!currentObj.wordsOfJesus;
            const isStrongsEqual = JSON.stringify(lastTextItem.strongs) === JSON.stringify(currentObj.strongs);

            if (isJesusEqual && isStrongsEqual) {
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
    const isOT = OLD_TESTAMENT_BOOK_NAMES.includes(book);
    const prefix = isOT ? 'H' : 'G';

    try {
        const url = `https://bolls.life/get-chapter/${translationCode}/${bookNumber}/${chapter}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const bollsVerses: any[] = await response.json();
        if (!bollsVerses || bollsVerses.length === 0) return null;
        
        const chapterContent: ChapterContentItem[] = bollsVerses.map(v => ({
            type: 'verse',
            number: v.verse,
            content: collapseVerseContent(parseBollsStrongTags(v.text, prefix))
        }));

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
  const apiKey = process.env.NEXT_PUBLIC_API_BIBLE_KEY;
  if (!apiKey) return null;
  
  try {
    const response = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/passages/${chapterId}?content-type=json&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true`, { headers: { 'api-key': apiKey } });
    if (!response.ok) return null;

    const json = await response.json();
    const data = json.data;
    let content_data = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
    
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
                     chapterContent.push({ type: 'verse', number: currentVerseNumber, content: collapseVerseContent(currentVerseContent) });
                     currentVerseContent = [];
                     currentVerseNumber = null;
                }
                if(startNewVerse) currentVerseNumber = startNewVerse;
                if (item.name === 'para' && item.attrs?.style === 'h') {
                    const headingText = item.items?.map((i: any) => i.text).join(' ').trim();
                    if(headingText) chapterContent.push({ type: 'heading', content: [headingText] });
                }
                const isNewWoc = isWoc || (item.name === 'char' && item.attrs?.style === 'woc');
                if (item.items) processItems(item.items, isNewWoc);
            } else if (item.type === 'text' && typeof item.text === 'string' && currentVerseNumber !== null) {
                currentVerseContent.push({ text: item.text, wordsOfJesus: isWoc });
            } else if (item.type === 'verse' && item.attrs?.number) {
                if (currentVerseNumber !== null && currentVerseContent.length > 0) {
                    chapterContent.push({ type: 'verse', number: currentVerseNumber, content: collapseVerseContent(currentVerseContent) });
                    currentVerseContent = [];
                }
                currentVerseNumber = parseInt(item.attrs.number, 10);
            }
        });
    };
    
    if (content_data) processItems(content_data);
    if (currentVerseNumber !== null && currentVerseContent.length > 0) {
        chapterContent.push({ type: 'verse', number: currentVerseNumber, content: collapseVerseContent(currentVerseContent) });
    }

    return {
      book: { name: book, id: bookAbbr },
      chapter: { number: parseInt(chapter, 10), content: chapterContent },
      translation: { name: TRANSLATIONS.find(t => t.id === translationId)?.name || translationId, id: translationId },
      copyright: data.copyright,
    };
  } catch (error) { return null; }
}

async function getChapter(book: string, chapter: string, translationId: string, isFallbackAttempt = false): Promise<BibleChapterResponse | null> {
  let chapterData: BibleChapterResponse | null = null;

  // Prefer Bolls Life for KJV and BSB as they often include Strong's tagging
  if (translationId === 'KJV' || translationId === 'BSB') {
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
    const apiKey = process.env.NEXT_PUBLIC_API_BIBLE_KEY;
    if (!apiKey) return [];
    
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
