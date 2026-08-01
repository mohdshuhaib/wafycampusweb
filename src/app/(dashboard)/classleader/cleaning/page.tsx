import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ClassCleaningClient from './client-page';

export const revalidate = 0; // Don't cache dashboards tightly

export default async function ClassCleaningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'classleader') redirect('/');

  const userClass = profile.designation;

  // Get Latest Date
  const { data: latestDate } = await supabase
    .from('cleaning_dates')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (!latestDate) {
    return <ClassCleaningClient dateId="" dateStr="" userClass={userClass} students={[]} places={[]} assignments={[]} statuses={[]} />;
  }

  // Get students of this class
  const { data: students } = await supabase
    .from('students')
    .select('cicno, name')
    .eq('class', userClass)
    .order('name');

  // Get places assigned to this class for this date
  const { data: classAssignments } = await supabase
    .from('class_assignments')
    .select('place_id')
    .eq('date_id', latestDate.id)
    .eq('class_name', userClass);

  const placeIds = classAssignments?.map(ca => ca.place_id) || [];

  let places: any[] = [];
  if (placeIds.length > 0) {
    const { data: pData } = await supabase
      .from('cleaning_places')
      .select('id, name, count')
      .in('id', placeIds);
    places = pData || [];
  }

  // Get student statuses for this class and date
  const studentCicnos = students?.map(s => s.cicno) || [];
  let statuses: any[] = [];
  let assignments: any[] = [];

  if (studentCicnos.length > 0) {
    const [statusReq, assignReq] = await Promise.all([
      supabase.from('student_statuses').select('*').eq('date_id', latestDate.id).in('student_cicno', studentCicnos),
      supabase.from('student_cleaning_assignments').select('*').eq('date_id', latestDate.id).in('student_cicno', studentCicnos)
    ]);
    statuses = statusReq.data || [];
    assignments = assignReq.data || [];
  }

  return (
    <ClassCleaningClient 
      dateId={latestDate.id} 
      dateStr={new Date(latestDate.date).toLocaleDateString()}
      userClass={userClass}
      students={students || []}
      places={places}
      assignments={assignments}
      statuses={statuses}
    />
  );
}
