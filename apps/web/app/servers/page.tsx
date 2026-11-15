import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import ServersView from './servers-view';

export default async function Servers() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="servers" title="Explore servers" scoped={false}><ServersView/></AppShell>;
}
