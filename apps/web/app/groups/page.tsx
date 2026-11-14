import { redirect } from 'next/navigation';
import { accountCookieName, session } from '../../lib/relay';
import Rooms from '../components/rooms';
export default async function Groups() {
  if (!await session(accountCookieName)) redirect('/');
  return <Rooms kind="group"/>;
}
