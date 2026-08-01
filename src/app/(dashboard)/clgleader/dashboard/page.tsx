import { Users, Building2, Calendar as CalendarIcon, CheckCircle2, TrendingUp } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function CollegeLeaderDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'clgleader') redirect('/');

  // Fetch real stats
  const [
    { count: studentsCount },
    { count: placesCount },
    { count: classesCount },
    { data: latestDate }
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('cleaning_places').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'classleader'),
    supabase.from('cleaning_dates').select('*').order('date', { ascending: false }).limit(1).single()
  ]);

  let todayCleaned = 0;
  let todayTotal = 0;
  if (latestDate) {
    const { data: assignments } = await supabase.from('student_cleaning_assignments').select('place_id, is_cleaned').eq('date_id', latestDate.id);
    if (assignments) {
      // Group by place to see if place is cleaned
      const placeIds = Array.from(new Set(assignments.map(a => a.place_id)));
      todayTotal = placeIds.length;
      todayCleaned = placeIds.filter(pid => assignments.filter(a => a.place_id === pid).some(a => a.is_cleaned)).length;
    }
  }

  const completionRate = todayTotal > 0 ? Math.round((todayCleaned / todayTotal) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">College Overview</h1>
        <p className="text-slate-600 dark:text-slate-400">High-level metrics for campus operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Students</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{studentsCount || 0}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl"><Users className="w-6 h-6 text-blue-500" /></div>
          </div>
        </div>

        <div className="glass-panel p-6 border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Classes</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{classesCount || 0}</h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl"><Building2 className="w-6 h-6 text-purple-500" /></div>
          </div>
        </div>

        <div className="glass-panel p-6 border-l-4 border-l-amber-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Places to Clean</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{placesCount || 0}</h3>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl"><CalendarIcon className="w-6 h-6 text-amber-500" /></div>
          </div>
        </div>

        <div className="glass-panel p-6 border-l-4 border-l-success">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Today's Completion</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{completionRate}%</h3>
            </div>
            <div className="p-3 bg-success/10 rounded-xl"><CheckCircle2 className="w-6 h-6 text-success" /></div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Campus Health
        </h2>
        <div className="p-6 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Today ({latestDate ? new Date(latestDate.date).toLocaleDateString() : 'N/A'}): {todayCleaned} out of {todayTotal} places have been cleaned.
          </p>
        </div>
      </div>
    </div>
  );
}
