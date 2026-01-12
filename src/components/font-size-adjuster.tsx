
"use client";

import { useAnnotationContext, type FontSize } from "@/contexts/annotation-context";
import { Button } from "./ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";

const fontSizes: FontSize[] = ['sm', 'md', 'lg', 'xl', '2xl'];

export function FontSizeAdjuster() {
  const { fontSize, setFontSize } = useAnnotationContext();

  const handleZoom = (direction: 'in' | 'out') => {
    const currentIndex = fontSizes.indexOf(fontSize);
    if (direction === 'in') {
      const nextIndex = Math.min(currentIndex + 1, fontSizes.length - 1);
      setFontSize(fontSizes[nextIndex]);
    } else {
      const prevIndex = Math.max(currentIndex - 1, 0);
      setFontSize(fontSizes[prevIndex]);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button 
        variant="outline" 
        size="icon" 
        onClick={() => handleZoom('out')}
        disabled={fontSize === 'sm'}
        className="h-8 w-8"
        aria-label="Decrease font size"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button 
        variant="outline" 
        size="icon" 
        onClick={() => handleZoom('in')}
        disabled={fontSize === '2xl'}
        className="h-8 w-8"
        aria-label="Increase font size"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
    </div>
  );
}
