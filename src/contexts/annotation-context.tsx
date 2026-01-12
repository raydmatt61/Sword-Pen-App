
"use client";

import { createContext, useContext, ReactNode, useState, Dispatch, SetStateAction, useCallback } from 'react';
import type { Annotation } from '@/lib/bible';

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
    createOrUpdateAnnotation: (data: Partial<Omit<Annotation, 'id' | 'userId'>>) => void;
}

const AnnotationContext = createContext<AnnotationContextType | undefined>(undefined);

export const AnnotationProvider = ({ children }: { children: ReactNode }) => {
    const [selection, setSelection] = useState<{ range: Range, verseNum: string } | null>(null);
    const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
    const [fontSize, setFontSize] = useState<FontSize>('md');
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [saveDrawing, setSaveDrawing] = useState(false);

    // This is a placeholder. It will be replaced by the actual implementation in AnnotationWrapper.
    // This avoids prop drilling the function from the wrapper up to the context.
    const createOrUpdateAnnotation = useCallback((data: Partial<Omit<Annotation, 'id' | 'userId'>>) => {
        console.warn('createOrUpdateAnnotation was called from the context placeholder.');
    }, []);


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
        createOrUpdateAnnotation, // Provide the placeholder
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
