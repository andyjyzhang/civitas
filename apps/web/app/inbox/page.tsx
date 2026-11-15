import { redirect } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { accountCookieName, session } from '../../lib/relay';
import AppShell from '../components/app-shell';
import { EmptyState, Page, PageHeader } from '../components/ui';

export default async function InboxPage() {
  if (!await session(accountCookieName)) redirect('/');
  return <AppShell active="inbox" title="Inbox">
    <Page>
      <PageHeader title="Inbox" description="Approvals and agent updates waiting for you."/>
      <EmptyState icon={<Inbox/>} title="Coming in this round" description="Agent requests that need your decision will collect here."/>
    </Page>
  </AppShell>;
}
