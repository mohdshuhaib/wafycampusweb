'use client';

import { useState, useEffect } from 'react';
import { Calendar, Brush, Users, Filter, X, UserCheck, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/components/ui/toast-provider';
import { Select } from '@/components/ui/select';

type DateRow = { id: string; date: string };
type Place = { id: string; name: string; block: string; count: number; floor?: string };
type Student = { cicno: string; name: string; class: string; is_exceptional?: boolean };
type ClassAssignment = { place_id: string; class_name: string };
type StudentAssignment = { id: string; place_id: string; student_cicno: string; is_cleaned?: boolean };
type StudentStatus = { student_cicno: string; status: string };

export default function CleanLeaderAssignStudentsClient({
  dates,
  currentDateId,
  classes,
  places,
  students,
  classAssignments,
  studentAssignments,
  studentStatuses
}: {
  dates: DateRow[];
  currentDateId: string;
  classes: string[];
  places: Place[];
  students: Student[];
  classAssignments: ClassAssignment[];
  studentAssignments: StudentAssignment[];
  studentStatuses: StudentStatus[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();

  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [localAssignments, setLocalAssignments] = useState<StudentAssignment[]>(studentAssignments);
  const [localStatuses, setLocalStatuses] = useState<StudentStatus[]>(studentStatuses);

  useEffect(() => {
    setLocalAssignments(studentAssignments);
  }, [studentAssignments]);

  useEffect(() => {
    setLocalStatuses(studentStatuses);
  }, [studentStatuses]);

  // Date selection change
  const handleDateChange = (dateId: string) => {
    if (dateId) {
      router.push(`/cleanleader/assign-students?dateId=${dateId}`);
    }
  };

  const getStudentStatus = (cicno: string) => 
    localStatuses.find(s => s.student_cicno === cicno)?.status || 'present';

  // Instant optimistic attendance toggle
  const handleStatusChange = async (cicno: string, newStatus: string) => {
    const prevStatuses = [...localStatuses];
    const prevAssignments = [...localAssignments];

    // Optimistic UI update
    setLocalStatuses(prev => {
      const idx = prev.findIndex(s => s.student_cicno === cicno);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], status: newStatus };
        return next;
      }
      return [...prev, { student_cicno: cicno, status: newStatus }];
    });

    // If changing to leave or medical, unassign immediately
    if (newStatus !== 'present') {
      setLocalAssignments(prev => prev.filter(a => a.student_cicno !== cicno));
    }

    const existing = prevStatuses.find(s => s.student_cicno === cicno);
    let err;
    if (existing) {
      const { error } = await supabase
        .from('student_statuses')
        .update({ status: newStatus })
        .eq('date_id', currentDateId)
        .eq('student_cicno', cicno);
      err = error;
    } else {
      const { error } = await supabase
        .from('student_statuses')
        .insert({
          date_id: currentDateId,
          student_cicno: cicno,
          status: newStatus
        });
      err = error;
    }

    if (!err && newStatus !== 'present') {
      await supabase
        .from('student_cleaning_assignments')
        .delete()
        .eq('date_id', currentDateId)
        .eq('student_cicno', cicno);
    }

    if (err) {
      toast.error(err.message || 'Failed to update attendance');
      // Rollback
      setLocalStatuses(prevStatuses);
      setLocalAssignments(prevAssignments);
    }
  };

  // Instant optimistic assign student
  const handleAssign = async (cicno: string, placeId: string) => {
    const tempId = 'temp-' + Date.now();
    const newAssignment: StudentAssignment = {
      id: tempId,
      place_id: placeId,
      student_cicno: cicno,
      is_cleaned: false
    };

    setLocalAssignments(prev => [...prev, newAssignment]);

    const { data, error } = await supabase
      .from('student_cleaning_assignments')
      .insert({
        date_id: currentDateId,
        place_id: placeId,
        student_cicno: cicno
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      // Rollback
      setLocalAssignments(prev => prev.filter(a => a.id !== tempId));
    } else if (data) {
      setLocalAssignments(prev => prev.map(a => a.id === tempId ? { ...a, id: data.id } : a));
    }
  };

  // Instant optimistic remove student assignment
  const handleRemoveAssignment = async (placeId: string, studentCicno: string) => {
    const prevAssignments = [...localAssignments];

    setLocalAssignments(prev => 
      prev.filter(item => !(item.place_id === placeId && item.student_cicno === studentCicno))
    );

    const { error } = await supabase
      .from('student_cleaning_assignments')
      .delete()
      .match({
        date_id: currentDateId,
        place_id: placeId,
        student_cicno: studentCicno
      });

    if (error) {
      toast.error(error.message);
      // Rollback
      setLocalAssignments(prevAssignments);
    }
  };

  if (!currentDateId) {
    return (
      <div className="p-8 text-center bg-muted/30 rounded-md border border-dashed border-border">
        <Calendar className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
        <p className="text-foreground font-medium text-sm">No active cleaning dates.</p>
        <p className="text-xs text-muted-foreground mt-1">Please create a cleaning date in the Assign page first.</p>
      </div>
    );
  }

  // Create class map for places
  const placeClassMap = new Map<string, string>();
  for (const ca of classAssignments) {
    placeClassMap.set(ca.place_id, ca.class_name);
  }

  // Filter places based on selectedClass
  const filteredPlaces = places.filter(place => {
    if (selectedClass === 'All') return true;
    const assignedClass = placeClassMap.get(place.id);
    return assignedClass === selectedClass;
  });

  // Available students (present, not exceptional, not already assigned to ANY place today)
  const isStudentAvailable = (s: Student) => {
    if (s.is_exceptional) return false;
    if (getStudentStatus(s.cicno) !== 'present') return false;
    if (localAssignments.some(a => a.student_cicno === s.cicno)) return false;
    return true;
  };

  // Filter students for attendance panel (if a specific class is selected)
  const attendanceStudents = selectedClass === 'All' 
    ? [] 
    : students.filter(s => s.class === selectedClass);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Assign Students</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assign individual students from any class to cleaning places for the selected date.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <div className="w-full md:w-56">
            <Select 
              value={currentDateId}
              onChange={handleDateChange}
              options={dates.map(d => ({
                value: d.id,
                label: new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              }))}
            />
          </div>
        </div>
      </div>

      {/* Class Filter Bar */}
      <div className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Filter by Class</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedClass('All')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selectedClass === 'All'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            All Classes ({places.length} Places)
          </button>
          {classes.map(cls => {
            const classPlacesCount = places.filter(p => placeClassMap.get(p.id) === cls).length;
            const isSelected = selectedClass === cls;
            return (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {cls} ({classPlacesCount})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Places on Left, Attendance on Right (if class selected) */}
      <div className={`grid grid-cols-1 ${selectedClass !== 'All' ? 'lg:grid-cols-12' : ''} gap-6`}>
        
        {/* Places Column */}
        <div className={selectedClass !== 'All' ? 'lg:col-span-7 xl:col-span-8 space-y-4' : 'space-y-4'}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Brush className="w-4 h-4 text-primary" />
              <span>Places ({filteredPlaces.length})</span>
            </h2>
            {selectedClass !== 'All' && (
              <span className="text-xs text-muted-foreground">
                Showing places assigned to <strong className="text-foreground">{selectedClass}</strong>
              </span>
            )}
          </div>

          {filteredPlaces.length === 0 ? (
            <div className="p-8 text-center bg-muted/30 rounded-md border border-dashed border-border">
              <Brush className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-foreground font-medium text-sm">No places found for this filter.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Assign places to this class in the <strong className="text-primary cursor-pointer hover:underline" onClick={() => router.push(`/cleanleader/assign?dateId=${currentDateId}`)}>Assign Classes</strong> page.
              </p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 ${selectedClass === 'All' ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
              {filteredPlaces.map(place => {
                const assignedHere = localAssignments.filter(a => a.place_id === place.id);
                const assignedClassName = placeClassMap.get(place.id);
                const needsMore = place.count - assignedHere.length;

                // Students eligible to be assigned here:
                // If this place is assigned to a specific class, prefer students of that class, or allow any available student
                const eligibleStudents = students.filter(s => {
                  if (!isStudentAvailable(s)) return false;
                  if (assignedClassName && s.class !== assignedClassName) return false;
                  return true;
                });

                return (
                  <div 
                    key={place.id} 
                    className="bg-card text-card-foreground border border-border border-l-4 border-l-primary rounded-lg p-4 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">{place.name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{place.block}</span>
                            {assignedClassName && (
                              <span className="text-[10px] font-semibold bg-accent text-accent-foreground px-1.5 py-0.2 rounded-sm">
                                {assignedClassName}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm shrink-0 ${
                          assignedHere.length >= place.count 
                            ? 'bg-accent text-accent-foreground' 
                            : 'bg-secondary text-secondary-foreground'
                        }`}>
                          {assignedHere.length} / {place.count}
                        </span>
                      </div>

                      {/* Assigned Students List */}
                      <div className="space-y-1.5 my-3">
                        {assignedHere.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic py-1">No students assigned yet</p>
                        ) : (
                          assignedHere.map(a => {
                            const student = students.find(s => s.cicno === a.student_cicno);
                            return (
                              <div 
                                key={a.id} 
                                className="flex justify-between items-center bg-muted/40 p-2 rounded-md border border-border text-xs"
                              >
                                <div>
                                  <span className="font-medium text-foreground">{student?.name || a.student_cicno}</span>
                                  {student && (
                                    <span className="ml-1.5 text-[10px] text-muted-foreground">({student.class})</span>
                                  )}
                                </div>
                                <button 
                                  onClick={() => handleRemoveAssignment(place.id, a.student_cicno)}
                                  className="text-xs text-destructive hover:underline font-medium"
                                  title="Remove assignment"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Student Assignment Dropdown */}
                    {needsMore > 0 && (
                      <div className="pt-2 border-t border-border mt-auto">
                        {eligibleStudents.length > 0 ? (
                          <Select 
                            value=""
                            onChange={(cicno) => {
                              if (cicno) handleAssign(cicno, place.id);
                            }}
                            placeholder={assignedClassName ? `Assign ${assignedClassName} student...` : "Assign student..."}
                            options={eligibleStudents.map(s => ({
                              value: s.cicno,
                              label: `${s.name} (${s.cicno})`
                            }))}
                          />
                        ) : (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">
                            {assignedClassName 
                              ? `No more available students in ${assignedClassName}.`
                              : "No available present students."}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance Column (Visible when a specific class is selected) */}
        {selectedClass !== 'All' && (
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Users className="w-4 h-4 text-primary" />
              <span>Attendance ({selectedClass})</span>
            </h2>

            <div className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-xs">
              {attendanceStudents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No students enrolled in {selectedClass}.</p>
              ) : (
                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                  {attendanceStudents.map(s => {
                    const status = getStudentStatus(s.cicno);
                    const isAssigned = localAssignments.some(a => a.student_cicno === s.cicno);

                    return (
                      <div 
                        key={s.cicno} 
                        className={`p-2.5 rounded-md border text-xs flex flex-col gap-2 ${
                          s.is_exceptional 
                            ? 'bg-muted/20 border-border/60 opacity-60' 
                            : 'bg-muted/30 border-border'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`font-semibold ${s.is_exceptional ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {s.name}
                              {s.is_exceptional && (
                                <span className="ml-1.5 text-[10px] bg-accent text-accent-foreground px-1.5 py-0.2 rounded-sm font-semibold">
                                  Exceptional
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">CIC: {s.cicno}</p>
                          </div>
                          {isAssigned && (
                            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm">
                              Assigned
                            </span>
                          )}
                        </div>

                        <div className="flex gap-1">
                          <button 
                            disabled={isAssigned || s.is_exceptional}
                            onClick={() => handleStatusChange(s.cicno, 'present')}
                            className={`flex-1 py-1 rounded-sm text-xs font-semibold transition-colors ${
                              status === 'present' && !s.is_exceptional
                                ? 'bg-accent text-accent-foreground'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            } disabled:opacity-50`}
                          >
                            Present
                          </button>
                          <button 
                            disabled={isAssigned || s.is_exceptional}
                            onClick={() => handleStatusChange(s.cicno, 'leave')}
                            className={`flex-1 py-1 rounded-sm text-xs font-semibold transition-colors ${
                              status === 'leave' && !s.is_exceptional
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            } disabled:opacity-50`}
                          >
                            Leave
                          </button>
                          <button 
                            disabled={isAssigned || s.is_exceptional}
                            onClick={() => handleStatusChange(s.cicno, 'medical')}
                            className={`flex-1 py-1 rounded-sm text-xs font-semibold transition-colors ${
                              status === 'medical' && !s.is_exceptional
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            } disabled:opacity-50`}
                          >
                            Medical
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
