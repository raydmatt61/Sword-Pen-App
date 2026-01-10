"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteField } from 'firebase/firestore';
import type { Annotation, BibleChapterResponse, ChapterContentItem, ChapterNote } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { BookText, Save } from 'lucide-react';
import { AiInsightGenerator } from './ai-insight-generator';
import { cn } from '@/lib/utils';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

function AnnotationControls({ onHighlight, onUnderline, onClear, onSaveNote, onCopy, isDirty }: { onHighlight: (style: string) => void, onUnderline: (style: string) => void, onClear: () => void, onSaveNote: () => void, onCopy: () => void, isDirty: boolean }) {
    const highlightColors = [
        { class: 'hl-yellow', color: '#fff59d' },
        { class: 'hl-green', color: '#c8e6c9' },
        { class: 'hl-blue', color: '#bbdefb' },
        { class: 'hl-pink', color: '#f8bbd0' },
    ];
    const underlineColors = [
        { class: 'ul-red', color: '#e53935' },
        { class: 'ul-purple', color: '#8e24aa' },
        { class: 'ul-orange', color: '#fb8c00' },
    ];

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-2">
                {highlightColors.map(h => <button key={h.class} onClick={() => onHighlight(h.class)} className="h-6 w-full rounded" style={{ backgroundColor: h.color }} title={`Highlight ${h.class.split('-')[1]}`}></button>)}
                {underlineColors.map(u => <button key={u.class} onClick={() => onUnderline(u.class)} className="h-6 w-full rounded text-white" style={{ backgroundColor: u.color }} title={`Underline ${u.class.split('-')[1]}`}>{u.class.split('-')[1]}</button>)}
                <Button variant="outline" size="sm" onClick={onClear} className="h-6">Clear</Button>
            </div>
             <Button onClick={onSaveNote} size="sm" disabled={!isDirty}><Save className="mr-2"/>Save Note</Button>
             <Button onClick={onCopy} variant="secondary" size="sm">Copy Verse Text</Button>
        </div>
    )
}

function VerseComponent({ verse, fullReference, annotation, onSelectVerse }: { verse: Extract<ChapterContentItem, { type: 'verse' }>, fullReference: string, annotation: Annotation | undefined, onSelectVerse: () => void }) {
    const verseText = useMemo(() => verse.content.map(c => typeof c === 'string' ? c : (c.text || '')).join(''), [verse.content]);
    const hasNote = !!annotation?.note;

    return (
         <p className="text-lg leading-relaxed font-body" onClick={onSelectVerse}>
            <sup className="font-headline font-bold text-primary mr-2">{verse.number}</sup>
            <span className={cn(
                "cursor-pointer p-1 rounded transition-colors hover:bg-primary/10",
                hasNote && "border-l-4 border-accent bg-accent/10",
                annotation?.highlight,
                annotation?.underline
            )}>
                {verseText}
            </span>
        </p>
    );
}

export function BibleDisplay({ chapterData }: { chapterData: BibleChapterResponse }) {
    const { user } = useUser();
    const firestore = useFirestore();

    const [selectedVerse, setSelectedVerse] = useState<string | null>(null);
    const [selectedVerseText, setSelectedVerseText] = useState<string>('');
    const [verseNote, setVerseNote] = useState('');
    const [chapterNote, setChapterNote] = useState('');

    const bookId = chapterData.book.id;
    const chapterNum = chapterData.chapter.number;
    const translationId = chapterData.translation.id;
    const fullReference = `${chapterData.book.name} ${chapterNum}`;

    // Fetch Annotations
    const annotationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        const annotationsPath = `users/${user.uid}/annotations`;
        return collection(firestore, annotationsPath);
    }, [user, firestore]);

    const { data: annotations, isLoading: annotationsLoading } = useCollection<Annotation>(annotationsQuery);

    const chapterAnnotations = useMemo(() => {
        if (!annotations) return {};
        const annotationMap: Record<string, Annotation> = {};
        annotations.filter(a => a.book === bookId && a.chapter === chapterNum && a.translation === translationId)
        .forEach(a => {
            annotationMap[a.verse] = a;
        });
        return annotationMap;
    }, [annotations, bookId, chapterNum, translationId]);


    // Fetch Chapter Note
    const chapterNoteDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        const chapterNoteId = `${translationId}-${bookId}-${chapterNum}`;
        return doc(firestore, `users/${user.uid}/chapterNotes`, chapterNoteId);
    }, [user, firestore, translationId, bookId, chapterNum]);

    // Non-blocking write for chapter note
    const handleChapterNoteChange = (note: string) => {
        setChapterNote(note);
        if (chapterNoteDocRef && user) {
            const data: ChapterNote = {
                id: chapterNoteDocRef.id,
                userId: user.uid,
                translation: translationId,
                book: bookId,
                chapter: chapterNum,
                note: note,
            };
            setDocumentNonBlocking(chapterNoteDocRef, data, { merge: true });
        }
    };

    const handleSelectVerse = useCallback((verse: Extract<ChapterContentItem, { type: 'verse' }>) => {
        setSelectedVerse(verse.number);
        const verseText = verse.content.map(c => typeof c === 'string' ? c : (c.text || '')).join('');
        setSelectedVerseText(verseText);
        const existingAnnotation = chapterAnnotations[verse.number as any];
        setVerseNote(existingAnnotation?.note || '');
    }, [chapterAnnotations]);


    const currentAnnotation = selectedVerse ? chapterAnnotations[selectedVerse] : undefined;
    const isVerseNoteDirty = selectedVerse ? verseNote !== (currentAnnotation?.note || '') : false;

    const getAnnotationRef = useCallback((verseNum: string) => {
        if (!user || !firestore) return null;
        const annotationId = `${translationId}-${bookId}-${chapterNum}-${verseNum}`;
        return doc(firestore, `users/${user.uid}/annotations`, annotationId);
    }, [user, firestore, translationId, bookId, chapterNum]);
    
    const handleAnnotationUpdate = (verseNum: string, data: Partial<Annotation>) => {
        if (!user) return;
        const ref = getAnnotationRef(verseNum);
        if(ref) {
            const payload: Annotation = {
                userId: user.uid,
                translation: translationId,
                book: bookId,
                chapter: chapterNum,
                verse: parseInt(verseNum),
                ...data,
            }
            setDocumentNonBlocking(ref, payload, { merge: true });
        }
    };
    
    const handleSaveVerseNote = () => {
        if (!selectedVerse || !isVerseNoteDirty) return;
        handleAnnotationUpdate(selectedVerse, { note: verseNote });
    };

    const handleHighlight = (style: string) => {
        if (!selectedVerse) return;
        const newStyle = currentAnnotation?.highlight === style ? undefined : style;
        handleAnnotationUpdate(selectedVerse, { highlight: newStyle || (deleteField() as any) });
    };

    const handleUnderline = (style: string) => {
        if (!selectedVerse) return;
        const newStyle = currentAnnotation?.underline === style ? undefined : style;
        handleAnnotationUpdate(selectedVerse, { underline: newStyle || (deleteField() as any) });
    };

    const handleClearMarkup = () => {
        if (!selectedVerse) return;
        handleAnnotationUpdate(selectedVerse, { highlight: deleteField() as any, underline: deleteField() as any });
    };

    const handleCopyVerse = () => {
        if (!selectedVerse || !selectedVerseText) return;
        navigator.clipboard.writeText(`${fullReference}:${selectedVerse}: ${selectedVerseText}`);
    };

    const verses = chapterData.chapter.content.filter(item => item.type === 'verse') as Extract<ChapterContentItem, { type: 'verse' }>[];

    return (
        <div className="mt-6 grid md:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <div className="md:col-span-1">
                <div className="sticky top-6 z-10 flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl flex items-center gap-3">
                                <BookText className="text-primary" />
                                Chapter Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             <Textarea
                                placeholder={`Write your notes for ${fullReference} here...`}
                                value={chapterNote}
                                onChange={(e) => handleChapterNoteChange(e.target.value)}
                                rows={6}
                                className="font-body text-base"
                                disabled={!user}
                            />
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-xl">
                                Verse Annotation
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             {!user ? <p className="text-sm text-muted-foreground">Sign in to annotate verses.</p> :
                             !selectedVerse ? <p className="text-sm text-muted-foreground">Select a verse to begin.</p> :
                             (
                                <div className="flex flex-col gap-4">
                                     <p className="font-bold font-headline text-primary">{fullReference}:{selectedVerse}</p>
                                    <Textarea
                                        placeholder="Your thoughts on this verse..."
                                        value={verseNote}
                                        onChange={(e) => setVerseNote(e.target.value)}
                                        className="font-body text-base"
                                        rows={5}
                                    />
                                    <AnnotationControls 
                                        onHighlight={handleHighlight}
                                        onUnderline={handleUnderline}
                                        onClear={handleClearMarkup}
                                        onSaveNote={handleSaveVerseNote}
                                        onCopy={handleCopyVerse}
                                        isDirty={isVerseNoteDirty}
                                    />
                                    {verseNote && (
                                        <AiInsightGenerator
                                            verse={`${fullReference}:${selectedVerse} - ${selectedVerseText}`}
                                            annotation={verseNote}
                                        />
                                    )}
                                </div>
                             )
                             }
                        </CardContent>
                    </Card>
                </div>
            </div>
            <div className="md:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-3xl">{fullReference}</CardTitle>
                         <p className="text-sm text-muted-foreground">{chapterData.translation.name}</p>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                             {chapterData.chapter.content.map((item, index) => {
                                if (item.type === 'heading') {
                                    return <h4 key={`h-${index}`} className="text-xl font-headline font-bold pt-4">{item.content.join(' ')}</h4>
                                }
                                if (item.type === 'verse') {
                                    return <VerseComponent 
                                                key={item.number} 
                                                verse={item} 
                                                fullReference={fullReference} 
                                                annotation={chapterAnnotations[item.number as any]}
                                                onSelectVerse={() => handleSelectVerse(item)}
                                            />
                                }
                                return null;
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Add CSS for highlights and underlines
const styles = `
.hl-yellow { background-color: #fff59d !important; }
.hl-green { background-color: #c8e6c9 !important; }
.hl-blue { background-color: #bbdefb !important; }
.hl-pink { background-color: #f8bbd0 !important; }
.ul-red { border-bottom: 3px solid #e53935; padding-bottom: 1px; }
.ul-purple { border-bottom: 3px solid #8e24aa; padding-bottom: 1px; }
.ul-orange { border-bottom: 3px solid #fb8c00; padding-bottom: 1px; }
`;

if (typeof window !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
}
