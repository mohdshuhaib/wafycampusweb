'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { getKeralaDateString, getKeralaTimeString, isWithinTimeWindow, isClassUnlockActive } from '@/utils/kerala-time';

export async function submitClassDayAttendance({
  date,
  records
}: {
  date: string;
  records: { cicno: string; status: 'present' | 'leave' | 'late' | 'medical' }[];
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized: Session expired.' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, designation')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'classleader' || !profile.designation) {
      return { success: false, error: 'Unauthorized: Only Class Leaders can submit class attendance.' };
    }

    const userClass = profile.designation.trim();

    // Verify time window or active 5-minute unlock
    const todayKerala = getKeralaDateString();
    const currentKeralaTime = getKeralaTimeString();

    if (date !== todayKerala) {
      // Check if unlocked specifically by College Leader
      const { data: unlockRow } = await supabase
        .from('day_attendance_class_unlocks')
        .select('unlocked_until')
        .eq('date', date)
        .eq('class', userClass)
        .single();

      if (!isClassUnlockActive(unlockRow?.unlocked_until)) {
        return { success: false, error: 'Submission window for this date is closed.' };
      }
    } else {
      // Check today's schedule
      const { data: scheduleRow } = await supabase
        .from('day_attendance_schedules')
        .select('start_time, end_time')
        .eq('date', date)
        .single();

      const startTime = scheduleRow ? scheduleRow.start_time : '07:00:00';
      const endTime = scheduleRow ? scheduleRow.end_time : '07:05:00';

      const windowCheck = isWithinTimeWindow(currentKeralaTime, startTime, endTime);

      if (!windowCheck.isOpen) {
        // Check active unlock
        const { data: unlockRow } = await supabase
          .from('day_attendance_class_unlocks')
          .select('unlocked_until')
          .eq('date', date)
          .eq('class', userClass)
          .single();

        if (!isClassUnlockActive(unlockRow?.unlocked_until)) {
          return { success: false, error: 'The attendance portal is locked. Please contact College Leader for a 5-minute unlock extension.' };
        }
      }
    }

    // Prepare records
    const nowIso = new Date().toISOString();
    const recordsToInsert = records.map(r => ({
      date,
      student_cicno: r.cicno,
      student_class: userClass,
      status: r.status,
      marked_by: user.id,
      updated_at: nowIso
    }));

    const { error: insErr } = await supabase
      .from('day_attendance_records')
      .upsert(recordsToInsert, { onConflict: 'date,student_cicno' });

    if (insErr) {
      return { success: false, error: insErr.message };
    }

    revalidatePath('/classleader/day-attendance');
    revalidatePath('/clgleader/attendance');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit attendance.' };
  }
}
