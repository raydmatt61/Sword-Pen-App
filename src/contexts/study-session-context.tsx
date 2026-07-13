
"use client";

import { createContext, useContext, ReactNode, useCallback, useMemo, useState, useEffect } from 'react';
import type { StudySession } from '@/lib/bible';
import { useUser, useFirestore, setDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { useAnnotationContext } from './annotation-context';

interface StudySessionContextType {
    scratchpad: string;
    setScratchpad: (text: string) => void;
    sketchpad: string;
    setSketchpad: (dataUrl: string) => void;
    isLoading: boolean;
}

const StudySessionContext = createContext<StudySessionContextType | undefined>(undefined);

export const StudySessionProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { chapterData } = useAnnotationContext();

    // The sessionId is uniquely tied to the book and chapter
    const sessionId = useMemo(() => {
        if (!chapterData) return null;
        return `${chapterData.book.id}-${chapterData.chapter.number}`;
    }, [chapterData]);

    const sessionDocRef = useMemoFirebase(() => {
        if (!user || !firestore || !sessionId) return null;
        return doc(firestore, `users/${user.uid}/studySessions/${sessionId}`);
    }, [user, firestore, sessionId]);

    const { data: sessionData, isLoading } = useDoc<StudySession>(sessionDocRef);

    const [scratchpad, setScratchpadState] = useState('');
    const [sketchpad, setSketchpadState] = useState('');

    // Synchronize local state with Firestore when the chapter (session) changes
    useEffect(() => {
        if (sessionData) {
            setScratchpadState(sessionData.scratchpad || '');
            setSketchpadState(sessionData.sketchpad || '');
        } else {
            setScratchpadState('');
            setSketchpadState('');
        }
    }, [sessionData]);

    const persistSession = useCallback((updates: Partial<StudySession>) => {
        if (!user || !firestore || !sessionId) return;
        const ref = doc(firestore, `users/${user.uid}/studySessions/${sessionId}`);
        setDocumentNonBlocking(ref, {
            ...updates,
            id: sessionId,
            userId: user.uid,
            book: chapterData?.book.id,
            chapter: chapterData?.chapter.number,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    }, [user, firestore, sessionId, chapterData]);

    const setScratchpad = useCallback((text: string) => {
        setScratchpadState(text);
        persistSession({ scratchpad: text });
    }, [persistSession]);

    const setSketchpad = useCallback((dataUrl: string) => {
        setSketchpadState(dataUrl);
        persistSession({ sketchpad: dataUrl });
    }, [persistSession]);

    const value = useMemo(() => ({
        scratchpad,
        setScratchpad,
        sketchpad,
        setSketchpad,
        isLoading
    }), [scratchpad, setScratchpad, sketchpad, setSketchpad, isLoading]);

    return <StudySessionContext.Provider value={value}>{children}</StudySessionContext.Provider>;
};

export const useStudySession = () => {
    const context = useContext(StudySessionContext);
    if (context === undefined) {
        throw new Error('useStudySession must be used within a StudySessionProvider');
    }
    return context;
};
