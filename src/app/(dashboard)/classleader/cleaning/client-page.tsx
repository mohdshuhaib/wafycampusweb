'use client';

import { useState, useEffect } from 'react';
import { Users, Calendar, Brush } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/components/ui/toast-provider';
import { Select } from '@/components/ui/select';

type Student = { cicno: string; name: string; is_exceptional?: boolean };
type Place = { id: string; name: string; count: number };
type Assignment = { id: string; place_id: string; student_cicno: string; is_cleaned?: boolean };
type Status = { student_cicno: string; status: string };

export default function ClassCleaningClient({
  dateId,
  dateStr,
  userClass,
  students,
  places,
  assignments,
  statuses
}: {
  dateId: string;
  dateStr: string;
  userClass: string;
  students: Student[];
  places: Place[];
  assignments: Assignment[];
  statuses: Status[];
}) {
  const supabase = createClient();
  const toast = useToast();

  const [localStatuses, setLocalStatuses] = useState<Status[]>(statuses);
  const [localAssignments, setLocalAssignments] = useState<Assignment[]>(assignments);

  useEffect(() => {
    setLocalStatuses(statuses);
  }, [statuses]);

  useEffect(() => {
    setLocalAssignments(assignments);
  }, [assignments]);

  // Instant status lookup
  const getStudentStatus = (cicno: string) => 
    localStatuses.find(s => s.student_cicno === cicno)?.status || 'present';
  
  // Instant optimistic attendance toggle
  const handleStatusChange = async (cicno: string, newStatus: string) => {
    const prevStatuses = [...localStatuses];
    const prevAssignments = [...localAssignments];

    // 1. Optimistic Update in UI (0ms)
    setLocalStatuses(prev => {
      const idx = prev.findIndex(s => s.student_cicno === cicno);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], status: newStatus };
        return next;
      }
      return [...prev, { student_cicno: cicno, status: newStatus }];
    });

    // If changing to leave or medical, immediately remove student from assigned places
    if (newStatus !== 'present') {
      setLocalAssignments(prev => prev.filter(a => a.student_cicno !== cicno));
    }

    // 2. Sync to Supabase in background
    const existing = prevStatuses.find(s => s.student_cicno === cicno);
    let err;
    if (existing) {
      const { error } = await supabase
        .from('student_statuses')
        .update({ status: newStatus })
        .eq('date_id', dateId)
        .eq('student_cicno', cicno);
      err = error;
    } else {
      const { error } = await supabase
        .from('student_statuses')
        .insert({
          date_id: dateId,
          student_cicno: cicno,
          status: newStatus
        });
      err = error;
    }

    if (!err && newStatus !== 'present') {
      await supabase
        .from('student_cleaning_assignments')
        .delete()
        .eq('date_id', dateId)
        .eq('student_cicno', cicno);
    }

    if (err) {
      toast.error(err.message || 'Failed to update attendance');
      // Rollback on error
      setLocalStatuses(prevStatuses);
      setLocalAssignments(prevAssignments);
    }
  };

  // Instant optimistic place assignment
  const handleAssign = async (cicno: string, placeId: string) => {
    const tempId = 'temp-' + Date.now();
    const newAssignment: Assignment = {
      id: tempId,
      place_id: placeId,
      student_cicno: cicno,
      is_cleaned: false
    };

    // Optimistic addition (0ms)
    setLocalAssignments(prev => [...prev, newAssignment]);

    const { data, error } = await supabase
      .from('student_cleaning_assignments')
      .insert({
        date_id: dateId,
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

  // Instant optimistic place unassignment
  const handleRemoveAssignment = async (a: Assignment) => {
    const prevAssignments = [...localAssignments];

    // Optimistic removal (0ms)
    setLocalAssignments(prev => 
      prev.filter(item => !(item.place_id === a.place_id && item.student_cicno === a.student_cicno))
    );

    const { error } = await supabase
      .from('student_cleaning_assignments')
      .delete()
      .match({ 
        date_id: dateId,
        place_id: a.place_id, 
        student_cicno: a.student_cicno 
      });

    if (error) {
      toast.error(error.message);
      // Rollback
      setLocalAssignments(prevAssignments);
    }
  };

  const availableStudents = students.filter(
    s => getStudentStatus(s.cicno) === 'present' && 
         !localAssignments.some(a => a.student_cicno === s.cicno) && 
         !s.is_exceptional
  );

  if (!dateId) {
    return (
      <div className="p-8 text-center bg-muted/30 rounded-md border border-dashed border-border">
        <Calendar className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
        <p className="text-foreground font-medium text-sm">No active cleaning dates.</p>
        <p className="text-xs text-muted-foreground mt-1">Please wait for the Cleaning Leader to generate today's list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Today's Cleaning</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3.5 h-3.5 text-primary" /> {dateStr} | Class <span className="font-semibold text-primary">{userClass}</span>
          </p>
        </div>
      </div>

      {places.length === 0 ? (
        <div className="p-8 text-center bg-muted/30 rounded-md border border-dashed border-border">
          <Brush className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
          <p className="text-foreground font-medium text-sm">Your class has no assigned places for today.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Places Assignment Panel */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Brush className="w-4 h-4 text-primary" /> Assign to Places
            </h2>
            {places.map(place => {
              const assignedHere = localAssignments.filter(a => a.place_id === place.id);
              const needsMore = place.count - assignedHere.length;

              return (
                <div key={place.id} className="bg-card text-card-foreground border border-border border-l-4 border-l-primary rounded-lg p-5 shadow-xs">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-sm text-foreground">{place.name}</h3>
                    <span className="text-xs font-semibold bg-secondary text-secondary-foreground px-2 py-0.5 rounded-sm">
                      {assignedHere.length} / {place.count}
                    </span>
                  </div>
                  
                  <div className="space-y-1.5 mb-3">
                    {assignedHere.map(a => {
                      const student = students.find(s => s.cicno === a.student_cicno);
                      return (
                        <div key={a.id} className="flex justify-between items-center bg-muted/40 p-2 rounded-md border border-border text-xs">
                          <span className="font-medium text-foreground">{student?.name || a.student_cicno}</span>
                          <button 
                            onClick={() => handleRemoveAssignment(a)}
                            className="text-xs text-destructive hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {needsMore > 0 && availableStudents.length > 0 && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select 
                          value=""
                          onChange={(val) => {
                            if (val) handleAssign(val, place.id);
                          }}
                          placeholder="Assign student..."
                          options={availableStudents.map(s => ({
                            value: s.cicno,
                            label: `${s.name} (${s.cicno})`
                          }))}
                        />
                      </div>
                    </div>
                  )}
                  {needsMore > 0 && availableStudents.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">No more present students available to assign.</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Attendance Panel */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Users className="w-4 h-4 text-primary" /> Attendance
            </h2>
            <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
              <div className="space-y-2">
                {students.map(s => {
                  const status = getStudentStatus(s.cicno);
                  const isAssigned = localAssignments.some(a => a.student_cicno === s.cicno);
                  
                  return (
                    <div key={s.cicno} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md border gap-2.5 ${s.is_exceptional ? 'bg-muted/20 border-border/60 opacity-60' : 'bg-muted/30 border-border'}`}>
                      <div>
                        <p className={`font-semibold text-xs ${s.is_exceptional ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {s.name}
                          {s.is_exceptional && <span className="ml-1.5 text-[10px] bg-accent text-accent-foreground px-1.5 py-0.2 rounded-sm font-semibold">Exceptional</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">CIC: {s.cicno}</p>
                      </div>
                      
                      <div className="flex gap-1.5">
                        <button 
                          disabled={isAssigned || s.is_exceptional}
                          onClick={() => handleStatusChange(s.cicno, 'present')}
                          className={`px-2.5 py-1 rounded-sm text-xs font-semibold transition-colors ${status === 'present' && !s.is_exceptional ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} disabled:opacity-50`}
                        >
                          Present
                        </button>
                        <button 
                          disabled={isAssigned || s.is_exceptional}
                          onClick={() => handleStatusChange(s.cicno, 'leave')}
                          className={`px-2.5 py-1 rounded-sm text-xs font-semibold transition-colors ${status === 'leave' && !s.is_exceptional ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} disabled:opacity-50`}
                        >
                          Leave
                        </button>
                        <button 
                          disabled={isAssigned || s.is_exceptional}
                          onClick={() => handleStatusChange(s.cicno, 'medical')}
                          className={`px-2.5 py-1 rounded-sm text-xs font-semibold transition-colors ${status === 'medical' && !s.is_exceptional ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} disabled:opacity-50`}
                        >
                          Medical
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
