import { redirect } from 'next/navigation';

// Chat and the context feed now live in Activity.
export default async function Redirect({ searchParams }: { searchParams: Promise<{ space?: string | string[] }> }) {
  const space = (await searchParams).space;
  redirect(typeof space === 'string' ? `/activity?space=${encodeURIComponent(space)}` : '/activity');
}
