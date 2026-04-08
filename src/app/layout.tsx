import type { Metadata } from 'next';
import { DM_Sans, Sarabun } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const sarabun = Sarabun({
  variable: '--font-sarabun',
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Smart Clinic',
  description: 'Smart Clinic — Business Intelligence & Management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${dmSans.variable} ${sarabun.variable} h-full antialiased`}>
      <body className="h-full font-body">{children}</body>
    </html>
  );
}
