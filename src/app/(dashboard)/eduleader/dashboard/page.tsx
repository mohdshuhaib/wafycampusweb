import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Calendar, BookOpen, Clock, ArrowRight, CheckCircle2, Sparkles, Layers } from 'lucide-react';

export const revalidate = 0;

export default async function EduLeaderDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, designation')
    .eq('id', user.id)
    .single();

  const isEdu = profile?.role === 'eduleader' || profile?.designation?.toLowerCase().includes('academic');
  if (!profile || !isEdu) redirect('/');

  // Query calendar data if table exists
  let calendarData: any[] = [];
  try {
    const { data } = await supabase.from('wafy_calendar').select('*');
    calendarData = data || [];
  } catch (e) {
    calendarData = [];
  }

  const TOTAL_YEAR_DAYS = 396; // Semester 1 (183 days) + Semester 2 (213 days)
  const examDays = calendarData.filter(d => d.status === 'exam').length;
  const leaveDays = calendarData.filter(d => d.status === 'leave').length;
  const wafyLeaveDays = calendarData.filter(d => d.status === 'wafy-leave').length;

  const nonAcademicDays = leaveDays + wafyLeaveDays;
  const academicDays = TOTAL_YEAR_DAYS - nonAcademicDays;
  const periodDays = academicDays - examDays;
  const totalExceptions = nonAcademicDays + examDays;


  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Academic Leader Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage academic scheduling, working days, and Wafy curriculum calendar.
          </p>
        </div>

        <Link
          href="/eduleader/calendar"
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:brightness-95 text-primary-foreground rounded-md text-xs font-semibold shadow-xs transition-all"
        >
          <Calendar className="w-4 h-4" /> Open Wafy Calendar <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* High-level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Academic Days Card */}
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Academic Days</p>
              <h3 className="text-3xl font-semibold text-foreground mt-1.5 tracking-tight">{academicDays}</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{periodDays}</span> Periods • <span className="font-semibold text-blue-600 dark:text-blue-400">{examDays}</span> Exams
          </p>
        </div>

        {/* Non-Academic / Leave Days Card */}
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Leave Days</p>
              <h3 className="text-3xl font-semibold text-foreground mt-1.5 tracking-tight">{nonAcademicDays}</h3>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <span className="font-semibold text-amber-600 dark:text-amber-400">{leaveDays}</span> Leaves • <span className="font-semibold text-rose-600 dark:text-rose-400">{wafyLeaveDays}</span> Wafy Leaves
          </p>
        </div>

        {/* Total Calendar Days Card */}
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Calendar Days</p>
              <h3 className="text-3xl font-semibold text-foreground mt-1.5 tracking-tight">{TOTAL_YEAR_DAYS}</h3>
            </div>
            <div className="p-2 bg-accent text-accent-foreground rounded-md">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            183 in Sem 1 • 213 in Sem 2 ({totalExceptions} exceptions)
          </p>
        </div>

        {/* Academic Ratio Card */}
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-primary uppercase tracking-wider">Academic Ratio</p>
              <h3 className="text-3xl font-semibold text-foreground mt-1.5 tracking-tight">
                {Math.round((academicDays / TOTAL_YEAR_DAYS) * 100)}%
              </h3>
            </div>
            <div className="p-2 bg-primary/10 text-primary rounded-md">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {academicDays} working days of {TOTAL_YEAR_DAYS}
          </p>
        </div>
      </div>

      {/* Work In Progress / Overview Hero Card */}
      <div className="bg-card text-card-foreground border border-border rounded-lg p-8 sm:p-10 flex flex-col items-center justify-center text-center shadow-xs">
        <div className="relative mb-5">
          <div className="bg-primary/10 text-primary p-4 rounded-full relative z-10">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2 tracking-tight">Academic Timeline & Working Calendar</h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed mb-6">
          Set up and customize the full 12-month Wafy Calendar divided into Semester 1 and Semester 2. Classify dates as Periods, Leaves, Exams, or Wafy Leaves with real-time academic counters.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/eduleader/calendar"
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:brightness-95 text-primary-foreground rounded-md text-xs font-semibold shadow-xs transition-colors"
          >
            <Calendar className="w-4 h-4" /> Go to Wafy Calendar
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md text-xs font-medium transition-colors"
          >
            Campus Home
          </Link>
        </div>
      </div>
    </div>
  );
}
