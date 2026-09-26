import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import CollegeLeaderStudentsClient, { StudentRecord } from './client-page';

export const revalidate = 0;

export default async function ClgLeaderStudentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'clgleader') redirect('/');

  // Fetch full student database records
  let students: StudentRecord[] = [];
  try {
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('class', { ascending: true })
      .order('name', { ascending: true });
    students = (data as StudentRecord[]) || [];
  } catch (e) {
    students = [];
  }

  return (
    <CollegeLeaderStudentsClient initialStudents={students} />
  );
}
