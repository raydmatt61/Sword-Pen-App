
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'The Sword and Pen',
  description: 'A modern Bible study tool for notes and insights.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&family=Literata:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-headline antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
