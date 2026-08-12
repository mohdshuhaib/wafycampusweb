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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Assign Places</h1>
          <p className="text-slate-600 dark:text-slate-400">Allocate cleaning areas to classes for specific dates.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sidebar Controls */}
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Select Date
              </h2>
              {currentDateId && (
                <button 
                  onClick={handleDeleteDate}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-danger bg-danger/10 hover:bg-danger/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete List
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

          <div className="glass-panel p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-success" /> New Date List
            </h2>
            <form onSubmit={handleCreateDate} className="space-y-4">
              <input 
                type="date" 
                value={newDateStr}
                onChange={e => setNewDateStr(e.target.value)}
                required
                className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary"
              />
              <button type="submit" className="w-full p-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg font-bold transition-all disabled:opacity-50 hover:bg-slate-700 dark:hover:bg-slate-300">
                Create
              </button>
            </form>
          </div>

          {currentDateId && (
            <div className="glass-panel p-6 border-l-4 border-l-primary bg-primary/5">
              <h2 className="text-xl font-bold mb-4">Assign Class</h2>
              <form onSubmit={handleAssign} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Class</label>
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
                  <label className="text-sm font-medium flex justify-between">
                    Select Places
                    <span className="text-xs text-primary font-bold">
                      {selectedClass ? (
                        <>Allocated: {selectedPlaces.reduce((sum, id) => sum + (places.find(p => p.id === id)?.count || 0), 0)} / {classStudentCounts[selectedClass] || 0}</>
                      ) : (
                        <>{selectedPlaces.length} selected</>
                      )}
                    </span>
                  </label>
                  
                  {/* Block Filter Tabs */}
                  {places.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 mb-2">
                      {['All', ...Array.from(new Set(places.map(p => p.block)))].map(block => (
                        <button
                          key={block}
                          type="button"
                          onClick={() => setActiveBlock(block)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${
                            activeBlock === block 
                              ? 'bg-primary text-white shadow-md' 
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          {block === 'All' ? 'All Blocks' : `${block}`}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {sortedPlaces
                      .filter(p => !assignments.some(a => a.place_id === p.id))
                      .filter(p => activeBlock === 'All' || p.block === activeBlock)
                      .map(p => {
                      const isSelected = selectedPlaces.includes(p.id);
                      return (
                        <div 
                          key={p.id}
                          onClick={() => togglePlace(p.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                            isSelected 
                              ? 'bg-primary text-white border-primary shadow-md' 
                              : 'bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                          }`}
                        >
                          <div>
                            <p className={`font-bold flex items-center flex-wrap gap-2 ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                              {p.name}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-normal ${isSelected ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>{p.floor || 'Ground'}</span>
                            </p>
                            <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>{p.block}</p>
                          </div>
                          <div className={`text-xs font-bold px-2 py-1 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
                            Needs: {p.count}
                          </div>
                        </div>
                      );
                    })}
                    {sortedPlaces
                      .filter(p => !assignments.some(a => a.place_id === p.id))
                      .filter(p => activeBlock === 'All' || p.block === activeBlock)
                      .length === 0 && (
                      <div className="text-center p-4 text-sm text-slate-500 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                        No places available in this block for this date.
                      </div>
                    )}
                  </div>
                </div>

                <button type="submit" className="w-full p-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold transition-all disabled:opacity-50">
                  Assign to Selected Places
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Assignments List */}
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Assignments for Selected Date</h2>
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
                className="w-full sm:w-48"
              />
            )}
          </div>
          
          {!currentDateId ? (
            <p className="text-slate-500 text-center py-8">Please select or create a date to manage assignments.</p>
          ) : assignments.length === 0 ? (
            <div className="p-8 text-center bg-white/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
              <ClipboardList className="w-10 h-10 mx-auto text-slate-400 mb-3 opacity-50" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">No assignments yet for this date.</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="p-8 text-center bg-white/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
              <p className="text-slate-600 dark:text-slate-400 font-medium">No assignments match this filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignments.map(a => {
                const place = places.find(p => p.id === a.place_id);
                const needed = place?.count || 0;
                const assigned = studentAssignmentsCounts[a.place_id] || 0;
                
                return (
                  <div key={a.id} className="flex justify-between items-center p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white flex items-center flex-wrap gap-2">
                        {place?.name || 'Unknown Place'}
                        {assigned >= needed && needed > 0 ? (
                           <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full font-bold">Completed ({assigned}/{needed})</span>
                        ) : assigned > 0 ? (
                           <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">Partial ({assigned}/{needed})</span>
                        ) : (
                           <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full font-bold">Not Assigned (0/{needed})</span>
                        )}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">Assigned to: <span className="font-bold text-primary">{a.class_name}</span></p>
                    </div>
                    <button onClick={() => handleRemove(a)} className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors" title="Remove assignment">
                      <Trash2 className="w-5 h-5" />
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
