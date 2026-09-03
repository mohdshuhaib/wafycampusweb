import { MapPin, Calendar, CheckCircle2, Info, Wrench, Users, ArrowLeft, Brush } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';

export const revalidate = 60;

export default async function PlaceDetailsPage({ params }: { params: Promise<{ place_id: string }> }) {
  const { place_id } = await params;
  const supabase = await createClient();

  // Fetch place
  const { data: place, error } = await supabase
    .from('cleaning_places')
    .select('*')
    .eq('id', place_id)
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link href="/cleaning" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Cleaning List
      </Link>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight flex items-center gap-3">
          {place.name}
        </h1>
        <span className="inline-flex items-center gap-1.5 text-primary font-medium text-sm">
          <MapPin className="w-4 h-4" /> {place.block}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {images.length > 0 ? (
            <div className="bg-card border border-border rounded-lg overflow-hidden aspect-video relative shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={images[0].trim()} 
                alt={place.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="bg-muted/40 border border-border rounded-lg overflow-hidden aspect-video relative flex items-center justify-center shadow-xs">
               <div className="text-center text-muted-foreground">
                 <Brush className="w-10 h-10 mx-auto mb-2 opacity-30" />
                 <p className="text-sm">No images provided</p>
               </div>
            </div>
          )}

          <div className="bg-card text-card-foreground border border-border rounded-lg p-6 shadow-xs">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" /> About This Place
            </h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              {place.description || "No description provided."}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
            <h3 className="font-semibold text-sm mb-4 text-foreground uppercase tracking-wider">Cleaning Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/40 border border-border">
                <div className="p-2 bg-accent text-accent-foreground rounded-md">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Times Cleaned</p>
                  <p className="text-lg font-bold text-foreground">{cleanedTimes}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/40 border border-border">
                <div className="p-2 bg-accent text-accent-foreground rounded-md">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Cleaning Date</p>
                  <p className="text-lg font-bold text-foreground">{latestDate ? new Date(latestDate.date).toLocaleDateString('en-GB') : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-foreground">
              <Users className="w-4 h-4 text-primary" /> Last Cleaned By
            </h3>
            {lastCleanedBy.length > 0 ? (
              <ul className="space-y-1.5">
                {lastCleanedBy.map((person, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs text-foreground bg-muted/40 p-2 rounded-md border border-border">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> {person}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No one has cleaned this recently.</p>
            )}
          </div>

          <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-foreground">
              <Wrench className="w-4 h-4 text-primary" /> Tools Available
            </h3>
            {tools && tools.length > 0 ? (
              <ul className="space-y-2">
                {tools.map((tool, idx) => (
                  <li key={idx} className="flex justify-between items-center text-xs text-foreground border-b border-border pb-1.5 last:border-0 last:pb-0">
                    <span>{tool.name}</span>
                    <span className="bg-secondary text-secondary-foreground font-semibold px-2 py-0.5 rounded-sm">
                      x{tool.count}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No tools registered in the system.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
