'use client';

import { useState } from 'react';
import { Droplets, PenTool, Plus, Trash2, CheckCircle2, AlertCircle, FileUp, MapPin, Edit2, X, Search } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { useToast } from '@/components/ui/toast-provider';
import { useLoading } from '@/components/ui/loading-provider';
import { Select } from '@/components/ui/select';

type Place = { id: string; name: string; block: string; floor: string; count: number; description: string; images_link: string };
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
  const [pFloor, setPFloor] = useState('Ground');
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

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'place' | 'tool' } | null>(null);

  const handleAddPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    startLoading();
    
    if (editingPlaceId) {
      const { error } = await supabase.from('cleaning_places').update({
        name: pName, block: pBlock, floor: pFloor, count: pCount, description: pDesc, images_link: pImages
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
        name: pName, block: pBlock, floor: pFloor, count: pCount, description: pDesc, images_link: pImages
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Place added successfully!');
        resetPlaceForm();
        router.refresh();
      }
    }
    setIsFormModalOpen(false);
    stopLoading();
  };

  const resetPlaceForm = () => {
    setPName(''); setPBlock('Kitchen Block'); setPFloor('Ground'); setPCount(1); setPDesc(''); setPImages('');
    setEditingPlaceId(null);
  };

  const handleEditPlace = (p: Place) => {
    setActiveTab('places');
    setPName(p.name);
    setPBlock(p.block);
    setPFloor(p.floor || 'Ground');
    setPCount(p.count);
    setPDesc(p.description || '');
    setPImages(p.images_link || '');
    setEditingPlaceId(p.id);
    setIsFormModalOpen(true);
  };

  const handleDeletePlaceClick = (id: string) => setItemToDelete({ id, type: 'place' });

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
    setIsFormModalOpen(false);
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
    setIsFormModalOpen(true);
  };

  const handleDeleteToolClick = (id: string) => setItemToDelete({ id, type: 'tool' });

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    startLoading();
    if (itemToDelete.type === 'place') {
      const { error } = await supabase.from('cleaning_places').delete().eq('id', itemToDelete.id);
      if (error) toast.error(error.message);
      else router.refresh();
    } else {
      const { error } = await supabase.from('tools').delete().eq('id', itemToDelete.id);
      if (error) toast.error(error.message);
      else router.refresh();
    }
    setItemToDelete(null);
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
            floor: r.floor || r.Floor || 'Ground',
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

  const floorWeights: Record<string, number> = { 'Ground': 0, 'Floor1': 1, 'Floor2': 2, 'Floor3': 3 };

  const placesByBlock = [...initialPlaces]
    .sort((a, b) => (floorWeights[a.floor] ?? 0) - (floorWeights[b.floor] ?? 0))
    .filter(p => p.name.toLowerCase().includes(placeSearch.toLowerCase()))
    .reduce((acc, place) => {
      if (!acc[place.block]) acc[place.block] = [];
      acc[place.block].push(place);
      return acc;
    }, {} as Record<string, Place[]>);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Manage Resources</h1>
          <p className="text-sm text-muted-foreground">Add or remove campus cleaning places and tools</p>
        </div>
      </div>

      <div className="flex gap-1.5 p-1 bg-secondary rounded-md w-fit">
        <button 
          onClick={() => { setActiveTab('places'); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${activeTab === 'places' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Droplets className="w-3.5 h-3.5" /> Places
        </button>
        <button 
          onClick={() => { setActiveTab('tools'); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${activeTab === 'tools' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <PenTool className="w-3.5 h-3.5" /> Tools
        </button>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-lg p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
            {activeTab === 'places' ? <><Droplets className="w-4 h-4 text-primary" /> Active Places</> : <><PenTool className="w-4 h-4 text-primary" /> Available Tools</>}
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            {activeTab === 'places' && (
              <div className="relative w-full sm:w-60">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground z-10">
                  <Search className="h-3.5 w-3.5" />
                </div>
                <input 
                  type="text"
                  placeholder="Search places..."
                  value={placeSearch}
                  onChange={(e) => setPlaceSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-card border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors shadow-xs"
                />
              </div>
            )}
            <button 
              onClick={() => {
                if (activeTab === 'places') resetPlaceForm();
                else resetToolForm();
                setIsFormModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary hover:brightness-95 text-primary-foreground rounded-md text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add {activeTab === 'places' ? 'Place' : 'Tool'}
            </button>
          </div>
        </div>
          
          <div className="space-y-4">
            {activeTab === 'places' ? (
              initialPlaces.length === 0 ? <p className="text-sm text-muted-foreground">No places added yet.</p> :
              Object.entries(placesByBlock).map(([block, places]) => (
                <div key={block} className="mb-6">
                  <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-1.5 border-b border-border pb-1.5">
                    <MapPin className="w-4 h-4 text-primary" /> {block}
                  </h3>
                  <div className="space-y-2">
                    {places.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-3.5 bg-muted/30 rounded-md border border-border hover:border-border/80 transition-colors">
                        <div>
                          <h4 className="font-medium text-sm text-foreground">{p.name} <span className="text-[11px] font-normal px-2 py-0.5 bg-secondary text-secondary-foreground rounded-sm ml-1.5">{p.floor || 'Ground'}</span></h4>
                          <p className="text-xs text-muted-foreground mt-0.5">Needs {p.count} students</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleEditPlace(p)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" title="Edit Place">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeletePlaceClick(p.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors" title="Delete Place">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              initialTools.length === 0 ? <p className="text-sm text-muted-foreground">No tools added yet.</p> :
              initialTools.map(t => (
                <div key={t.id} className="flex justify-between items-center p-3.5 bg-muted/30 rounded-md border border-border">
                  <div>
                    <h3 className="font-medium text-sm text-foreground">{t.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Available: {t.count}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleEditTool(t)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" title="Edit Tool">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteToolClick(t.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors" title="Delete Tool">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      
      {/* Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in" onClick={() => setIsFormModalOpen(false)}>
          <div 
            className="bg-card text-card-foreground border border-border rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                {activeTab === 'places' ? (
                  editingPlaceId ? <><Edit2 className="w-4 h-4 text-primary" /> Edit Place</> : <><Plus className="w-4 h-4 text-primary" /> Add Place</>
                ) : (
                  editingToolId ? <><Edit2 className="w-4 h-4 text-primary" /> Edit Tool</> : <><Plus className="w-4 h-4 text-primary" /> Add Tool</>
                )}
              </h2>
              <div className="flex gap-1.5">
                <div className="relative cursor-pointer text-xs font-medium text-primary bg-secondary px-2.5 py-1.5 rounded-md hover:bg-secondary/80 flex items-center gap-1.5 transition-colors">
                  <FileUp className="w-3.5 h-3.5" /> CSV
                  <input type="file" accept=".csv" onChange={handleBulkUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Bulk Upload CSV" />
                </div>
                <button onClick={() => setIsFormModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {activeTab === 'places' ? (
              <form onSubmit={handleAddPlace} className="space-y-3.5 text-sm">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Name *</label>
                  <input type="text" required value={pName} onChange={e => setPName(e.target.value)} className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Block *</label>
                  <Select 
                    value={pBlock} 
                    onChange={val => setPBlock(val)} 
                    options={[
                      { value: 'Kitchen Block', label: 'Kitchen Block' },
                      { value: 'Academic Block', label: 'Academic Block' },
                      { value: 'Arham Block', label: 'Arham Block' },
                      { value: 'Masjid Block', label: 'Masjid Block' },
                      { value: 'Special Block', label: 'Special Block' }
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Floor *</label>
                  <Select 
                    value={pFloor} 
                    onChange={val => setPFloor(val)} 
                    options={[
                      { value: 'Ground', label: 'Ground' },
                      { value: 'Floor1', label: 'Floor 1' },
                      { value: 'Floor2', label: 'Floor 2' },
                      { value: 'Floor3', label: 'Floor 3' }
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Students Needed *</label>
                  <input type="number" min="1" required value={pCount} onChange={e => setPCount(parseInt(e.target.value))} className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Drive Image Link</label>
                  <input type="text" value={pImages} onChange={e => setPImages(e.target.value)} className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs" placeholder="https://drive.google.com/..." />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Description</label>
                  <textarea value={pDesc} onChange={e => setPDesc(e.target.value)} className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs" rows={3}></textarea>
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button type="submit" className="flex-1 py-2 px-3 bg-primary hover:brightness-95 text-primary-foreground rounded-md font-medium text-sm transition-colors shadow-xs">
                    {editingPlaceId ? 'Update Place' : 'Add Place'}
                  </button>
                  <button type="button" onClick={() => setIsFormModalOpen(false)} className="py-2 px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium rounded-md text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddTool} className="space-y-3.5 text-sm">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Tool Name *</label>
                  <input type="text" required value={tName} onChange={e => setTName(e.target.value)} className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Quantity Available *</label>
                  <input type="number" min="1" required value={tCount} onChange={e => setTCount(parseInt(e.target.value))} className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Image Link</label>
                  <input type="text" value={tImage} onChange={e => setTImage(e.target.value)} className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs" placeholder="https://..." />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Description</label>
                  <textarea value={tDesc} onChange={e => setTDesc(e.target.value)} className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs" rows={3}></textarea>
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button type="submit" className="flex-1 py-2 px-3 bg-primary hover:brightness-95 text-primary-foreground rounded-md font-medium text-sm transition-colors shadow-xs">
                    {editingToolId ? 'Update Tool' : 'Add Tool'}
                  </button>
                  <button type="button" onClick={() => setIsFormModalOpen(false)} className="py-2 px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium rounded-md text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in" onClick={() => setItemToDelete(null)}>
          <div 
            className="bg-card text-card-foreground border border-border rounded-lg p-6 w-full max-w-sm shadow-lg text-center relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1.5">Confirm Deletion</h3>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Are you sure you want to delete this {itemToDelete.type}? This action cannot be undone.
            </p>
            <div className="flex gap-2.5">
              <button 
                onClick={() => setItemToDelete(null)} 
                className="flex-1 py-2 px-3 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                className="flex-1 py-2 px-3 rounded-md bg-destructive hover:brightness-95 text-destructive-foreground text-xs font-semibold transition-colors shadow-xs"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
