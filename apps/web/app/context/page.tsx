import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import ContextView from './context-view';

export default async function ContextPage() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="context" title="Context"><ContextView/></AppShell>;
}
