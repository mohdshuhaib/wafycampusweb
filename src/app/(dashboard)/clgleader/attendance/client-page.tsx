'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  CalendarCheck, 
  Calendar, 
  Clock, 
  Lock, 
  Unlock, 
  Copy, 
  Printer, 
  Plus, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ClipboardList
} from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';
import { createClient } from '@/utils/supabase/client';
import { VALID_CLASSES } from '@/app/(dashboard)/eduleader/students/constants';
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
import { 
  saveDaySchedule, 
  unlockClassForFiveMinutes, 
  createSpecialAttendance, 
  saveSpecialAttendanceForClass 
} from './actions';
import { 
  exportDayAttendancePdf, 
  exportSpecialAttendancePdf, 
  ClassPdfSummary 
} from '@/utils/attendance-pdf';

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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CollegeLeaderAttendanceClient({
  students,
  schedules: initialSchedules,
  dayRecords: initialDayRecords,
  dayUnlocks: initialDayUnlocks,
  specialAttendances: initialSpecialAttendances,
  specialClassStatuses: initialSpecialClassStatuses,
  specialRecords: initialSpecialRecords,
  calendarLeaveKeys
}: {
  students: StudentItem[];
  schedules: DaySchedule[];
  dayRecords: DayRecord[];
  dayUnlocks: DayUnlock[];
  specialAttendances: SpecialAttendance[];
  specialClassStatuses: SpecialClassStatus[];
  specialRecords: SpecialRecord[];
  calendarLeaveKeys: string[];
}) {
  const toast = useToast();
  const [mainTab, setMainTab] = useState<'day' | 'special'>('day');
  const [daySubTab, setDaySubTab] = useState<'upcoming' | 'past'>('upcoming');

  // Live state
  const [schedules, setSchedules] = useState<DaySchedule[]>(initialSchedules);
  const [dayRecords, setDayRecords] = useState<DayRecord[]>(initialDayRecords);
  const [dayUnlocks, setDayUnlocks] = useState<DayUnlock[]>(initialDayUnlocks);
  const [specialAttendances, setSpecialAttendances] = useState<SpecialAttendance[]>(initialSpecialAttendances);
  const [specialClassStatuses, setSpecialClassStatuses] = useState<SpecialClassStatus[]>(initialSpecialClassStatuses);
  const [specialRecords, setSpecialRecords] = useState<SpecialRecord[]>(initialSpecialRecords);

  const [currentTime, setCurrentTime] = useState(getKeralaTimeString());
  const [todayDate] = useState(getKeralaDateString());
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Time editing state for upcoming day
  const [editingDayDate, setEditingDayDate] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState('07:00');
  const [editEndTime, setEditEndTime] = useState('07:05');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Expanded past day view
  const [selectedPastDate, setSelectedPastDate] = useState<string | null>(null);
  const [expandedClassDetails, setExpandedClassDetails] = useState<string | null>(null);

  // Special Attendance state
  const [showAddSpecialModal, setShowAddSpecialModal] = useState(false);
  const [newSpecialName, setNewSpecialName] = useState('');
  const [newSpecialSubtitle, setNewSpecialSubtitle] = useState('');
  const [newSpecialDate, setNewSpecialDate] = useState(todayDate);
  const [newSpecialClasses, setNewSpecialClasses] = useState<string[]>([...VALID_CLASSES]);
  const [isCreatingSpecial, setIsCreatingSpecial] = useState(false);

  // Active Special Attendance detailed view
  const [selectedSpecialId, setSelectedSpecialId] = useState<string | null>(
    initialSpecialAttendances.length > 0 ? initialSpecialAttendances[0].id : null
  );
  const [selectedSpecialClass, setSelectedSpecialClass] = useState<string>(VALID_CLASSES[0]);
  const [specialFormStatuses, setSpecialFormStatuses] = useState<Record<string, 'present' | 'not attend' | 'leave' | 'medical'>>({});
  const [isSavingSpecialClass, setIsSavingSpecialClass] = useState(false);

  // Clock ticker for real-time countdowns & window transitions
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getKeralaTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Supabase Realtime synchronization
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('clgleader_attendance_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_attendance_schedules' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const rec = payload.new as DaySchedule;
          setSchedules(prev => {
            const idx = prev.findIndex(s => s.date === rec.date);
            if (idx >= 0) {
              const cp = [...prev];
              cp[idx] = rec;
              return cp;
            }
            return [rec, ...prev];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_attendance_class_unlocks' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const rec = payload.new as DayUnlock;
          setDayUnlocks(prev => {
            const idx = prev.findIndex(u => u.date === rec.date && u.class === rec.class);
            if (idx >= 0) {
              const cp = [...prev];
              cp[idx] = rec;
              return cp;
            }
            return [rec, ...prev];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_attendance_records' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const rec = payload.new as DayRecord;
          setDayRecords(prev => {
            const idx = prev.findIndex(r => r.date === rec.date && r.student_cicno === rec.student_cicno);
            if (idx >= 0) {
              const cp = [...prev];
              cp[idx] = rec;
              return cp;
            }
            return [rec, ...prev];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_attendances' }, payload => {
        if (payload.eventType === 'INSERT') {
          const rec = payload.new as SpecialAttendance;
          setSpecialAttendances(prev => [rec, ...prev]);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_attendance_class_status' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const rec = payload.new as SpecialClassStatus;
          setSpecialClassStatuses(prev => {
            const idx = prev.findIndex(s => s.special_attendance_id === rec.special_attendance_id && s.class === rec.class);
            if (idx >= 0) {
              const cp = [...prev];
              cp[idx] = rec;
              return cp;
            }
            return [rec, ...prev];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_attendance_records' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const rec = payload.new as SpecialRecord;
          setSpecialRecords(prev => {
            const idx = prev.findIndex(r => r.special_attendance_id === rec.special_attendance_id && r.student_cicno === rec.student_cicno);
            if (idx >= 0) {
              const cp = [...prev];
              cp[idx] = rec;
              return cp;
            }
            return [rec, ...prev];
          });
        }
      })
      .subscribe(status => {
        setIsLiveConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Map of date -> schedule
  const scheduleMap = useMemo(() => {
    const map = new Map<string, DaySchedule>();
    schedules.forEach(s => map.set(s.date, s));
    return map;
  }, [schedules]);

  // Compute Upcoming 5 working ("period") days starting from today
  const upcomingFiveDays = useMemo(() => {
    const leaveSet = new Set(calendarLeaveKeys);
    const results: { dateStr: string; startTime: string; endTime: string }[] = [];

    // Parse today
    const [y, m, d] = todayDate.split('-').map(Number);
    let curr = new Date(y, m - 1, d);

    for (let i = 0; i < 60 && results.length < 5; i++) {
      const year = curr.getFullYear();
      const monthIdx = curr.getMonth();
      const monthName = MONTH_NAMES[monthIdx];
      const dayNum = curr.getDate();
      const key = `${monthName}_${dayNum}`;

      // Check if day is period (not in leaveSet)
      if (!leaveSet.has(key)) {
        const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const existingSchedule = scheduleMap.get(dateStr);
        results.push({
          dateStr,
          startTime: existingSchedule ? existingSchedule.start_time : '07:00',
          endTime: existingSchedule ? existingSchedule.end_time : '07:05'
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
    return results;
  }, [todayDate, calendarLeaveKeys, scheduleMap]);

  // Compute Past dates that have concluded or recorded attendance
  const pastDates = useMemo(() => {
    const datesSet = new Set<string>();
    dayRecords.forEach(r => datesSet.add(r.date));
    schedules.forEach(s => {
      if (s.date < todayDate) datesSet.add(s.date);
    });

    // Check today: if today's end_time has passed
    const todaySchedule = scheduleMap.get(todayDate);
    const todayEndTime = todaySchedule ? todaySchedule.end_time : '07:05';
    if (currentTime > todayEndTime) {
      datesSet.add(todayDate);
    }

    return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  }, [dayRecords, schedules, todayDate, scheduleMap, currentTime]);

  // Initialize selectedPastDate
  useEffect(() => {
    if (!selectedPastDate && pastDates.length > 0) {
      setSelectedPastDate(pastDates[0]);
    }
  }, [pastDates, selectedPastDate]);

  // Students grouped by class, ordered by cicno ascending
  const studentsByClass = useMemo(() => {
    const map: Record<string, StudentItem[]> = {};
    VALID_CLASSES.forEach(cls => { map[cls] = []; });
    students.forEach(s => {
      if (!map[s.class]) map[s.class] = [];
      map[s.class].push(s);
    });
    Object.keys(map).forEach(cls => {
      map[cls].sort((a, b) => a.cicno.localeCompare(b.cicno, undefined, { numeric: true }));
    });
    return map;
  }, [students]);

  // Save Schedule Time Handler
  const handleSaveSchedule = async (dateStr: string) => {
    if (!editStartTime || !editEndTime) {
      toast.error('Both start and end time are required.');
      return;
    }
    setIsSavingSchedule(true);
    try {
      const res = await saveDaySchedule({
        date: dateStr,
        startTime: editStartTime,
        endTime: editEndTime
      });
      if (res.success) {
        toast.success(`Schedule saved for ${formatDisplayDate(dateStr)}: ${formatTimeAMPM(editStartTime)} - ${formatTimeAMPM(editEndTime)}`);
        setEditingDayDate(null);
      } else {
        toast.error(res.error || 'Failed to save schedule');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred');
    }
    setIsSavingSchedule(false);
  };

  // Unlock Class for 5 Minutes Handler
  const handleUnlockClass = async (dateStr: string, className: string) => {
    try {
      const res = await unlockClassForFiveMinutes({ date: dateStr, className });
      if (res.success) {
        toast.success(`Unlocked ${className} for 5 minutes! Class Leader can now submit.`);
      } else {
        toast.error(res.error || 'Failed to unlock class');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred');
    }
  };

  // Copy Day Attendance Summary to clipboard
  const handleCopyDayStrength = (dateStr: string) => {
    const recordsForDate = dayRecords.filter(r => r.date === dateStr);
    const presentCount = recordsForDate.filter(r => r.status === 'present').length;
    const lateCount = recordsForDate.filter(r => r.status === 'late').length;
    const medicalCount = recordsForDate.filter(r => r.status === 'medical').length;
    const totalPresentLateMed = presentCount + lateCount + medicalCount;
    const totalCollege = students.length;

    const copyText = `Total Strength of ${formatDisplayDate(dateStr, false)} is: ${totalPresentLateMed} / ${totalCollege}`;
    navigator.clipboard.writeText(copyText);
    toast.success(`Copied: "${copyText}"`);
  };

  // Export Day Attendance PDF
  const handleExportDayPdf = (dateStr: string) => {
    const recordsForDate = dayRecords.filter(r => r.date === dateStr);
    const recMap = new Map<string, 'present' | 'leave' | 'late' | 'medical'>();
    recordsForDate.forEach(r => recMap.set(r.student_cicno, r.status));

    const classesSummary: ClassPdfSummary[] = VALID_CLASSES.map(clsName => {
      const classStudents = studentsByClass[clsName] || [];
      let p = 0, l = 0, lt = 0, m = 0;
      const studentPdfRows = classStudents.map(s => {
        const st = recMap.get(s.cicno) || 'present';
        if (st === 'present') p++;
        else if (st === 'late') lt++;
        else if (st === 'medical') m++;
        else if (st === 'leave') l++;
        return {
          cicno: s.cicno,
          name: s.name,
          class: clsName,
          status: st
        };
      });
      return {
        className: clsName,
        totalStudents: classStudents.length,
        present: p,
        late: lt,
        medical: m,
        leave: l,
        students: studentPdfRows
      };
    });

    const presentTotal = recordsForDate.filter(r => r.status === 'present').length;
    const lateTotal = recordsForDate.filter(r => r.status === 'late').length;
    const medTotal = recordsForDate.filter(r => r.status === 'medical').length;
    const totalStrength = presentTotal + lateTotal + medTotal;

    exportDayAttendancePdf({
      date: dateStr,
      classesSummary,
      totalStrength,
      totalCollegeStudents: students.length
    });
    toast.success('Day Attendance PDF generated');
  };

  // Create Special Attendance Handler
  const handleCreateSpecialAttendance = async () => {
    if (!newSpecialName.trim()) {
      toast.error('Special attendance name is required.');
      return;
    }
    if (newSpecialClasses.length === 0) {
      toast.error('Select at least one class.');
      return;
    }
    setIsCreatingSpecial(true);
    try {
      const res = await createSpecialAttendance({
        name: newSpecialName,
        subtitle: newSpecialSubtitle,
        date: newSpecialDate,
        targetClasses: newSpecialClasses
      });
      if (res.success && res.attendance) {
        toast.success(`Special Attendance "${newSpecialName}" created!`);
        setShowAddSpecialModal(false);
        setNewSpecialName('');
        setNewSpecialSubtitle('');
        setSelectedSpecialId(res.attendance.id);
        setSelectedSpecialClass(res.attendance.target_classes[0] || VALID_CLASSES[0]);
      } else {
        toast.error(res.error || 'Failed to create');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred');
    }
    setIsCreatingSpecial(false);
  };

  // Current selected special attendance
  const currentSpecial = useMemo(() => {
    return specialAttendances.find(s => s.id === selectedSpecialId) || null;
  }, [specialAttendances, selectedSpecialId]);

  // Synchronize special form statuses when switching special attendance or class
  useEffect(() => {
    if (!currentSpecial) return;
    const records = specialRecords.filter(
      r => r.special_attendance_id === currentSpecial.id && r.student_class === selectedSpecialClass
    );
    const map: Record<string, 'present' | 'not attend' | 'leave' | 'medical'> = {};
    records.forEach(r => {
      map[r.student_cicno] = r.status;
    });
    setSpecialFormStatuses(map);
  }, [currentSpecial, selectedSpecialClass, specialRecords]);

  // Save Special Attendance for selected class (College Leader)
  const handleSaveSpecialClass = async () => {
    if (!currentSpecial) return;
    setIsSavingSpecialClass(true);
    try {
      const classStudents = studentsByClass[selectedSpecialClass] || [];
      const recordsToSave = classStudents.map(s => ({
        cicno: s.cicno,
        status: specialFormStatuses[s.cicno] || 'present'
      }));

      const res = await saveSpecialAttendanceForClass({
        specialAttendanceId: currentSpecial.id,
        className: selectedSpecialClass,
        records: recordsToSave
      });

      if (res.success) {
        toast.success(`Saved Special Attendance for ${selectedSpecialClass}! Class Leader locked.`);
      } else {
        toast.error(res.error || 'Failed to save');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error occurred');
    }
    setIsSavingSpecialClass(false);
  };

  // Copy Special Attendance Summary
  const handleCopySpecialStrength = () => {
    if (!currentSpecial) return;
    const recordsForSession = specialRecords.filter(r => r.special_attendance_id === currentSpecial.id);
    const presentCount = recordsForSession.filter(r => r.status === 'present').length;
    const totalEligible = currentSpecial.target_classes.reduce((sum, cls) => sum + (studentsByClass[cls]?.length || 0), 0);

    const copyText = `Total Strength of ${currentSpecial.name} is: ${presentCount} / ${totalEligible}`;
    navigator.clipboard.writeText(copyText);
    toast.success(`Copied: "${copyText}"`);
  };

  // Export Special Attendance PDF
  const handleExportSpecialPdf = () => {
    if (!currentSpecial) return;
    const recordsForSession = specialRecords.filter(r => r.special_attendance_id === currentSpecial.id);
    const recMap = new Map<string, 'present' | 'not attend' | 'leave' | 'medical'>();
    recordsForSession.forEach(r => recMap.set(r.student_cicno, r.status));

    const classesSummary: ClassPdfSummary[] = currentSpecial.target_classes.map(clsName => {
      const classStudents = studentsByClass[clsName] || [];
      let p = 0, l = 0, na = 0, m = 0;
      const studentPdfRows = classStudents.map(s => {
        const st = recMap.get(s.cicno) || 'present';
        if (st === 'present') p++;
        else if (st === 'not attend') na++;
        else if (st === 'leave') l++;
        else if (st === 'medical') m++;
        return {
          cicno: s.cicno,
          name: s.name,
          class: clsName,
          status: st
        };
      });
      return {
        className: clsName,
        totalStudents: classStudents.length,
        present: p,
        leave: l,
        medical: m,
        notAttend: na,
        students: studentPdfRows
      };
    });

    const totalPresent = recordsForSession.filter(r => r.status === 'present').length;
    const totalEligible = currentSpecial.target_classes.reduce((sum, cls) => sum + (studentsByClass[cls]?.length || 0), 0);

    exportSpecialAttendancePdf({
      attendanceName: currentSpecial.name,
      subtitle: currentSpecial.subtitle,
      date: currentSpecial.date,
      classesSummary,
      totalStrength: totalPresent,
      totalEligibleStudents: totalEligible
    });
    toast.success('Special Attendance PDF generated');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <CalendarCheck className="w-7 h-7 text-primary" />
              <span>Manage Attendance</span>
            </h1>
            {isLiveConnected && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control daily scheduled attendance, real-time class locks, and ad-hoc special sessions.
          </p>
        </div>

        {/* Primary Tabs */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setMainTab('day')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
              mainTab === 'day'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Day Attendance</span>
          </button>
          <button
            type="button"
            onClick={() => setMainTab('special')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
              mainTab === 'special'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Special Attendance</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: DAY ATTENDANCE                                                 */}
      {/* ========================================================================= */}
      {mainTab === 'day' && (
        <div className="space-y-6">
          {/* Sub-tabs: Upcoming vs Past */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/40 p-2 rounded-lg border border-border">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDaySubTab('upcoming')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  daySubTab === 'upcoming'
                    ? 'bg-background text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Upcoming (Next 5 Days)
              </button>
              <button
                type="button"
                onClick={() => setDaySubTab('past')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  daySubTab === 'past'
                    ? 'bg-background text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Past & Concluded
              </button>
            </div>

            <div className="text-xs text-muted-foreground">
              Kerala Time: <strong className="text-foreground font-mono">{currentTime}</strong> (Default: 7:00 AM – 7:05 AM)
            </div>
          </div>

          {/* UPCOMING VIEW */}
          {daySubTab === 'upcoming' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {upcomingFiveDays.map((item, idx) => {
                  const isEditing = editingDayDate === item.dateStr;
                  const isToday = item.dateStr === todayDate;

                  return (
                    <div
                      key={item.dateStr}
                      className={`relative rounded-xl border p-4 transition-all cursor-pointer flex flex-col justify-between ${
                        isEditing
                          ? 'border-primary ring-2 ring-primary/20 bg-card shadow-sm'
                          : isToday
                          ? 'border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500'
                          : 'border-border bg-card hover:border-border/80 hover:shadow-xs'
                      }`}
                      onClick={() => {
                        if (isEditing) {
                          setEditingDayDate(null);
                        } else {
                          setEditingDayDate(item.dateStr);
                          setEditStartTime(item.startTime);
                          setEditEndTime(item.endTime);
                        }
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Day {idx + 1} {isToday && '• Today'}
                          </span>
                          <Clock className={`w-3.5 h-3.5 ${isToday ? 'text-emerald-600' : 'text-primary'}`} />
                        </div>
                        <h3 className="text-sm font-bold text-foreground mt-1">
                          {formatDisplayDate(item.dateStr)}
                        </h3>
                        <p className="text-xs font-semibold text-primary mt-2 flex items-center gap-1">
                          <span>{formatTimeAMPM(item.startTime)}</span>
                          <span>–</span>
                          <span>{formatTimeAMPM(item.endTime)}</span>
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Click to edit</span>
                        {isEditing ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time Editing Option (Scroll-down / expanded card) */}
              {editingDayDate && (
                <div className="bg-card border border-primary/40 rounded-xl p-5 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-bold text-sm text-foreground">
                          Edit Attendance Time Window for {formatDisplayDate(editingDayDate)}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Set the exact 5-minute (or custom) window when class leaders can submit attendance.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingDayDate(null)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        Starting Time (Kerala IST)
                      </label>
                      <input
                        type="time"
                        value={editStartTime}
                        onChange={e => setEditStartTime(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        Ending Time (Kerala IST)
                      </label>
                      <input
                        type="time"
                        value={editEndTime}
                        onChange={e => setEditEndTime(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-muted-foreground font-medium">Quick presets:</span>
                    <button
                      type="button"
                      onClick={() => { setEditStartTime('07:00'); setEditEndTime('07:05'); }}
                      className="px-2.5 py-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded font-medium cursor-pointer border border-border"
                    >
                      Default Morning (07:00 – 07:05 AM)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditStartTime('09:45'); setEditEndTime('09:50'); }}
                      className="px-2.5 py-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded font-medium cursor-pointer border border-border"
                    >
                      Weekly Variant (09:45 – 09:50 AM)
                    </button>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingDayDate(null)}
                      className="px-4 py-2 text-xs font-semibold text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-md cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingSchedule}
                      onClick={() => handleSaveSchedule(editingDayDate)}
                      className="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:brightness-95 rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSavingSchedule ? 'Saving...' : 'Save Schedule Time'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PAST VIEW */}
          {daySubTab === 'past' && (
            <div className="space-y-6">
              {/* Date Selector Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
                {pastDates.length === 0 ? (
                  <span className="text-xs text-muted-foreground py-2">No past attendance records yet.</span>
                ) : (
                  pastDates.map(dateStr => {
                    const isSelected = selectedPastDate === dateStr;
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedPastDate(dateStr)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {formatDisplayDate(dateStr)}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Selected Past Date Details */}
              {selectedPastDate && (
                <div className="space-y-4">
                  {/* Action Bar: Strength stats + Copy Button + Export PDF */}
                  {(() => {
                    const recordsForDate = dayRecords.filter(r => r.date === selectedPastDate);
                    const presentCount = recordsForDate.filter(r => r.status === 'present').length;
                    const lateCount = recordsForDate.filter(r => r.status === 'late').length;
                    const medicalCount = recordsForDate.filter(r => r.status === 'medical').length;
                    const leaveCount = recordsForDate.filter(r => r.status === 'leave').length;
                    const strength = presentCount + lateCount + medicalCount;
                    const totalStudents = students.length;

                    return (
                      <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                              Day Attendance Summary
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDisplayDate(selectedPastDate)}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-xl font-bold text-foreground">
                              Total Strength: <span className="text-emerald-600 dark:text-emerald-400">{strength}</span> / {totalStudents}
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              ({presentCount} Present, {lateCount} Late, {medicalCount} Medical, {leaveCount} Leave)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 w-full md:w-auto">
                          <button
                            type="button"
                            onClick={() => handleCopyDayStrength(selectedPastDate)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md text-xs font-semibold border border-border shadow-xs cursor-pointer transition-colors"
                            title="Copy total strength summary text"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Strength</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportDayPdf(selectedPastDate)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground hover:brightness-95 rounded-md text-xs font-bold shadow-xs cursor-pointer transition-all"
                            title="Export PDF Report"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Export PDF</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 12 Classes Cards / Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {VALID_CLASSES.map(clsName => {
                      const classStudents = studentsByClass[clsName] || [];
                      const recordsForClass = dayRecords.filter(r => r.date === selectedPastDate && r.student_class === clsName);
                      const isAttended = recordsForClass.length > 0;

                      // Check unlock status
                      const unlockRecord = dayUnlocks.find(u => u.date === selectedPastDate && u.class === clsName);
                      const isCurrentlyUnlocked = isClassUnlockActive(unlockRecord?.unlocked_until);
                      const secondsRemaining = getRemainingSeconds(unlockRecord?.unlocked_until);

                      return (
                        <div
                          key={clsName}
                          className="bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-foreground">{clsName}</h4>
                                <span className="text-[11px] text-muted-foreground font-medium">
                                  ({classStudents.length} students)
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                {isAttended ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Attended
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                    <AlertCircle className="w-3 h-3" />
                                    Not Attended
                                  </span>
                                )}

                                {isCurrentlyUnlocked ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 animate-pulse">
                                    <Unlock className="w-3 h-3" />
                                    Unlocked ({formatSecondsMMSS(secondsRemaining)})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
                                    <Lock className="w-3 h-3" />
                                    Locked
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Unlock Button */}
                            <button
                              type="button"
                              onClick={() => handleUnlockClass(selectedPastDate, clsName)}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 transition-colors cursor-pointer"
                              title="Unlock this class for 5 minutes"
                            >
                              Unlock (5m)
                            </button>
                          </div>

                          {/* Quick Stats Summary for this class */}
                          {isAttended && (
                            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Present: <strong className="text-foreground">{recordsForClass.filter(r => r.status === 'present').length}</strong></span>
                              <span>Late: <strong className="text-foreground">{recordsForClass.filter(r => r.status === 'late').length}</strong></span>
                              <span>Medical: <strong className="text-foreground">{recordsForClass.filter(r => r.status === 'medical').length}</strong></span>
                              <span>Leave: <strong className="text-foreground">{recordsForClass.filter(r => r.status === 'leave').length}</strong></span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: SPECIAL ATTENDANCE                                             */}
      {/* ========================================================================= */}
      {mainTab === 'special' && (
        <div className="space-y-6">
          {/* Top Bar: Sessions Selector + Add New Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/40 p-3 rounded-xl border border-border">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              <span className="text-xs font-bold text-muted-foreground uppercase whitespace-nowrap">
                Sessions:
              </span>
              {specialAttendances.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">No special attendances created yet.</span>
              ) : (
                specialAttendances.map(s => {
                  const isSelected = selectedSpecialId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedSpecialId(s.id);
                        if (s.target_classes.length > 0 && !s.target_classes.includes(selectedSpecialClass)) {
                          setSelectedSpecialClass(s.target_classes[0]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {s.name} ({formatDisplayDate(s.date, false)})
                    </button>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAddSpecialModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground hover:brightness-95 rounded-md text-xs font-bold shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Special Attendance</span>
            </button>
          </div>

          {/* Special Attendance Detail View */}
          {currentSpecial ? (
            <div className="space-y-5">
              {/* Summary Header */}
              {(() => {
                const recordsForSession = specialRecords.filter(r => r.special_attendance_id === currentSpecial.id);
                const presentCount = recordsForSession.filter(r => r.status === 'present').length;
                const totalEligible = currentSpecial.target_classes.reduce(
                  (sum, cls) => sum + (studentsByClass[cls]?.length || 0), 0
                );

                return (
                  <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                          Special Session
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          {formatDisplayDate(currentSpecial.date)}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-foreground mt-1">
                        {currentSpecial.name}
                      </h2>
                      {currentSpecial.subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5">{currentSpecial.subtitle}</p>
                      )}
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        Total Strength: {presentCount} / {totalEligible} Present
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 w-full md:w-auto">
                      <button
                        type="button"
                        onClick={handleCopySpecialStrength}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md text-xs font-semibold border border-border shadow-xs cursor-pointer"
                        title="Copy special attendance strength"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Strength</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportSpecialPdf}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground hover:brightness-95 rounded-md text-xs font-bold shadow-xs cursor-pointer"
                        title="Export Special Attendance PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Export PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Class Tabs / Breadcrumbs */}
              <div className="bg-muted/40 p-1.5 rounded-lg border border-border flex items-center gap-1 overflow-x-auto">
                {currentSpecial.target_classes.map(clsName => {
                  const isSelected = selectedSpecialClass === clsName;
                  const statusRow = specialClassStatuses.find(
                    s => s.special_attendance_id === currentSpecial.id && s.class === clsName
                  );
                  const isSaved = !!statusRow;

                  return (
                    <button
                      key={clsName}
                      type="button"
                      onClick={() => setSelectedSpecialClass(clsName)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background'
                      }`}
                    >
                      <span>{clsName}</span>
                      {isSaved && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Class Student Roster for Marking */}
              {(() => {
                const classStudents = studentsByClass[selectedSpecialClass] || [];
                const classStatus = specialClassStatuses.find(
                  s => s.special_attendance_id === currentSpecial.id && s.class === selectedSpecialClass
                );

                return (
                  <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
                    {/* Header with Save Button & Last saved timestamp */}
                    <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-foreground">
                            {selectedSpecialClass} Attendance List
                          </h3>
                          <span className="text-xs text-muted-foreground font-medium">
                            ({classStudents.length} students)
                          </span>
                        </div>
                        {classStatus && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Last saved by <strong className="text-foreground">{classStatus.saved_by_role === 'clgleader' ? 'College Leader' : 'Class Leader'}</strong> on {new Date(classStatus.saved_at).toLocaleTimeString('en-GB')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const newMap: Record<string, 'present'> = {};
                            classStudents.forEach(s => { newMap[s.cicno] = 'present'; });
                            setSpecialFormStatuses(prev => ({ ...prev, ...newMap }));
                            toast.success(`Marked all ${selectedSpecialClass} students as Present`);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-md border border-border cursor-pointer"
                        >
                          Mark All Present
                        </button>

                        <button
                          type="button"
                          disabled={isSavingSpecialClass}
                          onClick={handleSaveSpecialClass}
                          className="px-4 py-1.5 text-xs font-bold text-primary-foreground bg-primary hover:brightness-95 rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {isSavingSpecialClass ? 'Saving...' : `Save ${selectedSpecialClass}`}
                        </button>
                      </div>
                    </div>

                    {/* Table of Students (Ordered by CIC Number Ascending) */}
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
                          {classStudents.map((student, idx) => {
                            const upperName = (student.name || '').toUpperCase();
                            const currentStatus = specialFormStatuses[student.cicno] || 'present';

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
                                    value={currentStatus}
                                    onChange={e => {
                                      const val = e.target.value as any;
                                      setSpecialFormStatuses(prev => ({
                                        ...prev,
                                        [student.cicno]: val
                                      }));
                                    }}
                                    className={`px-3 py-1 rounded text-xs font-bold border focus:outline-none cursor-pointer ${
                                      currentStatus === 'present'
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                        : currentStatus === 'not attend'
                                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                                        : currentStatus === 'leave'
                                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                                    }`}
                                  >
                                    <option value="present">Present</option>
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
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 text-center space-y-3">
              <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
              <h3 className="text-base font-bold text-foreground">No Special Attendance Selected</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Create a special attendance session or select an existing one above to mark and review attendance.
              </p>
              <button
                type="button"
                onClick={() => setShowAddSpecialModal(true)}
                className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md cursor-pointer"
              >
                Add Special Attendance
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW SPECIAL ATTENDANCE                                         */}
      {/* ========================================================================= */}
      {showAddSpecialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Create Special Attendance</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSpecialModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Attendance Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maghrib Masjid Attendance, Morning Assembly"
                  value={newSpecialName}
                  onChange={e => setNewSpecialName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Subtitle (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Checking absentees at evening prayer"
                  value={newSpecialSubtitle}
                  onChange={e => setNewSpecialSubtitle(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={newSpecialDate}
                  onChange={e => setNewSpecialDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Participating Classes ({newSpecialClasses.length}/{VALID_CLASSES.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (newSpecialClasses.length === VALID_CLASSES.length) {
                        setNewSpecialClasses([]);
                      } else {
                        setNewSpecialClasses([...VALID_CLASSES]);
                      }
                    }}
                    className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                  >
                    {newSpecialClasses.length === VALID_CLASSES.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {VALID_CLASSES.map(cls => {
                    const isSelected = newSpecialClasses.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setNewSpecialClasses(prev => prev.filter(c => c !== cls));
                          } else {
                            setNewSpecialClasses(prev => [...prev, cls]);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-background text-muted-foreground border-border hover:bg-muted'
                        }`}
                      >
                        {cls}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddSpecialModal(false)}
                className="px-4 py-2 text-xs font-semibold text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreatingSpecial}
                onClick={handleCreateSpecialAttendance}
                className="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:brightness-95 rounded-md shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isCreatingSpecial ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
