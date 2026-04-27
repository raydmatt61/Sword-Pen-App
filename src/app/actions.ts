
"use server";

import { generateVerseInsights as generateVerseInsightsFlow } from "@/ai/flows/generate-verse-insights";
import { BIBLE_BOOKS_ABBR, TRANSLATIONS, STATIC_BOOKS, BIBLE_ABBR_BOOKS, BIBLE_BOOK_NUMBERS, API_BIBLE_IDS_SEARCH, COPYRIGHTS, NOTES_LINKS } from "@/lib/bible";
import type { GenerateVerseInsightsInput, GenerateVerseInsightsOutput, SearchResultVerse, BibleChapterResponse, Book, CrossRefChapterResponse, ChapterContentItem, VerseContent, FormattedText, StrongsDetail } from "@/lib/bible";

const API_KEY = "n-eVwCRekVC0-oL2B6_s3";

/**
 * Cleans API text by replacing HTML tags with spaces to prevent word joining,
 * then collapsing multiple spaces and trimming.
 */
function cleanApiText(text: string): string {
    if (!text) return "";
    return text
        .replace(/<(br|p|div|span|b|i|i|em|strong|sup|sub|a)[^>]*>/gi, ' ')
        .replace(/<\/(br|p|div|span|b|i|i|em|strong|sup|sub|a)>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Collapses and cleans verse content segments to ensure proper spacing.
 */
function collapseVerseContent(content: VerseContent[]): VerseContent[] {
    if (!content || content.length === 0) return [];

    const result: VerseContent[] = [];
    let lastTextItem: FormattedText | null = null;

    for (const item of content) {
        const isMergeableText = typeof item === 'string' || (typeof item === 'object' && item !== null && 'text' in item && !('noteId' in item));

        if (!isMergeableText) {
            result.push(item);
            lastTextItem = null;
            continue;
        }

        const currentObj: FormattedText = typeof item === 'string' ? { text: item } : { ...item } as FormattedText;
        if (!currentObj.text) continue;

        currentObj.text = currentObj.text.replace(/\s+/g, ' ');

        if (lastTextItem) {
            const lastText = lastTextItem.text;
            const currentText = currentObj.text;
            
            const lastChar = lastText.slice(-1);
            const firstChar = currentText.charAt(0);

            let needsSpace = false;
            if (lastChar && firstChar && !/\s/.test(lastChar) && !/\s/.test(firstChar)) {
                const isFirstPunct = /[.,!?:;’”)}\]'’]/.test(firstChar);
                const isLastOpener = /[(\["'‘“]/.test(lastChar);
                if (!isFirstPunct && !isLastOpener) {
                    needsSpace = true;
                }
            }

            const isJesusEqual = !!lastTextItem.wordsOfJesus === !!currentObj.wordsOfJesus;
            const isStrongsEqual = lastTextItem.strongs === currentObj.strongs;

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

export async function searchBible(input: { query: string; translationId: string }): Promise<{ verses: SearchResultVerse[] } | null> {
    const { query, translationId } = input;
    const bibleId = API_BIBLE_IDS_SEARCH[translationId.toUpperCase()];
    if (!bibleId) {
        throw new Error(`Search is not supported for the "${translationId}" translation.`);
    }

    try {
        const response = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/search?query=${encodeURIComponent(query)}&sort=relevance`, {
            headers: { 'api-key': API_KEY },
            next: { revalidate: 3600 }
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
                text: cleanApiText(v.text),
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

async function getChapterFromBolls(translationId: string, book: string, chapter: string): Promise<BibleChapterResponse | null> {
    const bookAbbr = BIBLE_BOOKS_ABBR[book] || book;
    const bookNumber = BIBLE_BOOK_NUMBERS[book] || BIBLE_BOOK_NUMBERS[bookAbbr.toUpperCase()];
    
    if (!bookNumber) return null;

    try {
        const versionId = translationId.toUpperCase();
        const url = `https://bolls.life/get-text/${versionId}/${bookNumber}/${chapter}/`;
        const response = await fetch(url, { next: { revalidate: 86400 } });
        
        if (!response.ok) return null;
        
        const bollsVerses = await response.json();
        if (!bollsVerses || !Array.isArray(bollsVerses) || bollsVerses.length === 0) return null;

        const chapterContent: ChapterContentItem[] = bollsVerses.map(v => {
            const verseNum = v.verse || v.v || v.number;
            const verseText = v.text || v.t || v.content;
            return {
                type: 'verse',
                number: verseNum,
                content: collapseVerseContent([{ text: cleanApiText(verseText) }])
            };
        });

        const translationName = TRANSLATIONS.find(t => t.id === versionId)?.name || translationId;
        const bookName = BIBLE_ABBR_BOOKS[bookAbbr] || book;
        const copyright = COPYRIGHTS[versionId];
        const notesUrl = NOTES_LINKS[versionId];

        return {
            book: { name: bookName, id: bookAbbr },
            chapter: { number: parseInt(chapter, 10), content: chapterContent },
            translation: { name: translationName, id: versionId },
            copyright,
            notesUrl
        };
    } catch (error) {
        return null;
    }
}

async function getCrossReferences(book: string, chapter: string): Promise<CrossRefChapterResponse | null> {
  const CanonicalBook = BIBLE_BOOKS_ABBR[book] || book;
  try {
    const response = await fetch(`https://bible.helloao.org/api/d/open-cross-ref/${CanonicalBook}/${chapter}.json`);
    if (response.ok) {
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }
  } catch (error) {}
  return null;
}

export async function getChapter(book: string, chapter: string, translationId: string, isFallbackAttempt = false): Promise<BibleChapterResponse | null> {
  const chapterData = await getChapterFromBolls(translationId, book, chapter);
  
  if (chapterData) return chapterData;
  
  if (!isFallbackAttempt && translationId.toUpperCase() !== 'BSB') {
    return await getChapter(book, chapter, 'BSB', true);
  }
  return null;
}

export async function getBooks(translationId: string): Promise<Book[]> {
    return STATIC_BOOKS;
}

export async function getPageData(book: string, chapter: string, translationId: string) {
    const [booksData, chapterContent, crossRefData] = await Promise.all([
        getBooks(translationId),
        getChapter(book, chapter, translationId),
        getCrossReferences(book, chapter),
    ]);
    return { books: booksData, chapterData: chapterContent, crossRefs: crossRefData };
}

export async function getStrongsDetail(strongsNumber: string): Promise<StrongsDetail[] | null> {
    try {
        const isGreek = strongsNumber.startsWith('G');
        const number = strongsNumber.substring(1);
        const url = isGreek 
            ? `https://bolls.life/get-greek-lexicon/${number}/`
            : `https://bolls.life/get-hebrew-lexicon/${number}/`;
        
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') return [data];
        return null;
    } catch (error) {
        return null;
    }
}
