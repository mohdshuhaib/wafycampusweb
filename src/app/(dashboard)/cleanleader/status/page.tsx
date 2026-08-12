import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import StatusClient from './client-page';

export const revalidate = 0;

export default async function StatusPage({ searchParams }: { searchParams: Promise<{ dateId?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'cleanleader') redirect('/');

  // 1. Get Dates
  const { data: dates } = await supabase.from('cleaning_dates').select('*').order('date', { ascending: false });

  const sp = await searchParams;
  const currentDateId = sp.dateId || (dates && dates.length > 0 ? dates[0].id : '');

  const currentDate = dates?.find(d => d.id === currentDateId);

  let placesData: any[] = [];
  
  if (currentDateId) {
    // 2. Get places and their student assignments for the specific date
    const { data: places } = await supabase.from('cleaning_places').select('id, name, block');
    const { data: assignments } = await supabase.from('student_cleaning_assignments').select('*').eq('date_id', currentDateId);
    const { data: classAssignments } = await supabase.from('class_assignments').select('place_id, class_name').eq('date_id', currentDateId);
    
    if (places) {
      placesData = places.map(p => {
        const pAssigns = (assignments || []).filter(a => a.place_id === p.id);
        const cAssign = (classAssignments || []).find(ca => ca.place_id === p.id);
        const assignedStudentsCount = pAssigns.length;
        const isCleaned = pAssigns.length > 0 && pAssigns.some(a => a.is_cleaned);
        
        return {
          id: p.id,
          name: p.name,
          block: p.block,
          assignedCount: assignedStudentsCount,
          cleaned: isCleaned,
          classAssigned: cAssign?.class_name || null
        };
      });
    }
  }

  const { data: studentsInfo } = await supabase.from('students').select('class');
  const allClasses = studentsInfo ? Array.from(new Set(studentsInfo.map(s => s.class).filter(Boolean))).sort() : [];

  return (
    <StatusClient 
      dates={dates || []} 
      currentDate={currentDate || null} 
      placesData={placesData} 
      allClasses={allClasses}
    />
  );
}
