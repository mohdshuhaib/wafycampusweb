import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import CollegeLeaderAttendanceClient from './client-page';
import { getKeralaDateString } from '@/utils/kerala-time';

export const revalidate = 0;

export default async function CollegeLeaderAttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'clgleader') redirect('/');

  // 1. Fetch all students for full-college strength calculations and class rosters
  const { data: studentsData } = await supabase
    .from('students')
    .select('cicno, name, class, batch, number')
    .order('cicno', { ascending: true });

  const students = studentsData || [];

  // 2. Fetch Wafy calendar exceptions
  const { data: calendarExceptions } = await supabase
    .from('wafy_calendar')
    .select('month_name, day, status');

  const exceptionsMap = new Set<string>();
  (calendarExceptions || []).forEach(e => {
    if (e.status === 'leave' || e.status === 'wafy-leave') {
      exceptionsMap.add(`${e.month_name}_${e.day}`);
    }
  });

  // 3. Fetch all custom Day Attendance Schedules
  const { data: schedulesData } = await supabase
    .from('day_attendance_schedules')
    .select('*');

  const schedules = schedulesData || [];

  // 4. Fetch recent Day Attendance Records
  const { data: recordsData } = await supabase
    .from('day_attendance_records')
    .select('*')
    .order('created_at', { ascending: false });

  const dayRecords = recordsData || [];

  // 5. Fetch Day Attendance Unlocks
  const { data: unlocksData } = await supabase
    .from('day_attendance_class_unlocks')
    .select('*');

  const dayUnlocks = unlocksData || [];

  // 6. Fetch Special Attendances
  const { data: specialData } = await supabase
    .from('special_attendances')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  const specialAttendances = specialData || [];

  // 7. Fetch Special Attendance Class Statuses
  const { data: specialClassStatusData } = await supabase
    .from('special_attendance_class_status')
    .select('*');

  const specialClassStatuses = specialClassStatusData || [];

  // 8. Fetch Special Attendance Records
  const { data: specialRecordsData } = await supabase
    .from('special_attendance_records')
    .select('*');

  const specialRecords = specialRecordsData || [];

  return (
    <CollegeLeaderAttendanceClient
      students={students}
      schedules={schedules}
      dayRecords={dayRecords}
      dayUnlocks={dayUnlocks}
      specialAttendances={specialAttendances}
      specialClassStatuses={specialClassStatuses}
      specialRecords={specialRecords}
      calendarLeaveKeys={Array.from(exceptionsMap)}
    />
  );
}
