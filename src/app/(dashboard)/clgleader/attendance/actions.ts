'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// Verify College Leader
async function verifyClgLeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false, user: null, supabase };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'clgleader') {
    return { authorized: false, user: null, supabase };
  }

  return { authorized: true, user, supabase };
}

/**
 * Save / edit start and end time for a day's attendance
 */
export async function saveDaySchedule({
  date,
  startTime,
  endTime
}: {
  date: string;
  startTime: string;
  endTime: string;
}) {
  try {
    const { authorized, supabase } = await verifyClgLeader();
    if (!authorized) return { success: false, error: 'Unauthorized: Only College Leader can edit schedules' };

    const { error } = await supabase
      .from('day_attendance_schedules')
      .upsert({
        date,
        start_time: startTime,
        end_time: endTime,
        updated_at: new Date().toISOString()
      }, { onConflict: 'date' });

    if (error) return { success: false, error: error.message };

    revalidatePath('/clgleader/attendance');
    revalidatePath('/classleader/day-attendance');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update schedule' };
  }
}

/**
 * Unlock a specific class for 5 minutes
 */
export async function unlockClassForFiveMinutes({
  date,
  className
}: {
  date: string;
  className: string;
}) {
  try {
    const { authorized, user, supabase } = await verifyClgLeader();
    if (!authorized) return { success: false, error: 'Unauthorized' };

    // 5 minutes from current UTC timestamp
    const unlockedUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('day_attendance_class_unlocks')
      .upsert({
        date,
        class: className,
        unlocked_until: unlockedUntil,
        unlocked_by: user!.id,
        created_at: new Date().toISOString()
      }, { onConflict: 'date,class' });

    if (error) return { success: false, error: error.message };

    revalidatePath('/clgleader/attendance');
    revalidatePath('/classleader/day-attendance');
    return { success: true, unlockedUntil };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to unlock class' };
  }
}

/**
 * Create a new Special Attendance session
 */
export async function createSpecialAttendance({
  name,
  subtitle,
  date,
  targetClasses
}: {
  name: string;
  subtitle?: string | null;
  date: string;
  targetClasses: string[];
}) {
  try {
    const { authorized, user, supabase } = await verifyClgLeader();
    if (!authorized) return { success: false, error: 'Unauthorized' };

    if (!name.trim()) return { success: false, error: 'Attendance Name is required' };
    if (!date) return { success: false, error: 'Date is required' };
    if (!targetClasses || targetClasses.length === 0) {
      return { success: false, error: 'At least one class must be selected' };
    }

    const { data, error } = await supabase
      .from('special_attendances')
      .insert({
        name: name.trim(),
        subtitle: subtitle ? subtitle.trim() : null,
        date,
        target_classes: targetClasses,
        created_by: user!.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/clgleader/attendance');
    revalidatePath('/classleader/special-attendance');
    return { success: true, attendance: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create special attendance' };
  }
}

/**
 * Save special attendance records for a specific class (College Leader action)
 */
export async function saveSpecialAttendanceForClass({
  specialAttendanceId,
  className,
  records
}: {
  specialAttendanceId: string;
  className: string;
  records: { cicno: string; status: 'present' | 'not attend' | 'leave' | 'medical' }[];
}) {
  try {
    const { authorized, user, supabase } = await verifyClgLeader();
    if (!authorized) return { success: false, error: 'Unauthorized' };

    // 1. Batch upsert records
    if (records.length > 0) {
      const recordsToUpsert = records.map(r => ({
        special_attendance_id: specialAttendanceId,
        student_cicno: r.cicno,
        student_class: className,
        status: r.status,
        updated_at: new Date().toISOString()
      }));

      const { error: rErr } = await supabase
        .from('special_attendance_records')
        .upsert(recordsToUpsert, { onConflict: 'special_attendance_id,student_cicno' });

      if (rErr) return { success: false, error: rErr.message };
    }

    // 2. Update status marker to clgleader
    const nowIso = new Date().toISOString();
    const { error: sErr } = await supabase
      .from('special_attendance_class_status')
      .upsert({
        special_attendance_id: specialAttendanceId,
        class: className,
        saved_by_role: 'clgleader',
        saved_by_user: user!.id,
        saved_at: nowIso
      }, { onConflict: 'special_attendance_id,class' });

    if (sErr) return { success: false, error: sErr.message };

    revalidatePath('/clgleader/attendance');
    revalidatePath('/classleader/special-attendance');
    return { success: true, savedAt: nowIso };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save special attendance' };
  }
}

/**
 * Fetch all Day Attendance records for a given date
 */
export async function getDayAttendanceForDate(date: string) {
  try {
    const supabase = await createClient();
    const { data: records, error } = await supabase
      .from('day_attendance_records')
      .select('student_cicno, student_class, status, marked_by, updated_at')
      .eq('date', date);

    if (error) return { records: [], unlocks: [], error: error.message };

    const { data: unlocks } = await supabase
      .from('day_attendance_class_unlocks')
      .select('class, unlocked_until')
      .eq('date', date);

    return { records: records || [], unlocks: unlocks || [], error: null };
  } catch (err: any) {
    return { records: [], unlocks: [], error: err.message };
  }
}

/**
 * Fetch all Special Attendance records & status for a given special attendance session
 */
export async function getSpecialAttendanceDetails(specialAttendanceId: string) {
  try {
    const supabase = await createClient();
    const { data: records, error } = await supabase
      .from('special_attendance_records')
      .select('student_cicno, student_class, status, updated_at')
      .eq('special_attendance_id', specialAttendanceId);

    if (error) return { records: [], classStatuses: [], error: error.message };

    const { data: classStatuses } = await supabase
      .from('special_attendance_class_status')
      .select('class, saved_by_role, saved_at')
      .eq('special_attendance_id', specialAttendanceId);

    return { records: records || [], classStatuses: classStatuses || [], error: null };
  } catch (err: any) {
    return { records: [], classStatuses: [], error: err.message };
  }
}
