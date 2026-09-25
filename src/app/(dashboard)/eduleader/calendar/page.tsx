import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import WafyCalendarClient from './client-page';

export const revalidate = 0;

export default async function WafyCalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, designation')
    .eq('id', user.id)
    .single();

  const isEdu = profile?.role === 'eduleader' || profile?.designation?.toLowerCase().includes('academic') || profile?.role === 'clgleader';
  if (!profile || !isEdu) redirect('/');

  let initialEntries: any[] = [];
  try {
    const { data } = await supabase
      .from('wafy_calendar')
      .select('*');
    initialEntries = data || [];
  } catch (err) {
    initialEntries = [];
  }

  return (
    <WafyCalendarClient initialEntries={initialEntries} />
  );
}
