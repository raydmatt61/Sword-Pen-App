
"use client";

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode.react';
import { Button } from './ui/button';
import { Settings, QrCode as QrIcon, Link as LinkIcon, Download, Upload, Loader2, Share2, Database, Copy } from 'lucide-react';
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

export function SettingsDialog() {
  const [url, setUrl] = useState('');
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

  useEffect(() => {
    if (isOpen && isClient) {
      setUrl(window.location.href);
    }
  }, [isOpen, isClient]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    toast({
        title: "Link Copied",
        description: "The page URL has been copied to your clipboard.",
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
        <Button variant="outline" size="icon">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">App Settings</DialogTitle>
          <DialogDescription>
            Manage your sharing options and personal study data.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="share" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="share" className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" /> Share
                </TabsTrigger>
                <TabsTrigger value="data" className="flex items-center gap-2">
                    <Database className="h-4 w-4" /> Data
                </TabsTrigger>
            </TabsList>
            
            <TabsContent value="share" className="space-y-6 pt-6">
                <div className="flex flex-col items-center justify-center gap-6">
                    <div className="p-4 bg-white rounded-lg shadow-inner border">
                        <QRCode value={url} size={180} />
                    </div>
                    
                    <div className="w-full space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest text-center">Share this location</p>
                        <div className="flex gap-2">
                            <Input 
                                readOnly 
                                value={url} 
                                className="bg-muted/50 font-mono text-[10px] md:text-xs"
                            />
                            <Button size="icon" variant="outline" onClick={handleCopyLink} className="shrink-0">
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground text-center">
                        Scan the code or copy the link to share your current study location.
                    </p>
                </div>
            </TabsContent>

            <TabsContent value="data" className="space-y-4 pt-4">
                <div className="grid gap-2">
                    <h4 className="font-medium text-sm">Study Portability</h4>
                    <p className="text-xs text-muted-foreground">
                        Export your notes and highlights as a JSON file for backup or transfer.
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <Button variant="secondary" className="w-full" onClick={handleExport} disabled={!allUserAnnotations || allUserAnnotations.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> Export Annotations
                    </Button>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".json"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <Button variant="outline" className="w-full" onClick={handleImportClick} disabled={isImporting || !user}>
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            Import Annotations
                        </Button>
                    </div>
                    {!user && (
                        <p className="text-[10px] text-destructive text-center font-medium">
                            Please sign in to manage your data.
                        </p>
                    )}
                </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
