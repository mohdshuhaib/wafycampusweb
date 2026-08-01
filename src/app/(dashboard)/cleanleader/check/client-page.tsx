'use client';

import { useState } from 'react';
import { CheckSquare, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

type PlaceData = {
  id: string;
  name: string;
  block: string;
  assignments: { id: string, student_cicno: string, students: { name: string, class: string } }[];
  cleaned: boolean;
};

export default function CheckClient({
  placesData,
  dateStr,
  dateId
}: {
  placesData: PlaceData[];
  dateStr: string;
  dateId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const supabase = createClient();
  const router = useRouter();

  const handleToggleCleaned = async (placeId: string, currentStatus: boolean, assignmentIds: string[]) => {
    if (assignmentIds.length === 0) return;
    setLoading(true);
    setError('');
    
    // We update all assignments for this place on this date to the new status
    const { error } = await supabase
      .from('student_cleaning_assignments')
      .update({ is_cleaned: !currentStatus })
      .in('id', assignmentIds);
      
    if (error) setError(error.message);
    else router.refresh();
    
    setLoading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Verify Cleaning</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {dateId ? `Verify places for ${dateStr}` : 'No active dates found.'}
          </p>
        </div>
      </div>

      {error && <div className="p-4 bg-danger/10 text-danger rounded-xl flex items-center gap-2"><AlertCircle className="w-5 h-5" /> {error}</div>}

      {!dateId ? (
        <div className="p-8 text-center text-slate-500 glass-panel">Please create a date in Assign Places first.</div>
      ) : placesData.length === 0 ? (
        <div className="p-8 text-center text-slate-500 glass-panel">No assigned places to check today.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {placesData.map(place => (
            <div key={place.id} className={`glass-panel p-6 border-l-4 transition-colors ${place.cleaned ? 'border-l-success bg-success/5' : 'border-l-amber-500'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-xl text-slate-900 dark:text-white">{place.name}</h3>
                  <p className="text-sm text-slate-500">{place.block}</p>
                </div>
                {place.cleaned ? (
                  <CheckCircle2 className="w-8 h-8 text-success" />
                ) : (
                  <XCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                )}
              </div>
              
              <div className="space-y-2 mb-6">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Cleaned By:</p>
                {place.assignments.map(a => (
                  <div key={a.id} className="text-sm text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 p-2 rounded">
                    {a.students?.name} <span className="text-xs opacity-70">({a.students?.class})</span>
                  </div>
                ))}
              </div>

              <button
                disabled={loading}
                onClick={() => handleToggleCleaned(place.id, place.cleaned, place.assignments.map(a => a.id))}
                className={`w-full p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                  place.cleaned 
                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30'
                }`}
              >
                <CheckSquare className="w-5 h-5" />
                {place.cleaned ? 'Mark as Not Cleaned' : 'Mark as Cleaned'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
