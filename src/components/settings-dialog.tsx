
"use client";

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode.react';
import { Button } from './ui/button';
import { Settings, Download, Upload, Loader2, Copy, Palette, FileJson, Share2, Eye } from 'lucide-react';
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
            if (!Array.isArray(importedData)) throw new Error("Invalid format.");
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
            toast({ title: "Import Successful", description: `Successfully imported ${count} annotations.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Import Failed", description: "Could not parse JSON file." });
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
        <Button variant="outline" size="icon" className="h-10 w-10 md:h-9 md:w-9">
          <Settings className="h-5 w-5 md:h-4 md:w-4" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-w-[95vw] rounded-2xl border-stone-200 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl text-primary">App Settings</DialogTitle>
          <DialogDescription className="text-base">
            Manage your study data and display options.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="share" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-3 h-12 bg-stone-200/50 p-1 rounded-xl">
                <TabsTrigger value="share" className="text-xs md:text-sm font-bold text-stone-600 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Share</TabsTrigger>
                <TabsTrigger value="data" className="text-xs md:text-sm font-bold text-stone-600 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Data</TabsTrigger>
                <TabsTrigger value="branding" className="text-xs md:text-sm font-bold text-stone-600 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Logo</TabsTrigger>
            </TabsList>
            
            <TabsContent value="share" className="space-y-6 pt-6">
                <div className="flex flex-col items-center justify-center gap-6">
                    <div className="p-4 bg-white rounded-2xl shadow-inner border-2 border-stone-100">
                        <QRCode value={url} size={180} />
                    </div>
                    <div className="w-full space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] text-center">Application URL</p>
                        <div className="flex gap-2">
                            <Input readOnly value={url} className="bg-white border-stone-200 font-mono text-[11px] h-12" />
                            <Button size="icon" variant="outline" onClick={handleCopyLink} className="shrink-0 h-12 w-12 border-stone-200"><Copy className="h-5 w-5" /></Button>
                        </div>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="data" className="space-y-4 pt-4">
                <div className="grid gap-3 border-2 p-5 rounded-2xl bg-stone-50 border-stone-100">
                    <h4 className="font-bold text-base flex items-center gap-2 text-primary"><FileJson className="h-5 w-5" /> Study Portability</h4>
                    <p className="text-sm text-stone-600 leading-relaxed">Export your annotations for backup or import a saved session to another device.</p>
                    <div className="flex flex-col gap-3 mt-2">
                        <Button variant="secondary" size="lg" onClick={handleExport} disabled={!allUserAnnotations || allUserAnnotations.length === 0} className="h-12 text-base font-bold bg-white border border-stone-200 hover:bg-stone-100">
                            <Download className="mr-2 h-5 w-5" /> Export (.json)
                        </Button>
                        <div className="relative">
                            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <Button variant="outline" size="lg" className="w-full h-12 text-base font-bold border-stone-200 bg-white" onClick={handleImportClick} disabled={isImporting || !user}>
                                {isImporting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
                                Import (.json)
                            </Button>
                        </div>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="branding" className="pt-4 space-y-4">
                <div className="flex flex-col items-center justify-center border-2 rounded-2xl p-8 bg-stone-50 border-stone-100 gap-6">
                    <Logo className="h-24 w-24 text-primary" />
                    <div className="text-center">
                        <h4 className="font-headline font-bold text-xl text-primary">The Sword and Pen</h4>
                        <p className="text-sm text-stone-500 mt-1 uppercase tracking-widest">Digital Scripture Study Tool</p>
                    </div>
                    <Button variant="outline" size="lg" onClick={handleDownloadLogo} className="h-12 font-bold border-stone-200 bg-white hover:bg-primary hover:text-primary-foreground transition-all">
                        <Download className="mr-2 h-5 w-5" /> Download Logo (SVG)
                    </Button>
                </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
