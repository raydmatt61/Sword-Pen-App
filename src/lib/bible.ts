
import { z } from 'zod';

export type Translation = {
    id: string;
    name: string;
};

export const TRANSLATIONS: Translation[] = [
    { id: 'BSB', name: 'Berean Standard Bible' },
    { id: 'engnet', name: 'New English Translation' },
    { id: 'WEB', name: 'World English Bible' },
    { id: 'CSB', name: 'Christian Standard Bible' },
    { id: 'NIV', name: 'New International Version' },
    { id: 'NASB', name: 'New American Standard Bible' },
    { id: 'KJV', name: 'King James Version' },
];

export const BIBLE_BOOKS_ABBR: Record<string, string> = {
    "Genesis": "GEN", "Exodus": "EXO", "Leviticus": "LEV", "Numbers": "NUM", "Deuteronomy": "DEU", "Joshua": "JOS", "Judges": "JDG", "Ruth": "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA",
    "1 Kings": "1KI", "2 Kings": "2KI", "1 Chronicles": "1CH", "2 Chronicles": "2CH", "Ezra": "EZR", "Nehemiah": "NEH", "Esther": "EST", "Job": "JOB", "Psalms": "PSA", "Proverbs": "PRO",
    "Ecclesiastes": "ECC", "Song of Solomon": "SNG", "Isaiah": "ISA", "Jeremiah": "JER", "Lamentations": "LAM", "Ezekiel": "EZK", "Daniel": "DAN", "Hosea": "HOS", "Joel": "JOL",
    "Amos": "AMO", "Obadiah": "OBA", "Jonah": "JON", "Micah": "MIC", "Nahum": "NAM", "Habakkuk": "HAB", "Zephaniah": "ZEP", "Haggai": "HAG", "Zechariah": "ZEC", "Malachi": "MAL",
    "Matthew": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT", "Romans": "ROM", "1 Corinthians": "1CO", "2 Corinthians": "2CO", "Galatians": "GAL", "Ephesians": "EPH",
    "Philippians": "PHP", "Colossians": "COL", "1 Thessalonians": "1TH", "2 Thessalonians": "2TH", "1 Timothy": "1TI", "2 Timothy": "2TI", "Titus": "TIT", "Philemon": "PHM",
    "Hebrews": "HEB", "James": "JAS", "1 Peter": "1PE", "2 Peter": "2PE", "1 John": "1JN", "2 John": "2JN", "3 John": "3JN", "Jude": "JUD", "Revelation": "REV"
};

export const OLD_TESTAMENT_BOOK_NAMES = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Song of Songs", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
    "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"
];

export const NEW_TESTAMENT_BOOK_NAMES = [
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon",
    "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

export const BIBLE_BOOK_NUMBERS: Record<string, number> = {
    "Genesis": 1, "Exodus": 2, "Leviticus": 3, "Numbers": 4, "Deuteronomy": 5, "Joshua": 6, "Judges": 7, "Ruth": 8, "1 Samuel": 9, "2 Samuel": 10,
    "1 Kings": 11, "2 Kings": 12, "1 Chronicles": 13, "2 Chronicles": 14, "Ezra": 15, "Nehemiah": 16, "Esther": 17, "Job": 18, "Psalms": 19, "Proverbs": 20,
    "Ecclesiastes": 21, "Song of Solomon": 22, "Song of Songs": 22, "Isaiah": 23, "Jeremiah": 24, "Lamentations": 25, "Ezekiel": 26, "Daniel": 27, "Hosea": 28, "Joel": 29,
    "Amos": 30, "Obadiah": 31, "Jonah": 32, "Micah": 33, "Nahum": 34, "Habakkuk": 35, "Zephaniah": 36, "Haggai": 37, "Zechariah": 38, "Malachi": 39,
    "Matthew": 40, "Mark": 41, "Luke": 42, "John": 43, "Acts": 44, "Romans": 45, "1 Corinthians": 46, "2 Corinthians": 47, "Galatians": 48, "Ephesians": 49,
    "Philippians": 50, "Colossians": 51, "1 Thessalonians": 52, "2 Thessalonians": 53, "1 Timothy": 54, "2 Timothy": 55, "Titus": 56, "Philemon": 57,
    "Hebrews": 58, "James": 59, "1 Peter": 60, "2 Peter": 61, "1 John": 62, "2 John": 63, "3 John": 64, "Jude": 65, "Revelation": 66
};

export const BIBLE_BOOKS = Object.keys(BIBLE_BOOKS_ABBR);

export type Footnote = {
    id: string;
    text: string;
};

export type FormattedText = {
    text: string;
    poem?: number;
    wordsOfJesus?: boolean;
    strongs?: string;
};

export type InlineHeading = {
    heading: string;
};

export type InlineLineBreak = {
    lineBreak: true;
};

export type VerseFootnoteReference = {
    noteId: string;
};

export type VerseContent = string | FormattedText | InlineHeading | InlineLineBreak | VerseFootnoteReference;

export type HebrewSubtitleContent = string | FormattedText | VerseFootnoteReference;

export type ChapterContentItem = {
    type: 'heading';
    content: string[];
} | {
    type: 'line_break';
} | {
    type: 'verse';
    number: number;
    content: VerseContent[];
} | {
    type: 'hebrew_subtitle';
    content: HebrewSubtitleContent[];
};

export type BibleChapterResponse = {
    book: {
        name: string;
        id: string;
    };
    chapter: {
        number: number;
        content: ChapterContentItem[];
        footnotes?: Footnote[];
    };
    translation: {
        name: string;
        id: string;
    };
    copyright?: string;
};

export type Book = {
    id: string;
    commonName: string;
    numberOfChapters: number;
    testament: 'OT' | 'NT';
};

export type Annotation = {
  id: string;
  userId: string;
  translation: string;
  book: string;
  chapter: number;
  verse: number;
  start: number;
  end: number;
  text: string;
  note?: string;
  highlight?: string;
  underline?: string;
  createdAt?: any;
  updatedAt?: any;
  groupId?: string;
};

export type Bookmark = {
  id: string;
  userId: string;
  translation: string;
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  text?: string;
  createdAt?: any;
};

export type CrossRef = {
    book: string;
    chapter: number;
    verse: number;
    endVerse?: number;
    score?: number;
};

export type CrossRefVerse = {
    verse: number;
    references: CrossRef[];
};

export type CrossRefChapterResponse = {
    book: {
        id: string;
        name: string;
    };
    chapter: {
        number: number;
        content: CrossRefVerse[];
    };
};

export const BIBLE_ABBR_BOOKS: Record<string, string> = Object.fromEntries(
    Object.entries(BIBLE_BOOKS_ABBR).map(([name, abbr]) => [abbr, name])
);

export type SearchResultVerse = {
    id: string;
    reference: string;
    text: string;
    bookId: string;
};

export const API_BIBLE_IDS_SEARCH: Record<string, string> = {
    CSB: 'a556c5305ee15c3f-01',
    NIV: '78a9f6124f344018-01',
    NASB: 'b8ee27bcd1cae43a-01',
    KJV: 'de4e12af7f28f599-01',
    WEB: '72f4e6dc683324df-01',
};

export const GenerateVerseInsightsInputSchema = z.object({
    verse: z.string().describe('The Bible verse to analyze.'),
    annotations: z.string().describe('User annotations for the verse.'),
});

export const GenerateVerseInsightsOutputSchema = z.object({
    insights: z.string().describe('AI-generated insights for the verse based on user annotations.'),
});

export type GenerateVerseInsightsInput = z.infer<typeof GenerateVerseInsightsInputSchema>;
export type GenerateVerseInsightsOutput = z.infer<typeof GenerateVerseInsightsOutputSchema>;
