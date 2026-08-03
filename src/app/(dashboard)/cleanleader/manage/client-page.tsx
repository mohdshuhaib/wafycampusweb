'use client';

import { useState } from 'react';
import { Droplets, PenTool, Plus, Trash2, CheckCircle2, AlertCircle, FileUp, MapPin, Edit2, X, Search } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { useToast } from '@/components/ui/toast-provider';
import { useLoading } from '@/components/ui/loading-provider';
import { Select } from '@/components/ui/select';

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

  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const { startLoading, stopLoading } = useLoading();

  // Place form
  const [pName, setPName] = useState('');
  const [pBlock, setPBlock] = useState('Kitchen Block');
  const [pCount, setPCount] = useState(1);
  const [pDesc, setPDesc] = useState('');
  const [pImages, setPImages] = useState('');
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [placeSearch, setPlaceSearch] = useState('');

  // Tool form
  const [tName, setTName] = useState('');
  const [tCount, setTCount] = useState(1);
  const [tDesc, setTDesc] = useState('');
  const [tImage, setTImage] = useState('');
  const [editingToolId, setEditingToolId] = useState<string | null>(null);

  const handleAddPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    startLoading();
    
    if (editingPlaceId) {
      const { error } = await supabase.from('cleaning_places').update({
        name: pName, block: pBlock, count: pCount, description: pDesc, images_link: pImages
      }).eq('id', editingPlaceId);
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Place updated successfully!');
        resetPlaceForm();
        router.refresh();
      }
    } else {
      const { error } = await supabase.from('cleaning_places').insert({
        name: pName, block: pBlock, count: pCount, description: pDesc, images_link: pImages
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Place added successfully!');
        resetPlaceForm();
        router.refresh();
      }
    }
    stopLoading();
  };

  const resetPlaceForm = () => {
    setPName(''); setPBlock('Kitchen Block'); setPCount(1); setPDesc(''); setPImages('');
    setEditingPlaceId(null);
  };

  const handleEditPlace = (p: Place) => {
    setActiveTab('places');
    setPName(p.name);
    setPBlock(p.block);
    setPCount(p.count);
    setPDesc(p.description || '');
    setPImages(p.images_link || '');
    setEditingPlaceId(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePlace = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    startLoading();
    const { error } = await supabase.from('cleaning_places').delete().eq('id', id);
    if (error) toast.error(error.message);
    else router.refresh();
    stopLoading();
  };

  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    startLoading();
    
    if (editingToolId) {
      const { error } = await supabase.from('tools').update({
        name: tName, count: tCount, description: tDesc, image_link: tImage
      }).eq('id', editingToolId);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Tool updated successfully!');
        resetToolForm();
        router.refresh();
      }
    } else {
      const { error } = await supabase.from('tools').insert({
        name: tName, count: tCount, description: tDesc, image_link: tImage
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Tool added successfully!');
        resetToolForm();
        router.refresh();
      }
    }
    stopLoading();
  };

  const resetToolForm = () => {
    setTName(''); setTCount(1); setTDesc(''); setTImage('');
    setEditingToolId(null);
  };

  const handleEditTool = (t: Tool) => {
    setActiveTab('tools');
    setTName(t.name);
    setTCount(t.count);
    setTDesc(t.description || '');
    setTImage(t.image_link || '');
    setEditingToolId(t.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTool = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    startLoading();
    const { error } = await supabase.from('tools').delete().eq('id', id);
    if (error) toast.error(error.message);
    else router.refresh();
    stopLoading();
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    startLoading();

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
            toast.error('No valid data found for places. Ensure "name" column exists.');
            stopLoading(); return;
          }

          const { error: insertError } = await supabase.from('cleaning_places').insert(toInsert);
          if (insertError) {
            toast.error(insertError.message);
          } else { 
            toast.success(`Added ${toInsert.length} places!`); 
            router.refresh(); 
          }
        } else {
          const toInsert = rows.map(r => ({
            name: r.name || r.Name || '',
            count: parseInt(r.count || r.Count || r.quantity || r.Quantity) || 1,
            description: r.description || r.Description || '',
            image_link: r.image_link || r.image || r.Image || ''
          })).filter(r => r.name.trim() !== '');

          if (toInsert.length === 0) {
            toast.error('No valid data found for tools. Ensure "name" column exists.');
            stopLoading(); return;
          }

          const { error: insertError } = await supabase.from('tools').insert(toInsert);
          if (insertError) {
            toast.error(insertError.message);
          } else { 
            toast.success(`Added ${toInsert.length} tools!`); 
            router.refresh(); 
          }
        }
        stopLoading();
        e.target.value = '';
      },
      error: (err) => { toast.error(err.message); stopLoading(); }
    });
  };

  const placesByBlock = initialPlaces
    .filter(p => p.name.toLowerCase().includes(placeSearch.toLowerCase()))
    .reduce((acc, place) => {
      if (!acc[place.block]) acc[place.block] = [];
      acc[place.block].push(place);
      return acc;
    }, {} as Record<string, Place[]>);

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
          onClick={() => { setActiveTab('places'); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'places' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
        >
          <Droplets className="w-4 h-4" /> Places
        </button>
        <button 
          onClick={() => { setActiveTab('tools'); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'tools' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
        >
          <PenTool className="w-4 h-4" /> Tools
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* List View */}
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {activeTab === 'places' ? <><Droplets className="w-5 h-5 text-primary" /> Active Places</> : <><PenTool className="w-5 h-5 text-primary" /> Available Tools</>}
            </h2>
            {activeTab === 'places' && (
              <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 z-10">
                  <Search className="h-4 w-4" />
                </div>
                <input 
                  type="text"
                  placeholder="Search places..."
                  value={placeSearch}
                  onChange={(e) => setPlaceSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur-sm transition-all"
                />
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            {activeTab === 'places' ? (
              initialPlaces.length === 0 ? <p className="text-slate-500">No places added yet.</p> :
              Object.entries(placesByBlock).map(([block, places]) => (
                <div key={block} className="mb-8">
                  <h3 className="font-bold text-lg text-primary mb-4 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <MapPin className="w-5 h-5" /> {block}
                  </h3>
                  <div className="space-y-3">
                    {places.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white">{p.name}</h4>
                          <p className="text-sm text-slate-500">Needs {p.count} students</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditPlace(p)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit Place">
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleDeletePlace(p.id)} className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors" title="Delete Place">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  <div className="flex gap-2">
                    <button onClick={() => handleEditTool(t)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit Tool">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDeleteTool(t.id)} className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors" title="Delete Tool">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Form */}
        <div className="glass-panel p-6 bg-gradient-to-br from-primary/5 to-transparent h-fit sticky top-24">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {activeTab === 'places' ? (
                editingPlaceId ? <><Edit2 className="w-5 h-5 text-primary" /> Edit Place</> : <><Plus className="w-5 h-5 text-primary" /> Add Place</>
              ) : (
                editingToolId ? <><Edit2 className="w-5 h-5 text-primary" /> Edit Tool</> : <><Plus className="w-5 h-5 text-primary" /> Add Tool</>
              )}
            </h2>
            <div className="relative cursor-pointer text-sm font-medium text-primary bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
              <FileUp className="w-4 h-4" /> CSV
              <input type="file" accept=".csv" onChange={handleBulkUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
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
                <Select 
                  value={pBlock} 
                  onChange={val => setPBlock(val)} 
                  options={[
                    { value: 'Kitchen Block', label: 'Kitchen Block' },
                    { value: 'Academic Block', label: 'Academic Block' },
                    { value: 'Arham Block', label: 'Arham Block' },
                    { value: 'Masjid Block', label: 'Masjid Block' }
                  ]}
                />
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
              <div className="flex gap-3">
                <button type="submit" className="flex-1 p-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold transition-all shadow-sm">
                  {editingPlaceId ? 'Update Place' : 'Add Place'}
                </button>
                {editingPlaceId && (
                  <button type="button" onClick={resetPlaceForm} className="p-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
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
              <div className="flex gap-3">
                <button type="submit" className="flex-1 p-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold transition-all shadow-sm">
                  {editingToolId ? 'Update Tool' : 'Add Tool'}
                </button>
                {editingToolId && (
                  <button type="button" onClick={resetToolForm} className="p-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
