
export type Translation = {
    id: string;
    name: string;
};

export const TRANSLATIONS: Translation[] = [
    { id: 'BSB', name: 'Berean Standard Bible' },
    { id: 'engnet', name: 'New English Translation' },
    { id: 'EWEB', name: 'World English Bible' },
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


export const BIBLE_BOOKS = Object.keys(BIBLE_BOOKS_ABBR);

export type FormattedText = {
    text: string;
    poem?: number;
    wordsOfJesus?: boolean;
};

export type InlineHeading = {
    heading: string;
};

export type InlineLineBreak = {
    lineBreak: true;
};

export type VerseFootnoteReference = {
    noteId: number;
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
        footnotes?: any[];
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
    

    

    


