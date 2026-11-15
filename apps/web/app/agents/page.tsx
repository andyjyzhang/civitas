import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import AgentsView from './agents-view';

export default async function Agents() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="agents" title="Agents"><AgentsView/></AppShell>;
}
