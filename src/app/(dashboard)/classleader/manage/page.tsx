import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ManageStudentsClient from './client-page';

export default async function ManageStudentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'classleader') {
    redirect('/');
  }

  const userClass = profile.designation;

  const { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('class', userClass)
    .order('name');

  return <ManageStudentsClient initialStudents={students || []} userClass={userClass} />;
}
