import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AssignPlacesClient from './client-page';

export const revalidate = 0;

export default async function AssignPlacesPage({ searchParams }: { searchParams: Promise<{ dateId?: string }> }) {
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

  const sp = await searchParams;
  // Use the searchParam dateId, or default to the most recent date if available
  const currentDateId = sp.dateId || (dates && dates.length > 0 ? dates[0].id : '');

  // 2. Fetch places
  const { data: places } = await supabase.from('cleaning_places').select('id, name, block, count, floor').order('name');

  // 3. Fetch current assignments for the selected date
  let assignments: any[] = [];
  if (currentDateId) {
    const { data: cAssignments } = await supabase
      .from('class_assignments')
      .select('*')
      .eq('date_id', currentDateId);
    assignments = cAssignments || [];
  }

  // 4. Fetch available classes & student counts
  const [classLeadersRes, studentsRes] = await Promise.all([
    supabase.from('profiles').select('designation').eq('role', 'classleader'),
    supabase.from('students').select('class, is_exceptional')
  ]);

  const students = studentsRes.data || [];
  const classLeaderClasses = classLeadersRes.data?.map(c => c.designation).filter(Boolean) || [];
  const studentClasses = students.map(s => s.class).filter(Boolean);
  const classes = Array.from(new Set([...classLeaderClasses, ...studentClasses])).sort();

  const classStudentCounts: Record<string, number> = {};
  students.forEach(s => {
    if (s.class && !s.is_exceptional) {
      classStudentCounts[s.class] = (classStudentCounts[s.class] || 0) + 1;
    }
  });

  // 5. Fetch assigned students count for the selected date
  const studentAssignmentsCounts: Record<string, number> = {};
  if (currentDateId) {
    const { data: studentAssignments } = await supabase
      .from('student_cleaning_assignments')
      .select('place_id')
      .eq('date_id', currentDateId);
      
    if (studentAssignments) {
      studentAssignments.forEach(sa => {
        if (sa.place_id) {
          studentAssignmentsCounts[sa.place_id] = (studentAssignmentsCounts[sa.place_id] || 0) + 1;
        }
      });
    }
  }

  return (
    <AssignPlacesClient
      dates={dates || []}
      currentDateId={currentDateId}
      places={places || []}
      assignments={assignments}
      classes={classes}
      classStudentCounts={classStudentCounts}
      studentAssignmentsCounts={studentAssignmentsCounts}
    />
  );
}
