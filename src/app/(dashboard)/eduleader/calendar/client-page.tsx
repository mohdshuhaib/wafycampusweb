'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Check, 
  X, 
  RotateCcw, 
  Printer, 
  Sparkles, 
  Info
} from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  upsertCalendarDay, 
  deleteCalendarDay, 
  resetCalendarSemester,
  CalendarStatus 
} from './actions';

export type MonthConfig = {
  name: string;
  days: number;
  monthIndex: number; // 0 for Jan, 1 for Feb, ..., 11 for Dec
};

// Semester 1: June, July, August, September, October (153 Days)
export const SEMESTER_1_MONTHS: MonthConfig[] = [
  { name: 'June', days: 30, monthIndex: 5 },
  { name: 'July', days: 31, monthIndex: 6 },
  { name: 'August', days: 31, monthIndex: 7 },
  { name: 'September', days: 30, monthIndex: 8 },
  { name: 'October', days: 31, monthIndex: 9 },
];

// Semester 2: November, December, January, February (29 days full), March, April, May (213 Days)
export const SEMESTER_2_MONTHS: MonthConfig[] = [
  { name: 'November', days: 30, monthIndex: 10 },
  { name: 'December', days: 31, monthIndex: 11 },
  { name: 'January', days: 31, monthIndex: 0 },
  { name: 'February', days: 29, monthIndex: 1 }, // Full 29 days always
  { name: 'March', days: 31, monthIndex: 2 },
  { name: 'April', days: 30, monthIndex: 3 },
  { name: 'May', days: 31, monthIndex: 4 },
];

export const TOTAL_SEM1_DAYS = SEMESTER_1_MONTHS.reduce((sum, m) => sum + m.days, 0); // 153
export const TOTAL_SEM2_DAYS = SEMESTER_2_MONTHS.reduce((sum, m) => sum + m.days, 0); // 213
export const TOTAL_YEAR_DAYS = TOTAL_SEM1_DAYS + TOTAL_SEM2_DAYS; // 366 (12 Months)

const STATUS_CONFIG: Record<CalendarStatus, { 
  label: string; 
  category: 'academic' | 'leave'; 
  colorName: string;
  badgeClass: string; 
  cellActiveClass: string;
  legendBorder: string;
}> = {
  'period': {
    label: 'Period (Working Day)',
    category: 'academic',
    colorName: 'Green',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    cellActiveClass: 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs',
    legendBorder: 'border-emerald-500'
  },
  'leave': {
    label: 'Leave (Non-Working)',
    category: 'leave',
    colorName: 'Orange',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    cellActiveClass: 'bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-xs ring-2 ring-amber-400',
    legendBorder: 'border-amber-500'
  },
  'exam': {
    label: 'Exam',
    category: 'academic',
    colorName: 'Blue',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    cellActiveClass: 'bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs ring-2 ring-blue-400',
    legendBorder: 'border-blue-500'
  },
  'wafy-leave': {
    label: 'Wafy Leave',
    category: 'leave',
    colorName: 'Red',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    cellActiveClass: 'bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs ring-2 ring-rose-400',
    legendBorder: 'border-rose-500'
  }
};

export default function WafyCalendarClient({
  initialEntries = []
}: {
  initialEntries?: any[];
}) {
  const toast = useToast();
  const [activeSemester, setActiveSemester] = useState<'sem1' | 'sem2' | 'both'>('sem1');
  const [activeTool, setActiveTool] = useState<CalendarStatus | 'clear' | null>(null);

  // Key format: `${semester}_${month_name}_${day}` -> CalendarStatus
  // By DEFAULT: If key does NOT exist, status is 'period' (Green Academic Working Day)
  const [calendarMap, setCalendarMap] = useState<Record<string, CalendarStatus>>(() => {
    const map: Record<string, CalendarStatus> = {};
    initialEntries.forEach((entry: any) => {
      // Exclude legacy sem1 November entries since November is now strictly Sem 2
      if (entry.semester === 'sem1' && entry.month_name === 'November') return;
      const key = `${entry.semester}_${entry.month_name}_${entry.day}`;
      map[key] = entry.status;
    });
    return map;
  });

  const [notesMap, setNotesMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    initialEntries.forEach((entry: any) => {
      if (entry.semester === 'sem1' && entry.month_name === 'November') return;
      if (entry.note) {
        const key = `${entry.semester}_${entry.month_name}_${entry.day}`;
        map[key] = entry.note;
      }
    });
    return map;
  });

  const [selectedDayInfo, setSelectedDayInfo] = useState<{
    semester: 'sem1' | 'sem2';
    monthName: string;
    monthIndex: number;
    day: number;
  } | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  // Sync with localStorage as instant backup
  useEffect(() => {
    const saved = localStorage.getItem('wafy_calendar_entries');
    if (saved && Object.keys(calendarMap).length === 0) {
      try {
        const parsed = JSON.parse(saved);
        const cleaned: Record<string, CalendarStatus> = {};
        Object.entries(parsed).forEach(([k, v]) => {
          if (!k.startsWith('sem1_November_')) {
            cleaned[k] = v as CalendarStatus;
          }
        });
        setCalendarMap(cleaned);
      } catch (e) {}
    }
  }, [calendarMap]);

  const saveToLocal = (newMap: Record<string, CalendarStatus>) => {
    localStorage.setItem('wafy_calendar_entries', JSON.stringify(newMap));
  };

  // Helper to get key
  const getKey = (semester: 'sem1' | 'sem2', monthName: string, day: number) => 
    `${semester}_${monthName}_${day}`;

  // Helper to get day status with default 'period'
  const getDayStatus = (semester: 'sem1' | 'sem2', monthName: string, day: number): CalendarStatus => {
    const key = getKey(semester, monthName, day);
    return calendarMap[key] || 'period';
  };

  // Toggle or stamp a day
  const handleDayClick = async (semester: 'sem1' | 'sem2', month: MonthConfig, day: number) => {
    const key = getKey(semester, month.name, day);
    const currentStatus = getDayStatus(semester, month.name, day);

    if (activeTool) {
      // Paint mode: Stamp the active tool
      const nextMap = { ...calendarMap };
      if (activeTool === 'clear' || activeTool === 'period' || currentStatus === activeTool) {
        // Reset to default 'period' (Green Working Day)
        delete nextMap[key];
        setCalendarMap(nextMap);
        saveToLocal(nextMap);
        await deleteCalendarDay(semester, month.name, day);
      } else {
        // Mark exception (leave, wafy-leave, or exam)
        nextMap[key] = activeTool;
        setCalendarMap(nextMap);
        saveToLocal(nextMap);
        await upsertCalendarDay({
          semester,
          month_name: month.name,
          month_index: month.monthIndex,
          day,
          status: activeTool,
          note: notesMap[key]
        });
      }
    } else {
      // Open selector dialog
      setSelectedDayInfo({
        semester,
        monthName: month.name,
        monthIndex: month.monthIndex,
        day
      });
    }
  };

  // Set status from modal picker
  const setStatusFromPicker = async (status: CalendarStatus | 'clear') => {
    if (!selectedDayInfo) return;
    const { semester, monthName, monthIndex, day } = selectedDayInfo;
    const key = getKey(semester, monthName, day);
    const nextMap = { ...calendarMap };

    if (status === 'clear' || status === 'period') {
      // Reset back to default Academic Working Day (Period)
      delete nextMap[key];
      setCalendarMap(nextMap);
      saveToLocal(nextMap);
      setSelectedDayInfo(null);
      await deleteCalendarDay(semester, monthName, day);
      toast.success(`${monthName} ${day} set to Default Working Day (Period)`);
    } else {
      nextMap[key] = status;
      setCalendarMap(nextMap);
      saveToLocal(nextMap);
      setSelectedDayInfo(null);
      await upsertCalendarDay({
        semester,
        month_name: monthName,
        month_index: monthIndex,
        day,
        status,
        note: notesMap[key]
      });
      toast.success(`${monthName} ${day} set to ${STATUS_CONFIG[status].label}`);
    }
  };

  // Compute Metrics with ALL DAYS DEFAULTING TO PERIOD (GREEN)
  const stats = useMemo(() => {
    let sem1Period = 0;
    let sem1Exam = 0;
    let sem1Leave = 0;
    let sem1WafyLeave = 0;

    let sem2Period = 0;
    let sem2Exam = 0;
    let sem2Leave = 0;
    let sem2WafyLeave = 0;

    // Calculate Semester 1
    SEMESTER_1_MONTHS.forEach(m => {
      for (let d = 1; d <= m.days; d++) {
        const key = getKey('sem1', m.name, d);
        const st = calendarMap[key] || 'period';
        if (st === 'period') sem1Period++;
        else if (st === 'exam') sem1Exam++;
        else if (st === 'leave') sem1Leave++;
        else if (st === 'wafy-leave') sem1WafyLeave++;
      }
    });

    // Calculate Semester 2
    SEMESTER_2_MONTHS.forEach(m => {
      for (let d = 1; d <= m.days; d++) {
        const key = getKey('sem2', m.name, d);
        const st = calendarMap[key] || 'period';
        if (st === 'period') sem2Period++;
        else if (st === 'exam') sem2Exam++;
        else if (st === 'leave') sem2Leave++;
        else if (st === 'wafy-leave') sem2WafyLeave++;
      }
    });

    const sem1Academic = sem1Period + sem1Exam;
    const sem1NonAcademic = sem1Leave + sem1WafyLeave;
    const sem2Academic = sem2Period + sem2Exam;
    const sem2NonAcademic = sem2Leave + sem2WafyLeave;

    const totalAcademic = sem1Academic + sem2Academic;
    const totalNonAcademic = sem1NonAcademic + sem2NonAcademic;
    const totalDays = TOTAL_YEAR_DAYS;

    return {
      sem1: {
        academic: sem1Academic,
        nonAcademic: sem1NonAcademic,
        period: sem1Period,
        exam: sem1Exam,
        leave: sem1Leave,
        wafyLeave: sem1WafyLeave,
        total: TOTAL_SEM1_DAYS
      },
      sem2: {
        academic: sem2Academic,
        nonAcademic: sem2NonAcademic,
        period: sem2Period,
        exam: sem2Exam,
        leave: sem2Leave,
        wafyLeave: sem2WafyLeave,
        total: TOTAL_SEM2_DAYS
      },
      overall: {
        academic: totalAcademic,
        nonAcademic: totalNonAcademic,
        period: sem1Period + sem2Period,
        exam: sem1Exam + sem2Exam,
        leave: sem1Leave + sem2Leave,
        wafyLeave: sem1WafyLeave + sem2WafyLeave,
        total: totalDays
      }
    };
  }, [calendarMap]);

  // Current view stats based on activeSemester tab
  const currentViewStats = useMemo(() => {
    if (activeSemester === 'sem1') return stats.sem1;
    if (activeSemester === 'sem2') return stats.sem2;
    return stats.overall;
  }, [activeSemester, stats]);

  // Reset to default working days
  const handleClearSemester = async () => {
    const semLabel = activeSemester === 'both' ? 'All Semesters' : activeSemester === 'sem1' ? 'Semester 1' : 'Semester 2';
    if (!confirm(`Are you sure you want to reset all days in ${semLabel} to default Academic Working Days (Period - Green)?`)) return;

    const nextMap = { ...calendarMap };
    Object.keys(nextMap).forEach(key => {
      if (activeSemester === 'both' || key.startsWith(`${activeSemester}_`)) {
        delete nextMap[key];
      }
    });
    setCalendarMap(nextMap);
    saveToLocal(nextMap);
    await resetCalendarSemester(activeSemester === 'both' ? undefined : activeSemester);
    toast.success(`${semLabel} reset to Default Academic Working Days (Green).`);
  };

  // Export PDF Report
  const handleExportPdf = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const primaryColor = [24, 24, 27];

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Wafy Academic Calendar Report', 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 27);

      // Summary Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 33, 182, 32, 2, 2, 'F');

      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(`Total Academic Days: ${stats.overall.academic} / ${stats.overall.total} (Period: ${stats.overall.period}, Exam: ${stats.overall.exam})`, 20, 43);
      doc.text(`Total Non-Working Days: ${stats.overall.nonAcademic} (Leave: ${stats.overall.leave}, Wafy Leave: ${stats.overall.wafyLeave})`, 20, 52);
      doc.text(`Semester 1 Academic: ${stats.sem1.academic} / ${stats.sem1.total}  |  Semester 2 Academic: ${stats.sem2.academic} / ${stats.sem2.total}`, 20, 61);

      // Table Breakdown
      const tableRows: any[] = [];

      // Helper to process month rows
      const addMonthRows = (months: MonthConfig[], semName: string, semCode: 'sem1' | 'sem2') => {
        months.forEach(m => {
          let pCount = 0, eCount = 0, lCount = 0, wlCount = 0;
          for (let d = 1; d <= m.days; d++) {
            const st = calendarMap[getKey(semCode, m.name, d)] || 'period';
            if (st === 'period') pCount++;
            else if (st === 'exam') eCount++;
            else if (st === 'leave') lCount++;
            else if (st === 'wafy-leave') wlCount++;
          }
          const acadTotal = pCount + eCount;
          const leaveTotal = lCount + wlCount;
          tableRows.push([
            semName,
            m.name,
            `${m.days} days`,
            `${acadTotal} (Period: ${pCount}, Exam: ${eCount})`,
            `${leaveTotal} (Leave: ${lCount}, Wafy: ${wlCount})`
          ]);
        });
      };

      addMonthRows(SEMESTER_1_MONTHS, 'Semester 1', 'sem1');
      addMonthRows(SEMESTER_2_MONTHS, 'Semester 2', 'sem2');

      autoTable(doc, {
        startY: 73,
        head: [['Semester', 'Month', 'Total Days', 'Academic Working Days', 'Leave / Non-Working']],
        body: tableRows,
        headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontStyle: 'bold' },
        styles: { cellPadding: 3.5, fontSize: 9, valign: 'middle' },
        columnStyles: {
          0: { cellWidth: 28, fontStyle: 'bold' },
          1: { cellWidth: 28, fontStyle: 'bold' },
          2: { cellWidth: 24 },
          3: { cellWidth: 52 },
          4: { cellWidth: 50 }
        }
      });

      doc.save('Wafy_Calendar.pdf');
      toast.success('Calendar exported to PDF');
    } catch (e: any) {
      toast.error('Failed to export PDF');
    }
    setIsExporting(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-primary" />
            <span>Wafy Calendar</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage Academic Working Days & Non-Working exceptions across Semester 1 and Semester 2 (full 29 days in February).
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:brightness-95 text-primary-foreground rounded-md text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> {isExporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Default Rule Banner */}
      <div className="flex items-start sm:items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 px-3.5 py-2.5 rounded-lg text-xs leading-relaxed">
        <Info className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5 sm:mt-0" />
        <div>
          <span className="font-bold">Default Setup:</span> All dates are <strong>Academic Working Days (Green Period)</strong> by default. Click on any date or use the quick paint tool below to define non-working exceptions (<strong>Leave - Orange</strong>, <strong>Wafy Leave - Red</strong>) or <strong>Exam (Blue)</strong>.
        </div>
      </div>

      {/* Global Color Badges & Legend Bar */}
      <div className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Status Legend & Quick Paint Mode
            </span>
          </div>

          {activeTool && (
            <span className="text-[11px] text-primary font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Active Paint Mode: {activeTool === 'clear' ? 'Eraser (Reset to Default Period)' : STATUS_CONFIG[activeTool].label} — Click any date to stamp
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tool Buttons */}
          {(['period', 'leave', 'exam', 'wafy-leave'] as CalendarStatus[]).map(st => {
            const config = STATUS_CONFIG[st];
            const isToolActive = activeTool === st;

            return (
              <button
                key={st}
                type="button"
                onClick={() => setActiveTool(isToolActive ? null : st)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                  isToolActive 
                    ? `${config.cellActiveClass} ring-2 ring-ring ring-offset-1`
                    : `${config.badgeClass} hover:brightness-95`
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${
                  st === 'period' ? 'bg-emerald-500' :
                  st === 'leave' ? 'bg-amber-500' :
                  st === 'exam' ? 'bg-blue-600' :
                  'bg-rose-600'
                }`} />
                <span>{st === 'period' ? 'Period (Default)' : config.label}</span>
                <span className="text-[10px] opacity-80">({config.category === 'academic' ? 'Academic' : 'Non-Working'})</span>
                {isToolActive && <Check className="w-3 h-3 ml-0.5" />}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'clear' ? null : 'clear')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer ${
              activeTool === 'clear'
                ? 'bg-destructive text-destructive-foreground font-semibold ring-2 ring-ring'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border'
            }`}
          >
            <RotateCcw className="w-3 h-3" /> Eraser (Default Period)
          </button>

          {activeTool && (
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              className="text-[11px] text-muted-foreground hover:text-foreground underline ml-auto cursor-pointer"
            >
              Exit Paint Mode
            </button>
          )}
        </div>
      </div>

      {/* Academic Days & Leave Counters Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Academic Working Days */}
        <div className="bg-card border border-border rounded-lg p-4 shadow-xs border-l-4 border-l-emerald-500">
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Academic Days
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-foreground">{currentViewStats.academic}</h3>
            <span className="text-xs text-muted-foreground">/ {currentViewStats.total} days</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{currentViewStats.period}</span> Period • <span className="font-semibold text-blue-600 dark:text-blue-400">{currentViewStats.exam}</span> Exam
          </p>
        </div>

        {/* Total Non-Academic / Leave Days */}
        <div className="bg-card border border-border rounded-lg p-4 shadow-xs border-l-4 border-l-amber-500">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Leave / Off Days
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-foreground">{currentViewStats.nonAcademic}</h3>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <span className="font-semibold text-amber-600 dark:text-amber-400">{currentViewStats.leave}</span> Leave • <span className="font-semibold text-rose-600 dark:text-rose-400">{currentViewStats.wafyLeave}</span> Wafy
          </p>
        </div>

        {/* Total Calendar Days */}
        <div className="bg-card border border-border rounded-lg p-4 shadow-xs border-l-4 border-l-primary">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            Total Calendar Days
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-foreground">{currentViewStats.total}</h3>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {activeSemester === 'sem1' ? 'Semester 1 (153 Days)' : activeSemester === 'sem2' ? 'Semester 2 (213 Days)' : 'Both Semesters (366 Days)'}
          </p>
        </div>

        {/* Academic Ratio */}
        <div className="bg-card border border-border rounded-lg p-4 shadow-xs border-l-4 border-l-blue-500">
          <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Academic Ratio
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-foreground">
              {currentViewStats.total > 0 ? Math.round((currentViewStats.academic / currentViewStats.total) * 100) : 100}%
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Working day percentage
          </p>
        </div>
      </div>

      {/* Semester Switcher Tabs & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/40 p-1.5 rounded-lg border border-border">
        <div className="flex flex-wrap gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSemester('sem1')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSemester === 'sem1'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            Semester 1 (Jun – Oct • 153 Days)
          </button>
          <button
            type="button"
            onClick={() => setActiveSemester('sem2')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSemester === 'sem2'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            Semester 2 (Nov – May • 213 Days)
          </button>
          <button
            type="button"
            onClick={() => setActiveSemester('both')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSemester === 'both'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            All 12 Months (366 Days)
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end px-2">
          <span className="text-[11px] text-muted-foreground hidden md:inline">
            12 Months (Sem 1: Jun–Oct • Sem 2: Nov–May)
          </span>
          <button
            type="button"
            onClick={handleClearSemester}
            className="text-[11px] text-destructive hover:underline font-medium cursor-pointer"
          >
            Reset {activeSemester === 'both' ? 'All' : activeSemester === 'sem1' ? 'Sem 1' : 'Sem 2'} to Default Period
          </button>
        </div>
      </div>

      {/* CALENDAR MONTHS DISPLAY */}
      <div className="space-y-8">
        {/* Semester 1 Section */}
        {(activeSemester === 'sem1' || activeSemester === 'both') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-sm bg-accent text-accent-foreground text-xs font-bold uppercase">
                  Semester 1
                </span>
                <h2 className="text-base font-bold text-foreground">
                  June – October ({stats.sem1.academic} / {stats.sem1.total} Academic Days)
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                5 Months • {stats.sem1.period} Periods, {stats.sem1.exam} Exams, {stats.sem1.leave} Leaves, {stats.sem1.wafyLeave} Wafy Leaves
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SEMESTER_1_MONTHS.map(month => (
                <MonthCard
                  key={`sem1_${month.name}`}
                  semester="sem1"
                  month={month}
                  calendarMap={calendarMap}
                  onDayClick={handleDayClick}
                  activeTool={activeTool}
                />
              ))}
            </div>
          </div>
        )}

        {/* Semester 2 Section */}
        {(activeSemester === 'sem2' || activeSemester === 'both') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-sm bg-accent text-accent-foreground text-xs font-bold uppercase">
                  Semester 2
                </span>
                <h2 className="text-base font-bold text-foreground">
                  November – May ({stats.sem2.academic} / {stats.sem2.total} Academic Days)
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                7 Months (February full 29 days) • {stats.sem2.period} Periods, {stats.sem2.exam} Exams, {stats.sem2.leave} Leaves, {stats.sem2.wafyLeave} Wafy Leaves
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SEMESTER_2_MONTHS.map(month => (
                <MonthCard
                  key={`sem2_${month.name}`}
                  semester="sem2"
                  month={month}
                  calendarMap={calendarMap}
                  onDayClick={handleDayClick}
                  activeTool={activeTool}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Day Picker Modal (when not in paint mode) */}
      {selectedDayInfo && (
        <div 
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedDayInfo(null)}
        >
          <div 
            className="bg-card text-card-foreground border border-border rounded-lg shadow-xl max-w-sm w-full p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-border pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-accent text-accent-foreground rounded-sm">
                  {selectedDayInfo.semester === 'sem1' ? 'Semester 1' : 'Semester 2'}
                </span>
                <h3 className="text-lg font-bold text-foreground mt-1">
                  {selectedDayInfo.monthName} {selectedDayInfo.day}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Current: <strong className="text-foreground">{STATUS_CONFIG[getDayStatus(selectedDayInfo.semester, selectedDayInfo.monthName, selectedDayInfo.day)].label}</strong>
                  {!(getKey(selectedDayInfo.semester, selectedDayInfo.monthName, selectedDayInfo.day) in calendarMap) && ' (Default Working Day)'}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedDayInfo(null)}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setStatusFromPicker('period')}
                className="flex items-center justify-between p-2.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span>Period (Default Academic Working Day)</span>
                </div>
                <span className="text-[10px] opacity-70">Green</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFromPicker('leave')}
                className="flex items-center justify-between p-2.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Leave (Non-Academic Day)</span>
                </div>
                <span className="text-[10px] opacity-70">Orange</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFromPicker('exam')}
                className="flex items-center justify-between p-2.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-500/30 text-xs font-semibold transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600" />
                  <span>Exam (Academic Day)</span>
                </div>
                <span className="text-[10px] opacity-70">Blue</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFromPicker('wafy-leave')}
                className="flex items-center justify-between p-2.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-600" />
                  <span>Wafy Leave (Non-Academic Day)</span>
                </div>
                <span className="text-[10px] opacity-70">Red</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFromPicker('clear')}
                className="flex items-center justify-center p-2 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-all mt-1 cursor-pointer"
              >
                Reset to Default Working Day (Period)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Month Card with Days Grid
function MonthCard({
  semester,
  month,
  calendarMap,
  onDayClick,
  activeTool
}: {
  semester: 'sem1' | 'sem2';
  month: MonthConfig;
  calendarMap: Record<string, CalendarStatus>;
  onDayClick: (semester: 'sem1' | 'sem2', month: MonthConfig, day: number) => void;
  activeTool: CalendarStatus | 'clear' | null;
}) {
  // Count stats for this month using default 'period' for unconfigured days
  let academicCount = 0;
  let leaveCount = 0;

  for (let d = 1; d <= month.days; d++) {
    const key = `${semester}_${month.name}_${d}`;
    const st = calendarMap[key] || 'period';
    if (st === 'period' || st === 'exam') academicCount++;
    else if (st === 'leave' || st === 'wafy-leave') leaveCount++;
  }

  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors">
      <div>
        {/* Month Header */}
        <div className="flex justify-between items-center mb-3 border-b border-border pb-2">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
              <span>{month.name}</span>
              {month.name === 'February' && (
                <span className="text-[10px] px-1.5 py-0.2 bg-primary/10 text-primary font-semibold rounded-xs">
                  29 Days Full
                </span>
              )}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {month.days} Days Total
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">
              {academicCount} Acad
            </span>
            <span className="font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">
              {leaveCount} Leave
            </span>
          </div>
        </div>

        {/* Days Grid: 7 columns (calendar layout) */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {Array.from({ length: month.days }, (_, i) => i + 1).map(day => {
            const key = `${semester}_${month.name}_${day}`;
            const status = calendarMap[key] || 'period';
            const isCustom = key in calendarMap;

            let cellClass = STATUS_CONFIG.period.cellActiveClass;
            if (status === 'leave') {
              cellClass = STATUS_CONFIG.leave.cellActiveClass;
            } else if (status === 'exam') {
              cellClass = STATUS_CONFIG.exam.cellActiveClass;
            } else if (status === 'wafy-leave') {
              cellClass = STATUS_CONFIG['wafy-leave'].cellActiveClass;
            }

            return (
              <button
                key={day}
                type="button"
                onClick={() => onDayClick(semester, month, day)}
                className={`h-10 rounded-md border text-xs flex flex-col items-center justify-center transition-all cursor-pointer select-none ${cellClass} ${
                  activeTool ? 'hover:scale-105 active:scale-95' : ''
                }`}
                title={`${month.name} ${day}: ${STATUS_CONFIG[status].label}${isCustom ? ' (Exception)' : ' (Default Working Day)'}`}
              >
                <span className="font-bold text-xs leading-none">{day}</span>
                <span className="text-[7.5px] font-medium tracking-tighter uppercase leading-none opacity-90 mt-0.5">
                  {status === 'wafy-leave' ? 'Wafy' : status === 'period' ? 'Period' : status}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
