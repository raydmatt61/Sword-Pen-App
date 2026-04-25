
"use server";

import { generateVerseInsights as generateVerseInsightsFlow } from "@/ai/flows/generate-verse-insights";
import { API_BIBLE_IDS_SEARCH, BIBLE_BOOKS_ABBR, TRANSLATIONS, STATIC_BOOKS, BIBLE_ABBR_BOOKS } from "@/lib/bible";
import type { GenerateVerseInsightsInput, GenerateVerseInsightsOutput, SearchResultVerse, BibleChapterResponse, Book, CrossRefChapterResponse, ChapterContentItem, VerseContent, FormattedText, StrongsDetail } from "@/lib/bible";

const API_KEY = "n-eVwCRekVC0-oL2B6_s3";

/**
 * Cleans API text by replacing HTML tags with spaces to prevent word joining,
 * then collapsing multiple spaces and trimming.
 */
function cleanApiText(text: string): string {
    if (!text) return "";
    return text
        // Replace known block-level and inline tags that act as word separators with spaces
        .replace(/<(br|p|div|span|b|i|i|em|strong|sup|sub)[^>]*>/gi, ' ')
        .replace(/<\/(br|p|div|span|b|i|i|em|strong|sup|sub)>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')      // Catch-all for any other tags
        .replace(/&nbsp;/g, ' ')      // Replace non-breaking spaces
        .replace(/\s+/g, ' ')         // Collapse multiple spaces
        .replace(/([,.;:!?])([^\s\d])/g, '$1 $2') // Ensure space after punctuation
        .replace(/([^\s])([(\["'‘“])/g, '$1 $2')   // Space before opening brackets/quotes
        .replace(/([)\]"'’ ”])([^\s,. ;:!?])/g, '$1 $2') // Space after closing brackets/quotes
        .trim();
}

/**
 * Collapses and cleans verse content segments to ensure proper spacing.
 */
function collapseVerseContent(content: VerseContent[]): VerseContent[] {
    if (!content || content.length === 0) return [];

    const result: VerseContent[] = [];
    let lastTextItem: FormattedText | null = null;

    for (let i = 0; i < content.length; i++) {
        const item = content[i];
        
        const isMergeableText = typeof item === 'string' || (typeof item === 'object' && item !== null && 'text' in item && !('noteId' in item));

        if (!isMergeableText) {
            result.push(item);
            lastTextItem = null;
            continue;
        }

        const currentObj: FormattedText = typeof item === 'string' ? { text: item } : { ...item } as FormattedText;
        if (!currentObj.text) continue;

        // Clean the text segment
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
    const bibleId = API_BIBLE_IDS_SEARCH[translationId as keyof typeof API_BIBLE_IDS_SEARCH];
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

async function getChapterFromBolls(translationCode: string, book: string, chapter: string): Promise<BibleChapterResponse | null> {
    const bookAbbr = BIBLE_BOOKS_ABBR[book] || book;
    const bookNumber = (STATIC_BOOKS.find(b => b.id === bookAbbr || b.commonName === book)?.id && (STATIC_BOOKS.indexOf(STATIC_BOOKS.find(b => b.id === bookAbbr || b.commonName === book)!) + 1)) || 1;

    try {
        const url = `https://bolls.life/get-chapter/${translationCode}/${bookNumber}/${chapter}/`;
        const response = await fetch(url, { next: { revalidate: 86400 } });
        if (!response.ok) return null;
        const bollsVerses: any[] = await response.json();
        if (!bollsVerses || bollsVerses.length === 0) return null;
        
        const chapterContent: ChapterContentItem[] = bollsVerses.map(v => ({
            type: 'verse',
            number: v.verse,
            content: collapseVerseContent([{ text: cleanApiText(v.text) }])
        }));

        const translationName = TRANSLATIONS.find(t => t.id === translationCode)?.name || translationCode;

        return {
            book: { name: BIBLE_ABBR_BOOKS[bookAbbr] || book, id: bookAbbr },
            chapter: { number: parseInt(chapter, 10), content: chapterContent },
            translation: { name: translationName, id: translationCode },
        };
    } catch (error) { return null; }
}

async function getChapterFromLabsBible(book: string, chapter: string): Promise<BibleChapterResponse | null> {
    try {
        const passage = `${book.replace(/ /g, '+')}+${chapter}`;
        const url = `https://labs.bible.org/api/?passage=${passage}&type=json`;
        const response = await fetch(url, { next: { revalidate: 86400 } });
        if (!response.ok) return null;
        const labsVerses: any[] = await response.json();
        if (!labsVerses || !Array.isArray(labsVerses)) return null;

        const chapterContent: ChapterContentItem[] = labsVerses.map(v => ({
            type: 'verse',
            number: parseInt(v.verse, 10),
            content: collapseVerseContent([{ 
                text: cleanApiText(v.text).replace(/^\d+\s*/, '')
            }])
        }));

        const bookAbbr = BIBLE_BOOKS_ABBR[book] || book;
        return {
            book: { name: book, id: bookAbbr },
            chapter: { number: parseInt(chapter, 10), content: chapterContent },
            translation: { name: "New English Translation", id: "NET" },
        };
    } catch (error) {
        return null;
    }
}

async function getChapterFromWeb(book: string, chapter: string): Promise<BibleChapterResponse | null> {
    const bookAbbr = BIBLE_BOOKS_ABBR[book] || book;
    try {
        // Use the official HelloAO API which is more stable than raw GitHub files
        const url = `https://bible.helloao.org/api/t/engwebp/${bookAbbr}/${chapter}.json`;
        const response = await fetch(url, { next: { revalidate: 86400 } });
        if (!response.ok) return null;
        const data = await response.json();
        
        // Clean up the text in all content items
        if (data.chapter && data.chapter.content) {
            data.chapter.content = data.chapter.content.map((item: any) => {
                if (item.type === 'verse') {
                    return { ...item, content: collapseVerseContent(item.content.map((c: any) => 
                        typeof c === 'string' ? cleanApiText(c) : (typeof c === 'object' && c.text ? { ...c, text: cleanApiText(c.text) } : c)
                    )) };
                }
                return item;
            });
        }

        return {
            ...data,
            translation: { name: "World English Bible", id: "WEB" }
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
  let chapterData: BibleChapterResponse | null = null;

  const normalizedId = translationId.toUpperCase();

  if (normalizedId === 'BSB' || normalizedId === 'KJV') {
    chapterData = await getChapterFromBolls(normalizedId, book, chapter);
  } else if (normalizedId === 'NET') {
      chapterData = await getChapterFromLabsBible(book, chapter);
  } else if (normalizedId === 'WEB') {
      chapterData = await getChapterFromWeb(book, chapter);
  }
  
  if (chapterData) return chapterData;
  
  // Fallback to BSB if the requested translation fails
  if (!isFallbackAttempt && normalizedId !== 'BSB') {
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
