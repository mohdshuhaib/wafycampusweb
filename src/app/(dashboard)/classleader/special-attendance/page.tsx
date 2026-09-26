import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ClassLeaderSpecialAttendanceClient from './client-page';

export const revalidate = 0;

export default async function ClassLeaderSpecialAttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, designation')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'classleader' || !profile.designation) {
    redirect('/');
  }

  const userClass = profile.designation.trim();

  // 1. Fetch class students ordered by CIC ascending
  const { data: studentsData } = await supabase
    .from('students')
    .select('cicno, name, class, batch, number')
    .eq('class', userClass)
    .order('cicno', { ascending: true });

  const students = studentsData || [];

  // 2. Fetch special attendances where target_classes contains userClass
  const { data: specialData } = await supabase
    .from('special_attendances')
    .select('*')
    .contains('target_classes', [userClass])
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  const specialAttendances = specialData || [];

  // 3. Fetch status for user's class across these attendances
  const { data: statusData } = await supabase
    .from('special_attendance_class_status')
    .select('*')
    .eq('class', userClass);

  const classStatuses = statusData || [];

  // 4. Fetch records for user's class
  const { data: recordsData } = await supabase
    .from('special_attendance_records')
    .select('*')
    .eq('student_class', userClass);

  const classRecords = recordsData || [];

  return (
    <ClassLeaderSpecialAttendanceClient
      userClass={userClass}
      students={students}
      specialAttendances={specialAttendances}
      initialStatuses={classStatuses}
      initialRecords={classRecords}
    />
  );
}
