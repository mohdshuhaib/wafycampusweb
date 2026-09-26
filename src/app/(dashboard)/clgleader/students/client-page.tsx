'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Phone, 
  Users, 
  Filter, 
  Layers, 
  GraduationCap, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Eye, 
  Calendar,
  Sparkles,
  RefreshCw,
  Mail,
  Copy,
  ExternalLink
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/components/ui/toast-provider';

export type StudentRecord = {
  id?: string;
  cicno: string;
  name: string;
  class: string;
  batch?: string | null;
  number?: number | string | null;
  is_exceptional?: boolean | null;
  created_at?: string | null;
};

// WhatsApp SVG Icon
function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
  );
}

function cleanDigits(val: number | string | null | undefined): string | null {
  if (!val) return null;
  const digits = String(val).replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

function getWhatsAppLink(rawPhone: number | string | null | undefined): string | null {
  const digits = cleanDigits(rawPhone);
  if (!digits) return null;
  // If 10 digits standard mobile number, prepend Indian country code 91
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}`;
}

function getTelLink(rawPhone: number | string | null | undefined): string | null {
  const digits = cleanDigits(rawPhone);
  if (!digits) return null;
  const full = digits.length === 10 ? `+91${digits}` : `+${digits}`;
  return `tel:${full}`;
}

export default function CollegeLeaderStudentsClient({
  initialStudents = []
}: {
  initialStudents: StudentRecord[];
}) {
  const toast = useToast();
  const [students, setStudents] = useState<StudentRecord[]>(initialStudents);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<StudentRecord | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Sync state if initialStudents changes from server revalidation
  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  // Set up Supabase Realtime synchronization
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('clgleader_students_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRecord = payload.new as StudentRecord;
            setStudents(prev => {
              if (prev.some(s => s.cicno === newRecord.cicno)) return prev;
              return [newRecord, ...prev];
            });
            toast.success(`New student enrolled: ${newRecord.name.toUpperCase()}`);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as StudentRecord;
            setStudents(prev => prev.map(s => s.cicno === updated.cicno ? { ...s, ...updated } : s));
          } else if (payload.eventType === 'DELETE') {
            const oldCicno = (payload.old as any)?.cicno;
            if (oldCicno) {
              setStudents(prev => prev.filter(s => s.cicno !== oldCicno));
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
  }, [toast]);

  // Unique classes with student counts
  const { classOptions, classCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach(s => {
      if (s.class) {
        counts[s.class] = (counts[s.class] || 0) + 1;
      }
    });

    const standardClasses = [
      'USR 1', 'USR 2',
      'MUL 1', 'MUL 2',
      'KVS 1', 'KVS 2',
      'AQD 1', 'AQD 2',
      'HLR 1', 'HLR 2',
      'LUG 1', 'LUG 2'
    ];

    const allFoundClasses = Array.from(new Set([
      ...standardClasses,
      ...Object.keys(counts)
    ])).sort();

    return { classOptions: allFoundClasses, classCounts: counts };
  }, [students]);

  // Unique batches with student counts
  const { batchOptions, batchCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach(s => {
      if (s.batch) {
        const b = s.batch.trim();
        counts[b] = (counts[b] || 0) + 1;
      }
    });
    const sortedBatches = Object.keys(counts).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { batchOptions: sortedBatches, batchCounts: counts };
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // Class filter
      if (selectedClass !== 'all' && s.class !== selectedClass) {
        return false;
      }
      // Batch filter
      if (selectedBatch !== 'all' && (s.batch || '').trim() !== selectedBatch) {
        return false;
      }
      // Search term
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const nameMatch = (s.name || '').toLowerCase().includes(q);
        const cicMatch = (s.cicno || '').toLowerCase().includes(q);
        const classMatch = (s.class || '').toLowerCase().includes(q);
        const batchMatch = (s.batch || '').toLowerCase().includes(q);
        const phoneMatch = s.number ? String(s.number).includes(q) : false;
        if (!nameMatch && !cicMatch && !classMatch && !batchMatch && !phoneMatch) {
          return false;
        }
      }
      return true;
    });
  }, [students, selectedClass, selectedBatch, search]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard!`);
  };

  const hasActiveFilters = selectedClass !== 'all' || selectedBatch !== 'all' || search.trim() !== '';

  const resetFilters = () => {
    setSelectedClass('all');
    setSelectedBatch('all');
    setSearch('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Users className="w-7 h-7 text-primary" />
              <span>Students Directory</span>
            </h1>
            {isLiveConnected && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comprehensive database records, class affiliations, and direct communication channels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border">
            Total Students: <strong className="text-foreground">{students.length}</strong>
          </span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card text-card-foreground border border-border rounded-lg p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Enrolled</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-foreground">{students.length}</h3>
            <span className="text-xs text-muted-foreground">students</span>
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">Filtered View</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-primary">{filteredStudents.length}</h3>
            <span className="text-xs text-muted-foreground">matching</span>
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Classes</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-foreground">{Object.keys(classCounts).length}</h3>
            <span className="text-xs text-muted-foreground">represented</span>
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Batches</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-foreground">{batchOptions.length}</h3>
            <span className="text-xs text-muted-foreground">batches</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by student name, CIC, class, batch, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Class Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Class:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-md text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
              >
                <option value="all">All Classes ({students.length})</option>
                {classOptions.map(cls => (
                  <option key={cls} value={cls}>
                    {cls} ({classCounts[cls] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Batch:</span>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-md text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
              >
                <option value="all">All Batches ({students.length})</option>
                {batchOptions.map(batch => (
                  <option key={batch} value={batch}>
                    {batch} ({batchCounts[batch] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer border border-destructive/20"
                title="Reset all filters"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Pills Indicator */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60 text-xs">
            <span className="text-muted-foreground font-medium">Active filters:</span>
            {selectedClass !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                Class: {selectedClass}
                <button type="button" onClick={() => setSelectedClass('all')} className="hover:opacity-75">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedBatch !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                Batch: {selectedBatch}
                <button type="button" onClick={() => setSelectedBatch('all')} className="hover:opacity-75">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {search.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border font-medium">
                Search: &ldquo;{search.trim()}&rdquo;
                <button type="button" onClick={() => setSearch('')} className="hover:opacity-75">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <span className="text-muted-foreground ml-auto">
              Showing {filteredStudents.length} of {students.length}
            </span>
          </div>
        )}
      </div>

      {/* Main Student Directory Table */}
      <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
            <h3 className="text-base font-semibold text-foreground">No students found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {hasActiveFilters
                ? 'No students match your filter or search criteria. Try resetting your search or selecting a different class or batch.'
                : 'No student records exist in the database yet.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Student Details</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Batch</th>
                  <th className="py-3 px-3 text-center w-20">WhatsApp</th>
                  <th className="py-3 px-3 text-center w-20">Call</th>
                  <th className="py-3 px-4">Exemption</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStudents.map((student, idx) => {
                  const upperName = (student.name || '').toUpperCase();
                  const waUrl = getWhatsAppLink(student.number);
                  const telUrl = getTelLink(student.number);
                  const hasPhone = !!cleanDigits(student.number);

                  return (
                    <tr 
                      key={student.cicno || idx}
                      className="hover:bg-muted/40 transition-colors group"
                    >
                      {/* Row Index */}
                      <td className="py-3 px-4 text-center text-xs text-muted-foreground font-mono">
                        {idx + 1}
                      </td>

                      {/* Student Details: Name (Uppercase) + CIC + Email */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
                            {upperName}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span className="font-mono font-medium text-foreground/80 bg-muted px-1.5 py-0.2 rounded-sm border border-border/60">
                              CIC: {student.cicno}
                            </span>
                            <span className="text-[11px] text-muted-foreground/75 truncate max-w-[200px]">
                              {student.cicno.toLowerCase()}@campus.com
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                          {student.class}
                        </span>
                      </td>

                      {/* Batch */}
                      <td className="py-3 px-4">
                        {student.batch ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground border border-border">
                            {student.batch}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </td>

                      {/* WhatsApp Column */}
                      <td className="py-3 px-3 text-center">
                        {hasPhone && waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all shadow-xs hover:scale-110 active:scale-95 cursor-pointer"
                            title={`Open WhatsApp chat with ${upperName} (${student.number})`}
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                          </a>
                        ) : (
                          <span 
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground/40 cursor-not-allowed"
                            title="No phone number available"
                          >
                            <WhatsAppIcon className="w-4 h-4 opacity-40" />
                          </span>
                        )}
                      </td>

                      {/* Call Column */}
                      <td className="py-3 px-3 text-center">
                        {hasPhone && telUrl ? (
                          <a
                            href={telUrl}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 hover:bg-blue-600 text-blue-600 hover:text-white transition-all shadow-xs hover:scale-110 active:scale-95 cursor-pointer"
                            title={`Call ${upperName} (${student.number})`}
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        ) : (
                          <span 
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground/40 cursor-not-allowed"
                            title="No phone number available"
                          >
                            <Phone className="w-4 h-4 opacity-40" />
                          </span>
                        )}
                      </td>

                      {/* Exemption Status */}
                      <td className="py-3 px-4">
                        {student.is_exceptional ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            <ShieldAlert className="w-3 h-3" />
                            Exempted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Standard
                          </span>
                        )}
                      </td>

                      {/* View Details Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForDetails(student)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors cursor-pointer border border-border"
                          title="View all database fields"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        {filteredStudents.length > 0 && (
          <div className="py-3 px-4 bg-muted/30 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-muted-foreground">
            <span>
              Displaying <strong className="text-foreground">{filteredStudents.length}</strong> of{' '}
              <strong className="text-foreground">{students.length}</strong> students
            </span>
            <span className="text-[11px]">
              Click on WhatsApp or Call icons to communicate directly.
            </span>
          </div>
        )}
      </div>

      {/* FULL DATABASE DETAILS MODAL */}
      {selectedStudentForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  {selectedStudentForDetails.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground leading-tight">
                    {selectedStudentForDetails.name.toUpperCase()}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    CIC: {selectedStudentForDetails.cicno} • {selectedStudentForDetails.class}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForDetails(null)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Complete database fields */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Full Name
                  </span>
                  <span className="font-bold text-sm text-foreground break-words block mt-0.5">
                    {selectedStudentForDetails.name.toUpperCase()}
                  </span>
                </div>

                {/* CIC Number */}
                <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    CIC Number
                  </span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-sm text-foreground">
                      {selectedStudentForDetails.cicno}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedStudentForDetails.cicno, 'CIC Number')}
                      className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      title="Copy CIC"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Class */}
                <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Class
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary border border-primary/20 mt-1">
                    {selectedStudentForDetails.class}
                  </span>
                </div>

                {/* Batch */}
                <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Batch
                  </span>
                  <span className="font-semibold text-sm text-foreground block mt-0.5">
                    {selectedStudentForDetails.batch || 'Not Assigned'}
                  </span>
                </div>

                {/* Phone Number */}
                <div className="bg-muted/40 p-3 rounded-lg border border-border/60 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Contact Phone Number
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono font-semibold text-sm text-foreground">
                      {selectedStudentForDetails.number ? String(selectedStudentForDetails.number) : 'Not Provided'}
                    </span>
                    {selectedStudentForDetails.number && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(selectedStudentForDetails.number), 'Phone Number')}
                          className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground bg-background rounded border border-border cursor-pointer"
                        >
                          Copy
                        </button>
                        {getWhatsAppLink(selectedStudentForDetails.number) && (
                          <a
                            href={getWhatsAppLink(selectedStudentForDetails.number)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors cursor-pointer"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                        {getTelLink(selectedStudentForDetails.number) && (
                          <a
                            href={getTelLink(selectedStudentForDetails.number)!}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Portal Account Email */}
                <div className="bg-muted/40 p-3 rounded-lg border border-border/60 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Student Portal Email
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-xs text-foreground font-medium">
                        {selectedStudentForDetails.cicno.toLowerCase()}@campus.com
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${selectedStudentForDetails.cicno.toLowerCase()}@campus.com`, 'Email')}
                      className="text-muted-foreground hover:text-primary cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Cleaning Exemption Status */}
                <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Cleaning Exemption
                  </span>
                  <div className="mt-1">
                    {selectedStudentForDetails.is_exceptional ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        <ShieldAlert className="w-3 h-3" />
                        Exempted from Cleaning
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Standard (Non-exempt)
                      </span>
                    )}
                  </div>
                </div>

                {/* Enrolled / Created At */}
                <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Enrolled At
                  </span>
                  <span className="text-xs font-medium text-foreground block mt-1">
                    {selectedStudentForDetails.created_at
                      ? new Date(selectedStudentForDetails.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStudentForDetails(null)}
                className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-semibold text-xs rounded-md transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
