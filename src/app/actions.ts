"use server";

import { generateVerseInsights as generateVerseInsightsFlow } from "@/ai/flows/generate-verse-insights";
import { BIBLE_BOOKS_ABBR, TRANSLATIONS, STATIC_BOOKS, BIBLE_ABBR_BOOKS, BIBLE_BOOK_NUMBERS, API_BIBLE_IDS_SEARCH, COPYRIGHTS, NOTES_LINKS } from "@/lib/bible";
import type { GenerateVerseInsightsInput, GenerateVerseInsightsOutput, SearchResultVerse, BibleChapterResponse, Book, CrossRefChapterResponse, ChapterContentItem, VerseContent, FormattedText, VerseFootnoteReference, StrongsDetail } from "@/lib/bible";

const API_KEY = "n-eVwCRekVC0-oL2B6_s3";

function cleanApiText(text: string): string {
    if (typeof text !== 'string' || !text) return "";
    return text
        .replace(/<([^>]+)>/g, ' <$1> ') 
        .replace(/<(br|p|div|span|h[1-6]|b|i|i|em|strong|sup|sub|a)[^>]*>/gi, ' ')
        .replace(/<\/(br|p|div|span|h[1-6]|b|i|i|em|strong|sup|sub|a)>/gi, ' ')
        .replace(/<[^+]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

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
                if (!isFirstPunct && !isLastOpener) needsSpace = true;
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
    if (!bibleId) throw new Error(`Search is not supported for "${translationId}".`);
    try {
        const response = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/search?query=${encodeURIComponent(query)}&sort=relevance`, {
            headers: { 'api-key': API_KEY },
            next: { revalidate: 3600 }
        });
        if (!response.ok) throw new Error("Search service returned an error.");
        const json = await response.json();
        return {
            verses: (json.data?.verses || []).map((v: any) => ({
                id: v.id,
                reference: v.reference,
                text: cleanApiText(v.text),
                bookId: v.bookId,
            }))
        };
    } catch (error) {
        throw error;
    }
}

export async function generateVerseInsights(input: GenerateVerseInsightsInput): Promise<GenerateVerseInsightsOutput> {
  try {
    return await generateVerseInsightsFlow(input);
  } catch (error) {
    throw new Error("Failed to generate AI insights.");
  }
}

async function getChapterFromApiBible(translationId: string, book: string, chapter: string): Promise<BibleChapterResponse | null> {
    const bibleId = API_BIBLE_IDS_SEARCH[translationId.toUpperCase()];
    if (!bibleId) return null;
    const bookAbbr = BIBLE_BOOKS_ABBR[book] || book;
    const chapterId = `${bookAbbr}.${chapter}`;
    try {
        const response = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/chapters/${chapterId}?content-type=json&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false`, {
            headers: { 'api-key': API_KEY },
            next: { revalidate: 86400 }
        });
        if (!response.ok) return null;
        const json = await response.json();
        const contentHtml = json.data.content;
        if (!contentHtml) return null;
        const chapterContent: ChapterContentItem[] = [];
        const cleanHtml = contentHtml
            .replace(/<(div|h[1-6]|p)\s+[^>]*class="(s\d*|para|mt|ms|mr|r|p|s|m|q\d*)"[^>]*>/gi, '###HEADING###')
            .replace(/<span\s+[^>]*data-number="(\d+)"[^>]*>/gi, ' ###VERSE_$1### ')
            .replace(/<span\s+[^>]*data-sid="[^"]+\.(\d+)"[^>]*>/gi, ' ###VERSE_$1### ')
            .replace(/<span\s+[^>]*class="v"[^>]*data-sid="[^"]+\.(\d+)"[^>]*>/gi, ' ###VERSE_$1### ')
            .replace(/<span\s+[^>]*class="v"[^>]*>(\d+)<\/span>/gi, ' ###VERSE_$1### ')
            .replace(/<\/span>/gi, ' ')
            .replace(/<\/div>|<\/h[1-6]>|<\/p>/gi, ' ###BREAK### ');
        const cleanContent = cleanHtml.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
        const sections = cleanContent.split(/###(HEADING|VERSE_\d+|BREAK)###/);
        for (let i = 1; i < sections.length; i += 2) {
            const marker = sections[i];
            const text = cleanApiText(sections[i+1]);
            if (marker === 'HEADING' && text?.trim()) chapterContent.push({ type: 'heading', content: [text.trim()] });
            else if (marker === 'BREAK') chapterContent.push({ type: 'line_break', content: [] });
            else if (marker.startsWith('VERSE_') && text) {
                chapterContent.push({ type: 'verse', number: parseInt(marker.split('_')[1], 10), content: collapseVerseContent([{ text: text }]) });
            }
        }
        if (chapterContent.length === 0) return null;
        return {
            book: { name: BIBLE_ABBR_BOOKS[bookAbbr] || book, id: bookAbbr },
            chapter: { number: parseInt(chapter, 10), content: chapterContent },
            translation: { name: TRANSLATIONS.find(t => t.id === translationId.toUpperCase())?.name || translationId, id: translationId.toUpperCase() },
            copyright: COPYRIGHTS[translationId.toUpperCase()]
        };
    } catch (error) { return null; }
}

async function getChapterFromBolls(translationId: string, book: string, chapter: string): Promise<BibleChapterResponse | null> {
    const bookAbbr = BIBLE_BOOKS_ABBR[book] || book;
    const bookNumber = BIBLE_BOOK_NUMBERS[book] || BIBLE_BOOK_NUMBERS[bookAbbr.toUpperCase()];
    if (!bookNumber) return null;
    try {
        const url = `https://bolls.life/get-text/${translationId.toUpperCase()}/${bookNumber}/${chapter}/`;
        const response = await fetch(url, { next: { revalidate: 86400 } });
        if (!response.ok) return null;
        const bollsVerses = await response.json();
        if (!bollsVerses || !Array.isArray(bollsVerses) || bollsVerses.length === 0) return null;
        const chapterContent: ChapterContentItem[] = bollsVerses.map(v => ({
            type: 'verse',
            number: v.verse || v.v || v.number,
            content: collapseVerseContent([{ text: cleanApiText(v.text || v.t || v.content) }])
        }));
        return {
            book: { name: BIBLE_ABBR_BOOKS[bookAbbr] || book, id: bookAbbr },
            chapter: { number: parseInt(chapter, 10), content: chapterContent },
            translation: { name: TRANSLATIONS.find(t => t.id === translationId.toUpperCase())?.name || translationId, id: translationId.toUpperCase() },
            copyright: COPYRIGHTS[translationId.toUpperCase()],
            notesUrl: NOTES_LINKS[translationId.toUpperCase()]
        };
    } catch (error) { return null; }
}

export async function getChapter(book: string, chapter: string, translationId: string, isFallbackAttempt = false): Promise<BibleChapterResponse | null> {
  const tid = translationId.toUpperCase();
  if (API_BIBLE_IDS_SEARCH[tid]) {
      const apiData = await getChapterFromApiBible(translationId, book, chapter);
      if (apiData) return apiData;
  }
  const chapterData = await getChapterFromBolls(tid, book, chapter);
  if (chapterData) return chapterData;
  if (tid === 'CSB') {
    const hcsbData = await getChapterFromBolls('HCSB', book, chapter);
    if (hcsbData) return { ...hcsbData, translation: { name: 'Christian Standard Bible', id: 'CSB' } };
  }
  if (!isFallbackAttempt && tid !== 'BSB') return await getChapter(book, chapter, 'BSB', true);
  return null;
}

export async function getBooks(translationId: string): Promise<Book[]> {
    return STATIC_BOOKS;
}

export async function getPageData(book: string, chapter: string, translationId: string) {
    try {
        const canonicalBookAbbr = BIBLE_BOOKS_ABBR[book] || book;
        const crossRefUrl = `https://bible.helloao.org/api/d/open-cross-ref/${canonicalBookAbbr}/${chapter}.json`;
        
        const results = await Promise.all([
            getBooks(translationId),
            getChapter(book, chapter, translationId),
            fetch(crossRefUrl).then(r => r.ok ? r.json() : null).catch(() => null)
        ]);
        
        const booksData = results[0];
        const chapterContent = results[1];
        const crossRefData = results[2];
        
        if (!booksData || !chapterContent) return null;
        return { books: booksData, chapterData: chapterContent, crossRefs: crossRefData };
    } catch (e) {
        return null;
    }
}

export async function getStrongsDetail(strongsNumber: string): Promise<StrongsDetail[] | null> {
    try {
        const isGreek = strongsNumber.startsWith('G');
        const number = strongsNumber.substring(1);
        const url = isGreek ? `https://bolls.life/get-greek-lexicon/${number}/` : `https://bolls.life/get-hebrew-lexicon/${number}/`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return Array.isArray(data) ? data : data ? [data] : null;
    } catch (error) { return null; }
}
