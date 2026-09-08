import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import CleanLeaderAssignStudentsClient from './client-page';

export const revalidate = 0;

export default async function CleanLeaderAssignStudentsPage({
  searchParams
}: {
  searchParams: Promise<{ dateId?: string }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'cleanleader') redirect('/');

  // 1. Fetch dates, places, students, and class leaders concurrently
  const [datesRes, placesRes, studentsRes, classLeadersRes] = await Promise.all([
    supabase.from('cleaning_dates').select('id, date').order('date', { ascending: false }),
    supabase.from('cleaning_places').select('id, name, block, count, floor').order('name'),
    supabase.from('students').select('cicno, name, class, is_exceptional').order('name'),
    supabase.from('profiles').select('designation').eq('role', 'classleader')
  ]);

  const dates = datesRes.data || [];
  const places = placesRes.data || [];
  const students = studentsRes.data || [];
  
  // Combine classes from profiles and students
  const classLeaderClasses = classLeadersRes.data?.map(c => c.designation).filter(Boolean) || [];
  const studentClasses = students.map(s => s.class).filter(Boolean);
  const classes = Array.from(new Set([...classLeaderClasses, ...studentClasses])).sort();

  const sp = await searchParams;
  const currentDateId = sp.dateId || (dates.length > 0 ? dates[0].id : '');

  let classAssignments: any[] = [];
  let studentAssignments: any[] = [];
  let studentStatuses: any[] = [];

  if (currentDateId) {
    const [cAssignRes, sAssignRes, sStatusRes] = await Promise.all([
      supabase.from('class_assignments').select('place_id, class_name').eq('date_id', currentDateId),
      supabase.from('student_cleaning_assignments').select('id, place_id, student_cicno, is_cleaned').eq('date_id', currentDateId),
      supabase.from('student_statuses').select('student_cicno, status').eq('date_id', currentDateId)
    ]);
    classAssignments = cAssignRes.data || [];
    studentAssignments = sAssignRes.data || [];
    studentStatuses = sStatusRes.data || [];
  }

  return (
    <CleanLeaderAssignStudentsClient
      dates={dates}
      currentDateId={currentDateId}
      classes={classes}
      places={places}
      students={students}
      classAssignments={classAssignments}
      studentAssignments={studentAssignments}
      studentStatuses={studentStatuses}
    />
  );
}
