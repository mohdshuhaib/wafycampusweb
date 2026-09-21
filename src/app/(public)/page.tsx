import { Users, Droplets, Calendar, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs transition-all hover:shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{title}</h3>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="p-2 rounded-md bg-accent text-accent-foreground">
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
    { count: placesCount },
    { data: latestDateData }
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('cleaning_places').select('count', { count: 'exact' }),
    supabase.from('cleaning_dates').select('id, date').order('date', { ascending: false }).limit(1).single()
  ]);
  
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
    cleaningFinished: cleaningFinishedCount,
    lastCleaningDate: latestDateData?.date ? new Date(latestDateData.date).toLocaleDateString('en-GB') : 'N/A'
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">
          Campus Status
        </h1>
        <p className="text-sm text-muted-foreground">
          Overview of Wafy Campus cleaning activities and real-time status.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Students" 
          value={stats.students} 
          icon={<Users className="w-5 h-5 text-primary" />} 
        />
        <StatCard 
          title="Cleaning Places" 
          value={stats.places} 
          icon={<Droplets className="w-5 h-5 text-primary" />} 
        />
        <StatCard 
          title="Cleaning Finished" 
          value={stats.cleaningFinished} 
          icon={<CheckCircle2 className="w-5 h-5 text-primary" />} 
        />
        <StatCard 
          title="Last Cleaning Date" 
          value={stats.lastCleaningDate} 
          icon={<Calendar className="w-5 h-5 text-primary" />} 
        />
      </div>
    </div>
  );
}
