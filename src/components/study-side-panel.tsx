
"use client";

import { useState, useRef, useEffect } from 'react';
import { SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from './ui/sidebar';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Eraser, Download, Type, PenTool, Loader2, Save, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudySession } from '@/contexts/study-session-context';
import { ScrollArea } from './ui/scroll-area';

export function StudySidePanel() {
    const { scratchpad, setScratchpad, sketchpad, setSketchpad, isLoading, isSaving, persistNow } = useStudySession();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#1c1917');
    const [isEraser, setIsEraser] = useState(false);
    
    // Tracking for 2-finger panning
    const activePointers = useRef<Map<number, { x: number, y: number }>>(new Map());
    const isPanning = useRef(false);

    // Initialize Canvas and restore saved drawing
    useEffect(() => {
        const canvas = canvasRef.current;
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

        if (sketchpad) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
            };
            img.src = sketchpad;
        } else {
            ctx.clearRect(0, 0, width, height);
        }
    }, [sketchpad, isLoading]);

    const startDrawing = (e: React.PointerEvent) => {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.current.size > 1) {
            isPanning.current = true;
            setIsDrawing(false);
            return;
        }

        setIsDrawing(true);
        isPanning.current = false;
        
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.PointerEvent) => {
        const prevPos = activePointers.current.get(e.pointerId);
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (isPanning.current || activePointers.current.size > 1) {
            if (prevPos && scrollContainerRef.current) {
                const dy = e.clientY - prevPos.y;
                scrollContainerRef.current.scrollTop -= dy;
            }
            return;
        }

        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        
        if (isEraser) {
            ctx.lineWidth = 20;
        } else if (e.pointerType === 'pen' && e.pressure > 0) {
            // Refined ultra-thin line for high-fidelity stylus input
            ctx.lineWidth = 0.2 + (e.pressure * 1.5);
        } else {
            ctx.lineWidth = 0.8;
        }

        ctx.strokeStyle = color;
        ctx.lineTo(x, y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const stopDrawing = (e: React.PointerEvent) => {
        activePointers.current.delete(e.pointerId);
        
        if (activePointers.current.size === 0) {
            isPanning.current = false;
        }

        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            setSketchpad(canvas.toDataURL());
        }
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
                            </div>
                        </div>
                        
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-white/90 backdrop-blur-md p-2 rounded-full border shadow-lg z-10">
                            {['#1c1917', '#991b1b', '#15803d', '#1d4ed8', '#7e22ce'].map((c) => (
                                <button
                                    key={c}
                                    onClick={() => { setColor(c); setIsEraser(false); }}
                                    className={cn(
                                        "h-6 w-6 rounded-full border-2 border-transparent transition-all hover:scale-125",
                                        !isEraser && color === c && "border-white ring-2 ring-primary scale-110"
                                    )}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                            <button
                                onClick={() => setIsEraser(!isEraser)}
                                className={cn(
                                    "h-6 w-6 rounded-full border-2 border-stone-200 flex items-center justify-center transition-all hover:scale-125",
                                    isEraser && "bg-primary text-white border-primary ring-2 ring-primary scale-110"
                                )}
                                title="Eraser"
                            >
                                <Eraser className="h-3 w-3" />
                            </button>
                        </div>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </div>
    );
}
