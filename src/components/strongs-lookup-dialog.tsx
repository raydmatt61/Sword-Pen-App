
"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { BookMarked, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { getStrongsDetail } from '@/app/actions';
import type { StrongsDetail } from '@/lib/bible';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { BIBLE_ABBR_BOOKS } from '@/lib/bible';

interface StrongsLookupDialogProps {
  navigate: (newValues: Partial<{ book: string; chapter: string; translation: string; }>) => void;
}

const RenderHtmlWithNavigation = ({ htmlString, onNavigate }: { htmlString: string; onNavigate: (bookAbbr: string, chapter: string) => void; }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            const element = contentRef.current;
            element.innerHTML = htmlString;
            const links = element.querySelectorAll('a');
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('/Bible/')) {
                    link.addEventListener('click', e => {
                        e.preventDefault();
                        const parts = href.split('/');
                        if (parts.length >= 4) { // e.g., ['', 'Bible', 'JHN', '3']
                            onNavigate(parts[2], parts[3]);
                        }
                    });
                } else {
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                }
            });
        }
    }, [htmlString, onNavigate]);

    return <div ref={contentRef} className="strongs-html-content" />;
};

export function StrongsLookupDialog({ navigate }: StrongsLookupDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StrongsDetail[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsLoading(true);
    setResults(null);
    try {
      const lookupResults = await getStrongsDetail(query.trim().toUpperCase());
      if (lookupResults && lookupResults.length > 0) {
        setResults(lookupResults);
      } else {
        toast({
          title: "No Results",
          description: `No Strong's definition found for "${query}".`,
        });
      }
    } catch (error) {
      console.error("Strongs lookup error:", error);
      toast({
        variant: "destructive",
        title: "Lookup Failed",
        description: error instanceof Error ? error.message : "An error occurred during the lookup. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLinkNavigate = (bookAbbr: string, chapter: string) => {
    const bookName = BIBLE_ABBR_BOOKS[bookAbbr.toUpperCase()];
    if (bookName) {
      navigate({ book: bookName, chapter: chapter });
      onOpenChange(false); // Close dialog
    }
  };

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setQuery('');
      setResults(null);
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <BookMarked className="h-4 w-4" />
          <span className="sr-only">Strongs Lookup</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Strong's Concordance Lookup</DialogTitle>
          <DialogDescription>
            Enter a Strong's number (e.g., G2424 or H8064) to see its definition.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleLookup} className="flex gap-2">
          <Input 
            placeholder="e.g., G2424"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="characters"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : "Lookup"}
          </Button>
        </form>
        <ScrollArea className="max-h-[60vh] mt-4">
          <div className="pr-4 space-y-4">
            {isLoading && (
                 <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
            {results && results.map((item) => (
              <Card key={item.strongsNumber}>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-baseline justify-between">
                        <span>{item.lemma} ({item.transliteration})</span>
                        <span className="text-lg font-bold text-primary">{item.strongsNumber}</span>
                    </CardTitle>
                     {item.pronunciation && <p className="text-sm text-muted-foreground -mt-2">{item.pronunciation}</p>}
                </CardHeader>
                <CardContent className="space-y-4 font-body">
                    <p><span className="font-bold">Short Definition:</span> {item.shortDefinition}</p>
                    {item.longDefinition && (
                        <div>
                            <p className="font-bold">Long Definition:</p>
                            <RenderHtmlWithNavigation htmlString={item.longDefinition} onNavigate={handleLinkNavigate} />
                        </div>
                    )}
                     <div>
                        <p className="font-bold">KJV Definition:</p>
                        <p className="italic">{item.kjvDefinition}</p>
                    </div>
                    {item.strongsDerivation && (
                        <div>
                            <p className="font-bold">Derivation:</p>
                            <RenderHtmlWithNavigation htmlString={item.strongsDerivation} onNavigate={handleLinkNavigate} />
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <p className="text-xs text-muted-foreground">
                        Data from Sefaria &amp; bolls.life.
                    </p>
                </CardFooter>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
