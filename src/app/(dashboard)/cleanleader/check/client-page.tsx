'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Filter, Clock, Check, RefreshCw } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast-provider';

type StudentAssignment = {
  id: string;
  student_cicno: string;
  is_cleaned: boolean;
  students: { name: string; class: string };
};

type PlaceData = {
  id: string;
  name: string;
  block: string;
  floor: string;
  assignments: StudentAssignment[];
  assignedCount: number;
  cleanedCount: number;
  isFullCleaned: boolean;
  isPartiallyCleaned: boolean;
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
  const [places, setPlaces] = useState<PlaceData[]>(placesData);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [filterBlock, setFilterBlock] = useState('All');
  const [filterClass, setFilterClass] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    setPlaces(placesData);
  }, [placesData]);

  // Toggle individual student cleaning status
  const handleToggleStudent = async (assignmentId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const previousPlaces = [...places];

    // Optimistic update
    setPlaces(prevPlaces => prevPlaces.map(p => {
      const hasAssignment = p.assignments.some(a => a.id === assignmentId);
      if (!hasAssignment) return p;

      const newAssignments = p.assignments.map(a => 
        a.id === assignmentId ? { ...a, is_cleaned: newStatus } : a
      );
      const cleanedCount = newAssignments.filter(a => a.is_cleaned).length;
      const isFull = newAssignments.length > 0 && cleanedCount === newAssignments.length;
      const isPartial = cleanedCount > 0 && cleanedCount < newAssignments.length;

      return {
        ...p,
        assignments: newAssignments,
        cleanedCount,
        isFullCleaned: isFull,
        isPartiallyCleaned: isPartial,
        cleaned: isFull
      };
    }));

    setLoadingActionId(assignmentId);
    const { error } = await supabase
      .from('student_cleaning_assignments')
      .update({ is_cleaned: newStatus })
      .eq('id', assignmentId);

    setLoadingActionId(null);

    if (error) {
      toast.error(error.message || 'Failed to update student cleaning status');
      setPlaces(previousPlaces);
    } else {
      router.refresh();
    }
  };

  // Mark all students in a place as cleaned or not cleaned
  const handleTogglePlaceAll = async (place: PlaceData) => {
    const targetStatus = !place.isFullCleaned;
    const assignmentIds = place.assignments.map(a => a.id);
    if (assignmentIds.length === 0) return;

    const previousPlaces = [...places];

    // Optimistic update
    setPlaces(prevPlaces => prevPlaces.map(p => {
      if (p.id !== place.id) return p;

      const newAssignments = p.assignments.map(a => ({ ...a, is_cleaned: targetStatus }));
      const cleanedCount = targetStatus ? newAssignments.length : 0;
      return {
        ...p,
        assignments: newAssignments,
        cleanedCount,
        isFullCleaned: targetStatus,
        isPartiallyCleaned: false,
        cleaned: targetStatus
      };
    }));

    setLoadingActionId(place.id);
    const { error } = await supabase
      .from('student_cleaning_assignments')
      .update({ is_cleaned: targetStatus })
      .in('id', assignmentIds);

    setLoadingActionId(null);

    if (error) {
      toast.error(error.message || 'Failed to update cleaning status');
      setPlaces(previousPlaces);
    } else {
      router.refresh();
    }
  };

  const blocks = ['All', ...Array.from(new Set(places.map(p => p.block).filter(Boolean)))].sort();
  const classes = ['All', ...Array.from(new Set(places.flatMap(p => p.assignments.map(a => a.students?.class)).filter(Boolean)))].sort();
  const statusOptions = ['All', 'Full Cleaned', 'Partially Cleaned', 'Not Cleaned'];

  const floorWeights: Record<string, number> = { 'Ground': 0, 'Floor1': 1, 'Floor2': 2, 'Floor3': 3, 'Floor4': 4, 'Floor5': 5 };

  const filteredPlaces = places
    .filter(p => filterBlock === 'All' || p.block === filterBlock)
    .filter(p => filterClass === 'All' || p.assignments.some(a => a.students?.class === filterClass))
    .filter(p => {
      if (filterStatus === 'All') return true;
      if (filterStatus === 'Full Cleaned') return p.isFullCleaned;
      if (filterStatus === 'Partially Cleaned') return p.isPartiallyCleaned;
      if (filterStatus === 'Not Cleaned') return !p.isFullCleaned && !p.isPartiallyCleaned;
      return true;
    })
    .sort((a, b) => {
      const wA = floorWeights[a.floor] ?? 99;
      const wB = floorWeights[b.floor] ?? 99;
      if (wA !== wB) return wA - wB;
      return a.name.localeCompare(b.name);
    });

  const totalAssignedPlaces = places.length;
  const fullCleanedCount = places.filter(p => p.isFullCleaned).length;
  const partiallyCleanedCount = places.filter(p => p.isPartiallyCleaned).length;
  const notCleanedCount = places.filter(p => !p.isFullCleaned && !p.isPartiallyCleaned).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Verify Cleaning</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {dateId ? `Verify places and individual cleaners for ${dateStr}` : 'No active dates found.'}
          </p>
        </div>
        
        {dateId && places.length > 0 && (
          <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
            <div className="w-full sm:w-36 flex-1">
              <Select 
                value={filterBlock}
                onChange={setFilterBlock}
                options={blocks.map(b => ({ value: b, label: b === 'All' ? 'All Blocks' : b }))}
              />
            </div>
            <div className="w-full sm:w-36 flex-1">
              <Select 
                value={filterClass}
                onChange={setFilterClass}
                options={classes.map(c => ({ value: c, label: c === 'All' ? 'All Classes' : c }))}
              />
            </div>
            <div className="w-full sm:w-40 flex-1">
              <Select 
                value={filterStatus}
                onChange={setFilterStatus}
                options={statusOptions.map(s => ({ value: s, label: s }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Pills */}
      {dateId && totalAssignedPlaces > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-3 shadow-xs">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Places</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{totalAssignedPlaces}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 shadow-xs">
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Full Cleaned</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{fullCleanedCount}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 shadow-xs">
            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Partially Cleaned</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{partiallyCleanedCount}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 shadow-xs">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Not Cleaned</p>
            <p className="text-xl font-bold text-muted-foreground mt-0.5">{notCleanedCount}</p>
          </div>
        </div>
      )}

      {!dateId ? (
        <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-lg shadow-xs">
          Please create a date in Assign Places first.
        </div>
      ) : filteredPlaces.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-lg shadow-xs">
          No places match the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPlaces.map(place => {
            const isPlaceBusy = loadingActionId === place.id;
            
            return (
              <div 
                key={place.id} 
                className={`bg-card text-card-foreground border border-border p-5 rounded-lg shadow-xs border-l-4 transition-all flex flex-col justify-between ${
                  place.isFullCleaned 
                    ? 'border-l-primary bg-accent/15' 
                    : place.isPartiallyCleaned
                    ? 'border-l-amber-500 bg-amber-500/5'
                    : 'border-l-muted-foreground/30'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div>
                      <h3 className="font-semibold text-base text-foreground">{place.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{place.block} • {place.floor || 'Ground'}</p>
                    </div>

                    {/* Overall Place Status Badge */}
                    <div>
                      {place.isFullCleaned ? (
                        <span className="inline-flex items-center gap-1.5 text-accent-foreground text-xs font-semibold bg-accent px-2.5 py-1 rounded-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Full Cleaned ({place.cleanedCount}/{place.assignedCount})
                        </span>
                      ) : place.isPartiallyCleaned ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-semibold bg-amber-500/15 px-2.5 py-1 rounded-sm">
                          <Clock className="w-3.5 h-3.5" /> Partially Cleaned ({place.cleanedCount}/{place.assignedCount})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs font-medium bg-muted/60 px-2.5 py-1 rounded-sm">
                          <XCircle className="w-3.5 h-3.5" /> Not Cleaned (0/{place.assignedCount})
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Cleaners List with Individual Toggles */}
                  <div className="space-y-2 mb-4 mt-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span>Cleaners ({place.assignedCount}):</span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        Click student to toggle cleaned
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {place.assignments.map(a => {
                        const isStudentBusy = loadingActionId === a.id;

                        return (
                          <div 
                            key={a.id} 
                            className={`text-xs p-2.5 rounded-md border flex items-center justify-between gap-2 transition-colors ${
                              a.is_cleaned 
                                ? 'bg-accent/40 border-accent text-foreground' 
                                : 'bg-muted/40 border-border text-foreground'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-foreground uppercase truncate">
                                {a.students?.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Class: <strong className="text-foreground font-medium">{a.students?.class}</strong> • CIC: {a.student_cicno}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={isStudentBusy || isPlaceBusy}
                              onClick={() => handleToggleStudent(a.id, a.is_cleaned)}
                              className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                                a.is_cleaned
                                  ? 'bg-primary text-primary-foreground hover:brightness-95 shadow-xs'
                                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border'
                              }`}
                              title={a.is_cleaned ? 'Mark as Not Cleaned' : 'Mark as Cleaned'}
                            >
                              {a.is_cleaned ? (
                                <>
                                  <Check className="w-3 h-3" /> Cleaned
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-muted-foreground" /> Mark Done
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Place-Level Action Button */}
                <div className="pt-2 border-t border-border mt-2">
                  <button
                    disabled={isPlaceBusy || place.assignments.length === 0}
                    onClick={() => handleTogglePlaceAll(place)}
                    className={`w-full py-2 px-3 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 ${
                      place.isFullCleaned 
                        ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border'
                        : 'bg-primary hover:brightness-95 text-primary-foreground font-semibold'
                    }`}
                  >
                    {place.isFullCleaned ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" /> Mark All as Not Cleaned
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Full Cleaned ({place.assignedCount} Cleaners)
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
