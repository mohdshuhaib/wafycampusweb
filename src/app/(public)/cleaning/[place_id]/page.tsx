import { MapPin, Calendar, CheckCircle2, Info, Wrench, Users, ArrowLeft, Brush } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';

export const revalidate = 60;

export default async function PlaceDetailsPage({ params }: { params: { place_id: string } }) {
  const supabase = await createClient();

  // Fetch place
  const { data: place, error } = await supabase
    .from('cleaning_places')
    .select('*')
    .eq('id', params.place_id)
    .single();

  if (error || !place) {
    notFound();
  }

  // Fetch tools
  const { data: tools } = await supabase.from('tools').select('*');

  // Fetch latest date to get cleaning stats
  const { data: latestDate } = await supabase
    .from('cleaning_dates')
    .select('id, date')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  let cleanedTimes = 0;
  let lastCleanedBy: string[] = [];

  if (latestDate) {
    const { count } = await supabase
      .from('student_cleaning_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('place_id', place.id)
      .eq('is_cleaned', true);
    cleanedTimes = count || 0;

    // Get who cleaned it on the latest date
    const { data: assignees } = await supabase
      .from('student_cleaning_assignments')
      .select('student_cicno, students(name, class)')
      .eq('place_id', place.id)
      .eq('date_id', latestDate.id);

    if (assignees) {
      lastCleanedBy = assignees.map(a => {
        const student: any = Array.isArray(a.students) ? a.students[0] : a.students;
        return `${student?.name} (${student?.class})`;
      });
    }
  }

  const images = place.images_link ? place.images_link.split(',') : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <Link href="/cleaning" className="inline-flex items-center gap-2 text-slate-500 hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Cleaning List
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-4">
          {place.name}
        </h1>
        <span className="inline-flex items-center gap-2 text-primary font-medium text-lg">
          <MapPin className="w-5 h-5" /> {place.block}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {images.length > 0 ? (
            <div className="glass-panel p-1 rounded-2xl overflow-hidden aspect-video relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={images[0].trim()} 
                alt={place.name}
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
          ) : (
            <div className="glass-panel p-1 rounded-2xl overflow-hidden aspect-video relative bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
               <div className="text-center text-slate-400">
                 <Brush className="w-12 h-12 mx-auto mb-2 opacity-30" />
                 <p>No images provided</p>
               </div>
            </div>
          )}

          <div className="glass-panel p-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Info className="w-6 h-6 text-primary" /> About This Place
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
              {place.description || "No description provided."}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-6 bg-gradient-to-br from-primary/10 to-transparent">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Cleaning Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-success/20 text-success rounded-xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Times Cleaned</p>
                  <p className="text-xl font-bold">{cleanedTimes}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 text-purple-500 rounded-xl">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Last Cleaning Date</p>
                  <p className="text-xl font-bold">{latestDate ? new Date(latestDate.date).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Last Cleaned By
            </h3>
            {lastCleanedBy.length > 0 ? (
              <ul className="space-y-2">
                {lastCleanedBy.map((person, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="w-2 h-2 bg-primary rounded-full"></div> {person}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No one has cleaned this recently.</p>
            )}
          </div>

          <div className="glass-panel p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" /> Tools Available
            </h3>
            {tools && tools.length > 0 ? (
              <ul className="space-y-3">
                {tools.map((tool, idx) => (
                  <li key={idx} className="flex justify-between items-center text-slate-700 dark:text-slate-300 border-b border-slate-200/50 dark:border-slate-700/50 pb-2 last:border-0 last:pb-0">
                    <span>{tool.name}</span>
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold px-2 py-1 rounded">
                      x{tool.count}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No tools registered in the system.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
