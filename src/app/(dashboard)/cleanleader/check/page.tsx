import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import CheckClient from './client-page';

export const revalidate = 0;

export default async function CheckPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'cleanleader') redirect('/');

  // 1. Get Latest Date
  const { data: latestDate } = await supabase.from('cleaning_dates').select('*').order('date', { ascending: false }).limit(1).single();

  let placesData: any[] = [];
  
  if (latestDate) {
    // 2. Get assignments mapped to places
    const { data: assignments } = await supabase
      .from('student_cleaning_assignments')
      .select('id, place_id, is_cleaned, student_cicno, students(name, class)')
      .eq('date_id', latestDate.id);

    const placeIds = Array.from(new Set(assignments?.map(a => a.place_id) || []));
    
    if (placeIds.length > 0) {
      const { data: places } = await supabase.from('cleaning_places').select('id, name, block, floor').in('id', placeIds);
      
      if (places && assignments) {
        placesData = places.map(p => {
          const pAssigns = assignments.filter(a => a.place_id === p.id);
          const isCleaned = pAssigns.length > 0 && pAssigns.some(a => a.is_cleaned);
          
          return {
            id: p.id,
            name: p.name,
            block: p.block,
            floor: p.floor,
            assignments: pAssigns,
            cleaned: isCleaned
          };
        });
      }
    }
  }

  return (
    <CheckClient 
      placesData={placesData} 
      dateId={latestDate?.id || ''} 
      dateStr={latestDate ? new Date(latestDate.date).toLocaleDateString() : ''} 
    />
  );
}
