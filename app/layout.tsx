import type { Metadata } from 'next';
import Providers from './providers';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Yield Field — DeFi Aggregator for Monad',
  description:
    'Compare APY across all Monad DeFi protocols, calculate returns and invest in one click.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
