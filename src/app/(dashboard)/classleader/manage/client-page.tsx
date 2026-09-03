'use client';

import { useState } from 'react';
import { Users, Upload, Plus, AlertCircle, CheckCircle2, FileUp, Edit2, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';

type Student = {
  id: string;
  name: string;
  cicno: string;
  class: string;
  batch: string | null;
  number: number | null;
};

export default function ManageStudentsClient({ initialStudents, userClass }: { initialStudents: Student[], userClass: string }) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const supabase = createClient();
  const router = useRouter();

  // New Student Form State
  const [name, setName] = useState('');
  const [cicno, setCicno] = useState('');
  const [batch, setBatch] = useState('');
  const [number, setNumber] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!name || !cicno) {
      setError('Name and CIC Number are required.');
      setLoading(false);
      return;
    }

    if (isEditing) {
      const { data, error: updateError } = await supabase
        .from('students')
        .update({
          name,
          batch: batch || null,
          number: number ? parseInt(number) : null
        })
        .eq('cicno', cicno)
        .select()
        .single();

      if (updateError) {
        setError(updateError.message);
      } else if (data) {
        setSuccess(`Student ${data.name} updated successfully!`);
        setStudents(prev => prev.map(s => s.cicno === cicno ? data : s));
        resetForm();
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('students')
        .insert({
          name,
          cicno,
          class: userClass,
          batch: batch || null,
          number: number ? parseInt(number) : null
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
      } else if (data) {
        setSuccess(`Student ${data.name} added successfully!`);
        setStudents(prev => [...prev, data]);
        resetForm();
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setName('');
    setCicno('');
    setBatch('');
    setNumber('');
    setIsEditing(false);
    router.refresh();
  };

  const handleEdit = (s: Student) => {
    setActiveTab('add');
    setName(s.name);
    setCicno(s.cicno);
    setBatch(s.batch || '');
    setNumber(s.number ? String(s.number) : '');
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (cicno: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    
    const { error } = await supabase.from('students').delete().eq('cicno', cicno);
    if (!error) {
      setStudents(prev => prev.filter(s => s.cicno !== cicno));
      router.refresh();
    } else {
      alert(error.message);
    }
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        const toInsert = rows.map(row => ({
          name: row.name || row.Name || '',
          cicno: String(row.cicno || row.Cicno || row.CICNO || ''),
          class: userClass,
          batch: row.batch || row.Batch || null,
          number: parseInt(row.phone || row.Phone || row.number || row.Number) || null
        })).filter(r => r.name.trim() !== '' && r.cicno.trim() !== '');

        if (toInsert.length === 0) {
          setError('No valid data found in CSV. Please ensure "name" and "cicno" columns exist.');
          setLoading(false);
          return;
        }

        const { data, error: insertError } = await supabase
          .from('students')
          .insert(toInsert)
          .select();

        if (insertError) {
          setError(insertError.message);
        } else if (data) {
          setSuccess(`Successfully added ${data.length} students!`);
          setStudents(prev => [...prev, ...data]);
          router.refresh();
        }
        setLoading(false);
        // Reset file input
        e.target.value = '';
      },
      error: (err) => {
        setError(err.message);
        setLoading(false);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Manage Students</h1>
          <p className="text-sm text-muted-foreground">Class: <span className="font-semibold text-primary">{userClass}</span></p>
        </div>
      </div>

      <div className="flex gap-1.5 p-1 bg-secondary rounded-md w-fit flex-wrap">
        <button 
          onClick={() => setActiveTab('list')}
          className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${activeTab === 'list' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Student List
        </button>
        <button 
          onClick={() => setActiveTab('add')}
          className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${activeTab === 'add' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Add Student
        </button>
        <button 
          onClick={() => setActiveTab('bulk')}
          className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'bulk' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <FileUp className="w-3.5 h-3.5" /> Bulk Upload
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Total Students: {students.length}</h2>
          </div>
          
          {students.length === 0 ? (
            <div className="p-8 text-center bg-muted/30 rounded-md border border-dashed border-border">
              <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-foreground font-medium text-sm">No students added yet.</p>
              <button onClick={() => setActiveTab('add')} className="mt-3 text-primary text-xs hover:underline font-semibold">
                Add your first student
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">CIC No</th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Batch</th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Phone</th>
                    <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">{student.name}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{student.cicno}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{student.batch || '-'}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{student.number || '-'}</td>
                      <td className="py-3 px-4 text-right flex justify-end gap-1.5">
                        <button onClick={() => handleEdit(student)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors" title="Edit Student">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(student.cicno)} className="text-xs text-destructive hover:bg-destructive/10 px-2.5 py-1 rounded-md transition-colors font-medium">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 sm:p-6 shadow-xs max-w-2xl">
          <h2 className="text-base font-semibold mb-5 flex items-center gap-2 text-foreground">
            {isEditing ? <><Edit2 className="w-4 h-4 text-primary" /> Edit Student</> : <><Plus className="w-4 h-4 text-primary" /> Add New Student</>}
          </h2>

          {error && (
            <div className="mb-5 p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2 border border-destructive/20">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          
          {success && (
            <div className="mb-5 p-3 bg-accent/40 text-accent-foreground text-sm rounded-md flex items-center gap-2 border border-accent">
              <CheckCircle2 className="w-4 h-4" /> {success}
            </div>
          )}

          <form onSubmit={handleAddStudent} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Full Name *</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs" 
                  placeholder="e.g. John Doe" 
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">CIC Number *</label>
                <input 
                  type="text" 
                  value={cicno}
                  onChange={(e) => setCicno(e.target.value)}
                  disabled={isEditing}
                  className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs disabled:opacity-50 disabled:cursor-not-allowed" 
                  placeholder="e.g. 1045" 
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Batch (Optional)</label>
                <input 
                  type="text" 
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs" 
                  placeholder="e.g. Batch 1" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Phone Number (Optional)</label>
                <input 
                  type="number" 
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full px-3 py-1.5 bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-xs" 
                  placeholder="e.g. 9876543210" 
                />
              </div>
            </div>
            <div className="pt-2 flex gap-2.5">
              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 py-2 px-3 bg-primary hover:brightness-95 text-primary-foreground rounded-md font-medium text-sm transition-colors shadow-xs disabled:opacity-50"
              >
                {loading ? 'Saving...' : isEditing ? 'Update Student' : 'Save Student'}
              </button>
              {isEditing && (
                <button type="button" onClick={() => { resetForm(); setActiveTab('list'); }} className="py-2 px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {activeTab === 'bulk' && (
        <div className="bg-card text-card-foreground border border-border rounded-lg p-5 sm:p-6 shadow-xs max-w-2xl">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2 text-foreground">
            <FileUp className="w-4 h-4 text-primary" /> Bulk Upload Students
          </h2>
          
          <div className="mb-5 text-xs text-muted-foreground space-y-1">
            <p>Upload a CSV file containing your students. Required columns: <strong className="text-foreground">name</strong> and <strong className="text-foreground">cicno</strong>.</p>
            <p>Optional columns: <strong className="text-foreground">batch</strong>, <strong className="text-foreground">phone</strong>.</p>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2 border border-destructive/20">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          
          {success && (
            <div className="mb-5 p-3 bg-accent/40 text-accent-foreground text-sm rounded-md flex items-center gap-2 border border-accent">
              <CheckCircle2 className="w-4 h-4" /> {success}
            </div>
          )}

          <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-center bg-muted/20 hover:bg-muted/40 transition-colors relative">
            <Upload className="w-8 h-8 text-muted-foreground mb-3 opacity-60" />
            <h3 className="text-sm font-semibold text-foreground mb-1">Upload CSV File</h3>
            <p className="text-xs text-muted-foreground mb-3">Click to browse or drag and drop</p>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleBulkUpload}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            {loading && <p className="text-primary text-xs font-semibold mt-2 animate-pulse">Processing file...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
