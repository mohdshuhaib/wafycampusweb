'use client';

import { BarChart3, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';

type DateRow = { id: string; date: string };
type PlaceData = { id: string; name: string; block: string; assignedCount: number; cleaned: boolean };

export default function StatusClient({
  dates,
  currentDate,
  placesData
}: {
  dates: DateRow[];
  currentDate: DateRow | null;
  placesData: PlaceData[];
}) {
  const router = useRouter();
  
  const cleanedCount = placesData.filter(p => p.cleaned).length;
  const totalCount = placesData.filter(p => p.assignedCount > 0).length;
  const progress = totalCount > 0 ? Math.round((cleanedCount / totalCount) * 100) : 0;

  const assignedPlaces = placesData.filter(p => p.assignedCount > 0);
  const unassignedPlaces = placesData.filter(p => p.assignedCount === 0);

  // Group unassigned places by block
  const unassignedByBlock: Record<string, PlaceData[]> = {};
  unassignedPlaces.forEach(p => {
    if (!unassignedByBlock[p.block]) unassignedByBlock[p.block] = [];
    unassignedByBlock[p.block].push(p);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Live Status</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Monitoring cleaning progress and status
          </p>
        </div>
        
        {dates.length > 0 && (
          <div className="w-full md:w-64">
            <Select 
              value={currentDate?.id || ''}
              onChange={(val) => router.push(`?dateId=${val}`)}
              placeholder="Select a date..."
              options={dates.map(d => ({
                value: d.id,
                label: new Date(d.date).toLocaleDateString('en-GB')
              }))}
            />
          </div>
        )}
      </div>

      {!currentDate ? (
        <div className="p-8 text-center text-slate-500 glass-panel">Please create a date in Assign Places first.</div>
      ) : (
        <>
          <div className="glass-panel p-6 mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Overall Progress for {new Date(currentDate.date).toLocaleDateString('en-GB')}
            </h2>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 mb-2 overflow-hidden">
              <div 
                className="bg-primary h-4 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {cleanedCount} of {totalCount} assigned places cleaned ({progress}%)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedPlaces.map(place => (
              <div key={place.id} className="glass-panel p-6 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{place.name}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {place.block}
                    </p>
                  </div>
                  {place.cleaned ? (
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  ) : (
                    <XCircle className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm font-medium">
                  <span className="text-slate-600 dark:text-slate-400">Status</span>
                  {place.cleaned ? (
                    <span className="text-success bg-success/10 px-2 py-1 rounded">Cleaned</span>
                  ) : (
                    <span className="text-amber-500 bg-amber-500/10 px-2 py-1 rounded">In Progress</span>
                  )}
                </div>
              </div>
            ))}
          </div>
            
          {unassignedPlaces.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Unassigned Places</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(unassignedByBlock).map(([block, places]) => (
                  <div key={block} className="glass-panel p-6">
                    <h4 className="font-bold text-primary flex items-center gap-2 mb-4">
                      <MapPin className="w-4 h-4" /> {block}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {places.map(p => (
                        <span key={p.id} className="text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg shadow-sm">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
