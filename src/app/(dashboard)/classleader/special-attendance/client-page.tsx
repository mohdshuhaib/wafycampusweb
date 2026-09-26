'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardList, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Check, 
  X, 
  Users, 
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';
import { createClient } from '@/utils/supabase/client';
import { formatDisplayDate } from '@/utils/kerala-time';
import { submitClassSpecialAttendance } from './actions';

export type StudentItem = {
  cicno: string;
  name: string;
  class: string;
  batch?: string | null;
  number?: number | string | null;
};

export type SpecialAttendance = {
  id: string;
  name: string;
  subtitle?: string | null;
  date: string;
  target_classes: string[];
  created_at: string;
};

export type SpecialClassStatus = {
  special_attendance_id: string;
  class: string;
  saved_by_role: 'clgleader' | 'classleader';
  saved_at: string;
};

export type SpecialRecord = {
  special_attendance_id: string;
  student_cicno: string;
  student_class: string;
  status: 'present' | 'not attend' | 'leave' | 'medical';
};

export default function ClassLeaderSpecialAttendanceClient({
  userClass,
  students,
  specialAttendances: initialSpecialAttendances,
  initialStatuses,
  initialRecords
}: {
  userClass: string;
  students: StudentItem[];
  specialAttendances: SpecialAttendance[];
  initialStatuses: SpecialClassStatus[];
  initialRecords: SpecialRecord[];
}) {
  const toast = useToast();

  const [specialAttendances, setSpecialAttendances] = useState<SpecialAttendance[]>(initialSpecialAttendances);
  const [classStatuses, setClassStatuses] = useState<SpecialClassStatus[]>(initialStatuses);
  const [classRecords, setClassRecords] = useState<SpecialRecord[]>(initialRecords);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Selected Special Attendance
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSpecialAttendances.length > 0 ? initialSpecialAttendances[0].id : null
  );

  // Status mapping: cicno -> status
  const [statusMap, setStatusMap] = useState<Record<string, 'present' | 'not attend' | 'leave' | 'medical'>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Supabase Realtime synchronization
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`classleader_special_att_${userClass}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'special_attendances' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newAtt = payload.new as SpecialAttendance;
            if (newAtt.target_classes.includes(userClass)) {
              setSpecialAttendances(prev => [newAtt, ...prev]);
              toast.success(`New Special Attendance: ${newAtt.name}`);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'special_attendance_class_status' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newStatus = payload.new as SpecialClassStatus;
            if (newStatus.class === userClass) {
              setClassStatuses(prev => {
                const idx = prev.findIndex(s => s.special_attendance_id === newStatus.special_attendance_id);
                if (idx >= 0) {
                  const cp = [...prev];
                  cp[idx] = newStatus;
                  return cp;
                }
                return [newStatus, ...prev];
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'special_attendance_records' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const rec = payload.new as SpecialRecord;
            if (rec.student_class === userClass) {
              setClassRecords(prev => {
                const idx = prev.findIndex(r => r.special_attendance_id === rec.special_attendance_id && r.student_cicno === rec.student_cicno);
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
  }, [userClass, toast]);

  // Current session
  const currentSpecial = useMemo(() => {
    return specialAttendances.find(s => s.id === selectedId) || null;
  }, [specialAttendances, selectedId]);

  // Current session status for this class
  const currentClassStatus = useMemo(() => {
    if (!currentSpecial) return null;
    return classStatuses.find(s => s.special_attendance_id === currentSpecial.id && s.class === userClass) || null;
  }, [currentSpecial, classStatuses, userClass]);

  // Check if locked by College Leader
  const isLockedByCollegeLeader = currentClassStatus?.saved_by_role === 'clgleader';

  // Sorted students in CIC Number ascending order
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => 
      a.cicno.localeCompare(b.cicno, undefined, { numeric: true })
    );
  }, [students]);

  // Synchronize status map when switching sessions or receiving records
  useEffect(() => {
    if (!currentSpecial) return;
    const records = classRecords.filter(r => r.special_attendance_id === currentSpecial.id);
    const map: Record<string, 'present' | 'not attend' | 'leave' | 'medical'> = {};
    sortedStudents.forEach(s => {
      const match = records.find(r => r.student_cicno === s.cicno);
      map[s.cicno] = match ? match.status : 'present';
    });
    setStatusMap(map);
  }, [currentSpecial, classRecords, sortedStudents]);

  // Stats calculation
  const stats = useMemo(() => {
    let p = 0, na = 0, l = 0, m = 0;
    sortedStudents.forEach(s => {
      const st = statusMap[s.cicno] || 'present';
      if (st === 'present') p++;
      else if (st === 'not attend') na++;
      else if (st === 'medical') m++;
      else if (st === 'leave') l++;
    });
    return { present: p, notAttend: na, medical: m, leave: l, total: sortedStudents.length };
  }, [sortedStudents, statusMap]);

  // Submit handler
  const handleSave = async () => {
    if (!currentSpecial) return;
    setIsSaving(true);
    try {
      const payloadRecords = sortedStudents.map(s => ({
        cicno: s.cicno,
        status: statusMap[s.cicno] || 'present'
      }));

      const res = await submitClassSpecialAttendance({
        specialAttendanceId: currentSpecial.id,
        records: payloadRecords
      });

      if (res.success) {
        toast.success(`Special Attendance saved for Class ${userClass}!`);
      } else {
        toast.error(res.error || 'Failed to submit');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred');
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-primary" />
              <span>Special Attendance</span>
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
            Mark attendance for special sessions (e.g. Masjid, Assemblies) assigned to your class.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border">
            Total Sessions: <strong className="text-foreground">{specialAttendances.length}</strong>
          </span>
        </div>
      </div>

      {/* Session Cards Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
        {specialAttendances.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground w-full">
            No special attendance sessions assigned to your class yet.
          </div>
        ) : (
          specialAttendances.map(s => {
            const isSelected = selectedId === s.id;
            const statusRow = classStatuses.find(st => st.special_attendance_id === s.id);
            const isSaved = !!statusRow;
            const isLocked = statusRow?.saved_by_role === 'clgleader';

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`px-4 py-2.5 rounded-xl border text-left transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-card border-border text-foreground hover:border-border/80 hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-xs">{s.name}</span>
                  {isLocked ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-500/40">
                      <Lock className="w-2.5 h-2.5" />
                      Locked
                    </span>
                  ) : isSaved ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40">
                      <Check className="w-2.5 h-2.5" />
                      Saved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                      Pending
                    </span>
                  )}
                </div>
                <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {formatDisplayDate(s.date)}
                </p>
              </button>
            );
          })
        )}
      </div>

      {/* Main Special Attendance Entry View */}
      {currentSpecial && (
        <div className="space-y-4">
          {/* Lock Banner if Saved by College Leader */}
          {isLockedByCollegeLeader && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block">Locked by College Leader</span>
                <span>
                  This special attendance was verified and saved by the College Leader on{' '}
                  <strong>{new Date(currentClassStatus!.saved_at).toLocaleTimeString('en-GB')}</strong>.
                  Class Leaders cannot modify locked records.
                </span>
              </div>
            </div>
          )}

          {/* Active Session Info Card */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Special Attendance
              </span>
              <h2 className="text-base font-bold text-foreground mt-0.5">
                {currentSpecial.name}
              </h2>
              {currentSpecial.subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{currentSpecial.subtitle}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Date: <strong>{formatDisplayDate(currentSpecial.date)}</strong> • Class: <strong>{userClass}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {!isLockedByCollegeLeader && (
                <button
                  type="button"
                  onClick={() => {
                    const newMap: Record<string, 'present'> = {};
                    sortedStudents.forEach(s => { newMap[s.cicno] = 'present'; });
                    setStatusMap(prev => ({ ...prev, ...newMap }));
                    toast.success('Marked all students as Present');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-md border border-border cursor-pointer"
                >
                  Mark All Present
                </button>
              )}

              {!isLockedByCollegeLeader && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className="px-4 py-1.5 text-xs font-bold text-primary-foreground bg-primary hover:brightness-95 rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Attendance'}
                </button>
              )}
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Present</span>
              <span className="text-2xl font-bold text-foreground mt-0.5 block">{stats.present}</span>
            </div>
            <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Not Attend</span>
              <span className="text-2xl font-bold text-foreground mt-0.5 block">{stats.notAttend}</span>
            </div>
            <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Leave</span>
              <span className="text-2xl font-bold text-foreground mt-0.5 block">{stats.leave}</span>
            </div>
            <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Medical</span>
              <span className="text-2xl font-bold text-foreground mt-0.5 block">{stats.medical}</span>
            </div>
          </div>

          {/* Student Roster Table in CIC Number Ascending Order */}
          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4 w-32 font-mono">CIC No</th>
                    <th className="py-2.5 px-4">Student Name</th>
                    <th className="py-2.5 px-4 text-center w-48">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedStudents.map((student, idx) => {
                    const upperName = (student.name || '').toUpperCase();
                    const currentStatus = statusMap[student.cicno] || 'present';

                    return (
                      <tr key={student.cicno} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 text-center text-xs text-muted-foreground font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-xs text-foreground">
                          {student.cicno}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-foreground text-xs">
                          {upperName}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <select
                            disabled={isLockedByCollegeLeader}
                            value={currentStatus}
                            onChange={e => {
                              const val = e.target.value as any;
                              setStatusMap(prev => ({
                                ...prev,
                                [student.cicno]: val
                              }));
                            }}
                            className={`px-3 py-1 rounded text-xs font-bold border focus:outline-none cursor-pointer disabled:cursor-not-allowed ${
                              currentStatus === 'present'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                : currentStatus === 'not attend'
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                                : currentStatus === 'leave'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                            }`}
                          >
                            <option value="present">Present (Default)</option>
                            <option value="not attend">Not Attend</option>
                            <option value="leave">Leave</option>
                            <option value="medical">Medical</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer with Save Action */}
            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {isLockedByCollegeLeader
                  ? 'Locked: Records cannot be modified.'
                  : 'Click Save Attendance when you finish marking.'}
              </span>

              {!isLockedByCollegeLeader && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className="px-5 py-2 text-xs font-bold text-primary-foreground bg-primary hover:brightness-95 rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Attendance'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
