
"use client";

import { createContext, useContext, ReactNode, useState, Dispatch, SetStateAction, useCallback } from 'react';
import type { Annotation, BibleChapterResponse } from '@/lib/bible';
import { useUser, useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';

export type FontSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface AnnotationContextType {
    selection: { range: Range, verseNum: string } | null;
    setSelection: Dispatch<SetStateAction<{ range: Range, verseNum: string } | null>>;
    activeAnnotation: Annotation | null;
    setActiveAnnotation: Dispatch<SetStateAction<Annotation | null>>;
    fontSize: FontSize;
    setFontSize: Dispatch<SetStateAction<FontSize>>;
    isDrawingMode: boolean;
    setIsDrawingMode: Dispatch<SetStateAction<boolean>>;
    saveDrawing: boolean;
    setSaveDrawing: Dispatch<SetStateAction<boolean>>;
    triggerSaveDrawing: () => void;
    createOrUpdateAnnotation: (data: Partial<Omit<Annotation, 'id' | 'userId'>>, chapterData: BibleChapterResponse) => void;
    deleteAnnotation: (annotation: Annotation) => void;
    resetAnnotationState: () => void;
}

const AnnotationContext = createContext<AnnotationContextType | undefined>(undefined);

interface AnnotationProviderProps {
    children: ReactNode;
}

export const AnnotationProvider = ({ children }: AnnotationProviderProps) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const [selection, setSelection] = useState<{ range: Range, verseNum: string } | null>(null);
    const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
    const [fontSize, setFontSize] = useState<FontSize>('md');
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [saveDrawing, setSaveDrawing] = useState(false);

    const resetAnnotationState = useCallback(() => {
        setActiveAnnotation(null);
        setSelection(null);
        setIsDrawingMode(false);
        if (window.getSelection) window.getSelection()?.removeAllRanges();
    }, []);

    const triggerSaveDrawing = useCallback(() => {
        setSaveDrawing(true);
    }, []);

    const createOrUpdateAnnotation = useCallback((data: Partial<Omit<Annotation, 'id' | 'userId'>>, chapterData: BibleChapterResponse) => {
        if (!user || !firestore) return;

        const { book: { id: bookId }, chapter: { number: chapterNum }, translation: { id: translationId } } = chapterData;

        // SCENARIO 1: UPDATE existing annotation (text or drawing)
        if (activeAnnotation) {
             const docRef = doc(firestore, `users/${user.uid}/annotations`, activeAnnotation.id);
             setDocumentNonBlocking(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
        
        // SCENARIO 2: CREATE new TEXT annotation from a selection
        } else if (selection) {
            const { range, verseNum } = selection;
            const verseElement = range.startContainer.parentElement?.closest('[data-verse-number]');
            if (!verseElement) return;
            
            // This logic calculates the start/end offsets relative to the verse text content, excluding the verse number
            const supLength = verseElement.querySelector('sup')?.textContent?.length || 0;
            const preSelectionRange = document.createRange();
            preSelectionRange.selectNodeContents(verseElement);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            const start = preSelectionRange.toString().length - supLength;
            
            const text = range.toString();
             // Prevent creating empty annotations unless a note is being added
            if (!text.trim() && data.note === undefined) return;

            const end = start + text.length;

            const newAnnotation: Omit<Annotation, 'id'> = {
                userId: user.uid,
                translation: translationId,
                book: bookId,
                chapter: chapterNum,
                verse: parseInt(verseNum),
                start: start >= 0 ? start : 0,
                end: end,
                text: text,
                ...data
            };
            const newDocRef = doc(collection(firestore, `users/${user.uid}/annotations`));
            setDocumentNonBlocking(newDocRef, { ...newAnnotation, createdAt: serverTimestamp() });
        
        // SCENARIO 3: CREATE new DRAWING annotation
        } else if (data.drawingDataUrl) {
            const newAnnotation: Omit<Annotation, 'id'> = {
                userId: user.uid,
                translation: translationId,
                book: bookId,
                chapter: chapterNum,
                verse: 0, // Chapter-level drawing
                text: 'Handwritten Note',
                ...data
            };
            const newDocRef = doc(collection(firestore, `users/${user.uid}/annotations`));
            setDocumentNonBlocking(newDocRef, { ...newAnnotation, createdAt: serverTimestamp() });
        }
        
        resetAnnotationState();

    }, [user, firestore, activeAnnotation, selection, resetAnnotationState]);

    const deleteAnnotation = useCallback((annotationToDelete: Annotation) => {
         if (annotationToDelete && firestore && user) {
            const docRef = doc(firestore, `users/${user.uid}/annotations`, annotationToDelete.id);
            deleteDocumentNonBlocking(docRef);
            resetAnnotationState();
        }
    }, [user, firestore, resetAnnotationState]);

    const value = {
        selection,
        setSelection,
        activeAnnotation,
        setActiveAnnotation,
        fontSize,
        setFontSize,
        isDrawingMode,
        setIsDrawingMode,
        saveDrawing,
        setSaveDrawing,
        triggerSaveDrawing,
        createOrUpdateAnnotation,
        deleteAnnotation,
        resetAnnotationState
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
