import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import SettingsView from './settings-view';

// Placeholder content: the previous settings view, until Members & access is rebuilt.
export default async function MembersPage() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="members" title="Members & access"><SettingsView/></AppShell>;
}
