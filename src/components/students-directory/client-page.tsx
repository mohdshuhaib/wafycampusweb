'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, BarChart3, X } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { useLoading } from '@/components/ui/loading-provider';

export type StudentData = {
  cicno: string;
  name: string;
  class: string;
  status: string; // current date status
  stats: {
    present: number;
    leave: number;
    medical: number;
    cleanFinished: number;
    cleanNotFinished: number;
  };
};

export default function StudentsDirectoryClient({
  dates,
  currentDateId,
  students,
  classes
}: {
  dates: { id: string; date: string }[];
  currentDateId: string;
  students: StudentData[];
  classes: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useLoading();
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showTotalModal, setShowTotalModal] = useState(false);
  const [sortStat, setSortStat] = useState<'name' | 'present' | 'leave' | 'medical' | 'cleanFinished' | 'cleanNotFinished'>('name');

  useEffect(() => {
    stopLoading();
  }, [searchParams, stopLoading]);

  const filteredStudents = students.filter(s => {
    if (filterClass !== 'All' && s.class !== filterClass) return false;
    if (filterStatus !== 'All' && s.status !== filterStatus.toLowerCase()) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.cicno.includes(q)) return false;
    }
    return true;
  });

  const sortedStudentsForModal = [...students].sort((a, b) => {
    if (sortStat === 'name') return a.name.localeCompare(b.name);
    return b.stats[sortStat] - a.stats[sortStat];
  });

  const statuses = ['All', 'Present', 'Leave', 'Medical'];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Students Directory</h1>
          <p className="text-sm text-muted-foreground">
            View student attendance and cleaning performance
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
          {dates.length > 0 && (
            <div className="w-full md:w-44">
              <Select 
                value={currentDateId}
                onChange={(val) => { startLoading(); router.push(`?dateId=${val}`); }}
                placeholder="Select date..."
                options={dates.map(d => ({
                  value: d.id,
                  label: new Date(d.date).toLocaleDateString('en-GB')
                }))}
              />
            </div>
          )}
          <button 
            onClick={() => setShowTotalModal(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:brightness-95 text-primary-foreground rounded-md font-medium text-xs transition-colors shadow-xs flex-1 md:flex-none"
          >
            <BarChart3 className="w-3.5 h-3.5" /> Aggregate Stats
          </button>
        </div>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-lg p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground z-10">
              <Search className="h-4 w-4" />
            </div>
            <input 
              type="text"
              placeholder="Search by student name or CIC no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-card border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors shadow-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2.5 items-center">
            <div className="w-full sm:w-36">
              <Select 
                value={filterClass} 
                onChange={(val) => setFilterClass(val)}
                options={['All', ...classes].map(c => ({ value: c, label: c }))}
              />
            </div>
            <div className="w-full sm:w-36">
              <Select 
                value={filterStatus} 
                onChange={(val) => setFilterStatus(val)}
                options={statuses.map(s => ({ value: s, label: s }))}
              />
            </div>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-md bg-muted/20">
            No students found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">CIC No</th>
                  <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Class</th>
                  <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Status (Selected Date)</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.cicno} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">{s.name}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{s.cicno}</td>
                    <td className="py-3 px-4 text-xs font-medium text-foreground">{s.class}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold ${
                        s.status === 'leave' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 
                        s.status === 'medical' ? 'bg-destructive/10 text-destructive' :
                        s.status === 'present' ? 'bg-accent text-accent-foreground' :
                        'bg-secondary text-secondary-foreground'
                      }`}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTotalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card text-card-foreground border border-border rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col shadow-lg animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/40 rounded-t-lg">
              <div>
                <h2 className="text-base font-semibold text-foreground">All-Time Aggregate Statistics</h2>
                <p className="text-xs text-muted-foreground mt-0.5">View overall performance across all recorded dates</p>
              </div>
              <button onClick={() => setShowTotalModal(false)} className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-border flex flex-wrap items-center gap-3 bg-card">
              <span className="text-xs font-medium text-muted-foreground">Sort by:</span>
              <div className="w-44">
                <Select 
                  value={sortStat} 
                  onChange={(val) => setSortStat(val as any)}
                  options={[
                    { value: 'name', label: 'Name (A-Z)' },
                    { value: 'present', label: 'Most Presents' },
                    { value: 'leave', label: 'Most Leaves' },
                    { value: 'medical', label: 'Most Medicals' },
                    { value: 'cleanFinished', label: 'Most Cleans Finished' },
                    { value: 'cleanNotFinished', label: 'Most Cleans Missed' },
                  ]}
                />
              </div>
            </div>

            <div className="overflow-y-auto p-4">
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-muted/50 border-b border-border sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Name & Class</th>
                      <th className="py-2.5 px-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider text-center">Present</th>
                      <th className="py-2.5 px-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider text-center">Leave</th>
                      <th className="py-2.5 px-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider text-center">Medical</th>
                      <th className="py-2.5 px-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider text-center">Clean Finished</th>
                      <th className="py-2.5 px-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider text-center">Clean Missed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudentsForModal.map((s) => (
                      <tr key={s.cicno} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors text-xs">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-foreground">{s.name}</div>
                          <div className="text-[11px] text-muted-foreground">{s.class} ({s.cicno})</div>
                        </td>
                        <td className="py-2.5 px-3 text-center"><span className="inline-block px-2 py-0.5 bg-accent text-accent-foreground rounded-sm font-semibold">{s.stats.present}</span></td>
                        <td className="py-2.5 px-3 text-center"><span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 rounded-sm font-semibold">{s.stats.leave}</span></td>
                        <td className="py-2.5 px-3 text-center"><span className="inline-block px-2 py-0.5 bg-destructive/10 text-destructive rounded-sm font-semibold">{s.stats.medical}</span></td>
                        <td className="py-2.5 px-3 text-center"><span className="inline-block px-2 py-0.5 bg-primary/10 text-primary rounded-sm font-semibold">{s.stats.cleanFinished}</span></td>
                        <td className="py-2.5 px-3 text-center"><span className="inline-block px-2 py-0.5 bg-secondary text-secondary-foreground rounded-sm font-semibold">{s.stats.cleanNotFinished}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
