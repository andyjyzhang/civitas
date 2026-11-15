import { redirect } from 'next/navigation';

export default async function RelayRedirect({ searchParams }: { searchParams: Promise<{ space?: string | string[] }> }) {
  const space = (await searchParams).space;
  redirect(typeof space === 'string' ? `/context?space=${encodeURIComponent(space)}` : '/context');
}
