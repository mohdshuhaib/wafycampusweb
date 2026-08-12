'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, MapPin, HeartPulse, CheckCircle2, XCircle, Brush } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { useLoading } from '@/components/ui/loading-provider';

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

type DateRow = { id: string; date: string };

export default function ClientCleaningPage({ 
  places, 
  dates, 
  currentDateId,
  allClasses
}: { 
  places: PlaceData[]; 
  dates: DateRow[]; 
  currentDateId: string;
  allClasses: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useLoading();
  
  const [search, setSearch] = useState('');
  const [filterBlock, setFilterBlock] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterClass, setFilterClass] = useState('All');

  useEffect(() => {
    stopLoading();
  }, [searchParams, stopLoading]);
  
  const blocks = ['All', 'Kitchen Block', 'Academic Block', 'Arham Block', 'Masjid Block', 'Special Block'];
  const statuses = ['All', 'Cleaned', 'Not Cleaned'];
  const classOptions = ['All', ...allClasses];

  const filteredPlaces = places.filter(place => {
    if (filterBlock !== 'All' && place.block !== filterBlock) return false;
    if (filterStatus === 'Cleaned' && !place.cleaned) return false;
    if (filterStatus === 'Not Cleaned' && place.cleaned) return false;
    if (filterClass !== 'All' && place.classAssigned !== filterClass) return false;
    
    if (search) {
      const s = search.toLowerCase();
      const inPlaceName = place.name.toLowerCase().includes(s);
      const inStudent = place.students.some(st => 
        st.name.toLowerCase().includes(s) || st.cicno.toLowerCase().includes(s)
      );
      const inClass = (place.classAssigned || '').toLowerCase().includes(s);
      if (!inPlaceName && !inStudent && !inClass) return false;
    }
    return true;
  }).sort((a, b) => {
    const classA = a.classAssigned || 'ZZZ_Unassigned';
    const classB = b.classAssigned || 'ZZZ_Unassigned';
    if (classA !== classB) {
      return classA.localeCompare(classB);
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 z-10">
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
        
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
          <div className="w-full sm:w-40 flex-1">
            <Select 
              value={currentDateId}
              onChange={(val) => { startLoading(); router.push(`?dateId=${val}`); }}
              placeholder="Date..."
              options={dates.map(d => ({
                value: d.id,
                label: new Date(d.date).toLocaleDateString('en-GB')
              }))}
            />
          </div>
          <div className="w-full sm:w-40 flex-1">
            <Select 
              value={filterClass} 
              onChange={(val) => setFilterClass(val)}
              options={classOptions.map(c => ({ value: c, label: c === 'All' ? 'All Classes' : c }))}
            />
          </div>
          <div className="w-full sm:w-40 flex-1">
            <Select 
              value={filterBlock} 
              onChange={(val) => setFilterBlock(val)}
              options={blocks.map(b => ({ value: b, label: b === 'All' ? 'All Blocks' : b }))}
            />
          </div>
          <div className="w-full sm:w-40 flex-1">
            <Select 
              value={filterStatus} 
              onChange={(val) => setFilterStatus(val)}
              options={statuses.map(s => ({ value: s, label: s === 'All' ? 'All Status' : s }))}
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
        <div className="p-8 text-center bg-white/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
          <Brush className="w-10 h-10 mx-auto text-slate-400 mb-3 opacity-50" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">
            {filterClass !== 'All' 
              ? `No cleaning assigned for Class ${filterClass} today. Have a great day!` 
              : "No places match your search criteria."}
          </p>
        </div>
      ) : (
        <>
        {/* Mobile Cards View */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
          {filteredPlaces.map((place, idx) => (
            <div key={place.id} className="bg-white/60 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-slate-500 mb-1">#{idx + 1} • <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3"/>{place.block}</span></div>
                  <Link href={`/cleaning/${place.id}`} className="font-bold text-lg text-primary hover:underline">
                    {place.name}
                  </Link>
                </div>
                {place.cleaned ? (
                  <span className="inline-flex items-center gap-1 text-success text-xs font-bold bg-success/10 px-2 py-1 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Cleaned
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-danger text-xs font-bold bg-danger/10 px-2 py-1 rounded-md">
                    <XCircle className="w-3 h-3" /> Not Cleaned
                  </span>
                )}
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Assigned To: <span className="text-primary">{place.classAssigned || 'Unassigned'}</span>
                </div>
                {place.students.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {place.students.map(s => (
                      <span key={s.cicno} className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium ${
                        s.status === 'leave' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 
                        s.status === 'medical' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}>
                        {s.name} {s.status !== 'present' && `(${s.status})`}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No specific students assigned yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
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
        </>
      )}
    </div>
  );
}
