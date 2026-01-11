
"use client";

import { createContext, useContext, ReactNode } from 'react';
import type { Annotation, BibleChapterResponse } from '@/lib/bible';

interface AnnotationContextType {
    chapterData: BibleChapterResponse;
    chapterAnnotations: Record<string, Annotation[]>;
    handleTextSelect: (e: React.MouseEvent<HTMLDivElement>) => void;
    handleAnnotationClick: (annotation: Annotation) => void;
}

const AnnotationContext = createContext<AnnotationContextType | undefined>(undefined);

export const AnnotationProvider = ({ value, children }: { value: AnnotationContextType, children: ReactNode }) => {
    return <AnnotationContext.Provider value={value}>{children}</AnnotationContext.Provider>;
};

export const useAnnotationContext = () => {
    const context = useContext(AnnotationContext);
    if (context === undefined) {
        throw new Error('useAnnotationContext must be used within an AnnotationProvider');
    }
    return context;
};
