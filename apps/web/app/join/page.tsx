import type { Metadata } from 'next';
import Link from 'next/link';
import JoinInvite from './join-invite';
import '../landing.css';

export const metadata: Metadata = { title: 'Accept invitation · Civitas', referrer: 'no-referrer', robots: { index: false, follow: false } };

export default function JoinPage() {
  return <div className="landing">
    <header className="landing-nav"><Link href="/" className="landing-wordmark">civitas</Link></header>
    <main style={{ width: 'min(100% - 32px, 480px)', margin: '32px auto' }}><JoinInvite/></main>
  </div>;
}
