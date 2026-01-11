
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This hook ensures that the component will re-render on the client
    // after the initial server render.
    setIsClient(true);
  }, []);

  useEffect(() => {
    // This effect now safely runs only on the client, after isClient is true.
    if (isOpen && isClient) {
      setUrl(window.location.href);
    }
  }, [isOpen, isClient]);

  // Don't render the component on the server or during the initial client render
  // before the isClient state is set.
  if (!isClient) {
    return null;
  }

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
