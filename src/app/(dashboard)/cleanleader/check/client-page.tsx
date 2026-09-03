'use client';

import { useState } from 'react';
import { CheckSquare, CheckCircle2, XCircle, AlertCircle, Filter } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';

type PlaceData = {
  id: string;
  name: string;
  block: string;
  floor: string;
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
  const [filterBlock, setFilterBlock] = useState('All');
  const [filterClass, setFilterClass] = useState('All');
  
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

  const blocks = ['All', ...Array.from(new Set(placesData.map(p => p.block).filter(Boolean)))].sort();
  const classes = ['All', ...Array.from(new Set(placesData.flatMap(p => p.assignments.map(a => a.students?.class)).filter(Boolean)))].sort();

  const floorWeights: Record<string, number> = { 'Ground': 0, 'Floor1': 1, 'Floor2': 2, 'Floor3': 3, 'Floor4': 4, 'Floor5': 5 };

  const filteredPlaces = placesData
    .filter(p => filterBlock === 'All' || p.block === filterBlock)
    .filter(p => filterClass === 'All' || p.assignments.some(a => a.students?.class === filterClass))
    .sort((a, b) => {
      const wA = floorWeights[a.floor] ?? 99;
      const wB = floorWeights[b.floor] ?? 99;
      if (wA !== wB) return wA - wB;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Verify Cleaning</h1>
          <p className="text-sm text-muted-foreground">
            {dateId ? `Verify places for ${dateStr}` : 'No active dates found.'}
          </p>
        </div>
        
        {dateId && placesData.length > 0 && (
          <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
            <div className="w-full sm:w-44">
              <Select 
                value={filterBlock}
                onChange={setFilterBlock}
                options={blocks.map(b => ({ value: b, label: b === 'All' ? 'All Blocks' : b }))}
              />
            </div>
            <div className="w-full sm:w-44">
              <Select 
                value={filterClass}
                onChange={setFilterClass}
                options={classes.map(c => ({ value: c, label: c === 'All' ? 'All Classes' : c }))}
              />
            </div>
          </div>
        )}
      </div>

      {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2 border border-destructive/20"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {!dateId ? (
        <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-lg shadow-xs">Please create a date in Assign Places first.</div>
      ) : filteredPlaces.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-lg shadow-xs">No places match the selected filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPlaces.map(place => (
            <div key={place.id} className={`bg-card text-card-foreground border border-border p-5 rounded-lg shadow-xs border-l-4 transition-colors ${place.cleaned ? 'border-l-primary bg-accent/20' : 'border-l-muted-foreground/30'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-base text-foreground">{place.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{place.block} • {place.floor || 'Ground'}</p>
                </div>
                {place.cleaned ? (
                  <CheckCircle2 className="w-6 h-6 text-accent-foreground" />
                ) : (
                  <XCircle className="w-6 h-6 text-muted-foreground/40" />
                )}
              </div>
              
              <div className="space-y-1.5 mb-4">
                <p className="text-xs font-medium text-foreground">Cleaned By:</p>
                {place.assignments.map(a => (
                  <div key={a.id} className="text-xs text-foreground bg-muted/40 p-2 rounded-md border border-border">
                    {a.students?.name} <span className="text-muted-foreground">({a.students?.class})</span>
                  </div>
                ))}
              </div>

              <button
                disabled={loading}
                onClick={() => handleToggleCleaned(place.id, place.cleaned, place.assignments.map(a => a.id))}
                className={`w-full py-2 px-3 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 ${
                  place.cleaned 
                    ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    : 'bg-primary hover:brightness-95 text-primary-foreground'
                }`}
              >
                {place.cleaned ? (
                  <>Mark as Not Cleaned</>
                ) : (
                  <>Mark as Cleaned</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
