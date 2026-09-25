'use server';

import { createClient } from '@/utils/supabase/server';

export type ReportData = {
  dateStr: string;
  stats: {
    totalPlaces: number;
    assignedPlacesCount: number;
    leaveCount: number;
    medicalCount: number;
    studentsCleaned: number;
    studentsPending: number;
    unassignedPlaces: string[];
  };
  assignedPlaces: {
    id: string;
    placeName: string;
    placeBlock: string;
    className: string;
    isCleaned: boolean;
    assignedCount: number;
    cleanedCount: number;
    isFullCleaned: boolean;
    isPartiallyCleaned: boolean;
    students: { cicno: string; name: string; is_cleaned: boolean }[];
  }[];
  unassignedStudentsByClass: {
    className: string;
    students: {
      cicno: string;
      name: string;
      status: string;
      is_exceptional: boolean;
    }[];
  }[];
};

export async function getPdfReportData(dateId: string): Promise<{ data: ReportData | null, error: string | null }> {
  try {
    const supabase = await createClient();
    
    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Unauthorized' };
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'cleanleader') return { data: null, error: 'Unauthorized' };

    // Fetch Date
    const { data: dateRec } = await supabase.from('cleaning_dates').select('*').eq('id', dateId).single();
    if (!dateRec) return { data: null, error: 'Date not found.' };

    // 1. Fetch places
    const { data: places } = await supabase.from('cleaning_places').select('*');

    // 2. Fetch assignments
    const { data: studentAssignments } = await supabase.from('student_cleaning_assignments').select('*').eq('date_id', dateId);
    const { data: classAssignments } = await supabase.from('class_assignments').select('*').eq('date_id', dateId);

    // 3. Fetch student statuses for this date
    const { data: studentStatuses } = await supabase.from('student_statuses').select('*').eq('date_id', dateId);

    // 4. Fetch students
    const { data: students } = await supabase.from('students').select('cicno, name, class, is_exceptional');

    // Map students for quick lookup
    const studentMap: Record<string, { name: string, class: string }> = {};
    if (students) {
      students.forEach(s => {
        studentMap[s.cicno] = { name: s.name, class: s.class };
      });
    }

    // Aggregate Data
    const totalPlaces = places?.length || 0;
    const assignedPlacesList = classAssignments?.map(ca => ca.place_id) || [];
    const assignedPlacesCount = new Set(assignedPlacesList).size;

    let leaveCount = 0;
    let medicalCount = 0;
    
    if (studentStatuses) {
      studentStatuses.forEach(ss => {
        if (ss.status === 'leave') leaveCount++;
        if (ss.status === 'medical') medicalCount++;
      });
    }

    let studentsCleaned = 0;
    let studentsPending = 0;

    if (studentAssignments) {
      studentAssignments.forEach(sa => {
        if (sa.is_cleaned) studentsCleaned++;
        else studentsPending++;
      });
    }

    const unassignedPlaces = (places || [])
      .filter(p => !assignedPlacesList.includes(p.id))
      .map(p => p.name);

    // Build unassigned students class-wise
    const assignedCicnoSet = new Set((studentAssignments || []).map(sa => sa.student_cicno));
    const unassignedByClassMap: Record<string, { cicno: string; name: string; status: string; is_exceptional: boolean }[]> = {};

    (students || []).forEach(s => {
      if (!assignedCicnoSet.has(s.cicno)) {
        const statusRec = studentStatuses?.find(ss => ss.student_cicno === s.cicno);
        const cls = s.class || 'Unassigned';
        if (!unassignedByClassMap[cls]) {
          unassignedByClassMap[cls] = [];
        }
        unassignedByClassMap[cls].push({
          cicno: s.cicno,
          name: s.name,
          status: statusRec?.status || 'present',
          is_exceptional: !!s.is_exceptional,
        });
      }
    });

    const unassignedStudentsByClass = Object.keys(unassignedByClassMap)
      .sort()
      .map(cls => ({
        className: cls,
        students: unassignedByClassMap[cls].sort((a, b) => a.name.localeCompare(b.name)),
      }));

    // Build full assigned places data
    const assignedPlacesData = (classAssignments || []).map(ca => {
      const place = places?.find(p => p.id === ca.place_id);
      
      const assignedStudents = (studentAssignments || [])
        .filter(sa => sa.place_id === ca.place_id)
        .map(sa => ({
          cicno: sa.student_cicno,
          name: studentMap[sa.student_cicno]?.name || 'Unknown',
          is_cleaned: sa.is_cleaned
        }));

      const cleanedCount = assignedStudents.filter(s => s.is_cleaned).length;
      const isFullCleaned = assignedStudents.length > 0 && cleanedCount === assignedStudents.length;
      const isPartiallyCleaned = cleanedCount > 0 && cleanedCount < assignedStudents.length;

      return {
        id: ca.id,
        placeName: place?.name || 'Unknown Place',
        placeBlock: place?.block || 'Unknown Block',
        className: ca.class_name,
        students: assignedStudents,
        isCleaned: isFullCleaned,
        assignedCount: assignedStudents.length,
        cleanedCount,
        isFullCleaned,
        isPartiallyCleaned
      };
    });

    // Sort heavily by class name here so we don't need to do it on the client
    assignedPlacesData.sort((a, b) => {
      if (a.className !== b.className) {
        return a.className.localeCompare(b.className);
      }
      return a.placeName.localeCompare(b.placeName);
    });

    return {
      error: null,
      data: {
        dateStr: new Date(dateRec.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        stats: {
          totalPlaces,
          assignedPlacesCount,
          leaveCount,
          medicalCount,
          studentsCleaned,
          studentsPending,
          unassignedPlaces
        },
        assignedPlaces: assignedPlacesData,
        unassignedStudentsByClass
      }
    };

  } catch (err: any) {
    return { data: null, error: err.message || 'An error occurred' };
  }
}
