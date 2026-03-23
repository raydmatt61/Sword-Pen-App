
"use client";

import { createContext, useContext, ReactNode, useState, Dispatch, SetStateAction, useCallback, useMemo, useEffect } from 'react';
import type { Annotation, BibleChapterResponse, BsbConcordanceMap, BsbConcordanceEntry } from '@/lib/bible';
import { useUser, useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { getBsbConcordanceText } from '@/app/actions';

export type FontSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export type SelectionInfo = { range: Range, verseElements: HTMLElement[] };

interface AnnotationMap {
    [verseNumber: string]: Annotation[];
}

interface AnnotationContextType {
    selection: SelectionInfo | null;
    setSelection: Dispatch<SetStateAction<SelectionInfo | null>>;
    activeAnnotation: Annotation | null;
    setActiveAnnotation: Dispatch<SetStateAction<Annotation | null>>;
    chapterAnnotations: AnnotationMap;
    chapterData: BibleChapterResponse | null;
    fontSize: FontSize;
    setFontSize: Dispatch<SetStateAction<FontSize>>;
    createOrUpdateAnnotation: (data: Partial<Omit<Annotation, 'id' | 'userId'>>) => void;
    deleteAnnotation: (annotation: Annotation) => void;
    resetAnnotationState: () => void;
    bsbConcordance: BsbConcordanceMap | null;
    bsbConcordanceLoading: boolean;
}

const AnnotationContext = createContext<AnnotationContextType | undefined>(undefined);

interface AnnotationProviderProps {
    children: ReactNode;
    chapterData: BibleChapterResponse | null;
}

function parseBsbTSV(text: string): BsbConcordanceMap {
  const lines = text.split("\n");
  const map: BsbConcordanceMap = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length < 8) continue;
    const ref = cols[0].trim();
    const word = cols[1].trim();
    const lang = cols[2].trim() as 'H' | 'G' | 'A';
    const strongs = cols[3].trim();
    const morph = cols[4].trim();
    const translit = cols[5].trim();
    const original = cols[6].trim();
    const strongsDef = cols[7].trim();
    const blbDef = cols[8] ? cols[8].trim() : "";
    
    if (!map[ref]) map[ref] = [];
    map[ref].push({ word, lang, strongs, morph, translit, original, strongsDef, blbDef });
  }
  return map;
}

export const AnnotationProvider = ({ children, chapterData }: AnnotationProviderProps) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const [selection, setSelection] = useState<SelectionInfo | null>(null);
    const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
    const [fontSize, setFontSize] = useState<FontSize>('md');
    
    const [bsbConcordance, setBsbConcordance] = useState<BsbConcordanceMap | null>(null);
    const [bsbConcordanceLoading, setBsbConcordanceLoading] = useState(false);

    // Load BSB Concordance data if needed - Fetch filtered data via Server Action
    useEffect(() => {
        if (chapterData?.translation.id === 'BSB' && chapterData?.book?.name) {
            setBsbConcordanceLoading(true);
            setBsbConcordance(null); // Clear old chapter's data
            
            getBsbConcordanceText(chapterData.book.name, chapterData.chapter.number)
                .then(text => {
                    setBsbConcordance(parseBsbTSV(text));
                    setBsbConcordanceLoading(false);
                })
                .catch(err => {
                    console.error("Failed to load BSB Concordance:", err);
                    setBsbConcordanceLoading(false);
                });
        } else {
            setBsbConcordance(null);
            setBsbConcordanceLoading(false);
        }
    }, [chapterData?.translation.id, chapterData?.book?.name, chapterData?.chapter?.number]);

    const annotationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/annotations`);
    }, [user, firestore]);

    const { data: allUserAnnotations } = useCollection<Annotation>(annotationsQuery);

    const chapterAnnotations = useMemo(() => {
        if (!allUserAnnotations || !chapterData) return {};
        const annotationMap: AnnotationMap = {};
        allUserAnnotations.filter(a => a.book === chapterData.book.id && a.chapter === chapterData.chapter.number && a.translation === chapterData.translation.id)
        .forEach(a => {
            const key = String(a.verse);
            if (!annotationMap[key]) {
                annotationMap[key] = [];
            }
            annotationMap[key].push(a);
        });
        return annotationMap;
    }, [allUserAnnotations, chapterData]);


    const resetAnnotationState = useCallback(() => {
        setActiveAnnotation(null);
        setSelection(null);
        if (window.getSelection) window.getSelection()?.removeAllRanges();
    }, []);

    const createOrUpdateAnnotation = useCallback((data: Partial<Omit<Annotation, 'id' | 'userId'>>) => {
        if (!user || !firestore || !chapterData) return;

        const { book: { id: bookId }, chapter: { number: chapterNum }, translation: { id: translationId } } = chapterData;

        // SCENARIO 1: UPDATE existing annotation(s)
        if (activeAnnotation) {
             const annotationsToUpdate: Annotation[] = [];
             if (activeAnnotation.groupId) {
                 Object.values(chapterAnnotations).flat().forEach(ann => {
                     if (ann.groupId === activeAnnotation.groupId) {
                         annotationsToUpdate.push(ann);
                     }
                 });
             } else {
                 annotationsToUpdate.push(activeAnnotation);
             }

             annotationsToUpdate.forEach(ann => {
                const docRef = doc(firestore, `users/${user.uid}/annotations`, ann.id);
                setDocumentNonBlocking(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
             });
             
             setActiveAnnotation(prev => prev ? { ...prev, ...data } : null);
        
        // SCENARIO 2: CREATE new annotation from a selection
        } else if (selection) {
            const { range, verseElements } = selection;
            
            const groupId = verseElements.length > 1 ? doc(collection(firestore, `users/${user.uid}/annotations`)).id : undefined;

            verseElements.forEach((verseEl, index) => {
                const verseNum = verseEl.getAttribute('data-verse-number');
                if (!verseNum) return;

                const verseTextWrapper = verseEl.querySelector<HTMLElement>('.verse-text-wrapper');
                if (!verseTextWrapper) return;
                
                const isFirstVerse = index === 0;
                const isLastVerse = index === verseElements.length - 1;

                const fullVerseRange = document.createRange();
                fullVerseRange.selectNodeContents(verseTextWrapper);

                const startPoint = isFirstVerse ? range.startContainer : fullVerseRange.startContainer;
                const startOffset = isFirstVerse ? range.startOffset : fullVerseRange.startOffset;
                const endPoint = isLastVerse ? range.endContainer : fullVerseRange.endContainer;
                const endOffset = isLastVerse ? range.endOffset : fullVerseRange.endOffset;

                const segmentRange = document.createRange();
                segmentRange.setStart(startPoint, startOffset);
                segmentRange.setEnd(endPoint, endOffset);

                const text = segmentRange.toString();
                if (!text.trim() && data.note === undefined) return;

                const preSegmentRange = document.createRange();
                preSegmentRange.selectNodeContents(verseTextWrapper);
                preSegmentRange.setEnd(startPoint, startOffset);
                const start = preSegmentRange.toString().length;
                const end = start + text.length;

                if (start >= end) return;

                const newAnnotation: Omit<Annotation, 'id'> = {
                    userId: user.uid,
                    translation: translationId,
                    book: bookId,
                    chapter: chapterNum,
                    verse: parseInt(verseNum),
                    start: start,
                    end: end,
                    text: text,
                    ...data,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };
                
                if (groupId) {
                    newAnnotation.groupId = groupId;
                }

                const newDocRef = doc(collection(firestore, `users/${user.uid}/annotations`));
                setDocumentNonBlocking(newDocRef, newAnnotation);
            });
            resetAnnotationState();
        }
    }, [user, firestore, activeAnnotation, selection, chapterData, resetAnnotationState, chapterAnnotations]);

    const deleteAnnotation = useCallback((annotationToDelete: Annotation) => {
         if (!annotationToDelete || !firestore || !user) return;
         
         const annotationsToDelete: Annotation[] = [];
         if (annotationToDelete.groupId) {
             Object.values(chapterAnnotations).flat().forEach(ann => {
                 if (ann.groupId === annotationToDelete.groupId) {
                     annotationsToDelete.push(ann);
                     }
             });
         } else {
             annotationsToDelete.push(annotationToDelete);
         }

         annotationsToDelete.forEach(ann => {
            const docRef = doc(firestore, `users/${user.uid}/annotations`, ann.id);
            deleteDocumentNonBlocking(docRef);
         });

        resetAnnotationState();
    }, [user, firestore, resetAnnotationState, chapterAnnotations]);

    const value = {
        selection,
        setSelection,
        activeAnnotation,
        setActiveAnnotation,
        chapterAnnotations,
        chapterData,
        fontSize,
        setFontSize,
        createOrUpdateAnnotation,
        deleteAnnotation,
        resetAnnotationState,
        bsbConcordance,
        bsbConcordanceLoading
    };

    return <AnnotationContext.Provider value={value}>{children}</AnnotationContext.Provider>;
};

export const useAnnotationContext = () => {
    const context = useContext(AnnotationContext);
    if (context === undefined) {
        throw new Error('useAnnotationContext must be used within an AnnotationProvider');
    }
    return context;
};
