
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAnnotationContext } from '@/contexts/annotation-context';
import { type Annotation } from '@/lib/bible';

interface DrawingCanvasProps {
    containerRef: React.RefObject<HTMLDivElement>;
    existingDrawings: Annotation[];
}

export function DrawingCanvas({ containerRef, existingDrawings }: DrawingCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { isDrawingMode, setSaveDrawing, createOrUpdateAnnotation, saveDrawing } = useAnnotationContext();
    const [isDrawing, setIsDrawing] = useState(false);
    const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

    useEffect(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            if (context) {
                 context.strokeStyle = '#8e24aa'; // ul-purple
                 context.lineWidth = 2;
                 context.lineCap = 'round';
                 context.lineJoin = 'round';
                 setCtx(context);
            }
        }
    }, []);

    const drawExisting = useCallback(() => {
        if (!ctx || !canvasRef.current) return;
        const canvas = canvasRef.current;
        ctx.clearRect(0,0, canvas.width, canvas.height); // Clear before redraw

        existingDrawings.forEach(d => {
            if (d.drawingDataUrl) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                }
                img.src = d.drawingDataUrl;
            }
        });
    }, [ctx, existingDrawings]);

    // Effect to handle resizing of the canvas to match container
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const resizeObserver = new ResizeObserver(() => {
            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
            // Redraw existing drawings after resize
            drawExisting();
        });

        resizeObserver.observe(container);

        // Initial size set
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        drawExisting();


        return () => resizeObserver.disconnect();
    }, [containerRef, ctx, drawExisting]);

    // Redraw when existing drawings change
     useEffect(() => {
        drawExisting();
    }, [existingDrawings, ctx, drawExisting]);

    const getCoords = (event: MouseEvent | TouchEvent): { x: number; y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        if (event instanceof MouseEvent) {
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        } else {
            return { x: event.touches[0].clientX - rect.left, y: event.touches[0].clientY - rect.top };
        }
    };

    const startDrawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawingMode || !ctx) return;
        event.preventDefault();
        setIsDrawing(true);
        const { x, y } = getCoords(event.nativeEvent);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !isDrawingMode || !ctx) return;
        event.preventDefault();
        const { x, y } = getCoords(event.nativeEvent);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!ctx) return;
        event.preventDefault();
        ctx.closePath();
        setIsDrawing(false);
    };
    
    // Effect to handle saving
    useEffect(() => {
        if (saveDrawing && canvasRef.current && ctx) {
            const dataUrl = canvasRef.current.toDataURL('image/png');

            createOrUpdateAnnotation({ drawingDataUrl: dataUrl });
            
            // Reset save trigger
            setSaveDrawing(false);
        }
    }, [saveDrawing, setSaveDrawing, createOrUpdateAnnotation, ctx]);

    if (!isDrawingMode && existingDrawings.length === 0) {
        return null; // Don't render anything if not in drawing mode and no drawings exist
    }

    return (
        <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="absolute top-0 left-0 w-full h-full"
            style={{ 
                pointerEvents: isDrawingMode ? 'auto' : 'none',
                zIndex: 10,
                touchAction: 'none'
            }}
        />
    );
}
