'use client';

import { useState } from 'react';
import { Calendar, ClipboardList, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

type DateRow = { id: string; date: string };
type Place = { id: string; name: string; block: string };
type Assignment = { id: string; class_name: string; place_id: string };

export default function AssignPlacesClient({
  dates,
  currentDateId,
  places,
  assignments,
  classes
}: {
  dates: DateRow[];
  currentDateId: string;
  places: Place[];
  assignments: Assignment[];
  classes: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const supabase = createClient();
  const router = useRouter();

  // Create Date Form
  const [newDateStr, setNewDateStr] = useState(new Date().toISOString().split('T')[0]);

  // Assign Form
  const [selectedPlace, setSelectedPlace] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  const handleCreateDate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    const { data, error } = await supabase.from('cleaning_dates').insert({ date: newDateStr }).select().single();
    if (error) setError(error.message);
    else {
      setSuccess('Created list for date ' + newDateStr);
      router.push(`?dateId=${data.id}`);
    }
    setLoading(false);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDateId) { setError('Select a date first'); return; }
    
    setLoading(true); setError(''); setSuccess('');
    const { error } = await supabase.from('class_assignments').insert({
      date_id: currentDateId,
      place_id: selectedPlace,
      class_name: selectedClass
    });
    
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Assigned successfully');
      setSelectedPlace('');
      setSelectedClass('');
      router.refresh();
    }
    setLoading(false);
  };

  const handleRemove = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('class_assignments').delete().eq('id', id);
    if (error) alert(error.message);
    else router.refresh();
    setLoading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Assign Places</h1>
          <p className="text-slate-600 dark:text-slate-400">Allocate cleaning areas to classes for specific dates.</p>
        </div>
      </div>

      {error && <div className="p-4 bg-danger/10 text-danger rounded-xl flex items-center gap-2"><AlertCircle className="w-5 h-5" /> {error}</div>}
      {success && <div className="p-4 bg-success/10 text-success rounded-xl flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> {success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sidebar Controls */}
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Select Date
            </h2>
            <select 
              className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary"
              value={currentDateId}
              onChange={(e) => router.push(`?dateId=${e.target.value}`)}
            >
              <option value="" disabled>Select a date...</option>
              {dates.map(d => (
                <option key={d.id} value={d.id}>{new Date(d.date).toLocaleDateString()}</option>
              ))}
            </select>
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
              <button disabled={loading} type="submit" className="w-full p-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg font-bold transition-all disabled:opacity-50 hover:bg-slate-700 dark:hover:bg-slate-300">
                Create
              </button>
            </form>
          </div>

          {currentDateId && (
            <div className="glass-panel p-6 border-l-4 border-l-primary bg-primary/5">
              <h2 className="text-xl font-bold mb-4">Assign Class</h2>
              <form onSubmit={handleAssign} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Place</label>
                  <select required value={selectedPlace} onChange={e => setSelectedPlace(e.target.value)} className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary">
                    <option value="" disabled>Select place...</option>
                    {places.map(p => <option key={p.id} value={p.id}>{p.name} ({p.block})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Class</label>
                  <select required value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary">
                    <option value="" disabled>Select class...</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button disabled={loading} type="submit" className="w-full p-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold transition-all disabled:opacity-50">
                  Assign
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Assignments List */}
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex items-center gap-2 mb-6">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Assignments for Selected Date</h2>
          </div>
          
          {!currentDateId ? (
            <p className="text-slate-500 text-center py-8">Please select or create a date to manage assignments.</p>
          ) : assignments.length === 0 ? (
            <div className="p-8 text-center bg-white/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
              <ClipboardList className="w-10 h-10 mx-auto text-slate-400 mb-3 opacity-50" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">No assignments yet for this date.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map(a => {
                const place = places.find(p => p.id === a.place_id);
                return (
                  <div key={a.id} className="flex justify-between items-center p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{place?.name || 'Unknown Place'}</h3>
                      <p className="text-sm text-slate-500">Assigned to: <span className="font-bold text-primary">{a.class_name}</span></p>
                    </div>
                    <button onClick={() => handleRemove(a.id)} disabled={loading} className="p-2 text-danger hover:bg-danger/10 rounded-lg disabled:opacity-50">
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
