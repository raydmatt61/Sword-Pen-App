
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAnnotationContext } from '@/contexts/annotation-context';
import { type Annotation, type BibleChapterResponse } from '@/lib/bible';

interface DrawingCanvasProps {
    containerRef: React.RefObject<HTMLDivElement>;
    existingDrawings: Annotation[];
    chapterData: BibleChapterResponse;
}

export function DrawingCanvas({ containerRef, existingDrawings, chapterData }: DrawingCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { 
        isDrawingMode, 
        drawingColor, 
        triggerSaveDrawing, 
        setSaveDrawing,
        createOrUpdateAnnotation, 
        saveDrawing,
        isErasing,
        activeAnnotation,
        setActiveAnnotation,
    } = useAnnotationContext();
    const [isDrawing, setIsDrawing] = useState(false);
    const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

    const drawExisting = useCallback((context: CanvasRenderingContext2D | null = ctx) => {
        if (!context || !canvasRef.current) return;
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); 

        const drawingsToRender = isErasing && activeAnnotation
            ? existingDrawings.filter(d => d.id === activeAnnotation.id)
            : existingDrawings;

        drawingsToRender.forEach(d => {
            if (d.drawingDataUrl) {
                const img = new Image();
                img.onload = () => {
                    context.drawImage(img, 0, 0);
                }
                img.src = d.drawingDataUrl;
            }
        });
    }, [ctx, existingDrawings, isErasing, activeAnnotation]);
    
    // Effect to handle resizing of the canvas to match container
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const resizeObserver = new ResizeObserver(() => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx && canvas.width > 0 && canvas.height > 0) {
                 tempCanvas.width = canvas.width;
                 tempCanvas.height = canvas.height;
                 tempCtx.drawImage(canvas, 0, 0);
            }

            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
            
            // We must re-get the context after resizing
            const newCtx = canvas.getContext('2d');
            if (newCtx) {
                setCtx(newCtx); // Update the state with the new context
                newCtx.drawImage(tempCanvas, 0, 0); // Restore previous drawing
                drawExisting(newCtx); // Redraw existing annotations with the new context
            }
        });

        resizeObserver.observe(container);

        // Initial size set
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        const initialCtx = canvas.getContext('2d');
        if (initialCtx) {
          setCtx(initialCtx);
          drawExisting(initialCtx);
        }

        return () => resizeObserver.disconnect();
    }, [containerRef, drawExisting]);


     useEffect(() => {
        drawExisting();
    }, [existingDrawings, drawExisting, isErasing, activeAnnotation]);

    // Setup canvas context and properties
    useEffect(() => {
        if (canvasRef.current && !ctx) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                setCtx(context);
            }
        }
    }, [ctx]);

    useEffect(() => {
        if (ctx) {
            if (isErasing) {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = 20; // Eraser size
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = drawingColor;
                ctx.lineWidth = 2; // Pen size
            }
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    }, [isErasing, drawingColor, ctx]);


    const getCoords = (event: MouseEvent | TouchEvent): { x: number; y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        const clientX = (event instanceof MouseEvent) ? event.clientX : event.touches[0].clientX;
        const clientY = (event instanceof MouseEvent) ? event.clientY : event.touches[0].clientY;

        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawingMode || !ctx) return;
        
        // Prevent drawing if eraser is active but no drawing is selected
        if (isErasing && !activeAnnotation) {
            return;
        }

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
        if (!ctx || !isDrawing) return;
        event.preventDefault();
        ctx.closePath();
        setIsDrawing(false);
    };
    
    // Effect to handle saving
    useEffect(() => {
        if (saveDrawing && canvasRef.current && ctx) {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            
            if (isErasing && activeAnnotation) {
                // If we were erasing an existing drawing, update it.
                createOrUpdateAnnotation({ drawingDataUrl: dataUrl }, chapterData);
            } else if (!isErasing) {
                // Clear the canvas except for existing drawings
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                drawExisting();

                // Draw the new content on a temporary canvas
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvasRef.current.width;
                tempCanvas.height = canvasRef.current.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                    tempCtx.drawImage(canvasRef.current, 0, 0);
                    const newDrawingUrl = tempCanvas.toDataURL('image/png');
                    // If we were drawing something new, create a new annotation.
                    createOrUpdateAnnotation({ drawingDataUrl: newDrawingUrl }, chapterData);
                }
            }
            
            setSaveDrawing(false);
        } else if (saveDrawing) {
            setSaveDrawing(false);
        }
    }, [saveDrawing, setSaveDrawing, createOrUpdateAnnotation, chapterData, ctx, isErasing, activeAnnotation, drawExisting]);
    
     // Handle clicking on a drawing to select it for erasing
    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isErasing || !ctx || !canvasRef.current) return;
        const { x, y } = getCoords(event.nativeEvent);

        let clickedAnnotation: Annotation | null = null;
        // Iterate backwards to select the top-most drawing
        for (let i = existingDrawings.length - 1; i >= 0; i--) {
            const d = existingDrawings[i];
            if (!d.drawingDataUrl) continue;
            
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            if(!tempCtx) continue;
            const img = new Image();
            img.src = d.drawingDataUrl;
            tempCanvas.width = canvasRef.current.width;
            tempCanvas.height = canvasRef.current.height;
            tempCtx.drawImage(img, 0, 0);

            const pixel = tempCtx.getImageData(x, y, 1, 1).data;
            if (pixel[3] > 0) { // Check alpha channel
                clickedAnnotation = d;
                break;
            }
        }
        
        setActiveAnnotation(clickedAnnotation);
    };

    return (
        <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="absolute top-0 left-0"
            style={{ 
                pointerEvents: isDrawingMode ? 'auto' : 'none',
                zIndex: isDrawingMode ? 10 : 1,
                touchAction: isDrawingMode ? 'none' : 'auto'
            }}
        />
    );
}

    