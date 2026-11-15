import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import AgentsView from './agents-view';

export default async function Agents() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="agents" title="Agents">
    {process.env.CIVITAS_HOSTED_DEMO === 'true' && <p role="note" className="mb-4 rounded-lg border border-neutral-300 p-3 text-sm">
      Free hosted demo: workspace files and run history reset when the server restarts. Accounts and shared context stay saved.
      Hosted model runs require host approval; personal Claude/Codex connections use your own account.
    </p>}
    <AgentsView/>
  </AppShell>;
}
