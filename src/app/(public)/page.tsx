import { Users, Droplets, Brush, Calendar, PenTool as Tool, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';

// Helper component for stat cards
function StatCard({ title, value, icon, gradient }: { title: string, value: string | number, icon: React.ReactNode, gradient: string }) {
  return (
    <div className={`glass-panel p-6 relative overflow-hidden group`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-20 transition-transform group-hover:scale-110 ${gradient}`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</h3>
          <p className="text-4xl font-bold text-slate-800 dark:text-white">{value}</p>
        </div>
        <div className={`p-3 rounded-xl bg-white/50 dark:bg-white/10 backdrop-blur-md`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export const revalidate = 60; // Revalidate page every 60 seconds

export default async function Home() {
  const supabase = await createClient();

  // Fetch actual data concurrently for performance
  const [
    { count: studentsCount },
    { count: placesCount, data: placesData },
    { count: toolsCount },
    { data: latestDateData }
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('cleaning_places').select('count', { count: 'exact' }),
    supabase.from('tools').select('*', { count: 'exact', head: true }),
    supabase.from('cleaning_dates').select('id, date').order('date', { ascending: false }).limit(1).single()
  ]);

  const totalCleanersNeeded = placesData?.reduce((acc, place) => acc + (place.count || 0), 0) || 0;
  
  let cleaningFinishedCount = 0;
  if (latestDateData) {
    const { count } = await supabase
      .from('student_cleaning_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('date_id', latestDateData.id)
      .eq('is_cleaned', true);
    cleaningFinishedCount = count || 0;
  }

  const stats = {
    students: studentsCount || 0,
    places: placesCount || 0,
    cleanersNeeded: totalCleanersNeeded,
    cleaningFinished: cleaningFinishedCount,
    lastCleaningDate: latestDateData?.date ? new Date(latestDateData.date).toLocaleDateString() : 'N/A',
    totalTools: toolsCount || 0
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
          Campus Status
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Overview of Wafy Campus cleaning activities.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          title="Total Students" 
          value={stats.students} 
          icon={<Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />} 
          gradient="bg-blue-500"
        />
        <StatCard 
          title="Cleaning Places" 
          value={stats.places} 
          icon={<Droplets className="w-6 h-6 text-teal-600 dark:text-teal-400" />} 
          gradient="bg-teal-500"
        />
        <StatCard 
          title="Cleaners Needed" 
          value={stats.cleanersNeeded} 
          icon={<Brush className="w-6 h-6 text-amber-600 dark:text-amber-400" />} 
          gradient="bg-amber-500"
        />
        <StatCard 
          title="Cleaning Finished" 
          value={stats.cleaningFinished} 
          icon={<CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />} 
          gradient="bg-green-500"
        />
        <StatCard 
          title="Last Cleaning Date" 
          value={stats.lastCleaningDate} 
          icon={<Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />} 
          gradient="bg-purple-500"
        />
        <StatCard 
          title="Total Tools" 
          value={stats.totalTools} 
          icon={<Tool className="w-6 h-6 text-orange-600 dark:text-orange-400" />} 
          gradient="bg-orange-500"
        />
      </div>
      
      {/* Empty State / Ideas */}
      <div className="glass-panel p-8 mt-12">
        <h2 className="text-2xl font-bold mb-4">Recent Ideas & Notes</h2>
        {stats.places === 0 ? (
          <div className="p-8 text-center bg-white/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
            <Brush className="w-10 h-10 mx-auto text-slate-400 mb-3 opacity-50" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">No active data available yet.</p>
            <p className="text-sm text-slate-500 mt-1">Once Cleaning Leaders set up places and tools, stats will appear here!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-lg bg-white/40 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <p className="text-slate-800 dark:text-slate-200">"Let's organize a campus-wide cleaning drive this Friday!"</p>
              <p className="text-sm text-slate-500 mt-2">— Cleaning Leader, Kitchen Block</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
