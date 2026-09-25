import { FileText, CheckCircle2, XCircle, Users, CheckCircle, Droplets, Clock } from 'lucide-react';
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
        const assignedCount = pAssigns.length;
        const cleanedCount = pAssigns.filter(a => a.is_cleaned).length;
        const isFullCleaned = assignedCount > 0 && cleanedCount === assignedCount;
        const isPartiallyCleaned = cleanedCount > 0 && cleanedCount < assignedCount;
        const classesInvolved = Array.from(new Set(pAssigns.map(a => {
          const student: any = Array.isArray(a.students) ? a.students[0] : a.students;
          return student?.class;
        }).filter(Boolean)));
        
        if (isFullCleaned) placesCleaned++;
        else placesNotCleaned++;
        
        if (classesInvolved.length === 0) leftToAssign++;

        return {
          id: p.id,
          place: p.name,
          block: p.block,
          class: classesInvolved.join(', ') || 'Unassigned',
          isFullCleaned,
          isPartiallyCleaned,
          cleanedCount,
          assignedCount,
          status: isFullCleaned ? 'Cleaned' : isPartiallyCleaned ? 'Partial' : 'Not Cleaned',
          time: isFullCleaned ? 'Reported' : isPartiallyCleaned ? `In Progress (${cleanedCount}/${assignedCount})` : 'Pending'
        };
      });
      
      classesAssigned = new Set(assignments.map(a => {
        const student: any = Array.isArray(a.students) ? a.students[0] : a.students;
        return student?.class;
      }).filter(Boolean)).size;
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Cleaning Report</h1>
          <p className="text-sm text-muted-foreground">Detailed logs for {latestDate ? new Date(latestDate.date).toLocaleDateString() : 'no active dates'}.</p>
        </div>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-lg p-5 sm:p-6 shadow-xs">
        {reports.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No data to display. Ensure Cleaning Leaders have generated assignments for today.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Place</th>
                  <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Block</th>
                  <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Class Assigned</th>
                  <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Time</th>
                  <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">{row.place}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{row.block}</td>
                    <td className="py-3 px-4 text-xs font-medium text-primary">{row.class}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{row.time}</td>
                    <td className="py-3 px-4">
                      {row.isFullCleaned ? (
                        <span className="inline-flex items-center gap-1 text-accent-foreground font-semibold bg-accent px-2 py-0.5 rounded-sm text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cleaned
                        </span>
                      ) : row.isPartiallyCleaned ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/15 px-2 py-0.5 rounded-sm text-xs">
                          <Clock className="w-3.5 h-3.5" /> Partial ({row.cleanedCount}/{row.assignedCount})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive font-semibold bg-destructive/10 px-2 py-0.5 rounded-sm text-xs">
                          <XCircle className="w-3.5 h-3.5" /> Pending
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="bg-card text-card-foreground border border-border p-4 rounded-lg shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Classes Active</p>
            <div className="p-1.5 bg-accent text-accent-foreground rounded-md"><Users className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-semibold text-foreground tracking-tight">{classesAssigned}</p>
        </div>

        <div className="bg-card text-card-foreground border border-border p-4 rounded-lg shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Places Cleaned</p>
            <div className="p-1.5 bg-accent text-accent-foreground rounded-md"><CheckCircle className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-semibold text-foreground tracking-tight">{placesCleaned}</p>
        </div>

        <div className="bg-card text-card-foreground border border-border p-4 rounded-lg shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Not Cleaned</p>
            <div className="p-1.5 bg-destructive/10 text-destructive rounded-md"><XCircle className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-semibold text-foreground tracking-tight">{placesNotCleaned}</p>
        </div>
        
        <div className="bg-card text-card-foreground border border-border p-4 rounded-lg shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Left to Assign</p>
            <div className="p-1.5 bg-accent text-accent-foreground rounded-md"><Droplets className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-semibold text-foreground tracking-tight">{leftToAssign}</p>
        </div>
      </div>
    </div>
  );
}
