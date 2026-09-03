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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <StarOff className="w-6 h-6 text-primary" />
            <span>Exceptional Students</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage students who are exempt from cleaning duties.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sidebar: Add Exceptional Student */}
        <div className="space-y-5">
          <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-foreground">
              <Search className="w-4 h-4 text-primary" /> Find Student
            </h2>
            <div className="relative">
              <input 
                type="text"
                placeholder="Search by name or CIC..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs transition-colors"
              />
              {search.trim() !== '' && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover text-popover-foreground border border-border rounded-md shadow-md overflow-hidden z-20">
                  {searchResults.length > 0 ? (
                    searchResults.map(s => (
                      <div key={s.cicno} className="p-3 border-b border-border last:border-0 hover:bg-accent hover:text-accent-foreground flex justify-between items-center transition-colors">
                        <div>
                          <p className="font-semibold text-xs text-foreground">{s.name}</p>
                          <p className="text-[11px] text-muted-foreground">{s.class} ({s.cicno})</p>
                        </div>
                        <button 
                          onClick={() => handleMakeExceptional(s.cicno)}
                          className="px-2.5 py-1 bg-primary hover:brightness-95 text-primary-foreground text-xs font-semibold rounded-sm transition-colors flex items-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3 h-3" /> Exempt
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      No matching non-exempt students found.
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Exceptional students will not be counted towards class capacities and cannot be assigned to cleaning places.
            </p>
          </div>
        </div>

        {/* Main List */}
        <div className="lg:col-span-2 bg-card text-card-foreground border border-border rounded-lg p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-foreground">Exceptional List</h2>
              <span className="bg-accent text-accent-foreground px-2.5 py-0.5 rounded-sm text-xs font-semibold">
                {exceptionalStudents.length} Students
              </span>
            </div>
            <div className="w-full sm:w-44">
              <Select 
                value={filterClass}
                onChange={setFilterClass}
                options={['All', ...classes].map(c => ({ value: c, label: c === 'All' ? 'All Classes' : c }))}
              />
            </div>
          </div>

          {exceptionalStudents.length === 0 ? (
            <div className="p-8 text-center bg-muted/30 rounded-md border border-dashed border-border">
              <StarOff className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-foreground font-medium text-sm">No exceptional students found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {exceptionalStudents.map(s => (
                <div key={s.cicno} className="flex justify-between items-center p-3.5 bg-muted/30 rounded-md border border-border hover:border-border/80 transition-colors">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">
                      {s.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Class: <span className="font-semibold text-primary">{s.class}</span> • CIC: {s.cicno}</p>
                  </div>
                  <button 
                    onClick={() => handleRemoveExceptional(s.cicno)} 
                    className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors flex items-center gap-1 text-xs font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> <span>Remove</span>
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
