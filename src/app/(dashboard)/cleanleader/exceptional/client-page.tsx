'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, StarOff, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useLoading } from '@/components/ui/loading-provider';
import { useToast } from '@/components/ui/toast-provider';
import { Select } from '@/components/ui/select';

type Student = { cicno: string; name: string; class: string; is_exceptional: boolean };

export default function ExceptionalClient({
  students,
  classes
}: {
  students: Student[];
  classes: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const { startLoading, stopLoading } = useLoading();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('All');
  const [localStudents, setLocalStudents] = useState<Student[]>(students);

  useEffect(() => {
    setLocalStudents(students);
  }, [students]);

  // Search Results logic
  const searchResults = search.trim() ? localStudents.filter(s => {
    if (s.is_exceptional) return false; // Don't show already exceptional in search results
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.cicno.includes(q);
  }).slice(0, 5) : []; // Limit to 5 results to avoid huge dropdowns

  // Exceptional list
  const exceptionalStudents = localStudents.filter(s => s.is_exceptional).filter(s => {
    if (filterClass !== 'All' && s.class !== filterClass) return false;
    return true;
  });

  const handleMakeExceptional = async (cicno: string) => {
    startLoading();
    
    // Optimistic Update
    setLocalStudents(prev => prev.map(s => s.cicno === cicno ? { ...s, is_exceptional: true } : s));
    
    const { data, error } = await supabase.from('students').update({ is_exceptional: true }).eq('cicno', cicno).select();
    
    if (error) {
      toast.error(error.message);
      // Revert on error
      setLocalStudents(students);
    } else if (!data || data.length === 0) {
      toast.error('Update failed! RLS policy might be blocking the update.');
      setLocalStudents(students);
    } else {
      toast.success('Student is now marked as Exceptional.');
      setSearch('');
      router.refresh();
    }
    stopLoading();
  };

  const handleRemoveExceptional = async (cicno: string) => {
    startLoading();
    
    // Optimistic Update
    setLocalStudents(prev => prev.map(s => s.cicno === cicno ? { ...s, is_exceptional: false } : s));
    
    const { data, error } = await supabase.from('students').update({ is_exceptional: false }).eq('cicno', cicno).select();
    
    if (error) {
      toast.error(error.message);
      setLocalStudents(students);
    } else if (!data || data.length === 0) {
      toast.error('Update failed! RLS policy might be blocking the update.');
      setLocalStudents(students);
    } else {
      toast.success('Student is no longer Exceptional.');
      router.refresh();
    }
    stopLoading();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <StarOff className="w-8 h-8 text-amber-500" /> Exceptional Students
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage students who are exempt from cleaning duties.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sidebar: Add Exceptional Student */}
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" /> Find Student
            </h2>
            <div className="relative">
              <input 
                type="text"
                placeholder="Search by name or CIC..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-4 pr-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {search.trim() !== '' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-20">
                  {searchResults.length > 0 ? (
                    searchResults.map(s => (
                      <div key={s.cicno} className="p-3 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex justify-between items-center transition-colors">
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.class} ({s.cicno})</p>
                        </div>
                        <button 
                          onClick={() => handleMakeExceptional(s.cicno)}
                          className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Exempt
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No matching non-exempt students found.
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Exceptional students will not be counted towards class capacities and cannot be assigned to cleaning places.
            </p>
          </div>
        </div>

        {/* Main List */}
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">Exceptional List</h2>
              <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-sm font-bold">
                {exceptionalStudents.length} Students
              </span>
            </div>
            <div className="w-full sm:w-48">
              <Select 
                value={filterClass}
                onChange={setFilterClass}
                options={['All', ...classes].map(c => ({ value: c, label: c === 'All' ? 'All Classes' : c }))}
              />
            </div>
          </div>

          {exceptionalStudents.length === 0 ? (
            <div className="p-8 text-center bg-white/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
              <StarOff className="w-10 h-10 mx-auto text-slate-400 mb-3 opacity-50" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">No exceptional students found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exceptionalStudents.map(s => (
                <div key={s.cicno} className="flex justify-between items-center p-4 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-amber-200 dark:border-amber-900/30 hover:border-amber-400 transition-colors">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {s.name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Class: <span className="font-medium text-primary">{s.class}</span> | CIC: {s.cicno}</p>
                  </div>
                  <button 
                    onClick={() => handleRemoveExceptional(s.cicno)} 
                    className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
