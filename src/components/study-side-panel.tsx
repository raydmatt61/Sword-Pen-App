
"use client";

import { useState, useRef, useEffect } from 'react';
import { SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from './ui/sidebar';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Eraser, Download, Type, PenTool } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StudySidePanel() {
    const [scratchpad, setScratchpad] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#1c1917');

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set high res for canvas
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        ctx?.beginPath();
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.strokeStyle = color;
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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
            <SidebarHeader className="p-4 border-b bg-stone-100">
                <h3 className="font-headline font-bold text-lg text-primary flex items-center gap-2">
                    <PenTool className="h-5 w-5" />
                    Study Workspace
                </h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Tablet-Only Enhanced Mode</p>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-2 flex items-center gap-2">
                        <Type className="h-3.5 w-3.5" />
                        Scratchpad
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <Textarea
                            placeholder="Jot down quick thoughts here..."
                            className="font-body text-sm bg-white border-stone-200 min-h-[200px] resize-none focus-visible:ring-primary/20"
                            value={scratchpad}
                            onChange={(e) => setScratchpad(e.target.value)}
                        />
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup className="flex-1 min-h-0 flex flex-col">
                    <SidebarGroupLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-2 flex items-center justify-between w-full">
                        <span className="flex items-center gap-2">
                            <PenTool className="h-3.5 w-3.5" />
                            Sketchpad
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
                    <SidebarGroupContent className="flex-1 relative bg-white border border-stone-200 rounded-lg overflow-hidden">
                        <canvas
                            ref={canvasRef}
                            onMouseDown={startDrawing}
                            onMouseUp={stopDrawing}
                            onMouseMove={draw}
                            onTouchStart={startDrawing}
                            onTouchEnd={stopDrawing}
                            onTouchMove={draw}
                            className="w-full h-full cursor-crosshair touch-none"
                        />
                        <div className="absolute bottom-2 left-2 flex gap-1 bg-stone-100/80 backdrop-blur-sm p-1 rounded-full border shadow-sm">
                            {['#1c1917', '#991b1b', '#15803d', '#1d4ed8'].map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    className={cn(
                                        "h-5 w-5 rounded-full border border-white transition-transform hover:scale-110",
                                        color === c && "ring-2 ring-primary ring-offset-1"
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
