
import { z } from 'zod';

export type Translation = {
    id: string;
    name: string;
};

export const TRANSLATIONS: Translation[] = [
    { id: 'BSB', name: 'Berean Standard Bible' },
    { id: 'KJV', name: 'King James Version' },
    { id: 'engnet', name: 'New English Translation' },
    { id: 'WEB', name: 'World English Bible' },
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

export const STATIC_BOOKS: Book[] = [
  { id: "GEN", commonName: "Genesis", numberOfChapters: 50, testament: "OT" },
  { id: "EXO", commonName: "Exodus", numberOfChapters: 40, testament: "OT" },
  { id: "LEV", commonName: "Leviticus", numberOfChapters: 27, testament: "OT" },
  { id: "NUM", commonName: "Numbers", numberOfChapters: 36, testament: "OT" },
  { id: "DEU", commonName: "Deuteronomy", numberOfChapters: 34, testament: "OT" },
  { id: "JOS", commonName: "Joshua", numberOfChapters: 24, testament: "OT" },
  { id: "JDG", commonName: "Judges", numberOfChapters: 21, testament: "OT" },
  { id: "RUT", commonName: "Ruth", numberOfChapters: 4, testament: "OT" },
  { id: "1SA", commonName: "1 Samuel", numberOfChapters: 31, testament: "OT" },
  { id: "2SA", commonName: "2 Samuel", numberOfChapters: 24, testament: "OT" },
  { id: "1KI", commonName: "1 Kings", numberOfChapters: 22, testament: "OT" },
  { id: "2KI", commonName: "2 Kings", numberOfChapters: 25, testament: "OT" },
  { id: "1CH", commonName: "1 Chronicles", numberOfChapters: 29, testament: "OT" },
  { id: "2CH", commonName: "2 Chronicles", numberOfChapters: 36, testament: "OT" },
  { id: "EZR", commonName: "Ezra", numberOfChapters: 10, testament: "OT" },
  { id: "NEH", commonName: "Nehemiah", numberOfChapters: 13, testament: "OT" },
  { id: "EST", commonName: "Esther", numberOfChapters: 10, testament: "OT" },
  { id: "JOB", commonName: "Job", numberOfChapters: 42, testament: "OT" },
  { id: "PSA", commonName: "Psalms", numberOfChapters: 150, testament: "OT" },
  { id: "PRO", commonName: "Proverbs", numberOfChapters: 31, testament: "OT" },
  { id: "ECC", commonName: "Ecclesiastes", numberOfChapters: 12, testament: "OT" },
  { id: "SNG", commonName: "Song of Solomon", numberOfChapters: 8, testament: "OT" },
  { id: "ISA", commonName: "Isaiah", numberOfChapters: 66, testament: "OT" },
  { id: "JER", commonName: "Jeremiah", numberOfChapters: 52, testament: "OT" },
  { id: "LAM", commonName: "Lamentations", numberOfChapters: 5, testament: "OT" },
  { id: "EZK", commonName: "Ezekiel", numberOfChapters: 48, testament: "OT" },
  { id: "DAN", commonName: "Daniel", numberOfChapters: 12, testament: "OT" },
  { id: "HOS", commonName: "Hosea", numberOfChapters: 14, testament: "OT" },
  { id: "JOL", commonName: "Joel", numberOfChapters: 3, testament: "OT" },
  { id: "AMO", commonName: "Amos", numberOfChapters: 9, testament: "OT" },
  { id: "OBA", commonName: "Obadiah", numberOfChapters: 1, testament: "OT" },
  { id: "JON", commonName: "Jonah", numberOfChapters: 4, testament: "OT" },
  { id: "MIC", commonName: "Micah", numberOfChapters: 7, testament: "OT" },
  { id: "NAM", commonName: "Nahum", numberOfChapters: 3, testament: "OT" },
  { id: "HAB", commonName: "Habakkuk", numberOfChapters: 3, testament: "OT" },
  { id: "ZEP", commonName: "Zephaniah", numberOfChapters: 3, testament: "OT" },
  { id: "HAG", commonName: "Haggai", numberOfChapters: 2, testament: "OT" },
  { id: "ZEC", commonName: "Zechariah", numberOfChapters: 14, testament: "OT" },
  { id: "MAL", commonName: "Malachi", numberOfChapters: 4, testament: "OT" },
  { id: "MAT", commonName: "Matthew", numberOfChapters: 28, testament: "NT" },
  { id: "MRK", commonName: "Mark", numberOfChapters: 16, testament: "NT" },
  { id: "LUK", commonName: "Luke", numberOfChapters: 24, testament: "NT" },
  { id: "JHN", commonName: "John", numberOfChapters: 21, testament: "NT" },
  { id: "ACT", commonName: "Acts", numberOfChapters: 28, testament: "NT" },
  { id: "ROM", commonName: "Romans", numberOfChapters: 16, testament: "NT" },
  { id: "1CO", commonName: "1 Corinthians", numberOfChapters: 16, testament: "NT" },
  { id: "2CO", commonName: "2 Corinthians", numberOfChapters: 13, testament: "NT" },
  { id: "GAL", commonName: "Galatians", numberOfChapters: 6, testament: "NT" },
  { id: "EPH", commonName: "Ephesians", numberOfChapters: 6, testament: "NT" },
  { id: "PHP", commonName: "Philippians", numberOfChapters: 4, testament: "NT" },
  { id: "COL", commonName: "Colossians", numberOfChapters: 4, testament: "NT" },
  { id: "1TH", commonName: "1 Thessalonians", numberOfChapters: 5, testament: "NT" },
  { id: "2TH", commonName: "2 Thessalonians", numberOfChapters: 3, testament: "NT" },
  { id: "1TI", commonName: "1 Timothy", numberOfChapters: 6, testament: "NT" },
  { id: "2TI", commonName: "2 Timothy", numberOfChapters: 4, testament: "NT" },
  { id: "TIT", commonName: "Titus", numberOfChapters: 3, testament: "NT" },
  { id: "PHM", commonName: "Philemon", numberOfChapters: 1, testament: "NT" },
  { id: "HEB", commonName: "Hebrews", numberOfChapters: 13, testament: "NT" },
  { id: "JAS", commonName: "James", numberOfChapters: 5, testament: "NT" },
  { id: "1PE", commonName: "1 Peter", numberOfChapters: 5, testament: "NT" },
  { id: "2PE", commonName: "2 Peter", numberOfChapters: 3, testament: "NT" },
  { id: "1JN", commonName: "1 John", numberOfChapters: 5, testament: "NT" },
  { id: "2JN", commonName: "2 John", numberOfChapters: 1, testament: "NT" },
  { id: "3JN", commonName: "3 John", numberOfChapters: 1, testament: "NT" },
  { id: "JUD", commonName: "Jude", numberOfChapters: 1, testament: "NT" },
  { id: "REV", commonName: "Revelation", numberOfChapters: 22, testament: "NT" }
];

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

export type ChapterContentItem = {
    type: 'heading';
    content: string[];
} | {
    type: 'line_break';
} | {
    type: 'verse';
    number: number;
    content: VerseContent[];
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

export type JournalEntry = {
  id: string;
  userId: string;
  date: string;
  reference?: string;
  thoughts?: string;
  prayer?: string;
  createdAt?: any;
  updatedAt?: any;
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
    KJV: 'de4e12af7f28f599-01',
    WEB: '72f4e6dc683324df-01',
    engnet: '98de202246a0665f-01',
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

export type StrongsDetail = {
    strongsNumber: string;
    lemma: string;
    transliteration: string;
    pronunciation?: string;
    shortDefinition: string;
    kjvDefinition: string;
    strongsDerivation?: string;
};
