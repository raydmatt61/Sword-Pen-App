
"use client";

import { createContext, useContext, ReactNode, useState, Dispatch, SetStateAction } from 'react';
import type { Annotation } from '@/lib/bible';

interface AnnotationContextType {
    selection: { range: Range, verseNum: string } | null;
    setSelection: Dispatch<SetStateAction<{ range: Range, verseNum: string } | null>>;
    activeAnnotation: Annotation | null;
    setActiveAnnotation: Dispatch<SetStateAction<Annotation | null>>;
}

const AnnotationContext = createContext<AnnotationContextType | undefined>(undefined);

export const AnnotationProvider = ({ children }: { children: ReactNode }) => {
    const [selection, setSelection] = useState<{ range: Range, verseNum: string } | null>(null);
    const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);

    const value = {
        selection,
        setSelection,
        activeAnnotation,
        setActiveAnnotation,
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
