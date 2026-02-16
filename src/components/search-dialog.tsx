"use client";

import { useState } from 'react';
import { Button } from './ui/button';
import { Search, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { searchBible } from '@/app/actions';
import type { SearchResultVerse } from '@/app/actions';
import { BIBLE_ABBR_BOOKS } from '@/lib/bible';

export function SearchDialog({ translationId, navigate }: { translationId: string; navigate: (newValues: Partial<{ book: string; chapter: string; translation: string }>) => void; }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultVerse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsLoading(true);
    setResults([]);
    try {
      const searchResults = await searchBible({ query, translationId });
      if (searchResults && searchResults.verses.length > 0) {
        setResults(searchResults.verses);
      } else {
        toast({
          title: "No Results",
          description: `No results found for "${query}".`,
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        variant: "destructive",
        title: "Search Failed",
        description: error instanceof Error ? error.message : "An error occurred while searching. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultClick = (result: SearchResultVerse) => {
    const bookName = BIBLE_ABBR_BOOKS[result.bookId];
    if (bookName) {
      const chapter = result.id.split('.')[1];
      navigate({ book: bookName, chapter: chapter });
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Search Bible</DialogTitle>
          <DialogDescription>
            Search for a word or phrase in the selected translation ({translationId}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input 
            placeholder="e.g., God is love"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
          </Button>
        </form>
        <ScrollArea className="max-h-[60vh] mt-4">
          <div className="pr-4 space-y-4">
            {results.map((verse) => (
              <div key={verse.id} className="p-4 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => handleResultClick(verse)}>
                <p className="font-bold text-primary">{verse.reference}</p>
                <p className="text-sm" dangerouslySetInnerHTML={{ __html: verse.text.replace(/<mark>/g, '<mark class="bg-primary/20">') }}></p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
