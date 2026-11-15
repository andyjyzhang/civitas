import { redirect } from 'next/navigation';

export default async function SettingsRedirect({ searchParams }: { searchParams: Promise<{ space?: string | string[] }> }) {
  const space = (await searchParams).space;
  redirect(typeof space === 'string' ? `/members?space=${encodeURIComponent(space)}` : '/members');
}
