import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BTN KPR Frontend Shell',
  description: 'Minimal Next.js handoff shell for the BTN KPR house assessment demo.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
