import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AssignPlacesClient from './client-page';

export const revalidate = 0;

export default async function AssignPlacesPage({ searchParams }: { searchParams: { dateId?: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'cleanleader') redirect('/');

  // 1. Fetch dates
  const { data: dates } = await supabase.from('cleaning_dates').select('*').order('date', { ascending: false });

  // Use the searchParam dateId, or default to the most recent date if available
  const currentDateId = searchParams.dateId || (dates && dates.length > 0 ? dates[0].id : '');

  // 2. Fetch places
  const { data: places } = await supabase.from('cleaning_places').select('id, name, block').order('name');

  // 3. Fetch current assignments for the selected date
  let assignments: any[] = [];
  if (currentDateId) {
    const { data: cAssignments } = await supabase
      .from('class_assignments')
      .select('*')
      .eq('date_id', currentDateId);
    assignments = cAssignments || [];
  }

  // 4. Fetch available classes (profiles with role classleader)
  const { data: classLeaders } = await supabase.from('profiles').select('designation').eq('role', 'classleader');
  const classes = Array.from(new Set(classLeaders?.map(c => c.designation) || []));

  return (
    <AssignPlacesClient
      dates={dates || []}
      currentDateId={currentDateId}
      places={places || []}
      assignments={assignments}
      classes={classes}
    />
  );
}
