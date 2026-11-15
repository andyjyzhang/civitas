import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import InboxView from './inbox-view';

export default async function InboxPage() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="inbox" title="Inbox" scoped={false}><InboxView/></AppShell>;
}
