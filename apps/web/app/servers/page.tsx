import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import Rooms from '../components/rooms';
export default async function Servers() {
  if (!await session(accountCookieName)) redirect('/');
  return <Rooms kind="server"/>;
}
