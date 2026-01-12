

export type Translation = {
    id: string;
    name: string;
    englishName: string;
};

export type Book = {
    id: string;
    commonName: string;
    numberOfChapters: number;
};

export const BIBLE_BOOKS_ABBR: Record<string, string> = {
    "Genesis": "GEN", "Exodus": "EXO", "Leviticus": "LEV", "Numbers": "NUM", "Deuteronomy": "DEU", "Joshua": "JOS", "Judges": "JDG", "Ruth": "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA",
    "1 Kings": "1KI", "2 Kings": "2KI", "1 Chronicles": "1CH", "2 Chronicles": "2CH", "Ezra": "EZR", "Nehemiah": "NEH", "Esther": "EST", "Job": "JOB", "Psalms": "PSA", "Proverbs": "PRO",
    "Ecclesiastes": "ECC", "Song of Solomon": "SNG", "Isaiah": "ISA", "Jeremiah": "JER", "Lamentations": "LAM", "Ezekiel": "EZK", "Daniel": "DAN", "Hosea": "HOS", "Joel": "JOL",
    "Amos": "AMO", "Obadiah": "OBA", "Jonah": "JON", "Micah": "MIC", "Nahum": "NAM", "Habakkuk": "HAB", "Zephaniah": "ZEP", "Haggai": "HAG", "Zechariah": "ZEC", "Malachi": "MAL",
    "Matthew": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT", "Romans": "ROM", "1 Corinthians": "1CO", "2 Corinthians": "2CO", "Galatians": "GAL", "Ephesians": "EPH",
    "Philippians": "PHP", "Colossians": "COL", "1 Thessalonians": "1TH", "2 Thessalonians": "2TH", "1 Timothy": "1TI", "2 Timothy": "2TI", "Titus": "TIT", "Philemon": "PHM",
    "Hebrews": "HEB", "James": "JAS", "1 Peter": "1PE", "2 Peter": "2PE", "1 John": "1JN", "2 John": "2JN", "3 John": "3JN", "Jude": "JUD", "Revelation": "REV"
};

export const BIBLE_BOOKS = Object.keys(BIBLE_BOOKS_ABBR);

export const TRANSLATIONS: Translation[] = [
  { id: 'BSB', name: 'Berean Standard Bible', englishName: 'Berean Standard Bible' },
  { id: 'NET-notes', name: 'New English Translation (NET)', englishName: 'New English Translation' },
];

export type VerseContent = string | { type: 'word'; text: string };
export type ChapterContentItem = 
    | { type: 'heading'; content: string[] }
    | { type: 'verse'; number: string; content: VerseContent[]; 'para-break'?: boolean };

export type BibleChapterResponse = {
    book: {
        name: string;
        id: string;
    };
    chapter: {
        number: number;
        content: ChapterContentItem[];
    };
    translation: {
        name: string;
        id: string;
    };
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
};

    
