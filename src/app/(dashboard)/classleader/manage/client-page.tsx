'use client';

import { useState, useMemo, useEffect } from 'react';
import { Users, Search } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

type Student = {
  id: string;
  name: string;
  cicno: string;
  class: string;
  batch: string | null;
  number: number | null;
};

export default function ManageStudentsClient({ 
  initialStudents, 
  userClass 
}: { 
  initialStudents: Student[]; 
  userClass: string; 
}) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [searchTerm, setSearchTerm] = useState('');

  // Realtime Live Subscription for class students
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`classleader_students_${userClass}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as Student;
            if (newRow.class === userClass) {
              setStudents(prev => {
                if (prev.some(s => s.cicno === newRow.cicno)) return prev;
                return [newRow, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Student;
            if (updated.class === userClass) {
              setStudents(prev => prev.map(s => s.cicno === updated.cicno ? updated : s));
            } else {
              // Moved out of class
              setStudents(prev => prev.filter(s => s.cicno !== updated.cicno));
            }
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
  }, [userClass]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.cicno.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.batch && s.batch.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [students, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
              <Users className="w-7 h-7 text-primary" />
              <span>Students</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Class: <span className="font-bold text-primary">{userClass}</span> • {students.length} Students Enrolled
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search students in class..."
            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-card text-card-foreground border border-border rounded-lg shadow-xs overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground opacity-40 mb-3" />
            <h3 className="font-semibold text-base text-foreground">No students found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchTerm 
                ? 'No students match your search criteria.' 
                : 'No students have been assigned to your class yet. Please contact the Academic Leader.'}
            </p>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredStudents.length > 0 && (
          <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {filteredStudents.length} of {students.length} students</span>
            <span>All student names displayed in full capital letters</span>
          </div>
        )}
      </div>
    </div>
  );
}
