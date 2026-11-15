import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import ActivityView from './activity-view';

export default async function ActivityPage() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="activity" title="Activity"><ActivityView/></AppShell>;
}
