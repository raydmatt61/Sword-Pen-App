
"use client";

import { createContext, useContext, ReactNode, useCallback, useMemo, useState, useEffect, useRef } from 'react';
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
    isSaving: boolean;
    persistNow: () => void;
}

const StudySessionContext = createContext<StudySessionContextType | undefined>(undefined);

export const StudySessionProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { chapterData } = useAnnotationContext();

    const [scratchpad, setScratchpadState] = useState('');
    const [sketchpad, setSketchpadState] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Track original data to prevent overwriting local state while typing
    const lastSessionId = useRef<string | null>(null);

    const sessionId = useMemo(() => {
        if (!chapterData) return null;
        return `${chapterData.book.id}-${chapterData.chapter.number}`;
    }, [chapterData]);

    const sessionDocRef = useMemoFirebase(() => {
        if (!user || !firestore || !sessionId) return null;
        return doc(firestore, `users/${user.uid}/studySessions/${sessionId}`);
    }, [user, firestore, sessionId]);

    const { data: sessionData, isLoading } = useDoc<StudySession>(sessionDocRef);

    // Reset or Load session when chapter changes
    useEffect(() => {
        if (sessionId !== lastSessionId.current) {
            lastSessionId.current = sessionId;
            if (sessionData) {
                setScratchpadState(sessionData.scratchpad || '');
                setSketchpadState(sessionData.sketchpad || '');
            } else {
                setScratchpadState('');
                setSketchpadState('');
            }
        }
    }, [sessionId, sessionData]);

    const persistSession = useCallback((updates: Partial<StudySession>) => {
        if (!user || !firestore || !sessionId) return;
        setIsSaving(true);
        const ref = doc(firestore, `users/${user.uid}/studySessions/${sessionId}`);
        
        // Use a small delay to simulate network/processing and provide visual feedback
        setDocumentNonBlocking(ref, {
            ...updates,
            id: sessionId,
            userId: user.uid,
            book: chapterData?.book.id,
            chapter: chapterData?.chapter.number,
            updatedAt: serverTimestamp(),
        }, { merge: true });
        
        // Mocking saving state duration for UI certainty
        setTimeout(() => setIsSaving(false), 800);
    }, [user, firestore, sessionId, chapterData]);

    const setScratchpad = useCallback((text: string) => {
        setScratchpadState(text);
        persistSession({ scratchpad: text });
    }, [persistSession]);

    const setSketchpad = useCallback((dataUrl: string) => {
        setSketchpadState(dataUrl);
        persistSession({ sketchpad: dataUrl });
    }, [persistSession]);

    const persistNow = useCallback(() => {
        persistSession({ scratchpad, sketchpad });
    }, [persistSession, scratchpad, sketchpad]);

    const value = useMemo(() => ({
        scratchpad,
        setScratchpad,
        sketchpad,
        setSketchpad,
        isLoading,
        isSaving,
        persistNow
    }), [scratchpad, setScratchpad, sketchpad, setSketchpad, isLoading, isSaving, persistNow]);

    return <StudySessionContext.Provider value={value}>{children}</StudySessionContext.Provider>;
};

export const useStudySession = () => {
    const context = useContext(StudySessionContext);
    if (context === undefined) {
        throw new Error('useStudySession must be used within a StudySessionProvider');
    }
    return context;
};
