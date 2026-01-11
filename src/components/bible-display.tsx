
"use client";

import { useMemo } from 'react';
import { type Annotation, type BibleChapterResponse, type ChapterContentItem } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Balancer from 'react-wrap-balancer';
import { useAnnotationContext } from '@/contexts/annotation-context';


function VerseComponent({
    verse,
    annotations,
    onTextSelect,
    onAnnotationClick,
}: {
    verse: Extract<ChapterContentItem, { type: 'verse' }>;
    annotations: Annotation[];
    onTextSelect: (e: React.MouseEvent<HTMLParagraphElement>) => void;
    onAnnotationClick: (annotation: Annotation) => void;
}) {
    const verseText = useMemo(() => verse.content.map(c => typeof c === 'string' ? c : (c.text || '')).join(''), [verse.content]);
    
    const renderedContent = useMemo(() => {
        const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start);
        let lastIndex = 0;
        const parts: React.ReactNode[] = [];

        sortedAnnotations.forEach((annotation) => {
            if (annotation.start > lastIndex) {
                parts.push(verseText.substring(lastIndex, annotation.start));
            }
            parts.push(
                <span
                    key={annotation.id}
                    className={cn("annotated-text", annotation.highlight, annotation.underline, annotation.note && "border-b-2 border-dashed border-primary")}
                    onClick={(e) => { e.stopPropagation(); onAnnotationClick(annotation); }}
                >
                    {verseText.substring(annotation.start, annotation.end)}
                </span>
            );
            lastIndex = annotation.end;
        });

        if (lastIndex < verseText.length) {
            parts.push(verseText.substring(lastIndex));
        }

        return parts;
    }, [verseText, annotations, onAnnotationClick]);

    return (
        <p className="text-lg leading-relaxed font-body" data-verse-number={verse.number} onMouseUp={onTextSelect}>
            <sup className="font-headline font-bold text-primary mr-2 select-none">{verse.number}</sup>
            {renderedContent}
        </p>
    );
}

export function BibleDisplay() {
    const { 
        chapterData, 
        chapterAnnotations, 
        handleTextSelect, 
        handleAnnotationClick 
    } = useAnnotationContext();
    
    const fullReference = `${chapterData.book.name} ${chapterData.chapter.number}`;

    return (
        <div className="mt-4 md:mt-0">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-3xl">{fullReference}</CardTitle>
                        <p className="text-sm text-muted-foreground">{chapterData.translation.name}</p>
                </CardHeader>
                <CardContent onMouseUp={handleTextSelect}>
                    <div className="space-y-2 select-text">
                            {chapterData.chapter.content.map((item, index) => {
                            if (item.type === 'heading') {
                                return <h4 key={`h-${index}`} className="text-xl font-headline font-bold pt-4 select-none"><Balancer>{item.content.join(' ')}</Balancer></h4>
                            }
                            if (item.type === 'verse') {
                                return <VerseComponent 
                                            key={item.number} 
                                            verse={item} 
                                            annotations={chapterAnnotations[item.number] || []}
                                            onTextSelect={handleTextSelect}
                                            onAnnotationClick={handleAnnotationClick}
                                        />
                            }
                            return null;
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
