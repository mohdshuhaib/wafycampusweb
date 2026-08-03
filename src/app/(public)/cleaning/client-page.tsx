'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Search, Filter, MapPin, HeartPulse, CheckCircle2, XCircle, Brush } from 'lucide-react';
import { Select } from '@/components/ui/select';

type StudentAssignment = {
  name: string;
  cicno: string;
  status: string;
};

type PlaceData = {
  id: string;
  name: string;
  block: string;
  classAssigned: string | null;
  students: StudentAssignment[];
  cleaned: boolean;
  count: number;
};

export default function ClientCleaningPage({ places }: { places: PlaceData[] }) {
  const [search, setSearch] = useState('');
  const [filterBlock, setFilterBlock] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  
  const blocks = ['All', 'Kitchen Block', 'Academic Block', 'Arham Block', 'Masjid Block'];
  const statuses = ['All', 'Cleaned', 'Not Cleaned'];

  const filteredPlaces = places.filter(place => {
    if (filterBlock !== 'All' && place.block !== filterBlock) return false;
    if (filterStatus === 'Cleaned' && !place.cleaned) return false;
    if (filterStatus === 'Not Cleaned' && place.cleaned) return false;
    
    if (search) {
      const s = search.toLowerCase();
      const matchName = place.name.toLowerCase().includes(s);
      const matchClass = place.classAssigned?.toLowerCase().includes(s);
      const matchStudent = place.students.some(st => 
        st.name.toLowerCase().includes(s) || st.cicno.includes(s)
      );
      if (!matchName && !matchClass && !matchStudent) return false;
    }
    
    return true;
  });

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="h-5 w-5" />
          </div>
          <input 
            type="text"
            placeholder="Search by student name, CIC no, or place..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur-sm transition-all"
          />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0 items-center">
          <div className="w-48">
            <Select 
              value={filterBlock} 
              onChange={(val) => setFilterBlock(val)}
              options={blocks.map(b => ({ value: b, label: b }))}
            />
          </div>
          <div className="w-48">
            <Select 
              value={filterStatus} 
              onChange={(val) => setFilterStatus(val)}
              options={statuses.map(s => ({ value: s, label: s }))}
            />
          </div>
        </div>
      </div>

      {search && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
           <p className="text-primary font-medium flex justify-center items-center gap-2">
              <HeartPulse className="w-5 h-5" /> 
              {search.toLowerCase().includes('medical') || search.toLowerCase().includes('leave') ? 
                "Student is on Medical/Leave today." : 
                "If you don't see your name, you don't have cleaning today. Enjoy your day with a smile! 😊"}
           </p>
        </div>
      )}

      {places.length === 0 ? (
        <div className="p-8 text-center bg-white/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
          <Brush className="w-10 h-10 mx-auto text-slate-400 mb-3 opacity-50" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">No places available for cleaning today.</p>
        </div>
      ) : filteredPlaces.length === 0 ? (
        <div className="p-8 text-center text-slate-500">No places match your search criteria.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100/50 dark:bg-slate-800/50">
              <tr>
                <th className="p-4 font-semibold">Sl No</th>
                <th className="p-4 font-semibold">Cleaning Place</th>
                <th className="p-4 font-semibold">Block</th>
                <th className="p-4 font-semibold">Assigned To</th>
                <th className="p-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlaces.map((place, idx) => (
                <tr key={place.id} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">{idx + 1}</td>
                  <td className="p-4">
                    <Link href={`/cleaning/${place.id}`} className="font-bold text-primary hover:underline flex items-center gap-2">
                      {place.name}
                    </Link>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 text-sm bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
                      <MapPin className="w-3 h-3" /> {place.block}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <div className="font-medium mb-1">{place.classAssigned || 'Unassigned'}</div>
                      <div className="flex flex-wrap gap-1">
                        {place.students.map(s => (
                          <span key={s.cicno} className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                            s.status === 'leave' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 
                            s.status === 'medical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}>
                            {s.name} ({s.cicno}) {s.status !== 'present' && `- ${s.status}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {place.cleaned ? (
                      <span className="inline-flex items-center gap-1 text-success font-medium bg-success/10 px-3 py-1 rounded-full">
                        <CheckCircle2 className="w-4 h-4" /> Cleaned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-danger font-medium bg-danger/10 px-3 py-1 rounded-full">
                        <XCircle className="w-4 h-4" /> Not Cleaned
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
