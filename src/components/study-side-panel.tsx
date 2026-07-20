"use client";

import { useState, useRef, useEffect } from 'react';
import { SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from './ui/sidebar';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Eraser, Download, Type, PenTool, Loader2, Save, CheckCircle2, Square, Circle, Triangle, Shapes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudySession } from '@/contexts/study-session-context';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

type DrawingTool = 'pen' | 'eraser' | 'rect' | 'circle' | 'oval' | 'triangle';

export function StudySidePanel() {
    const { scratchpad, setScratchpad, sketchpad, setSketchpad, isLoading, isSaving, persistNow } = useStudySession();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#1c1917');
    const [tool, setTool] = useState<DrawingTool>('pen');
    
    // Tracking for 2-finger panning and start positions for shapes
    const activePointers = useRef<Map<number, { x: number, y: number }>>(new Map());
    const isPanning = useRef(false);
    const startPos = useRef<{ x: number, y: number } | null>(null);

    // Initialize Canvas and restore saved drawing
    useEffect(() => {
        const initCanvas = (canvas: HTMLCanvasElement | null) => {
            if (!canvas) return;
            const ctx = canvas.getContext('2d', { alpha: true });
            if (!ctx) return;

            const dpr = window.devicePixelRatio || 1;
            const width = 350; 
            const height = 2000; 
            
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.imageSmoothingEnabled = true;
            return ctx;
        };

        const ctx = initCanvas(canvasRef.current);
        initCanvas(previewCanvasRef.current);

        if (sketchpad && ctx) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, 350, 2000);
                ctx.drawImage(img, 0, 0, 350, 2000);
            };
            img.src = sketchpad;
        } else if (ctx) {
            ctx.clearRect(0, 0, 350, 2000);
        }
    }, [sketchpad, isLoading]);

    const getCoords = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const drawShape = (ctx: CanvasRenderingContext2D, toolType: DrawingTool, start: { x: number, y: number }, end: { x: number, y: number }) => {
        ctx.beginPath();
        const w = end.x - start.x;
        const h = end.y - start.y;

        switch (toolType) {
            case 'rect':
                ctx.strokeRect(start.x, start.y, w, h);
                break;
            case 'circle':
                const radius = Math.sqrt(w * w + h * h);
                ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
                ctx.stroke();
                break;
            case 'oval':
                const rx = Math.abs(w / 2);
                const ry = Math.abs(h / 2);
                const cx = start.x + w / 2;
                const cy = start.y + h / 2;
                ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
                ctx.stroke();
                break;
            case 'triangle':
                ctx.moveTo(start.x + w / 2, start.y);
                ctx.lineTo(start.x, start.y + h);
                ctx.lineTo(start.x + w, start.y + h);
                ctx.closePath();
                ctx.stroke();
                break;
        }
    };

    const startDrawing = (e: React.PointerEvent) => {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.current.size > 1) {
            isPanning.current = true;
            setIsDrawing(false);
            return;
        }

        const coords = getCoords(e);
        startPos.current = coords;
        setIsDrawing(true);
        isPanning.current = false;
        
        if (tool === 'pen' || tool === 'eraser') {
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(coords.x, coords.y);
            }
        }
    };

    const draw = (e: React.PointerEvent) => {
        const prevPointerPos = activePointers.current.get(e.pointerId);
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (isPanning.current || activePointers.current.size > 1) {
            if (prevPointerPos && scrollContainerRef.current) {
                const dy = e.clientY - prevPointerPos.y;
                scrollContainerRef.current.scrollTop -= dy;
            }
            return;
        }

        if (!isDrawing || !startPos.current) return;
        const coords = getCoords(e);

        if (tool === 'pen' || tool === 'eraser') {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;

            ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
            
            if (tool === 'eraser') {
                ctx.lineWidth = 20;
            } else if (e.pointerType === 'pen' && e.pressure > 0) {
                ctx.lineWidth = 0.15 + (e.pressure * 1.2);
            } else {
                ctx.lineWidth = 0.5;
            }

            ctx.strokeStyle = color;
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(coords.x, coords.y);
        } else {
            // Shape tools: draw on preview canvas
            const previewCanvas = previewCanvasRef.current;
            const pCtx = previewCanvas?.getContext('2d');
            if (!previewCanvas || !pCtx) return;

            pCtx.clearRect(0, 0, 350, 2000);
            pCtx.strokeStyle = color;
            pCtx.lineWidth = 0.8;
            drawShape(pCtx, tool, startPos.current, coords);
        }
    };

    const stopDrawing = (e: React.PointerEvent) => {
        activePointers.current.delete(e.pointerId);
        
        if (activePointers.current.size === 0) {
            isPanning.current = false;
        }

        if (!isDrawing) return;
        setIsDrawing(false);
        
        const coords = getCoords(e);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (canvas && ctx && startPos.current && tool !== 'pen' && tool !== 'eraser') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.8;
            drawShape(ctx, tool, startPos.current, coords);
            
            // Clear preview
            const previewCanvas = previewCanvasRef.current;
            previewCanvas?.getContext('2d')?.clearRect(0, 0, 350, 2000);
        }

        if (canvas) {
            setSketchpad(canvas.toDataURL());
        }
        startPos.current = null;
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSketchpad('');
    };

    const downloadCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = 'study-sketch.png';
        link.href = canvas.toDataURL();
        link.click();
    };

    return (
        <div className="flex flex-col h-full bg-stone-50 border-l border-stone-200">
            <SidebarHeader className="p-4 border-b bg-stone-100 relative">
                <div className="flex items-center justify-between">
                    <h3 className="font-headline font-bold text-lg text-primary flex items-center gap-2">
                        <PenTool className="h-5 w-5" />
                        Study Workspace
                    </h3>
                    <div className="flex items-center gap-2">
                        {isSaving ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-200">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Saving</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Synced</span>
                            </div>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={persistNow} title="Force Save">
                            <Save className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className="flex flex-col flex-1 overflow-hidden">
                <SidebarGroup className="shrink-0">
                    <SidebarGroupLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-2 flex items-center gap-2">
                        <Type className="h-3.5 w-3.5" />
                        Scratchpad
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <Textarea
                            placeholder="Jot down quick thoughts here..."
                            className="font-body text-sm bg-white border-stone-200 min-h-[150px] resize-none focus-visible:ring-primary/20"
                            value={scratchpad}
                            onChange={(e) => setScratchpad(e.target.value)}
                        />
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup className="flex-1 min-h-0 flex flex-col">
                    <SidebarGroupLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-2 flex items-center justify-between w-full">
                        <span className="flex items-center gap-2">
                            <PenTool className="h-3.5 w-3.5" />
                            Sketchpad (2-Finger Scroll)
                        </span>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearCanvas} title="Clear">
                                <Eraser className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={downloadCanvas} title="Download">
                                <Download className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="flex-1 relative bg-white border border-stone-200 rounded-lg overflow-hidden flex flex-col">
                        <div 
                            ref={scrollContainerRef}
                            className="flex-1 w-full overflow-auto scrollbar-hide cursor-crosshair touch-none"
                            style={{ touchAction: 'none' }}
                        >
                            <div className="relative w-full h-[2000px] bg-white">
                                <canvas
                                    ref={canvasRef}
                                    onPointerDown={startDrawing}
                                    onPointerMove={draw}
                                    onPointerUp={stopDrawing}
                                    onPointerLeave={stopDrawing}
                                    onPointerCancel={stopDrawing}
                                    className="w-full h-full block"
                                    style={{ touchAction: 'none' }}
                                />
                                <canvas
                                    ref={previewCanvasRef}
                                    className="absolute top-0 left-0 w-full h-full block pointer-events-none opacity-50"
                                    style={{ touchAction: 'none' }}
                                />
                            </div>
                        </div>
                        
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-md p-2 rounded-full border shadow-lg z-10">
                            <div className="flex gap-1 pr-2 border-r">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className={cn("h-7 w-7", tool === 'pen' && "bg-primary/10 text-primary")}
                                    onClick={() => setTool('pen')}
                                    title="Pen"
                                >
                                    <PenTool className="h-3.5 w-3.5" />
                                </Button>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className={cn("h-7 w-7", ['rect', 'circle', 'oval', 'triangle'].includes(tool) && "bg-primary/10 text-primary")}
                                            title="Shapes"
                                        >
                                            <Shapes className="h-3.5 w-3.5" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-1 flex gap-1" side="top">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {setTool('rect');}}><Square className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {setTool('circle');}}><Circle className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {setTool('oval');}} title="Oval">
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <ellipse cx="12" cy="12" rx="10" ry="6" />
                                            </svg>
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {setTool('triangle');}}><Triangle className="h-4 w-4" /></Button>
                                    </PopoverContent>
                                </Popover>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className={cn("h-7 w-7", tool === 'eraser' && "bg-primary/10 text-primary")}
                                    onClick={() => setTool('eraser')}
                                    title="Eraser"
                                >
                                    <Eraser className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            <div className="flex gap-1.5 px-1">
                                {['#1c1917', '#991b1b', '#15803d', '#1d4ed8', '#7e22ce'].map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => { setColor(c); if(tool === 'eraser') setTool('pen'); }}
                                        className={cn(
                                            "h-5 w-5 rounded-full border-2 border-transparent transition-all hover:scale-125",
                                            tool !== 'eraser' && color === c && "border-white ring-2 ring-primary scale-110"
                                        )}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </div>
    );
}
