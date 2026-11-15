import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import Rooms from '../components/rooms';

export default async function Groups() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="chat" title="Chat"><Rooms kind="group"/></AppShell>;
}
