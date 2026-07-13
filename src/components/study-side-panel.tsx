
"use client";

import { useState, useRef, useEffect } from 'react';
import { SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from './ui/sidebar';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Eraser, Download, Type, PenTool, Loader2, Save, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudySession } from '@/contexts/study-session-context';
import { ScrollArea, ScrollBar } from './ui/scroll-area';

export function StudySidePanel() {
    const { scratchpad, setScratchpad, sketchpad, setSketchpad, isLoading, isSaving, persistNow } = useStudySession();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#1c1917');

    // Initialize Canvas with Pointer Events and restore saved drawing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        // Ensure canvas backing store matches the CSS size (which is now 2000px height)
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2;

        // Restore saved sketch from state
        if (sketchpad) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, rect.width, rect.height);
                ctx.drawImage(img, 0, 0, rect.width, rect.height);
            };
            img.src = sketchpad;
        } else {
            ctx.clearRect(0, 0, rect.width, rect.height);
        }
    }, [sketchpad, isLoading]);

    const startDrawing = (e: React.PointerEvent) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        // clientX/Y - rect.left/top gives the coordinate relative to the top-left of the 2000px canvas
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.PointerEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Support pressure sensitivity for pen pointers
        if (e.pointerType === 'pen' && e.pressure > 0) {
            ctx.lineWidth = 1 + (e.pressure * 6);
        } else {
            ctx.lineWidth = 2;
        }

        ctx.strokeStyle = color;
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
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
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
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
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Chapter-Linked Session Data</p>
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
                            Sketchpad (Scrollable / Stylus)
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
                        <ScrollArea className="flex-1 w-full h-full">
                            <div className="relative w-full h-[2000px] bg-white">
                                <canvas
                                    ref={canvasRef}
                                    onPointerDown={startDrawing}
                                    onPointerMove={draw}
                                    onPointerUp={stopDrawing}
                                    onPointerLeave={stopDrawing}
                                    onPointerCancel={stopDrawing}
                                    className="w-full h-full cursor-crosshair touch-none"
                                    style={{ touchAction: 'none' }}
                                />
                            </div>
                            <ScrollBar orientation="vertical" />
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                        
                        {/* Fixed Toolbar over the scrollable area */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-white/90 backdrop-blur-md p-2 rounded-full border shadow-lg z-10">
                            {['#1c1917', '#991b1b', '#15803d', '#1d4ed8', '#7e22ce'].map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    className={cn(
                                        "h-6 w-6 rounded-full border-2 border-transparent transition-all hover:scale-125",
                                        color === c && "border-white ring-2 ring-primary scale-110"
                                    )}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </div>
    );
}
