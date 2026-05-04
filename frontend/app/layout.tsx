import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryProvider } from '../components/providers/query-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'BTN — OCR KPR Submission',
  description: 'Bank BTN — modern OCR KPR case-based submission workflow.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
