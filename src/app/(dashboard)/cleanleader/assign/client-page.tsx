'use client';

import { useState, useEffect } from 'react';
import { Calendar, ClipboardList, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast-provider';
import { useLoading } from '@/components/ui/loading-provider';
import { Select } from '@/components/ui/select';

type DateRow = { id: string; date: string };
type Place = { id: string; name: string; block: string; floor: string; count: number };
type Assignment = { id: string; class_name: string; place_id: string };

export default function AssignPlacesClient({
  dates,
  currentDateId,
  places,
  assignments,
  classes,
  classStudentCounts,
  studentAssignmentsCounts
}: {
  dates: DateRow[];
  currentDateId: string;
  places: Place[];
  assignments: Assignment[];
  classes: string[];
  classStudentCounts: Record<string, number>;
  studentAssignmentsCounts: Record<string, number>;
}) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { startLoading, stopLoading } = useLoading();

  // Stop loading when URL search params change (navigation completes)
  useEffect(() => {
    stopLoading();
  }, [searchParams, stopLoading]);

  // Create Date Form
  const [newDateStr, setNewDateStr] = useState(new Date().toISOString().split('T')[0]);

  // Assign Form
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [activeBlock, setActiveBlock] = useState<string>('All');
  
  // Assignment Filter
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'completed' | 'partial' | 'not-assigned'>('all');

  const handleCreateDate = async (e: React.FormEvent) => {
    e.preventDefault();
    startLoading();
    const { data, error } = await supabase.from('cleaning_dates').insert({ date: newDateStr }).select().single();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Created list for date ' + newDateStr);
      router.push(`?dateId=${data.id}`);
    }
    stopLoading();
  };

  const togglePlace = (placeId: string) => {
    if (!selectedClass) {
      toast.error('Please select a class first to check student capacity.');
      return;
    }

    const isAdding = !selectedPlaces.includes(placeId);
    
    if (isAdding) {
      const placeCount = places.find(p => p.id === placeId)?.count || 0;
      const currentlyNeeded = selectedPlaces.reduce((sum, id) => sum + (places.find(p => p.id === id)?.count || 0), 0);
      const studentCount = classStudentCounts[selectedClass] || 0;

      if (currentlyNeeded + placeCount > studentCount) {
        toast.error(`Cannot assign! You need ${currentlyNeeded + placeCount} students, but Class ${selectedClass} only has ${studentCount} students.`);
        return;
      }
    }

    setSelectedPlaces(prev => 
      isAdding ? [...prev, placeId] : prev.filter(id => id !== placeId)
    );
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDateId) { toast.error('Select a date first'); return; }
    if (selectedPlaces.length === 0) { toast.error('Select at least one place'); return; }
    if (!selectedClass) { toast.error('Select a class'); return; }
    
    startLoading();
    
    const inserts = selectedPlaces.map(p => ({
      date_id: currentDateId,
      place_id: p,
      class_name: selectedClass
    }));

    const { error } = await supabase.from('class_assignments').insert(inserts);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Assigned successfully');
      setSelectedPlaces([]);
      setSelectedClass('');
      router.refresh();
    }
    stopLoading();
  };

  const handleRemove = async (assignment: any) => {
    if (!confirm('Remove assignment?')) return;
    startLoading();

    // 1. Delete all student assignments for this place & date
    const { error: saError } = await supabase
      .from('student_cleaning_assignments')
      .delete()
      .eq('date_id', currentDateId)
      .eq('place_id', assignment.place_id);

    if (saError) {
      toast.error(saError.message);
      stopLoading();
      return;
    }

    // 2. Delete the class assignment
    const { error } = await supabase.from('class_assignments').delete().eq('id', assignment.id);
    if (error) toast.error(error.message);
    else router.refresh();
    stopLoading();
  };

  const handleDeleteDate = async () => {
    if (!currentDateId) return;
    if (!confirm('WARNING: Are you sure you want to delete this entire date and ALL associated cleaning assignments and student progress? This cannot be undone.')) return;
    
    startLoading();
    
    // 1. Delete student assignments
    await supabase.from('student_cleaning_assignments').delete().eq('date_id', currentDateId);
    
    // 2. Delete class assignments
    await supabase.from('class_assignments').delete().eq('date_id', currentDateId);
    
    // 3. Delete the date itself
    const { error } = await supabase.from('cleaning_dates').delete().eq('id', currentDateId);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Date deleted successfully');
      router.push('/cleanleader/assign');
    }
    stopLoading();
  };

  // Filter out classes that are already assigned to places for the selected date
  const availableClasses = classes.filter(c => !assignments.some(a => a.class_name === c));

  const floorWeights: Record<string, number> = { 'Ground': 0, 'Floor1': 1, 'Floor2': 2, 'Floor3': 3 };
  const sortedPlaces = [...places].sort((a, b) => (floorWeights[a.floor] ?? 0) - (floorWeights[b.floor] ?? 0));

  const filteredAssignments = assignments.filter(a => {
    if (assignmentFilter === 'all') return true;
    const place = places.find(p => p.id === a.place_id);
    const needed = place?.count || 0;
    const assigned = studentAssignmentsCounts[a.place_id] || 0;
    
    if (assignmentFilter === 'completed') return assigned >= needed;
    if (assignmentFilter === 'partial') return assigned > 0 && assigned < needed;
    if (assignmentFilter === 'not-assigned') return assigned === 0;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Assign Places</h1>
          <p className="text-sm text-muted-foreground">Allocate campus cleaning areas to classes for specific dates.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sidebar Controls */}
        <div className="space-y-5">
          <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Calendar className="w-4 h-4 text-primary" /> Select Date
              </h2>
              {currentDateId && (
                <button 
                  onClick={handleDeleteDate}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete List
                </button>
              )}
            </div>
            <Select 
              value={currentDateId}
              onChange={(val) => { startLoading(); router.push(`?dateId=${val}`); }}
              placeholder="Select a date..."
              options={dates.map(d => ({
                value: d.id,
                label: new Date(d.date).toLocaleDateString('en-GB')
              }))}
            />
          </div>

          <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-foreground">
              <Plus className="w-4 h-4 text-primary" /> New Date List
            </h2>
            <form onSubmit={handleCreateDate} className="space-y-3">
              <input 
                type="date" 
                value={newDateStr}
                onChange={e => setNewDateStr(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs"
              />
              <button type="submit" className="w-full py-2 px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md font-medium text-sm transition-colors shadow-xs">
                Create
              </button>
            </form>
          </div>

          {currentDateId && (
            <div className="bg-card text-card-foreground border border-border border-l-4 border-l-primary p-5 rounded-lg shadow-xs">
              <h2 className="text-base font-semibold mb-3 text-foreground">Assign Class</h2>
              <form onSubmit={handleAssign} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Class</label>
                  <Select 
                    required 
                    value={selectedClass} 
                    onChange={val => {
                      setSelectedClass(val);
                      setSelectedPlaces([]); // Reset places to validate limits correctly
                    }} 
                    placeholder="Select class..."
                    options={availableClasses.map(c => ({
                      value: c,
                      label: `${c} (${classStudentCounts[c] || 0} students)`
                    }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground flex justify-between">
                    Select Places
                    <span className="text-xs text-primary font-semibold">
                      {selectedClass ? (
                        <>Allocated: {selectedPlaces.reduce((sum, id) => sum + (places.find(p => p.id === id)?.count || 0), 0)} / {classStudentCounts[selectedClass] || 0}</>
                      ) : (
                        <>{selectedPlaces.length} selected</>
                      )}
                    </span>
                  </label>
                  
                  {/* Block Filter Tabs */}
                  {places.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-1.5">
                      {['All', ...Array.from(new Set(places.map(p => p.block)))].map(block => (
                        <button
                          key={block}
                          type="button"
                          onClick={() => setActiveBlock(block)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                            activeBlock === block 
                              ? 'bg-primary text-primary-foreground shadow-xs font-semibold' 
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                          }`}
                        >
                          {block === 'All' ? 'All Blocks' : `${block}`}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {sortedPlaces
                      .filter(p => !assignments.some(a => a.place_id === p.id))
                      .filter(p => activeBlock === 'All' || p.block === activeBlock)
                      .map(p => {
                      const isSelected = selectedPlaces.includes(p.id);
                      return (
                        <div 
                          key={p.id}
                          onClick={() => togglePlace(p.id)}
                          className={`p-2.5 rounded-md border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                            isSelected 
                              ? 'bg-primary/10 text-foreground border-primary' 
                              : 'bg-card border-border hover:border-border/80 text-foreground'
                          }`}
                        >
                          <div>
                            <p className="font-semibold flex items-center gap-1.5">
                              {p.name}
                              <span className="text-[10px] px-1.5 py-0.2 bg-secondary text-secondary-foreground rounded-sm font-normal">{p.floor || 'Ground'}</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{p.block}</p>
                          </div>
                          <div className="text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground">
                            Needs: {p.count}
                          </div>
                        </div>
                      );
                    })}
                    {sortedPlaces
                      .filter(p => !assignments.some(a => a.place_id === p.id))
                      .filter(p => activeBlock === 'All' || p.block === activeBlock)
                      .length === 0 && (
                      <div className="text-center p-4 text-xs text-muted-foreground bg-muted/20 rounded-md border border-dashed border-border">
                        No places available in this block for this date.
                      </div>
                    )}
                  </div>
                </div>

                <button type="submit" className="w-full py-2 px-3 bg-primary hover:brightness-95 text-primary-foreground rounded-md font-medium text-sm transition-colors shadow-xs disabled:opacity-50">
                  Assign to Selected Places
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Assignments List */}
        <div className="lg:col-span-2 bg-card text-card-foreground border border-border rounded-lg p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Assignments for Selected Date</h2>
            </div>
            
            {currentDateId && assignments.length > 0 && (
              <Select 
                value={assignmentFilter}
                onChange={(val) => setAssignmentFilter(val as any)}
                options={[
                  { value: 'all', label: 'All Assignments' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'partial', label: 'Partial' },
                  { value: 'not-assigned', label: 'Not Assigned' },
                ]}
                className="w-full sm:w-44"
              />
            )}
          </div>
          
          {!currentDateId ? (
            <p className="text-muted-foreground text-center text-sm py-8">Please select or create a date to manage assignments.</p>
          ) : assignments.length === 0 ? (
            <div className="p-8 text-center bg-muted/30 rounded-md border border-dashed border-border">
              <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-foreground font-medium text-sm">No assignments yet for this date.</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="p-8 text-center bg-muted/30 rounded-md border border-dashed border-border">
              <p className="text-muted-foreground font-medium text-sm">No assignments match this filter.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredAssignments.map(a => {
                const place = places.find(p => p.id === a.place_id);
                const needed = place?.count || 0;
                const assigned = studentAssignmentsCounts[a.place_id] || 0;
                
                return (
                  <div key={a.id} className="flex justify-between items-center p-3.5 bg-muted/30 rounded-md border border-border hover:border-border/80 transition-colors">
                    <div>
                      <h3 className="font-semibold text-sm text-foreground flex items-center flex-wrap gap-2">
                        {place?.name || 'Unknown Place'}
                        {assigned >= needed && needed > 0 ? (
                           <span className="text-[11px] bg-accent text-accent-foreground px-2 py-0.5 rounded-sm font-semibold">Completed ({assigned}/{needed})</span>
                        ) : assigned > 0 ? (
                           <span className="text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-sm font-semibold">Partial ({assigned}/{needed})</span>
                        ) : (
                           <span className="text-[11px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-sm font-semibold">Not Assigned (0/{needed})</span>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Assigned to: <span className="font-semibold text-primary">{a.class_name}</span></p>
                    </div>
                    <button onClick={() => handleRemove(a)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors" title="Remove assignment">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
