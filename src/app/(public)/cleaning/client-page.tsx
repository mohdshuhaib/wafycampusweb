'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, MapPin, HeartPulse, CheckCircle2, XCircle, Brush, Clock } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { useLoading } from '@/components/ui/loading-provider';

type StudentAssignment = {
  name: string;
  cicno: string;
  status: string;
  is_cleaned?: boolean;
};

type PlaceData = {
  id: string;
  name: string;
  block: string;
  classAssigned: string | null;
  students: StudentAssignment[];
  cleaned: boolean;
  count: number;
  assignedCount?: number;
  cleanedCount?: number;
  isFullCleaned?: boolean;
  isPartiallyCleaned?: boolean;
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
  const statuses = ['All', 'Cleaned', 'Partially Cleaned', 'Not Cleaned'];
  const classOptions = ['All', ...allClasses];

  const filteredPlaces = places.filter(place => {
    if (filterBlock !== 'All' && place.block !== filterBlock) return false;
    
    const isFull = place.isFullCleaned ?? place.cleaned;
    const isPartial = place.isPartiallyCleaned;

    if (filterStatus === 'Cleaned' && !isFull) return false;
    if (filterStatus === 'Partially Cleaned' && !isPartial) return false;
    if (filterStatus === 'Not Cleaned' && (isFull || isPartial)) return false;

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
    <div className="bg-card text-card-foreground border border-border rounded-lg p-5 sm:p-6 space-y-6 shadow-xs">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground z-10">
            <Search className="h-4 w-4" />
          </div>
          <input 
            type="text"
            placeholder="Search by student name, CIC no, or place..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors shadow-xs"
          />
        </div>
        
        <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
          <div className="w-full sm:w-36 flex-1">
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
          <div className="w-full sm:w-36 flex-1">
            <Select 
              value={filterClass} 
              onChange={(val) => setFilterClass(val)}
              options={classOptions.map(c => ({ value: c, label: c === 'All' ? 'All Classes' : c }))}
            />
          </div>
          <div className="w-full sm:w-36 flex-1">
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
        <div className="bg-accent/40 border border-accent rounded-md p-3 text-center">
           <p className="text-accent-foreground text-xs font-medium flex justify-center items-center gap-2">
              <HeartPulse className="w-4 h-4" /> 
              {search.toLowerCase().includes('medical') || search.toLowerCase().includes('leave') ? 
                "Student is on Medical/Leave today." : 
                "If you don't see your name, you don't have cleaning today. Enjoy your day with a smile! 😊"}
           </p>
        </div>
      )}

      {places.length === 0 ? (
        <div className="p-8 text-center bg-muted/30 rounded-md border border-dashed border-border">
          <Brush className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
          <p className="text-foreground font-medium text-sm">No places available for cleaning today.</p>
        </div>
      ) : filteredPlaces.length === 0 ? (
        <div className="p-8 text-center bg-muted/30 rounded-md border border-dashed border-border">
          <Brush className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
          <p className="text-foreground font-medium text-sm">
            {filterClass !== 'All' 
              ? `No cleaning assigned for Class ${filterClass} today. Have a great day!` 
              : "No places match your search criteria."}
          </p>
        </div>
      ) : (
        <>
        {/* Mobile Cards View */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
          {filteredPlaces.map((place, idx) => {
            const isFull = place.isFullCleaned ?? place.cleaned;
            const isPartial = place.isPartiallyCleaned;

            return (
              <div key={place.id} className="bg-card text-card-foreground p-4 rounded-lg border border-border shadow-xs flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">#{idx + 1} • <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3"/>{place.block}</span></div>
                    <Link href={`/cleaning/${place.id}`} className="font-semibold text-base text-primary hover:underline">
                      {place.name}
                    </Link>
                  </div>
                  {isFull ? (
                    <span className="inline-flex items-center gap-1 text-accent-foreground text-xs font-semibold bg-accent px-2 py-0.5 rounded-sm">
                      <CheckCircle2 className="w-3 h-3" /> Cleaned
                    </span>
                  ) : isPartial ? (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-semibold bg-amber-500/15 px-2 py-0.5 rounded-sm">
                      <Clock className="w-3 h-3" /> Partial ({place.cleanedCount}/{place.assignedCount || place.students.length})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-destructive text-xs font-semibold bg-destructive/10 px-2 py-0.5 rounded-sm">
                      <XCircle className="w-3 h-3" /> Not Cleaned
                    </span>
                  )}
                </div>
                
                <div className="bg-muted/40 p-3 rounded-md border border-border">
                  <div className="text-xs font-semibold text-foreground mb-1.5">
                    Assigned To: <span className="text-primary font-bold">{place.classAssigned || 'Unassigned'}</span>
                  </div>
                  {place.students.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {place.students.map(s => (
                        <span key={s.cicno} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium ${
                          s.is_cleaned 
                            ? 'bg-accent text-accent-foreground font-semibold'
                            : s.status === 'leave' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' 
                            : s.status === 'medical' ? 'bg-destructive/10 text-destructive' 
                            : 'bg-secondary text-secondary-foreground'
                        }`}>
                          {s.is_cleaned && <CheckCircle2 className="w-2.5 h-2.5 text-accent-foreground" />}
                          {s.name} {s.status !== 'present' && `(${s.status})`}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No specific students assigned yet.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sl No</th>
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cleaning Place</th>
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Block</th>
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned To</th>
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlaces.map((place, idx) => {
                const isFull = place.isFullCleaned ?? place.cleaned;
                const isPartial = place.isPartiallyCleaned;

                return (
                  <tr key={place.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <Link href={`/cleaning/${place.id}`} className="font-semibold text-primary hover:underline flex items-center gap-1.5">
                        {place.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-sm font-medium">
                        <MapPin className="w-3 h-3" /> {place.block}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs">
                        <div className="font-semibold text-foreground mb-1">{place.classAssigned || 'Unassigned'}</div>
                        <div className="flex flex-wrap gap-1">
                          {place.students.map(s => (
                            <span key={s.cicno} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium ${
                              s.is_cleaned
                                ? 'bg-accent text-accent-foreground font-semibold'
                                : s.status === 'leave' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' 
                                : s.status === 'medical' ? 'bg-destructive/10 text-destructive' 
                                : 'bg-secondary text-secondary-foreground'
                            }`}>
                              {s.is_cleaned && <CheckCircle2 className="w-3 h-3 text-accent-foreground" />}
                              {s.name} ({s.cicno}) {s.status !== 'present' ? `- ${s.status}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {isFull ? (
                        <span className="inline-flex items-center gap-1 text-accent-foreground text-xs font-semibold bg-accent px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cleaned
                        </span>
                      ) : isPartial ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-semibold bg-amber-500/15 px-2.5 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5" /> Partial ({place.cleanedCount}/{place.assignedCount || place.students.length})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs font-semibold bg-destructive/10 px-2.5 py-1 rounded-full">
                          <XCircle className="w-3.5 h-3.5" /> Not Cleaned
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
