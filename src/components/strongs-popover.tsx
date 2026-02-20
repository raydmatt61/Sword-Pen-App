
"use client";

import { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getStrongsDetail } from '@/app/actions';
import type { StrongsDetail } from '@/lib/bible';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BIBLE_ABBR_BOOKS } from '@/lib/bible';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';

interface StrongsPopoverProps {
  children: React.ReactNode;
  strongsNumber: string;
  navigate: (newValues: Partial<{ book: string; chapter: string; }>) => void;
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
                } else if (href && href.startsWith('/strongs/')) {
                    // Prevent default for strongs links within the definition for now
                    link.addEventListener('click', e => e.preventDefault());
                } else {
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                }
            });
        }
    }, [htmlString, onNavigate]);

    return <div ref={contentRef} className="strongs-html-content" />;
};


export function StrongsPopover({ children, strongsNumber, navigate }: StrongsPopoverProps) {
    const [details, setDetails] = useState<StrongsDetail[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open && !details) {
            setIsLoading(true);
            getStrongsDetail(strongsNumber)
                .then(res => {
                    if (res) {
                        setDetails(res);
                    } else {
                        toast({ variant: 'destructive', title: "Not Found", description: `Could not find a definition for ${strongsNumber}.` });
                        setIsOpen(false);
                    }
                })
                .catch(err => {
                    toast({ variant: 'destructive', title: "Lookup Error", description: err.message });
                    setIsOpen(false);
                })
                .finally(() => setIsLoading(false));
        }
    };
    
    const handleLinkNavigate = (bookAbbr: string, chapter: string) => {
        const bookName = BIBLE_ABBR_BOOKS[bookAbbr.toUpperCase()];
        if (bookName) {
            navigate({ book: bookName, chapter: chapter });
            setIsOpen(false);
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-[400px] md:w-[500px] p-0" onClick={(e) => e.stopPropagation()}>
                <ScrollArea className="max-h-[60vh]">
                     <div className="p-4 space-y-4">
                        {isLoading && (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                        {details && details.map((item) => (
                            <Card key={item.strongsNumber} className="shadow-none border-0">
                                <CardHeader>
                                    <CardTitle className="font-headline text-2xl flex items-baseline justify-between">
                                        <span>{item.lemma} ({item.transliteration})</span>
                                        <span className="text-lg font-bold text-primary">{item.strongsNumber}</span>
                                    </CardTitle>
                                    {item.pronunciation && <p className="text-sm text-muted-foreground -mt-2">{item.pronunciation}</p>}
                                </CardHeader>
                                <CardContent className="space-y-4 font-body text-sm">
                                    <p><span className="font-bold">Short Definition:</span> {item.shortDefinition}</p>
                                    {item.longDefinition && (
                                        <div>
                                            <p className="font-bold">Long Definition:</p>
                                            <RenderHtmlWithNavigation htmlString={item.longDefinition} onNavigate={handleLinkNavigate} />
                                        </div>
                                    )}
                                    {item.kjvDefinition && (
                                        <div>
                                            <p className="font-bold">KJV Definition:</p>
                                            <p className="italic">{item.kjvDefinition}</p>
                                        </div>
                                    )}
                                    {item.strongsDerivation && (
                                        <div>
                                            <p className="font-bold">Derivation:</p>
                                            <RenderHtmlWithNavigation htmlString={item.strongsDerivation} onNavigate={handleLinkNavigate} />
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter>
                                  <p className="text-xs text-muted-foreground">
                                    Data from Sefaria, <a href="https://github.com/openscriptures/strongs" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Open Scriptures</a> & bolls.life.
                                  </p>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
