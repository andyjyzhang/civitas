import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import MembersView from './members-view';

export default async function MembersPage() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="members" title="Members & access"><MembersView/></AppShell>;
}
