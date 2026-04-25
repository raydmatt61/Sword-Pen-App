"use server";

import { generateVerseInsights as generateVerseInsightsFlow } from "@/ai/flows/generate-verse-insights";
import { API_BIBLE_IDS_SEARCH, BIBLE_BOOKS_ABBR, BIBLE_BOOK_NUMBERS, TRANSLATIONS, BOOK_TESTAMENTS, STATIC_BOOKS } from "@/lib/bible";
import type { GenerateVerseInsightsInput, GenerateVerseInsightsOutput, SearchResultVerse, BibleChapterResponse, Book, CrossRefChapterResponse, ChapterContentItem, VerseContent, FormattedText, StrongsDetail } from "@/lib/bible";

const API_KEY = "n-eVwCRekVC0-oL2B6_s3";

/**
 * Cleans API text by replacing HTML tags with spaces to prevent word joining,
 * then collapsing multiple spaces and trimming.
 */
function cleanApiText(text: string): string {
    if (!text) return "";
    return text
        .replace(/<br\s*\/?>/gi, ' ') // Replace breaks with space
        .replace(/<[^>]+>/g, ' ')      // Replace ALL other HTML tags with space to prevent word sticking
        .replace(/&nbsp;/g, ' ')      // Replace non-breaking spaces
        .replace(/\s+/g, ' ')         // Collapse multiple spaces
        .replace(/([,.;:!?])([^\s\d])/g, '$1 $2') // Ensure space after punctuation
        .replace(/([^\s])([(\["'‘“])/g, '$1 $2')   // Space before opening brackets/quotes
        .replace(/([)\]"'’ ”])([^\s,. ;:!?])/g, '$1 $2') // Space after closing brackets/quotes
        .trim();
}

export async function searchBible(input: { query: string; translationId: string }): Promise<{ verses: SearchResultVerse[] } | null> {
    const { query, translationId } = input;
    const bibleId = API_BIBLE_IDS_SEARCH[translationId as keyof typeof API_BIBLE_IDS_SEARCH];
    if (!bibleId) {
        throw new Error(`Search is not supported for the "${translationId}" translation.`);
    }

    try {
        const response = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/search?query=${encodeURIComponent(query)}&sort=relevance`, {
            headers: { 'api-key': API_KEY }
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

        // Ensure natural spacing
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

async function getChapterFromBolls(translationCode: string, book: string, chapter: string): Promise<BibleChapterResponse | null> {
    const bookNumber = BIBLE_BOOK_NUMBERS[book as keyof typeof BIBLE_BOOK_NUMBERS];
    if (!bookNumber) return null;

    try {
        const url = `https://bolls.life/get-chapter/${translationCode}/${bookNumber}/${chapter}/`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const bollsVerses: any[] = await response.json();
        if (!bollsVerses || bollsVerses.length === 0) return null;
        
        const prefix = BOOK_TESTAMENTS[BIBLE_BOOKS_ABBR[book]] === 'OT' ? 'H' : 'G';
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
                    segments.push(part.replace(/<[^>]+>/g, ' '));
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
        };
    } catch (error) { return null; }
}

async function getChapterFromLabsBible(book: string, chapter: string): Promise<BibleChapterResponse | null> {
    try {
        // labs.bible.org works best with "Book+Chapter" format
        const passage = `${book.replace(/ /g, '+')}+${chapter}`;
        const url = `https://labs.bible.org/api/?passage=${passage}&type=json`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const labsVerses: any[] = await response.json();
        if (!labsVerses || !Array.isArray(labsVerses)) return null;

        const chapterContent: ChapterContentItem[] = labsVerses.map(v => ({
            type: 'verse',
            number: parseInt(v.verse, 10),
            content: [{ 
                // Strip leading verse numbers which sometimes appear in the text and clean spacing
                text: cleanApiText(v.text).replace(/^\d+\s*/, '')
            }]
        }));

        return {
            book: { name: book, id: BIBLE_BOOKS_ABBR[book] || book },
            chapter: { number: parseInt(chapter, 10), content: chapterContent },
            translation: { name: "New English Translation", id: "NET" },
        };
    } catch (error) {
        return null;
    }
}

async function getChapterFromHelloAo(book: string, chapter: string): Promise<BibleChapterResponse | null> {
    const bookAbbr = BIBLE_BOOKS_ABBR[book];
    if (!bookAbbr) return null;

    try {
        // Use GitHub Raw as a reliable source for WEB (British)
        const url = `https://raw.githubusercontent.com/HelloAOLab/bible-api/main/bible/engwebp/${bookAbbr}/${chapter}.json`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        
        if (data.chapter && data.chapter.content) {
            const chapterContent: ChapterContentItem[] = data.chapter.content.map((item: any) => {
                if (item.type === 'heading') {
                    return {
                        type: 'heading',
                        content: item.content.map((c: any) => cleanApiText(c))
                    };
                }
                if (item.type === 'verse') {
                    return {
                        type: 'verse',
                        number: item.number,
                        content: item.content.map((c: any) => {
                            if (typeof c === 'string') return cleanApiText(c);
                            if (c && typeof c === 'object' && c.text) return { text: cleanApiText(c.text), wordsOfJesus: c.wordsOfJesus };
                            return "";
                        })
                    };
                }
                return { type: 'line_break' };
            });

            return {
                book: { name: book, id: bookAbbr },
                chapter: { number: parseInt(chapter, 10), content: chapterContent },
                translation: { name: "World English Bible", id: "WEB" },
            };
        }
    } catch (error) {
        console.error("HelloAO API error:", error);
    }
    return null;
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

  if (translationId === 'BSB' || translationId === 'KJV') {
    chapterData = await getChapterFromBolls(translationId, book, chapter);
  } else if (translationId === 'NET') {
      chapterData = await getChapterFromLabsBible(book, chapter);
  } else if (translationId === 'WEB') {
      chapterData = await getChapterFromHelloAo(book, chapter);
  }
  
  if (chapterData) return chapterData;
  
  // Fallback to BSB if the requested translation fails
  if (!isFallbackAttempt && translationId !== 'BSB') {
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
