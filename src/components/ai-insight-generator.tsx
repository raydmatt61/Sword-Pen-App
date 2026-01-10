"use client";

import { useState } from 'react';
import { generateVerseInsights } from '@/app/actions';
import { Button } from './ui/button';
import { Lightbulb, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';

export function AiInsightGenerator({ verse, annotation }: { verse: string; annotation: string; }) {
  const [insight, setInsight] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setInsight('');
    try {
      const result = await generateVerseInsights({ verse, annotations: annotation });
      if (result.insights) {
        setInsight(result.insights);
      } else {
        throw new Error("Failed to get insights. The result was empty.");
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error Generating Insight",
        description: "An unexpected error occurred. Please try again.",
      });
      setIsOpen(false); // Close dialog on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleGenerate}>
          {isLoading && isOpen ? (
            <Loader2 className="mr-2 animate-spin" />
          ) : (
            <Lightbulb className="mr-2" />
          )}
          AI Insight
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-headline">AI-Generated Insight</DialogTitle>
          <DialogDescription>
            AI analysis based on the verse and your annotation.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
            {isLoading ? (
                <div className="flex items-center justify-center p-8 min-h-[200px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="font-body text-foreground whitespace-pre-wrap py-2">
                    {insight}
                </div>
            )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
