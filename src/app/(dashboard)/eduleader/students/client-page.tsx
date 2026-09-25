'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Upload, 
  Download, 
  Search, 
  Filter, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  ShieldCheck, 
  KeyRound, 
  Loader2,
  RefreshCw,
  Radio
} from 'lucide-react';
import Papa from 'papaparse';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/components/ui/toast-provider';
import { VALID_CLASSES } from './constants';
import { 
  createSingleStudent, 
  createBulkStudents, 
  deleteStudent,
  StudentInput 
} from './actions';

export type StudentRow = {
  id: string;
  name: string;
  cicno: string;
  class: string;
  batch: string | null;
  number: number | null;
  created_at?: string;
};

export default function EduLeaderStudentsClient({
  initialStudents = []
}: {
  initialStudents: StudentRow[];
}) {
  const toast = useToast();
  const [students, setStudents] = useState<StudentRow[]>(initialStudents);
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'bulk'>('list');

  // Supabase Realtime Subscription for Instant Live Sync
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('eduleader_students_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as StudentRow;
            setStudents(prev => {
              if (prev.some(s => s.cicno === newRow.cicno)) return prev;
              return [newRow, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as StudentRow;
            setStudents(prev => prev.map(s => s.cicno === updated.cicno ? updated : s));
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { cicno?: string; id?: string };
            setStudents(prev => prev.filter(s => s.cicno !== oldRow.cicno && s.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Single Add Form
  const [name, setName] = useState('');
  const [cicno, setCicno] = useState('');
  const [studentClass, setStudentClass] = useState<string>('USR 1');
  const [batch, setBatch] = useState('');
  const [phone, setPhone] = useState('');

  // Bulk Upload State
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<StudentInput[]>([]);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ total: number; success: number; failed: number } | null>(null);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.cicno.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.batch && s.batch.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesClass = selectedClassFilter === 'all' || s.class === selectedClassFilter;
      return matchesSearch && matchesClass;
    });
  }, [students, searchTerm, selectedClassFilter]);

  // Class counts map
  const classCounts = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach(s => {
      map[s.class] = (map[s.class] || 0) + 1;
    });
    return map;
  }, [students]);

  // Handle Single Student Submit
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cicno.trim() || !studentClass) {
      toast.error('Please fill in Full Name, CIC Number, and Class.');
      return;
    }

    setLoading(true);
    try {
      const res = await createSingleStudent({
        name: name.trim().toUpperCase(),
        cicno: cicno.trim(),
        class: studentClass,
        batch: batch.trim() || null,
        number: phone.trim() ? parseInt(phone.trim()) : null
      });

      if (res.success && res.data) {
        toast.success(`Student ${res.data.name} added successfully! Auth account created.`);
        setStudents(prev => [res.data, ...prev.filter(s => s.cicno !== res.data.cicno)]);
        setName('');
        setCicno('');
        setBatch('');
        setPhone('');
        setActiveTab('list');
      } else {
        toast.error(res.error || 'Failed to create student');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error occurred');
    }
    setLoading(false);
  };

  // Download CSV / Excel Template
  const handleDownloadTemplate = () => {
    const headers = ['Full Name', 'CIC Number', 'Class', 'Batch', 'Phone Number'];
    const sampleRows = [
      ['AHMAD ALI', 'CIC1001', 'USR 1', '2024-2028', '9876543210'],
      ['MUHAMMED BILAL', 'CIC1002', 'MUL 1', '2024-2028', '9876543211'],
      ['UMAR FAROOQ', 'CIC1003', 'KVS 1', '2024-2028', '9876543212'],
      ['HASSAN K', 'CIC1004', 'AQD 1', '2024-2028', '9876543213'],
      ['ABDULLAH M', 'CIC1005', 'HLR 1', '2024-2028', '9876543214'],
      ['ZAYD KHAN', 'CIC1006', 'LUG 1', '2024-2028', '9876543215']
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'students_bulk_upload_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded template CSV');
  };

  // Parse Bulk CSV
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFile(file);
    setBulkParsing(true);
    setBulkProgress(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        const formatted: StudentInput[] = rows.map(r => {
          const rawName = r['Full Name'] || r['name'] || r['Name'] || r['FULL NAME'] || '';
          const rawCic = r['CIC Number'] || r['cicno'] || r['Cicno'] || r['CICNO'] || r['CIC'] || '';
          const rawClass = r['Class'] || r['class'] || r['CLASS'] || '';
          const rawBatch = r['Batch'] || r['batch'] || r['BATCH'] || null;
          const rawPhone = r['Phone Number'] || r['Phone'] || r['phone'] || r['number'] || r['Number'] || null;

          return {
            name: String(rawName).trim().toUpperCase(),
            cicno: String(rawCic).trim(),
            class: String(rawClass).trim(),
            batch: rawBatch ? String(rawBatch).trim() : null,
            number: rawPhone ? parseInt(String(rawPhone).replace(/\D/g, '')) || null : null
          };
        }).filter(r => r.name !== '' && r.cicno !== '');

        setParsedRows(formatted);
        setBulkParsing(false);
      },
      error: (err) => {
        toast.error(`CSV Parsing error: ${err.message}`);
        setBulkParsing(false);
      }
    });
  };

  // Execute Bulk Upload
  const handleBulkUpload = async () => {
    if (parsedRows.length === 0) {
      toast.error('No valid rows found in file.');
      return;
    }

    setLoading(true);
    try {
      const res = await createBulkStudents(parsedRows);
      if (res.success) {
        setBulkProgress({
          total: parsedRows.length,
          success: res.created,
          failed: 0
        });
        toast.success(`Bulk upload complete! Successfully enrolled ${res.created} students.`);

        // Sync with verified records returned from server, preventing duplicate keys with Realtime
        if (res.records && res.records.length > 0) {
          setStudents(prev => {
            const existingCicnos = new Set(prev.map(s => s.cicno));
            const fresh = res.records.filter((r: any) => !existingCicnos.has(r.cicno));
            return [...fresh, ...prev];
          });
        }

        setParsedRows([]);
        setBulkFile(null);
      } else {
        setBulkProgress(null);
        toast.error(res.error || 'Bulk upload cancelled.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error occurred');
    }
    setLoading(false);
  };

  // Delete Student
  const handleDelete = async (cicno: string, studentName: string) => {
    if (!confirm(`Are you sure you want to delete student ${studentName} (${cicno})?`)) return;

    try {
      const res = await deleteStudent(cicno);
      if (res.success) {
        setStudents(prev => prev.filter(s => s.cicno !== cicno));
        toast.success(`Student ${studentName} deleted.`);
      } else {
        toast.error(res.error || 'Failed to delete student');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete student');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
              <Users className="w-7 h-7 text-primary" />
              <span>Manage Students</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Enroll students across all 12 classes, automatically provision campus authentication, and manage profiles.
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-secondary rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Students ({students.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'add'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bulk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'bulk'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk Upload</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ALL STUDENTS LIST */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by student name or CIC..."
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Class:
              </span>
              <select
                value={selectedClassFilter}
                onChange={e => setSelectedClassFilter(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-md text-xs text-foreground font-medium focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Classes ({students.length})</option>
                {VALID_CLASSES.map(cls => (
                  <option key={cls} value={cls}>
                    {cls} ({classCounts[cls] || 0})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedClassFilter('all');
                }}
                className="px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                title="Reset Filters"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs overflow-hidden">
            {filteredStudents.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-10 h-10 mx-auto text-muted-foreground opacity-40 mb-3" />
                <h3 className="font-semibold text-base text-foreground">No students found</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {searchTerm || selectedClassFilter !== 'all' 
                    ? 'Try adjusting your search criteria or class filter.' 
                    : 'Get started by adding your first student individually or via bulk upload.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md shadow-xs hover:brightness-95 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Student
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4">CIC Number</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Batch</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Auth Login (Email)</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.map((student, idx) => (
                      <tr 
                        key={student.cicno} 
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4 text-muted-foreground font-medium">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-foreground uppercase tracking-tight">
                            {student.name.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-primary">
                          {student.cicno}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-accent text-accent-foreground text-[10px] font-bold">
                            {student.class}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {student.batch || '—'}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground font-mono">
                          {student.number || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                          {student.cicno.toLowerCase()}@campus.com
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(student.cicno, student.name)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                            title="Delete Student"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filteredStudents.length > 0 && (
              <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>Showing {filteredStudents.length} of {students.length} students</span>
                <span>Names displayed in standard uppercase</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SINGLE STUDENT ADD */}
      {activeTab === 'add' && (
        <div className="max-w-2xl mx-auto bg-card text-card-foreground border border-border rounded-lg p-6 shadow-xs space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              <span>Enroll New Student</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fill in student details. An authentication login account will be automatically generated.
            </p>
          </div>

          <form onSubmit={handleSingleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Full Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value.toUpperCase())}
                placeholder="e.g. AHMAD BILAL"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground uppercase font-semibold placeholder:normal-case placeholder:font-normal placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
              <span className="text-[11px] text-muted-foreground">
                Student full name will be stored and displayed in CAPITAL LETTERS across the campus system.
              </span>
            </div>

            {/* CIC Number & Class */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  CIC Number <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={cicno}
                  onChange={e => setCicno(e.target.value.trim())}
                  placeholder="e.g. CIC2024"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Class <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  value={studentClass}
                  onChange={e => setStudentClass(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground font-semibold focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {VALID_CLASSES.map(cls => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Batch & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Batch
                </label>
                <input
                  type="text"
                  value={batch}
                  onChange={e => setBatch(e.target.value)}
                  placeholder="e.g. 2024-2028"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Auto Credentials Info Box */}
            <div className="bg-primary/5 border border-primary/20 rounded-md p-3.5 space-y-1 text-xs">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <KeyRound className="w-4 h-4" />
                <span>Automatic Campus Authentication Credentials</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                When created, this student will be given login access:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-primary/15 font-mono text-[11px]">
                <div>
                  <span className="text-muted-foreground">Login Email:</span>{' '}
                  <span className="font-bold text-foreground">
                    {cicno.trim() ? `${cicno.trim().toLowerCase()}@campus.com` : 'cicno@campus.com'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Default Password:</span>{' '}
                  <span className="font-bold text-foreground">
                    {cicno.trim() ? `${cicno.trim()}@77` : 'cicno@77'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-primary hover:brightness-95 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{loading ? 'Adding Student...' : 'Add Student'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: BULK UPLOAD */}
      {activeTab === 'bulk' && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Bulk Instructions & Template Download Card */}
          <div className="bg-card text-card-foreground border border-border rounded-lg p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <span>Bulk Students Upload (CSV / Excel)</span>
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                Upload a CSV spreadsheet with columns: <strong>Full Name</strong>, <strong>CIC Number</strong>, <strong>Class</strong> (e.g. USR 1, MUL 1), <strong>Batch</strong>, and <strong>Phone Number</strong>. Authentication accounts and student profiles will be automatically generated for every row.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold rounded-md border border-border shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-primary" />
              <span>Download CSV Template</span>
            </button>
          </div>

          {/* Upload Area */}
          <div className="bg-card text-card-foreground border border-border rounded-lg p-6 shadow-xs space-y-5">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors bg-muted/20">
              <Upload className="w-8 h-8 mx-auto text-primary mb-2 opacity-80" />
              <p className="text-sm font-semibold text-foreground">
                {bulkFile ? bulkFile.name : 'Select or drop a CSV file here'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                CSV or Excel-exported CSV formatted with standard headers
              </p>
              <label className="mt-4 inline-block">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="px-4 py-2 bg-primary hover:brightness-95 text-primary-foreground text-xs font-semibold rounded-md shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-all">
                  Browse Files
                </span>
              </label>
            </div>

            {/* Preview of Parsed Rows */}
            {parsedRows.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>File Parsed: {parsedRows.length} Students Ready to Upload</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([]);
                      setBulkFile(null);
                    }}
                    className="text-xs text-destructive hover:underline cursor-pointer"
                  >
                    Clear File
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-background">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-muted/60 sticky top-0 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Full Name</th>
                        <th className="py-2 px-3">CIC No</th>
                        <th className="py-2 px-3">Class</th>
                        <th className="py-2 px-3">Batch</th>
                        <th className="py-2 px-3">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                          <td className="py-2 px-3 font-semibold uppercase text-foreground">{row.name}</td>
                          <td className="py-2 px-3 font-mono text-primary">{row.cicno}</td>
                          <td className="py-2 px-3 font-bold">{row.class}</td>
                          <td className="py-2 px-3 text-muted-foreground">{row.batch || '—'}</td>
                          <td className="py-2 px-3 text-muted-foreground">{row.number || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 50 && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    + {parsedRows.length - 50} more rows...
                  </p>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleBulkUpload}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:brightness-95 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{loading ? 'Uploading & Creating Accounts...' : `Upload ${parsedRows.length} Students`}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Results Progress / Summary */}
            {bulkProgress && (
              <div className="p-4 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
                <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Batch Process Successful!</span>
                </p>
                <p className="text-muted-foreground">
                  All {bulkProgress.success} student accounts and campus logins were created and enrolled together in one transaction.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
