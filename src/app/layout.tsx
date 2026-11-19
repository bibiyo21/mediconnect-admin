import type { Metadata } from 'next';
import { SessionProvider } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'MediConnect Console', template: '%s · MediConnect Console' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#content" className="sr-only">Skip to content</a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
