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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Manage Students</h1>
          <p className="text-slate-600 dark:text-slate-400">Class: {userClass}</p>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl w-fit flex-wrap">
        <button 
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
        >
          Student List
        </button>
        <button 
          onClick={() => setActiveTab('add')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'add' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
        >
          Add Student
        </button>
        <button 
          onClick={() => setActiveTab('bulk')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'bulk' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <FileUp className="w-4 h-4" /> Bulk Upload
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Total Students: {students.length}</h2>
          </div>
          
          {students.length === 0 ? (
            <div className="p-8 text-center bg-white/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
              <Users className="w-10 h-10 mx-auto text-slate-400 mb-3 opacity-50" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">No students added yet.</p>
              <button onClick={() => setActiveTab('add')} className="mt-4 text-primary hover:underline font-medium">
                Add your first student
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Name</th>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">CIC No</th>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Batch</th>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Phone</th>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-medium">{student.name}</td>
                      <td className="p-4">{student.cicno}</td>
                      <td className="p-4">{student.batch || '-'}</td>
                      <td className="p-4">{student.number || '-'}</td>
                      <td className="p-4 text-right flex justify-end gap-2">
                        <button onClick={() => handleEdit(student)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit Student">
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(student.cicno)} className="text-sm text-danger hover:bg-danger/10 px-3 py-1 rounded-lg transition-colors">
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
        <div className="glass-panel p-6 max-w-2xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            {isEditing ? <><Edit2 className="w-5 h-5 text-primary" /> Edit Student</> : <><Plus className="w-5 h-5 text-primary" /> Add New Student</>}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-danger/10 text-danger rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-success/10 text-success rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> {success}
            </div>
          )}

          <form onSubmit={handleAddStudent} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name *</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
                  placeholder="e.g. John Doe" 
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">CIC Number *</label>
                <input 
                  type="text" 
                  value={cicno}
                  onChange={(e) => setCicno(e.target.value)}
                  disabled={isEditing}
                  className="w-full p-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed" 
                  placeholder="e.g. 1045" 
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Batch (Optional)</label>
                <input 
                  type="text" 
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="w-full p-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
                  placeholder="e.g. Batch 1" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number (Optional)</label>
                <input 
                  type="number" 
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full p-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
                  placeholder="e.g. 9876543210" 
                />
              </div>
            </div>
            <div className="pt-4 flex gap-3">
              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 p-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {loading ? 'Saving...' : isEditing ? 'Update Student' : 'Save Student'}
              </button>
              {isEditing && (
                <button type="button" onClick={() => { resetForm(); setActiveTab('list'); }} className="p-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {activeTab === 'bulk' && (
        <div className="glass-panel p-6 max-w-2xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <FileUp className="w-5 h-5 text-primary" /> Bulk Upload Students
          </h2>
          
          <div className="mb-6 prose dark:prose-invert text-sm text-slate-600 dark:text-slate-400">
            <p>Upload a CSV file containing your students. Required columns: <strong>name</strong> and <strong>cicno</strong>.</p>
            <p>Optional columns: <strong>batch</strong>, <strong>phone</strong>.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger/10 text-danger rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-success/10 text-success rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> {success}
            </div>
          )}

          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors relative">
            <Upload className="w-12 h-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">Upload CSV File</h3>
            <p className="text-sm text-slate-500 mb-4">Click to browse or drag and drop</p>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleBulkUpload}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            {loading && <p className="text-primary font-medium mt-2 animate-pulse">Processing file...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
