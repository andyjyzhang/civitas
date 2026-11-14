import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import AgentsView from './agents-view';

export default async function Agents() {
  if (!await session(accountCookieName)) redirect('/');
  return <AgentsView/>;
}
