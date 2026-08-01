'use client';

import { useState } from 'react';
import { Users, CheckCircle2, AlertCircle, Calendar, Brush } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

type Student = { cicno: string; name: string };
type Place = { id: string; name: string; count: number };
type Assignment = { id: string; place_id: string; student_cicno: string; is_cleaned: boolean };
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const supabase = createClient();
  const router = useRouter();

  // Find students who are present vs leave/medical
  const getStudentStatus = (cicno: string) => statuses.find(s => s.student_cicno === cicno)?.status || 'present';
  
  const handleStatusChange = async (cicno: string, newStatus: string) => {
    setLoading(true);
    setError('');
    const existing = statuses.find(s => s.student_cicno === cicno);
    
    let err;
    if (existing) {
      const { error } = await supabase.from('student_statuses').update({ status: newStatus }).eq('id', (existing as any).id);
      err = error;
    } else {
      const { error } = await supabase.from('student_statuses').insert({
        date_id: dateId,
        student_cicno: cicno,
        status: newStatus
      });
      err = error;
    }

    // If changing to leave/medical, remove from active assignments
    if (!err && newStatus !== 'present') {
      await supabase.from('student_cleaning_assignments').delete().eq('date_id', dateId).eq('student_cicno', cicno);
    }

    if (err) setError(err.message);
    else router.refresh();
    
    setLoading(false);
  };

  const handleAssign = async (cicno: string, placeId: string) => {
    setLoading(true);
    setError('');
    const { error } = await supabase.from('student_cleaning_assignments').insert({
      date_id: dateId,
      place_id: placeId,
      student_cicno: cicno
    });
    
    if (error) setError(error.message);
    else router.refresh();
    
    setLoading(false);
  };

  const handleRemoveAssignment = async (assignId: string) => {
    setLoading(true);
    setError('');
    const { error } = await supabase.from('student_cleaning_assignments').delete().eq('id', assignId);
    if (error) setError(error.message);
    else router.refresh();
    setLoading(false);
  };

  const availableStudents = students.filter(s => getStudentStatus(s.cicno) === 'present' && !assignments.some(a => a.student_cicno === s.cicno));

  if (!dateId) {
    return (
      <div className="p-8 text-center bg-white/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
        <Calendar className="w-10 h-10 mx-auto text-slate-400 mb-3 opacity-50" />
        <p className="text-slate-600 dark:text-slate-400 font-medium">No active cleaning dates.</p>
        <p className="text-sm text-slate-500 mt-1">Please wait for the Cleaning Leader to generate today's list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Today's Cleaning</h1>
          <p className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> {dateStr} | Class {userClass}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 text-danger rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {places.length === 0 ? (
        <div className="p-8 text-center bg-white/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
          <Brush className="w-10 h-10 mx-auto text-slate-400 mb-3 opacity-50" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Your class has no assigned places for today.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Places Assignment Panel */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Brush className="w-5 h-5 text-primary" /> Assign to Places
            </h2>
            {places.map(place => {
              const assignedHere = assignments.filter(a => a.place_id === place.id);
              const needsMore = place.count - assignedHere.length;

              return (
                <div key={place.id} className="glass-panel p-6 border-l-4 border-l-primary">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">{place.name}</h3>
                    <span className="text-sm font-medium bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
                      {assignedHere.length} / {place.count}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {assignedHere.map(a => {
                      const student = students.find(s => s.cicno === a.student_cicno);
                      return (
                        <div key={a.id} className="flex justify-between items-center bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                          <span className="text-sm font-medium">{student?.name}</span>
                          <button 
                            disabled={loading}
                            onClick={() => handleRemoveAssignment(a.id)}
                            className="text-xs text-danger hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {needsMore > 0 && availableStudents.length > 0 && (
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none"
                        onChange={(e) => {
                          if (e.target.value) handleAssign(e.target.value, place.id);
                          e.target.value = ""; // Reset
                        }}
                        disabled={loading}
                        defaultValue=""
                      >
                        <option value="" disabled>Assign student...</option>
                        {availableStudents.map(s => (
                          <option key={s.cicno} value={s.cicno}>{s.name} ({s.cicno})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {needsMore > 0 && availableStudents.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">No more present students available to assign.</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Attendance Panel */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Attendance
            </h2>
            <div className="glass-panel p-6">
              <div className="space-y-3">
                {students.map(s => {
                  const status = getStudentStatus(s.cicno);
                  const isAssigned = assignments.some(a => a.student_cicno === s.cicno);
                  
                  return (
                    <div key={s.cicno} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white/30 dark:bg-slate-800/30 rounded-lg border border-slate-200/50 dark:border-slate-700/50 gap-3">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-white">{s.name}</p>
                        <p className="text-xs text-slate-500">CIC: {s.cicno}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          disabled={loading || isAssigned}
                          onClick={() => handleStatusChange(s.cicno, 'present')}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${status === 'present' ? 'bg-success/20 text-success' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-300'} disabled:opacity-50`}
                        >
                          Present
                        </button>
                        <button 
                          disabled={loading || isAssigned}
                          onClick={() => handleStatusChange(s.cicno, 'leave')}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${status === 'leave' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-300'} disabled:opacity-50`}
                        >
                          Leave
                        </button>
                        <button 
                          disabled={loading || isAssigned}
                          onClick={() => handleStatusChange(s.cicno, 'medical')}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${status === 'medical' ? 'bg-danger/20 text-danger' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-300'} disabled:opacity-50`}
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
