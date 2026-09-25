'use server';

import { createClient } from '@/utils/supabase/server';

export type CalendarStatus = 'period' | 'leave' | 'exam' | 'wafy-leave';

export type CalendarEntry = {
  academic_year?: string;
  semester: 'sem1' | 'sem2';
  month_name: string;
  month_index: number;
  day: number;
  status: CalendarStatus;
  note?: string;
};

const DEFAULT_ACADEMIC_YEAR = '2026-2027';

export async function getCalendarData() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'Unauthorized' };

    const { data, error } = await supabase
      .from('wafy_calendar')
      .select('*');

    if (error) {
      return { data: [], error: error.message };
    }

    const filtered = (data || []).filter(
      d => !(d.semester === 'sem1' && d.month_name === 'November')
    );

    return { data: filtered, error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch calendar' };
  }
}

export async function upsertCalendarDay(entry: CalendarEntry) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, designation')
      .eq('id', user.id)
      .single();

    const isEdu = profile?.role === 'eduleader' || profile?.designation?.toLowerCase().includes('academic') || profile?.role === 'clgleader';
    if (!profile || !isEdu) {
      return { success: false, error: 'Unauthorized role' };
    }

    const year = entry.academic_year || DEFAULT_ACADEMIC_YEAR;

    const { error } = await supabase
      .from('wafy_calendar')
      .upsert({
        academic_year: year,
        semester: entry.semester,
        month_name: entry.month_name,
        month_index: entry.month_index,
        day: entry.day,
        status: entry.status,
        note: entry.note || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'academic_year,semester,month_name,day'
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update calendar day' };
  }
}

export async function batchUpsertCalendarDays(entries: CalendarEntry[]) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, designation')
      .eq('id', user.id)
      .single();

    const isEdu = profile?.role === 'eduleader' || profile?.designation?.toLowerCase().includes('academic') || profile?.role === 'clgleader';
    if (!profile || !isEdu) {
      return { success: false, error: 'Unauthorized role' };
    }

    const records = entries.map(e => ({
      academic_year: e.academic_year || DEFAULT_ACADEMIC_YEAR,
      semester: e.semester,
      month_name: e.month_name,
      month_index: e.month_index,
      day: e.day,
      status: e.status,
      note: e.note || null,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('wafy_calendar')
      .upsert(records, {
        onConflict: 'academic_year,semester,month_name,day'
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to batch update calendar' };
  }
}

export async function deleteCalendarDay(semester: string, monthName: string, day: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { error } = await supabase
      .from('wafy_calendar')
      .delete()
      .match({
        semester,
        month_name: monthName,
        day
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to remove calendar day' };
  }
}

export async function resetCalendarSemester(semester?: 'sem1' | 'sem2') {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, designation')
      .eq('id', user.id)
      .single();

    const isEdu = profile?.role === 'eduleader' || profile?.designation?.toLowerCase().includes('academic') || profile?.role === 'clgleader';
    if (!profile || !isEdu) {
      return { success: false, error: 'Unauthorized role' };
    }

    let query = supabase.from('wafy_calendar').delete();
    if (semester) {
      query = query.eq('semester', semester);
    } else {
      // Clear all calendar entries
      query = query.gte('day', 1);
    }

    const { error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reset calendar' };
  }
}
