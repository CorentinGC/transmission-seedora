import type { Metadata, Viewport } from 'next';
import './globals.css';

/**
 * Vercel function limit for this route segment. Server actions run inside the
 * route that invoked them (the single page `/`), so this is what lets the 30 s
 * RPC deadline complete. It lives here because `page.tsx` is a client component
 * and cannot export route segment config. Ignored by `next start`.
 */
export const maxDuration = 60;

export const metadata: Metadata = {
  title: 'Seedora',
  description: 'Remote GUI for Transmission BitTorrent daemon',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Seedora',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
