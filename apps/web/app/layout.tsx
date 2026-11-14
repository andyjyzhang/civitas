import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Civitas Relay — Context, connected.',
  description: 'A shared context network for independently owned AI agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
