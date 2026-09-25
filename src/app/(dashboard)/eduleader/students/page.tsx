import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import EduLeaderStudentsClient from './client-page';

export const revalidate = 0;

export default async function EduLeaderStudentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, designation')
    .eq('id', user.id)
    .single();

  const isEdu = profile?.role === 'eduleader' || profile?.designation?.toLowerCase().includes('academic') || profile?.role === 'clgleader';
  if (!profile || !isEdu) redirect('/');

  let students: any[] = [];
  try {
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('class', { ascending: true })
      .order('name', { ascending: true });
    students = data || [];
  } catch (e) {
    students = [];
  }

  return (
    <EduLeaderStudentsClient initialStudents={students} />
  );
}
