'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  CalendarCheck, 
  Clock, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  X, 
  Sparkles,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';
import { createClient } from '@/utils/supabase/client';
import { 
  getKeralaDateString, 
  getKeralaTimeString, 
  formatDisplayDate, 
  formatTimeAMPM, 
  isWithinTimeWindow,
  isClassUnlockActive,
  getRemainingSeconds,
  formatSecondsMMSS
} from '@/utils/kerala-time';
import { submitClassDayAttendance } from './actions';

export type StudentItem = {
  cicno: string;
  name: string;
  class: string;
  batch?: string | null;
  number?: number | string | null;
};

export type DaySchedule = {
  id?: string;
  date: string;
  start_time: string;
  end_time: string;
};

export type DayUnlock = {
  id?: string;
  date: string;
  class: string;
  unlocked_until: string;
};

export type DayRecord = {
  id?: string;
  date: string;
  student_cicno: string;
  student_class: string;
  status: 'present' | 'leave' | 'late' | 'medical';
};

export default function ClassLeaderDayAttendanceClient({
  userClass,
  todayDate,
  students,
  initialSchedule,
  initialUnlock,
  initialRecords
}: {
  userClass: string;
  todayDate: string;
  students: StudentItem[];
  initialSchedule: DaySchedule | null;
  initialUnlock: DayUnlock | null;
  initialRecords: DayRecord[];
}) {
  const toast = useToast();

  const [schedule, setSchedule] = useState<DaySchedule | null>(initialSchedule);
  const [unlock, setUnlock] = useState<DayUnlock | null>(initialUnlock);
  const [records, setRecords] = useState<DayRecord[]>(initialRecords);
  const [currentTime, setCurrentTime] = useState(getKeralaTimeString());
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Modal open state
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form statuses map: cicno -> status
  const [statusMap, setStatusMap] = useState<Record<string, 'present' | 'leave' | 'late' | 'medical'>>(() => {
    const map: Record<string, 'present' | 'leave' | 'late' | 'medical'> = {};
    // Pre-populate with existing records or default 'present'
    students.forEach(s => {
      const existing = initialRecords.find(r => r.student_cicno === s.cicno);
      map[s.cicno] = existing ? existing.status : 'present';
    });
    return map;
  });

  // Clock ticker every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getKeralaTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime synchronization
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`classleader_day_att_${userClass}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_attendance_schedules' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newSchedule = payload.new as DaySchedule;
            if (newSchedule.date === todayDate) {
              setSchedule(newSchedule);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_attendance_class_unlocks' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newUnlock = payload.new as DayUnlock;
            if (newUnlock.date === todayDate && newUnlock.class === userClass) {
              setUnlock(newUnlock);
              // If newly unlocked, notify and open modal!
              if (isClassUnlockActive(newUnlock.unlocked_until)) {
                toast.success('College Leader unlocked your attendance portal for 5 minutes!');
                setIsAttendanceModalOpen(true);
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_attendance_records' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const rec = payload.new as DayRecord;
            if (rec.date === todayDate && rec.student_class === userClass) {
              setRecords(prev => {
                const idx = prev.findIndex(r => r.student_cicno === rec.student_cicno);
                if (idx >= 0) {
                  const cp = [...prev];
                  cp[idx] = rec;
                  return cp;
                }
                return [rec, ...prev];
              });
            }
          }
        }
      )
      .subscribe((status) => {
        setIsLiveConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [todayDate, userClass, toast]);

  // Determine current portal window state
  const startTime = schedule ? schedule.start_time : '07:00:00';
  const endTime = schedule ? schedule.end_time : '07:05:00';

  const windowCheck = useMemo(() => {
    return isWithinTimeWindow(currentTime, startTime, endTime);
  }, [currentTime, startTime, endTime]);

  const isUnlockActive = useMemo(() => {
    return isClassUnlockActive(unlock?.unlocked_until);
  }, [unlock, currentTime]);

  const unlockSecondsRemaining = useMemo(() => {
    return isUnlockActive ? getRemainingSeconds(unlock?.unlocked_until) : 0;
  }, [isUnlockActive, unlock, currentTime]);

  // Overall is portal open?
  const isPortalOpen = windowCheck.isOpen || isUnlockActive;

  // Auto-open modal when time starts!
  useEffect(() => {
    if (windowCheck.isOpen && !isAttendanceModalOpen && records.length === 0) {
      setIsAttendanceModalOpen(true);
      toast.success('Attendance window is now LIVE! Please mark attendance.');
    }
  }, [windowCheck.isOpen, records.length, isAttendanceModalOpen, toast]);

  // Sorted students strictly by CIC ascending
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => 
      a.cicno.localeCompare(b.cicno, undefined, { numeric: true })
    );
  }, [students]);

  // Stats calculation
  const stats = useMemo(() => {
    let p = 0, l = 0, lt = 0, m = 0;
    sortedStudents.forEach(s => {
      const st = statusMap[s.cicno] || 'present';
      if (st === 'present') p++;
      else if (st === 'late') lt++;
      else if (st === 'medical') m++;
      else if (st === 'leave') l++;
    });
    return { present: p, late: lt, medical: m, leave: l, total: sortedStudents.length };
  }, [sortedStudents, statusMap]);

  // Submit attendance handler
  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      const payloadRecords = sortedStudents.map(s => ({
        cicno: s.cicno,
        status: statusMap[s.cicno] || 'present'
      }));

      const res = await submitClassDayAttendance({
        date: todayDate,
        records: payloadRecords
      });

      if (res.success) {
        toast.success(`Successfully saved attendance for Class ${userClass}!`);
        setIsAttendanceModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to submit attendance');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred');
    }
    setIsSaving(false);
  };

  const isAlreadySubmitted = records.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <CalendarCheck className="w-7 h-7 text-primary" />
              <span>Day Attendance</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              {userClass}
            </span>
            {isLiveConnected && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit daily student attendance during your scheduled 5-minute time window.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border px-3.5 py-2 rounded-lg shadow-xs">
          <Clock className="w-4 h-4 text-primary" />
          <div className="text-xs">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Kerala Time</span>
            <span className="font-mono font-bold text-foreground text-sm">{currentTime}</span>
          </div>
        </div>
      </div>

      {/* PORTAL STATUS BANNER */}
      <div className={`p-5 rounded-xl border shadow-xs transition-all ${
        isPortalOpen
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : windowCheck.status === 'upcoming'
          ? 'bg-blue-500/10 border-blue-500/30'
          : 'bg-muted/50 border-border'
      }`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isPortalOpen ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  PORTAL OPEN • ATTENDANCE LIVE
                </span>
              ) : windowCheck.status === 'upcoming' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
                  <Clock className="w-3.5 h-3.5" />
                  UPCOMING ATTENDANCE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
                  <Lock className="w-3.5 h-3.5" />
                  PORTAL LOCKED
                </span>
              )}

              {isUnlockActive && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                  <Unlock className="w-3.5 h-3.5" />
                  Unlocked by College Leader ({formatSecondsMMSS(unlockSecondsRemaining)})
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-foreground">
              {formatDisplayDate(todayDate)} • Scheduled: {formatTimeAMPM(startTime)} – {formatTimeAMPM(endTime)}
            </h3>

            <p className="text-xs text-muted-foreground">
              {isPortalOpen
                ? 'Please mark attendance for all students and click "Save Attendance" before the window closes.'
                : windowCheck.status === 'upcoming'
                ? `Portal will automatically unlock at ${formatTimeAMPM(startTime)}. Please stay on this page.`
                : 'The scheduled attendance window has ended. If you missed it, ask College Leader for a 5-minute unlock extension.'}
            </p>
          </div>

          <div>
            {isPortalOpen ? (
              <button
                type="button"
                onClick={() => setIsAttendanceModalOpen(true)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <span>{isAlreadySubmitted ? 'Review / Edit Attendance' : 'Open Attendance Portal'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : isAlreadySubmitted ? (
              <button
                type="button"
                onClick={() => setIsAttendanceModalOpen(true)}
                className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-semibold rounded-lg border border-border cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>View Submitted Roster</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* SUBMISSION STATUS CARD */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm text-foreground">
                Class {userClass} Roster ({students.length} Students)
              </h3>
              <p className="text-xs text-muted-foreground">
                Ordered by CIC Number Ascending.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAlreadySubmitted ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Submitted ({records.length} records)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Not Yet Submitted
              </span>
            )}
          </div>
        </div>

        {/* Quick Summary Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Present
            </span>
            <span className="text-2xl font-bold text-foreground mt-0.5 block">
              {stats.present}
            </span>
          </div>

          <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Late
            </span>
            <span className="text-2xl font-bold text-foreground mt-0.5 block">
              {stats.late}
            </span>
          </div>

          <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
              Medical
            </span>
            <span className="text-2xl font-bold text-foreground mt-0.5 block">
              {stats.medical}
            </span>
          </div>

          <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
              Leave (Absent)
            </span>
            <span className="text-2xl font-bold text-foreground mt-0.5 block">
              {stats.leave}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ATTENDANCE PUTTING MODAL (OPEN WHEN TIME STARTS OR UNLOCKED)               */}
      {/* ========================================================================= */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border bg-muted/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground leading-tight">
                    Class {userClass} Attendance • {formatDisplayDate(todayDate)}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>{students.length} Students</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-bold">{stats.present} Present</span>
                    <span>•</span>
                    <span className="text-amber-600 font-bold">{stats.late} Late</span>
                    <span>•</span>
                    <span className="text-rose-600 font-bold">{stats.leave} Leave</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAttendanceModalOpen(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub-banner with Live Remaining Time */}
            {isPortalOpen && (
              <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                <span className="font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Window Active: You can edit and save records.
                </span>
                {isUnlockActive && (
                  <span className="font-bold font-mono">
                    Unlock expires in: {formatSecondsMMSS(unlockSecondsRemaining)}
                  </span>
                )}
              </div>
            )}

            {/* Modal Body: Students in ascending CIC order */}
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-border">
              {sortedStudents.map((student, idx) => {
                const upperName = (student.name || '').toUpperCase();
                const currentStatus = statusMap[student.cicno] || 'present';

                return (
                  <div 
                    key={student.cicno}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-muted/20 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-xs text-muted-foreground font-mono text-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-foreground">
                            {upperName}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground font-semibold">
                          CIC: {student.cicno}
                        </span>
                      </div>
                    </div>

                    {/* Status Dropdown */}
                    <div className="flex items-center gap-2 justify-end pl-9 sm:pl-0">
                      <select
                        disabled={!isPortalOpen}
                        value={currentStatus}
                        onChange={e => {
                          const val = e.target.value as any;
                          setStatusMap(prev => ({
                            ...prev,
                            [student.cicno]: val
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors cursor-pointer disabled:cursor-not-allowed ${
                          currentStatus === 'present'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : currentStatus === 'leave'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                            : currentStatus === 'late'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                            : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                        }`}
                      >
                        <option value="present">Present (Default)</option>
                        <option value="late">Late</option>
                        <option value="medical">Medical</option>
                        <option value="leave">Leave</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground">
                Default: <strong>Present</strong>. Click any student to change.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAttendanceModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-md cursor-pointer"
                >
                  Close
                </button>

                {isPortalOpen && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveAttendance}
                    className="px-5 py-2 text-xs font-bold text-primary-foreground bg-primary hover:brightness-95 rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Attendance'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
