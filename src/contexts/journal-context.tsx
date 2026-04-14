
"use client";

import { createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import type { JournalEntry } from '@/lib/bible';
import { useUser, useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';

interface JournalContextType {
    entries: JournalEntry[] | null;
    addOrUpdateEntry: (entry: Partial<JournalEntry>) => void;
    deleteEntry: (entryId: string) => void;
}

const JournalContext = createContext<JournalContextType | undefined>(undefined);

export const JournalProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useUser();
    const firestore = useFirestore();

    const journalQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/journal`);
    }, [user, firestore]);

    const { data: entries } = useCollection<JournalEntry>(journalQuery);

    const addOrUpdateEntry = useCallback((entryData: Partial<JournalEntry>) => {
        if (!user || !firestore) return;

        const entryId = entryData.id || doc(collection(firestore, `users/${user.uid}/journal`)).id;
        const entryRef = doc(firestore, `users/${user.uid}/journal`, entryId);

        const finalData = {
            ...entryData,
            id: entryId,
            userId: user.uid,
            updatedAt: serverTimestamp(),
            createdAt: entryData.createdAt || serverTimestamp(),
        };

        setDocumentNonBlocking(entryRef, finalData, { merge: true });
    }, [user, firestore]);

    const deleteEntry = useCallback((entryId: string) => {
        if (!user || !firestore) return;
        const entryRef = doc(firestore, `users/${user.uid}/journal`, entryId);
        deleteDocumentNonBlocking(entryRef);
    }, [user, firestore]);

    const value = useMemo(() => ({
        entries: entries || null,
        addOrUpdateEntry,
        deleteEntry,
    }), [entries, addOrUpdateEntry, deleteEntry]);

    return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
};

export const useJournal = () => {
    const context = useContext(JournalContext);
    if (context === undefined) {
        throw new Error('useJournal must be used within a JournalProvider');
    }
    return context;
};
