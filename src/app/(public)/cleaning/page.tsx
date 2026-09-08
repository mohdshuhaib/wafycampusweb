import { createClient } from '@/utils/supabase/server';
import ClientCleaningPage from './client-page';

export const revalidate = 0;

export default async function PublicCleaningPage({ searchParams }: { searchParams: Promise<{ dateId?: string }> }) {
  const supabase = await createClient();
  const sp = await searchParams;

  // 1. Fetch dates, places, and distinct student classes concurrently in parallel
  const [datesRes, placesRes, classesRes] = await Promise.all([
    supabase.from('cleaning_dates').select('id, date').order('date', { ascending: false }),
    supabase.from('cleaning_places').select('id, name, block, count').order('name'),
    supabase.from('students').select('class')
  ]);

  const dates = datesRes.data || [];
  const placesData = placesRes.data || [];
  const allClasses = Array.from(new Set(classesRes.data?.map(s => s.class).filter(Boolean) || [])).sort();

  const currentDateId = sp.dateId || (dates.length > 0 ? dates[0].id : null);
  const currentDate = dates.find(d => d.id === currentDateId);

  let processedPlaces: any[] = [];

  if (placesData.length > 0) {
    if (currentDate) {
      // 2. Fetch assignments & statuses for this date concurrently in parallel
      const [classAssignmentsRes, studentAssignmentsRes, studentStatusesRes] = await Promise.all([
        supabase.from('class_assignments').select('place_id, class_name').eq('date_id', currentDate.id),
        supabase.from('student_cleaning_assignments').select('place_id, student_cicno, is_cleaned, students(name, cicno)').eq('date_id', currentDate.id),
        supabase.from('student_statuses').select('student_cicno, status').eq('date_id', currentDate.id)
      ]);

      const classAssignments = classAssignmentsRes.data || [];
      const studentAssignments = studentAssignmentsRes.data || [];
      const statuses = studentStatusesRes.data || [];

      // O(1) lookup maps
      const classMap = new Map<string, string>();
      for (const ca of classAssignments) {
        classMap.set(ca.place_id, ca.class_name);
      }

      const statusMap = new Map<string, string>();
      for (const st of statuses) {
        statusMap.set(String(st.student_cicno), st.status);
      }

      const assignmentsByPlace = new Map<string, any[]>();
      for (const sa of studentAssignments) {
        const list = assignmentsByPlace.get(sa.place_id) || [];
        list.push(sa);
        assignmentsByPlace.set(sa.place_id, list);
      }

      processedPlaces = placesData.map(place => {
        const classAssigned = classMap.get(place.id) || null;
        const sAssigns = assignmentsByPlace.get(place.id) || [];

        const assignedStudents = sAssigns.map(sa => {
          const studentObj = Array.isArray(sa.students) ? sa.students[0] : sa.students;
          const studentName = studentObj?.name || 'Unknown';
          const cicnoStr = String(sa.student_cicno);
          const status = statusMap.get(cicnoStr) || 'present';

          return {
            name: studentName,
            cicno: cicnoStr,
            status: status
          };
        });

        const isCleaned = sAssigns.length > 0 && sAssigns.some(sa => sa.is_cleaned);

        return {
          id: place.id,
          name: place.name,
          block: place.block,
          count: place.count,
          classAssigned,
          cleaned: isCleaned,
          students: assignedStudents
        };
      });
    } else {
      processedPlaces = placesData.map(place => ({
        id: place.id,
        name: place.name,
        block: place.block,
        count: place.count,
        classAssigned: null,
        cleaned: false,
        students: []
      }));
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">
          Cleaning Status
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Check cleaning assignments, search for students, and see the live status of all campus areas.
        </p>
      </div>

      <ClientCleaningPage 
        places={processedPlaces} 
        dates={dates} 
        currentDateId={currentDateId || ''} 
        allClasses={allClasses}
      />
    </div>
  );
}
