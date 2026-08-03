import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import StudentsDirectoryClient, { StudentData } from '@/components/students-directory/client-page';

export const revalidate = 0;

export default async function ClgLeaderStudentsPage({ searchParams }: { searchParams: Promise<{ dateId?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'clgleader') redirect('/');

  // 1. Fetch dates
  const { data: dates } = await supabase.from('cleaning_dates').select('*').order('date', { ascending: false });
  const sp = await searchParams;
  const currentDateId = sp.dateId || (dates && dates.length > 0 ? dates[0].id : '');

  // 2. Fetch all students
  const { data: students } = await supabase.from('students').select('cicno, name, class').order('class').order('name');
  
  const classes = Array.from(new Set(students?.map(s => s.class) || []));

  // 3. Fetch all statuses (for aggregate and current date)
  const { data: allStatuses } = await supabase.from('student_statuses').select('student_cicno, date_id, status');
  
  // 4. Fetch all cleaning assignments (for aggregate)
  const { data: allAssignments } = await supabase.from('student_cleaning_assignments').select('student_cicno, is_cleaned');

  // Process data
  const studentData: StudentData[] = (students || []).map(student => {
    // Current date status
    const currentStatusRow = (allStatuses || []).find(s => s.student_cicno === student.cicno && s.date_id === currentDateId);
    const currentStatus = currentStatusRow ? currentStatusRow.status : 'present';

    // Aggregate statuses
    const studentAllStatuses = (allStatuses || []).filter(s => s.student_cicno === student.cicno);
    const present = studentAllStatuses.filter(s => s.status === 'present').length;
    const leave = studentAllStatuses.filter(s => s.status === 'leave').length;
    const medical = studentAllStatuses.filter(s => s.status === 'medical').length;

    // Aggregate assignments
    const studentAllAssignments = (allAssignments || []).filter(a => a.student_cicno === student.cicno);
    const cleanFinished = studentAllAssignments.filter(a => a.is_cleaned).length;
    const cleanNotFinished = studentAllAssignments.filter(a => !a.is_cleaned).length;

    return {
      cicno: student.cicno,
      name: student.name,
      class: student.class || 'Unknown',
      status: currentStatus,
      stats: {
        present,
        leave,
        medical,
        cleanFinished,
        cleanNotFinished
      }
    };
  });

  return (
    <StudentsDirectoryClient 
      dates={dates || []}
      currentDateId={currentDateId}
      students={studentData}
      classes={classes}
    />
  );
}
