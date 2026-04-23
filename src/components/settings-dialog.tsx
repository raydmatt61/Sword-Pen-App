
"use client";

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode.react';
import { Button } from './ui/button';
import { Settings, Download, Upload, Loader2, Share2, Database, Copy, Palette, FileJson } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from './ui/input';
import { useAnnotationContext } from '@/contexts/annotation-context';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Logo } from './logo';

const APP_SHARE_URL = 'https://studio--studio-8198471998-f4406.us-central1.hosted.app/';

export function SettingsDialog() {
  const [url, setUrl] = useState(APP_SHARE_URL);
  const [isOpen, setIsOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { allUserAnnotations } = useAnnotationContext();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    toast({
        title: "Link Copied",
        description: "The application link has been copied to your clipboard.",
    });
  };

  const handleExport = () => {
    if (!allUserAnnotations) return;
    const dataStr = JSON.stringify(allUserAnnotations, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'sword-and-pen-annotations.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast({
        title: "Data Exported",
        description: "Your annotations have been downloaded as a JSON file.",
    });
  };

  const handleDownloadLogo = () => {
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.5 17.5 3 6l3-3 11.5 11.5" />
      <path d="M13 19l2 2" />
      <path d="M16 16l2 2" />
      <path d="M10 14 21 3" />
      <path d="M5 19l3-3 2 2-3 3-4 1 1-4 1 1z" />
    </svg>`;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sword-and-pen-logo.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Logo Downloaded", description: "The app logo has been saved as an SVG file." });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !firestore) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = e.target?.result as string;
            const importedData = JSON.parse(content);

            if (!Array.isArray(importedData)) {
                throw new Error("Invalid format: Expected an array of annotations.");
            }

            let count = 0;
            for (const item of importedData) {
                const { id, ...rest } = item;
                const newDocRef = doc(collection(firestore, `users/${user.uid}/annotations`));
                setDocumentNonBlocking(newDocRef, {
                    ...rest,
                    userId: user.uid,
                    updatedAt: serverTimestamp(),
                    createdAt: serverTimestamp(),
                });
                count++;
            }

            toast({
                title: "Import Successful",
                description: `Successfully imported ${count} annotations.`,
            });
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Import Failed",
                description: "Could not parse the JSON file. Please ensure it is a valid export.",
            });
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    reader.readAsText(file);
  };

  if (!isClient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 md:h-10 md:w-10">
          <Settings className="h-4 w-4 md:h-5 md:w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">App Settings</DialogTitle>
          <DialogDescription>
            Manage your study data and sharing options.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="share" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="share">Share</TabsTrigger>
                <TabsTrigger value="data">Data</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
            </TabsList>
            
            <TabsContent value="share" className="space-y-6 pt-6">
                <div className="flex flex-col items-center justify-center gap-6">
                    <div className="p-4 bg-white rounded-lg shadow-inner border">
                        <QRCode value={url} size={180} />
                    </div>
                    <div className="w-full space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">App URL</p>
                        <div className="flex gap-2">
                            <Input readOnly value={url} className="bg-muted/50 font-mono text-[10px]" />
                            <Button size="icon" variant="outline" onClick={handleCopyLink} className="shrink-0"><Copy className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="data" className="space-y-4 pt-4">
                <div className="grid gap-2 border p-4 rounded-lg bg-muted/20">
                    <h4 className="font-bold text-sm flex items-center gap-2"><FileJson className="h-4 w-4" /> Study Portability</h4>
                    <p className="text-xs text-muted-foreground">Export your annotations for backup or import a saved session.</p>
                    <div className="flex flex-col gap-2 mt-2">
                        <Button variant="secondary" size="sm" onClick={handleExport} disabled={!allUserAnnotations || allUserAnnotations.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> Export (.json)
                        </Button>
                        <div className="relative">
                            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <Button variant="outline" size="sm" className="w-full" onClick={handleImportClick} disabled={isImporting || !user}>
                                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Import (.json)
                            </Button>
                        </div>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="branding" className="pt-4 space-y-4">
                <div className="flex flex-col items-center justify-center border rounded-lg p-8 bg-muted/20 gap-4">
                    <Logo className="h-20 w-20 text-primary" />
                    <div className="text-center">
                        <h4 className="font-headline font-bold text-lg">The Sword and Pen</h4>
                        <p className="text-xs text-muted-foreground">Digital Scripture Study Tool</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleDownloadLogo}>
                        <Download className="mr-2 h-4 w-4" /> Download Logo (SVG)
                    </Button>
                </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
