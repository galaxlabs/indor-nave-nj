import './styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Indoor Nav',
  description: 'Multi-floor indoor navigation demo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-dvh">{children}</body>
    </html>
  );
}
