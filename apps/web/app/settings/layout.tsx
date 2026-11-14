import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  if (!await session(accountCookieName)) redirect('/');
  return children;
}
