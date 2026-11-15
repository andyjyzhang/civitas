import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import GroupChat from './group-chat';

export default async function Groups() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="chat" title="Chat"><GroupChat/></AppShell>;
}
