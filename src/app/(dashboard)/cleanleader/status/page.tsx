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
  let unassignedStudents: { cicno: string; name: string; class: string; status: string; is_exceptional: boolean }[] = [];
  
  if (currentDateId) {
    // 2. Get places, assignments, students, and statuses concurrently
    const [placesRes, assignmentsRes, classAssignmentsRes, studentsRes, statusesRes] = await Promise.all([
      supabase.from('cleaning_places').select('id, name, block'),
      supabase.from('student_cleaning_assignments').select('*').eq('date_id', currentDateId),
      supabase.from('class_assignments').select('place_id, class_name').eq('date_id', currentDateId),
      supabase.from('students').select('cicno, name, class, is_exceptional').order('name'),
      supabase.from('student_statuses').select('student_cicno, status').eq('date_id', currentDateId)
    ]);

    const places = placesRes.data || [];
    const assignments = assignmentsRes.data || [];
    const classAssignments = classAssignmentsRes.data || [];
    const students = studentsRes.data || [];
    const studentStatuses = statusesRes.data || [];
    
    if (places.length > 0) {
      placesData = places.map(p => {
        const pAssigns = assignments.filter(a => a.place_id === p.id);
        const cAssign = classAssignments.find(ca => ca.place_id === p.id);
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

    const assignedCicnos = new Set(assignments.map(a => a.student_cicno));
    unassignedStudents = students
      .filter(s => !assignedCicnos.has(s.cicno))
      .map(s => {
        const statusObj = studentStatuses.find(ss => ss.student_cicno === s.cicno);
        return {
          cicno: s.cicno,
          name: s.name,
          class: s.class || 'Unassigned',
          status: statusObj?.status || 'present',
          is_exceptional: !!s.is_exceptional
        };
      });
  }

  const [classLeadersRes, allStudentsRes] = await Promise.all([
    supabase.from('profiles').select('designation').eq('role', 'classleader'),
    supabase.from('students').select('class')
  ]);
  const classLeaderClasses = classLeadersRes.data?.map(c => c.designation).filter(Boolean) || [];
  const studentClasses = allStudentsRes.data?.map(s => s.class).filter(Boolean) || [];
  const allClasses = Array.from(new Set([...classLeaderClasses, ...studentClasses])).sort();

  return (
    <StatusClient 
      dates={dates || []} 
      currentDate={currentDate || null} 
      placesData={placesData} 
      unassignedStudents={unassignedStudents}
      allClasses={allClasses}
    />
  );
}
