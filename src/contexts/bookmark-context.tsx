
"use client";

import { createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import type { Bookmark } from '@/lib/bible';
import { useUser, useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';

interface BookmarkContextType {
    bookmarks: Bookmark[] | null;
    isBookmarked: (book: string, chapter: number, verse: number, translation: string) => boolean;
    toggleBookmark: (bookmark: Omit<Bookmark, 'id' | 'userId' | 'createdAt'>) => void;
}

const BookmarkContext = createContext<BookmarkContextType | undefined>(undefined);

export const BookmarkProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useUser();
    const firestore = useFirestore();

    const bookmarksQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/bookmarks`);
    }, [user, firestore]);

    const { data: bookmarks } = useCollection<Bookmark>(bookmarksQuery);

    const isBookmarked = useCallback((book: string, chapter: number, verse: number, translation: string) => {
        if (!bookmarks) return false;
        return bookmarks.some(b => 
            b.book === book && 
            b.chapter === chapter && 
            b.verse === verse && 
            b.translation === translation
        );
    }, [bookmarks]);

    const toggleBookmark = useCallback((bookmarkData: Omit<Bookmark, 'id' | 'userId' | 'createdAt'>) => {
        if (!user || !firestore) return;

        const existing = bookmarks?.find(b => 
            b.book === bookmarkData.book && 
            b.chapter === bookmarkData.chapter && 
            b.verse === bookmarkData.verse && 
            b.translation === bookmarkData.translation
        );

        if (existing) {
            const docRef = doc(firestore, `users/${user.uid}/bookmarks`, existing.id);
            deleteDocumentNonBlocking(docRef);
        } else {
            const newDocRef = doc(collection(firestore, `users/${user.uid}/bookmarks`));
            const newBookmark: Bookmark = {
                id: newDocRef.id,
                userId: user.uid,
                ...bookmarkData,
                createdAt: serverTimestamp(),
            };
            setDocumentNonBlocking(newDocRef, newBookmark);
        }
    }, [user, firestore, bookmarks]);

    const value = useMemo(() => ({
        bookmarks: bookmarks || null,
        isBookmarked,
        toggleBookmark,
    }), [bookmarks, isBookmarked, toggleBookmark]);

    return <BookmarkContext.Provider value={value}>{children}</BookmarkContext.Provider>;
};

export const useBookmarkContext = () => {
    const context = useContext(BookmarkContext);
    if (context === undefined) {
        throw new Error('useBookmarkContext must be used within a BookmarkProvider');
    }
    return context;
};
