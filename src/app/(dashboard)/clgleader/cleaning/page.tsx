import { FileText, CheckCircle2, XCircle, Users, CheckCircle, Droplets } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function CollegeLeaderCleaningReport() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'clgleader') redirect('/');

  // 1. Get Latest Date
  const { data: latestDate } = await supabase.from('cleaning_dates').select('*').order('date', { ascending: false }).limit(1).single();

  let reports: any[] = [];
  let classesAssigned = 0;
  let placesCleaned = 0;
  let placesNotCleaned = 0;
  let leftToAssign = 0;
  
  if (latestDate) {
    const { data: places } = await supabase.from('cleaning_places').select('id, name, block');
    const { data: assignments } = await supabase.from('student_cleaning_assignments').select('*, students(name, class)').eq('date_id', latestDate.id);
    
    if (places && assignments) {
      reports = places.map(p => {
        const pAssigns = assignments.filter(a => a.place_id === p.id);
        const isCleaned = pAssigns.length > 0 && pAssigns.some(a => a.is_cleaned);
        const classesInvolved = Array.from(new Set(pAssigns.map(a => {
          const student: any = Array.isArray(a.students) ? a.students[0] : a.students;
          return student?.class;
        }).filter(Boolean)));
        
        if (isCleaned) placesCleaned++;
        else placesNotCleaned++;
        
        if (classesInvolved.length === 0) leftToAssign++;

        return {
          id: p.id,
          place: p.name,
          block: p.block,
          class: classesInvolved.join(', ') || 'Unassigned',
          status: isCleaned ? 'Cleaned' : 'Not Cleaned',
          time: isCleaned ? 'Reported' : 'Pending'
        };
      });
      
      classesAssigned = new Set(assignments.map(a => {
        const student: any = Array.isArray(a.students) ? a.students[0] : a.students;
        return student?.class;
      }).filter(Boolean)).size;
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Cleaning Report</h1>
          <p className="text-slate-600 dark:text-slate-400">Detailed logs for {latestDate ? new Date(latestDate.date).toLocaleDateString() : 'no active dates'}.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors">
          <FileText className="w-4 h-4" /> Export PDF
        </button>
      </div>

      <div className="glass-panel p-6">
        {reports.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No data to display. Ensure Cleaning Leaders have generated assignments for today.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                <tr>
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Place</th>
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Block</th>
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Class Assigned</th>
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Time</th>
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-4 font-medium text-slate-900 dark:text-white">{row.place}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">{row.block}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">{row.class}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">{row.time}</td>
                    <td className="p-4">
                      {row.status === 'Cleaned' ? (
                        <span className="inline-flex items-center gap-1 text-success font-medium bg-success/10 px-3 py-1 rounded-full text-sm">
                          <CheckCircle2 className="w-4 h-4" /> Cleaned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-danger font-medium bg-danger/10 px-3 py-1 rounded-full text-sm">
                          <XCircle className="w-4 h-4" /> Pending
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
          <div className="flex justify-between items-start mb-2">
            <p className="text-blue-800 dark:text-blue-300 font-medium">Classes Active</p>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{classesAssigned}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800/30">
          <div className="flex justify-between items-start mb-2">
            <p className="text-green-800 dark:text-green-300 font-medium">Places Cleaned</p>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-900 dark:text-green-100">{placesCleaned}</p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800/30">
          <div className="flex justify-between items-start mb-2">
            <p className="text-red-800 dark:text-red-300 font-medium">Places Not Cleaned</p>
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-red-900 dark:text-red-100">{placesNotCleaned}</p>
        </div>
        
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
          <div className="flex justify-between items-start mb-2">
            <p className="text-amber-800 dark:text-amber-300 font-medium">Left to Assign</p>
            <Droplets className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-amber-900 dark:text-amber-100">{leftToAssign}</p>
        </div>
      </div>
    </div>
  );
}
