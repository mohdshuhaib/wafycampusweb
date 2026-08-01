'use client';

import { useState } from 'react';
import { Droplets, PenTool, Plus, Trash2, CheckCircle2, AlertCircle, FileUp } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';

type Place = { id: string; name: string; block: string; count: number; description: string; images_link: string };
type Tool = { id: string; name: string; count: number; description: string; image_link: string };

export default function ManagePlacesToolsClient({
  initialPlaces,
  initialTools
}: {
  initialPlaces: Place[];
  initialTools: Tool[];
}) {
  const [activeTab, setActiveTab] = useState<'places' | 'tools'>('places');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const supabase = createClient();
  const router = useRouter();

  // Place form
  const [pName, setPName] = useState('');
  const [pBlock, setPBlock] = useState('Kitchen Block');
  const [pCount, setPCount] = useState(1);
  const [pDesc, setPDesc] = useState('');
  const [pImages, setPImages] = useState('');

  // Tool form
  const [tName, setTName] = useState('');
  const [tCount, setTCount] = useState(1);
  const [tDesc, setTDesc] = useState('');
  const [tImage, setTImage] = useState('');

  const handleAddPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    const { error } = await supabase.from('cleaning_places').insert({
      name: pName, block: pBlock, count: pCount, description: pDesc, images_link: pImages
    });
    if (error) setError(error.message);
    else {
      setSuccess(`Place added successfully!`);
      setPName(''); setPBlock('Kitchen Block'); setPCount(1); setPDesc(''); setPImages('');
      router.refresh();
    }
    setLoading(false);
  };

  const handleDeletePlace = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    setLoading(true);
    const { error } = await supabase.from('cleaning_places').delete().eq('id', id);
    if (error) alert(error.message);
    else router.refresh();
    setLoading(false);
  };

  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    const { error } = await supabase.from('tools').insert({
      name: tName, count: tCount, description: tDesc, image_link: tImage
    });
    if (error) setError(error.message);
    else {
      setSuccess(`Tool added successfully!`);
      setTName(''); setTCount(1); setTDesc(''); setTImage('');
      router.refresh();
    }
    setLoading(false);
  };

  const handleDeleteTool = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    setLoading(true);
    const { error } = await supabase.from('tools').delete().eq('id', id);
    if (error) alert(error.message);
    else router.refresh();
    setLoading(false);
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true); setError(''); setSuccess('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        
        if (activeTab === 'places') {
          const toInsert = rows.map(r => ({
            name: r.name || r.Name || '',
            block: r.block || r.Block || 'Kitchen Block',
            count: parseInt(r.count || r.Count || r.students || r.Students) || 1,
            description: r.description || r.Description || '',
            images_link: r.images_link || r.image || r.Image || ''
          })).filter(r => r.name.trim() !== '');

          if (toInsert.length === 0) {
            setError('No valid data found for places. Ensure "name" column exists.');
            setLoading(false); return;
          }

          const { error: insertError } = await supabase.from('cleaning_places').insert(toInsert);
          if (insertError) setError(insertError.message);
          else { setSuccess(`Added ${toInsert.length} places!`); router.refresh(); }
        } else {
          const toInsert = rows.map(r => ({
            name: r.name || r.Name || '',
            count: parseInt(r.count || r.Count || r.quantity || r.Quantity) || 1,
            description: r.description || r.Description || '',
            image_link: r.image_link || r.image || r.Image || ''
          })).filter(r => r.name.trim() !== '');

          if (toInsert.length === 0) {
            setError('No valid data found for tools. Ensure "name" column exists.');
            setLoading(false); return;
          }

          const { error: insertError } = await supabase.from('tools').insert(toInsert);
          if (insertError) setError(insertError.message);
          else { setSuccess(`Added ${toInsert.length} tools!`); router.refresh(); }
        }
        setLoading(false);
        e.target.value = '';
      },
      error: (err) => { setError(err.message); setLoading(false); }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Manage Resources</h1>
          <p className="text-slate-600 dark:text-slate-400">Add or remove cleaning places and tools</p>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl w-fit">
        <button 
          onClick={() => { setActiveTab('places'); setError(''); setSuccess(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'places' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
        >
          <Droplets className="w-4 h-4" /> Places
        </button>
        <button 
          onClick={() => { setActiveTab('tools'); setError(''); setSuccess(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'tools' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
        >
          <PenTool className="w-4 h-4" /> Tools
        </button>
      </div>

      {error && <div className="p-4 bg-danger/10 text-danger rounded-xl flex items-center gap-2"><AlertCircle className="w-5 h-5" /> {error}</div>}
      {success && <div className="p-4 bg-success/10 text-success rounded-xl flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> {success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* List View */}
        <div className="lg:col-span-2 glass-panel p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            {activeTab === 'places' ? <><Droplets className="w-5 h-5 text-primary" /> Active Places</> : <><PenTool className="w-5 h-5 text-primary" /> Available Tools</>}
          </h2>
          
          <div className="space-y-4">
            {activeTab === 'places' ? (
              initialPlaces.length === 0 ? <p className="text-slate-500">No places added yet.</p> :
              initialPlaces.map(p => (
                <div key={p.id} className="flex justify-between items-center p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{p.name}</h3>
                    <p className="text-sm text-slate-500">{p.block} • Needs {p.count} students</p>
                  </div>
                  <button onClick={() => handleDeletePlace(p.id)} disabled={loading} className="p-2 text-danger hover:bg-danger/10 rounded-lg disabled:opacity-50"><Trash2 className="w-5 h-5" /></button>
                </div>
              ))
            ) : (
              initialTools.length === 0 ? <p className="text-slate-500">No tools added yet.</p> :
              initialTools.map(t => (
                <div key={t.id} className="flex justify-between items-center p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{t.name}</h3>
                    <p className="text-sm text-slate-500">Available: {t.count}</p>
                  </div>
                  <button onClick={() => handleDeleteTool(t.id)} disabled={loading} className="p-2 text-danger hover:bg-danger/10 rounded-lg disabled:opacity-50"><Trash2 className="w-5 h-5" /></button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Form */}
        <div className="glass-panel p-6 bg-gradient-to-br from-primary/5 to-transparent h-fit sticky top-24">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Add {activeTab === 'places' ? 'Place' : 'Tool'}
            </h2>
            <div className="relative cursor-pointer text-sm font-medium text-primary bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
              <FileUp className="w-4 h-4" /> CSV
              <input type="file" accept=".csv" onChange={handleBulkUpload} disabled={loading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
            </div>
          </div>

          {activeTab === 'places' ? (
            <form onSubmit={handleAddPlace} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name *</label>
                <input type="text" required value={pName} onChange={e => setPName(e.target.value)} className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Block *</label>
                <select value={pBlock} onChange={e => setPBlock(e.target.value)} className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                  <option>Kitchen Block</option>
                  <option>Academic Block</option>
                  <option>Arham Block</option>
                  <option>Masjid Block</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Students Needed *</label>
                <input type="number" min="1" required value={pCount} onChange={e => setPCount(parseInt(e.target.value))} className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Drive Image Link</label>
                <input type="text" value={pImages} onChange={e => setPImages(e.target.value)} className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://drive.google.com/..." />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Description</label>
                <textarea value={pDesc} onChange={e => setPDesc(e.target.value)} className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" rows={3}></textarea>
              </div>
              <button disabled={loading} type="submit" className="w-full p-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold transition-all disabled:opacity-50">
                {loading ? 'Adding...' : 'Add Place'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddTool} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Tool Name *</label>
                <input type="text" required value={tName} onChange={e => setTName(e.target.value)} className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Quantity Available *</label>
                <input type="number" min="1" required value={tCount} onChange={e => setTCount(parseInt(e.target.value))} className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Image Link</label>
                <input type="text" value={tImage} onChange={e => setTImage(e.target.value)} className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Description</label>
                <textarea value={tDesc} onChange={e => setTDesc(e.target.value)} className="w-full p-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" rows={3}></textarea>
              </div>
              <button disabled={loading} type="submit" className="w-full p-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold transition-all disabled:opacity-50">
                {loading ? 'Adding...' : 'Add Tool'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
