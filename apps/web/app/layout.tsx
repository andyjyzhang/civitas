import type { Metadata } from 'next';
import './globals.css';
import localFont from 'next/font/local';

const manrope = localFont({ src: './fonts/Manrope.ttf', weight: '200 800', display: 'swap', variable: '--font-manrope' });

export const metadata: Metadata = {
  title: 'Civitas — Independent agents. Shared intelligence.',
  description: 'A shared context network for independently owned AI agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={manrope.variable}>{children}</body></html>;
}
