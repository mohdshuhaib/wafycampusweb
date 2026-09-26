'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function submitClassSpecialAttendance({
  specialAttendanceId,
  records
}: {
  specialAttendanceId: string;
  records: { cicno: string; status: 'present' | 'not attend' | 'leave' | 'medical' }[];
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
      return { success: false, error: 'Unauthorized: Only Class Leaders can submit attendance.' };
    }

    const userClass = profile.designation.trim();

    // Check if College Leader has already saved and locked this class
    const { data: statusRow } = await supabase
      .from('special_attendance_class_status')
      .select('saved_by_role, saved_at')
      .eq('special_attendance_id', specialAttendanceId)
      .eq('class', userClass)
      .maybeSingle();

    if (statusRow?.saved_by_role === 'clgleader') {
      return {
        success: false,
        error: 'This session has been verified and locked by College Leader. Class leaders cannot modify it.'
      };
    }

    // 1. Batch upsert student records
    const nowIso = new Date().toISOString();
    const recordsToInsert = records.map(r => ({
      special_attendance_id: specialAttendanceId,
      student_cicno: r.cicno,
      student_class: userClass,
      status: r.status,
      updated_at: nowIso
    }));

    const { error: insErr } = await supabase
      .from('special_attendance_records')
      .upsert(recordsToInsert, { onConflict: 'special_attendance_id,student_cicno' });

    if (insErr) {
      return { success: false, error: insErr.message };
    }

    // 2. Update status marker to classleader
    const { error: statErr } = await supabase
      .from('special_attendance_class_status')
      .upsert({
        special_attendance_id: specialAttendanceId,
        class: userClass,
        saved_by_role: 'classleader',
        saved_by_user: user.id,
        saved_at: nowIso
      }, { onConflict: 'special_attendance_id,class' });

    if (statErr) {
      return { success: false, error: statErr.message };
    }

    revalidatePath('/classleader/special-attendance');
    revalidatePath('/clgleader/attendance');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit special attendance.' };
  }
}
