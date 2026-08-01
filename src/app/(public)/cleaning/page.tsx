import { createClient } from '@/utils/supabase/server';
import ClientCleaningPage from './client-page';

export const revalidate = 60;

export default async function PublicCleaningPage() {
  const supabase = await createClient();

  // Get the latest date
  const { data: latestDate } = await supabase
    .from('cleaning_dates')
    .select('id, date')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  // Fetch all places
  const { data: placesData } = await supabase
    .from('cleaning_places')
    .select('*')
    .order('name');

  let processedPlaces: any[] = [];

  if (placesData && placesData.length > 0) {
    if (latestDate) {
      // Fetch assignments for this date
      const [classAssignmentsReq, studentAssignmentsReq] = await Promise.all([
        supabase.from('class_assignments').select('*').eq('date_id', latestDate.id),
        supabase.from('student_cleaning_assignments').select('*, students(name, cicno), student_statuses(status)').eq('date_id', latestDate.id)
      ]);

      // Actually student_statuses is linked by student_cicno and date_id. The inner join above might not work exactly as intended if constraints aren't set perfectly.
      // We will fetch students and statuses manually if needed to be safe, but let's try manual stitching for perfect reliability without strict FK definitions.
      
      const { data: studentStatuses } = await supabase.from('student_statuses').select('*').eq('date_id', latestDate.id);
      const { data: studentsInfo } = await supabase.from('students').select('cicno, name');

      const classAssignments = classAssignmentsReq.data || [];
      const studentAssignments = studentAssignmentsReq.data || [];
      const statuses = studentStatuses || [];
      const students = studentsInfo || [];

      processedPlaces = placesData.map(place => {
        const cAssign = classAssignments.find(ca => ca.place_id === place.id);
        const sAssigns = studentAssignments.filter(sa => sa.place_id === place.id);
        
        const assignedStudents = sAssigns.map(sa => {
          const student = students.find(s => s.cicno === sa.student_cicno);
          const status = statuses.find(st => st.student_cicno === sa.student_cicno)?.status || 'present';
          return {
            name: student?.name || 'Unknown',
            cicno: sa.student_cicno,
            status: status
          };
        });

        // Determine if place is cleaned (if any student marked it as cleaned, or all of them. Let's say if at least one is cleaned)
        const isCleaned = sAssigns.length > 0 && sAssigns.some(sa => sa.is_cleaned);

        return {
          id: place.id,
          name: place.name,
          block: place.block,
          count: place.count,
          classAssigned: cAssign ? cAssign.class_name : null,
          cleaned: isCleaned,
          students: assignedStudents
        };
      });
    } else {
      // No dates exist yet
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
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
          Cleaning Status
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl">
          Check today's cleaning assignments, search for students, and see the live status of all campus areas.
        </p>
      </div>

      <ClientCleaningPage places={processedPlaces} />
    </div>
  );
}
