'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, BarChart3, X } from 'lucide-react';
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Students Directory</h1>
          <p className="text-slate-600 dark:text-slate-400">
            View student attendance and cleaning performance
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          {dates.length > 0 && (
            <div className="w-full md:w-48">
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
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium transition-all shadow-sm flex-1 md:flex-none"
          >
            <BarChart3 className="w-4 h-4" /> Aggregate Stats
          </button>
        </div>
      </div>

      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 z-10">
              <Search className="h-5 w-5" />
            </div>
            <input 
              type="text"
              placeholder="Search by student name or CIC no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur-sm transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="w-full sm:w-40">
              <Select 
                value={filterClass} 
                onChange={(val) => setFilterClass(val)}
                options={['All', ...classes].map(c => ({ value: c, label: c }))}
              />
            </div>
            <div className="w-full sm:w-40">
              <Select 
                value={filterStatus} 
                onChange={(val) => setFilterStatus(val)}
                options={statuses.map(s => ({ value: s, label: s }))}
              />
            </div>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
            No students found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                <tr>
                  <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300">Name</th>
                  <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300">CIC No</th>
                  <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300">Class</th>
                  <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300">Status (Selected Date)</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.cicno} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-medium">{s.name}</td>
                    <td className="p-4 text-slate-500">{s.cicno}</td>
                    <td className="p-4 font-medium text-slate-700 dark:text-slate-300">{s.class}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        s.status === 'leave' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 
                        s.status === 'medical' ? 'bg-danger/20 text-danger' :
                        s.status === 'present' ? 'bg-success/20 text-success' :
                        'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold">All-Time Aggregate Statistics</h2>
                <p className="text-sm text-slate-500">View overall performance across all recorded dates</p>
              </div>
              <button onClick={() => setShowTotalModal(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Sort by:</span>
              <div className="w-48">
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

            <div className="overflow-y-auto p-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100/50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300">Name & Class</th>
                      <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300 text-center">Present</th>
                      <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300 text-center">Leave</th>
                      <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300 text-center">Medical</th>
                      <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300 text-center">Clean Finished</th>
                      <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300 text-center">Clean Missed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudentsForModal.map((s) => (
                      <tr key={s.cicno} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                          <div className="font-medium text-slate-900 dark:text-white">{s.name}</div>
                          <div className="text-xs text-slate-500">{s.class} ({s.cicno})</div>
                        </td>
                        <td className="p-4 text-center"><span className="inline-block px-2 py-1 bg-success/10 text-success rounded-md font-medium text-sm">{s.stats.present}</span></td>
                        <td className="p-4 text-center"><span className="inline-block px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded-md font-medium text-sm">{s.stats.leave}</span></td>
                        <td className="p-4 text-center"><span className="inline-block px-2 py-1 bg-danger/10 text-danger rounded-md font-medium text-sm">{s.stats.medical}</span></td>
                        <td className="p-4 text-center"><span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-md font-medium text-sm">{s.stats.cleanFinished}</span></td>
                        <td className="p-4 text-center"><span className="inline-block px-2 py-1 bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded-md font-medium text-sm">{s.stats.cleanNotFinished}</span></td>
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
