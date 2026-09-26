import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ClassLeaderDayAttendanceClient from './client-page';
import { getKeralaDateString } from '@/utils/kerala-time';

export const revalidate = 0;

export default async function ClassLeaderDayAttendancePage() {
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
  const todayDate = getKeralaDateString();

  // 1. Fetch class students ordered by CIC number ascending
  const { data: studentsData } = await supabase
    .from('students')
    .select('cicno, name, class, batch, number')
    .eq('class', userClass)
    .order('cicno', { ascending: true });

  const students = studentsData || [];

  // 2. Fetch today's schedule
  const { data: scheduleData } = await supabase
    .from('day_attendance_schedules')
    .select('*')
    .eq('date', todayDate)
    .maybeSingle();

  // 3. Fetch active unlock for this class
  const { data: unlockData } = await supabase
    .from('day_attendance_class_unlocks')
    .select('*')
    .eq('date', todayDate)
    .eq('class', userClass)
    .maybeSingle();

  // 4. Fetch existing records for today
  const { data: existingRecordsData } = await supabase
    .from('day_attendance_records')
    .select('*')
    .eq('date', todayDate)
    .eq('student_class', userClass);

  const existingRecords = existingRecordsData || [];

  return (
    <ClassLeaderDayAttendanceClient
      userClass={userClass}
      todayDate={todayDate}
      students={students}
      initialSchedule={scheduleData || null}
      initialUnlock={unlockData || null}
      initialRecords={existingRecords}
    />
  );
}
