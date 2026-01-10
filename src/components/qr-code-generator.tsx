
"use client";

import { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { Button } from './ui/button';
import { QrCode } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

export function QrCodeGenerator() {
  const [url, setUrl] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // This ensures that window is defined, as it's only available on the client
    if (typeof window !== 'undefined') {
      setUrl(window.location.href);
    }
  }, [isOpen]); // Re-check URL if the dialog is re-opened, in case the page changed

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <QrCode className="h-5 w-5" />
          <span className="sr-only">View on Mobile</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>View on your Phone</DialogTitle>
          <DialogDescription>
            Scan this QR code with your phone's camera to open this app on your mobile device.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center p-4">
          {url ? (
            <div className="p-4 bg-white rounded-lg">
                <QRCode value={url} size={256} />
            </div>
          ) : (
            <p>Generating QR code...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
