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
      const placeIds = Array.from(new Set(assignments.map(a => a.place_id)));
      todayTotal = placeIds.length;
      todayCleaned = placeIds.filter(pid => {
        const placeAssigns = assignments.filter(a => a.place_id === pid);
        return placeAssigns.length > 0 && placeAssigns.every(a => a.is_cleaned);
      }).length;
    }
  }

  const completionRate = todayTotal > 0 ? Math.round((todayCleaned / todayTotal) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">College Overview</h1>
        <p className="text-sm text-muted-foreground">High-level metrics for campus operations.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Students</p>
              <h3 className="text-3xl font-semibold text-foreground mt-1.5 tracking-tight">{studentsCount || 0}</h3>
            </div>
            <div className="p-2 bg-accent text-accent-foreground rounded-md"><Users className="w-5 h-5" /></div>
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Classes</p>
              <h3 className="text-3xl font-semibold text-foreground mt-1.5 tracking-tight">{classesCount || 0}</h3>
            </div>
            <div className="p-2 bg-accent text-accent-foreground rounded-md"><Building2 className="w-5 h-5" /></div>
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Places to Clean</p>
              <h3 className="text-3xl font-semibold text-foreground mt-1.5 tracking-tight">{placesCount || 0}</h3>
            </div>
            <div className="p-2 bg-accent text-accent-foreground rounded-md"><CalendarIcon className="w-5 h-5" /></div>
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completion</p>
              <h3 className="text-3xl font-semibold text-foreground mt-1.5 tracking-tight">{completionRate}%</h3>
            </div>
            <div className="p-2 bg-accent text-accent-foreground rounded-md"><CheckCircle2 className="w-5 h-5" /></div>
          </div>
        </div>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-lg p-6 shadow-xs">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-foreground">
          <TrendingUp className="w-4 h-4 text-primary" /> Campus Health
        </h2>
        <div className="p-4 bg-muted/40 rounded-md border border-border text-center">
          <p className="text-sm text-foreground">
            Today ({latestDate ? new Date(latestDate.date).toLocaleDateString() : 'N/A'}): <span className="font-semibold text-primary">{todayCleaned}</span> out of <span className="font-semibold text-primary">{todayTotal}</span> places have been cleaned.
          </p>
        </div>
      </div>
    </div>
  );
}
