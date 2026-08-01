import { BarChart3, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function StatusPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'cleanleader') redirect('/');

  // 1. Get Latest Date
  const { data: latestDate } = await supabase.from('cleaning_dates').select('*').order('date', { ascending: false }).limit(1).single();

  let placesData: any[] = [];
  
  if (latestDate) {
    // 2. Get places and their student assignments
    const { data: places } = await supabase.from('cleaning_places').select('id, name, block');
    const { data: assignments } = await supabase.from('student_cleaning_assignments').select('*').eq('date_id', latestDate.id);
    
    if (places) {
      placesData = places.map(p => {
        const pAssigns = (assignments || []).filter(a => a.place_id === p.id);
        const assignedStudentsCount = pAssigns.length;
        // Assume cleaned if at least one assignment is marked cleaned (or if all, up to preference. Let's do at least one for simplicity)
        const isCleaned = pAssigns.length > 0 && pAssigns.some(a => a.is_cleaned);
        
        return {
          id: p.id,
          name: p.name,
          block: p.block,
          assignedCount: assignedStudentsCount,
          cleaned: isCleaned
        };
      });
    }
  }

  const cleanedCount = placesData.filter(p => p.cleaned).length;
  const totalCount = placesData.filter(p => p.assignedCount > 0).length; // Only count places that were actually assigned to someone
  const progress = totalCount > 0 ? Math.round((cleanedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Live Status</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {latestDate ? `Monitoring cleaning progress for ${new Date(latestDate.date).toLocaleDateString()}` : 'No active dates found.'}
          </p>
        </div>
      </div>

      {!latestDate ? (
        <div className="p-8 text-center text-slate-500 glass-panel">Please create a date in Assign Places first.</div>
      ) : (
        <>
          <div className="glass-panel p-6 mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Overall Progress
            </h2>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 mb-2 overflow-hidden">
              <div 
                className="bg-primary h-4 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {cleanedCount} of {totalCount} assigned places cleaned ({progress}%)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {placesData.filter(p => p.assignedCount > 0).map(place => (
              <div key={place.id} className="glass-panel p-6 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{place.name}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {place.block}
                    </p>
                  </div>
                  {place.cleaned ? (
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  ) : (
                    <XCircle className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm font-medium">
                  <span className="text-slate-600 dark:text-slate-400">Status</span>
                  {place.cleaned ? (
                    <span className="text-success bg-success/10 px-2 py-1 rounded">Cleaned</span>
                  ) : (
                    <span className="text-amber-500 bg-amber-500/10 px-2 py-1 rounded">In Progress</span>
                  )}
                </div>
              </div>
            ))}
            
            {placesData.filter(p => p.assignedCount === 0).length > 0 && (
               <div className="col-span-full mt-4">
                  <h3 className="text-lg font-bold mb-4 text-slate-500">Unassigned Places</h3>
                  <div className="flex flex-wrap gap-2">
                    {placesData.filter(p => p.assignedCount === 0).map(p => (
                      <span key={p.id} className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded">
                        {p.name}
                      </span>
                    ))}
                  </div>
               </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
