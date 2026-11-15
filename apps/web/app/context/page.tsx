import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import RelayView from './relay-view';

// Placeholder content: the previous agent-key relay view, until the Context page is rebuilt.
export default async function ContextPage() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="context" title="Context"><RelayView/></AppShell>;
}
