
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

    const sessionId = useMemo(() => {
        if (!chapterData) return null;
        return `${chapterData.book.id}-${chapterData.chapter.number}`;
    }, [chapterData]);

    const sessionDocRef = useMemoFirebase(() => {
        if (!user || !firestore || !sessionId) return null;
        return doc(firestore, `users/${user.uid}/studySessions/${sessionId}`);
    }, [user, firestore, sessionId]);

    const { data: sessionData, isLoading } = useDoc<StudySession>(sessionDocRef);
    const lastSessionId = useRef<string | null>(null);
    const saveTimeout = useRef<NodeJS.Timeout | null>(null);

    // Synchronize local state when the cloud data changes or session switches
    useEffect(() => {
        if (!sessionId) return;
        
        // If chapter changed, immediately clear local state to avoid seeing old data
        if (sessionId !== lastSessionId.current) {
            lastSessionId.current = sessionId;
            setScratchpadState('');
            setSketchpadState('');
        }
        
        // Once data is no longer loading, sync if we found something
        if (!isLoading && sessionId === lastSessionId.current) {
            if (sessionData) {
                setScratchpadState(sessionData.scratchpad || '');
                setSketchpadState(sessionData.sketchpad || '');
            }
        }
    }, [sessionId, sessionData, isLoading]);

    const persistSession = useCallback((updates: Partial<StudySession>) => {
        if (!user || !firestore || !sessionId) return;
        setIsSaving(true);
        const ref = doc(firestore, `users/${user.uid}/studySessions/${sessionId}`);
        
        setDocumentNonBlocking(ref, {
            ...updates,
            id: sessionId,
            userId: user.uid,
            book: chapterData?.book.id,
            chapter: chapterData?.chapter.number,
            updatedAt: serverTimestamp(),
        }, { merge: true });
        
        // Brief delay for the "Saving" indicator to be meaningful
        setTimeout(() => setIsSaving(false), 1200);
    }, [user, firestore, sessionId, chapterData]);

    const setScratchpad = useCallback((text: string) => {
        setScratchpadState(text);
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
            persistSession({ scratchpad: text });
        }, 1000);
    }, [persistSession]);

    const setSketchpad = useCallback((dataUrl: string) => {
        setSketchpadState(dataUrl);
        // Sketchpad saves on pointer up (stroke end) so it doesn't need heavy debouncing,
        // but we ensure it's persisted immediately.
        persistSession({ sketchpad: dataUrl });
    }, [persistSession]);

    const persistNow = useCallback(() => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
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
