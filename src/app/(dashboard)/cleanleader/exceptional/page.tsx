import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ExceptionalClient from './client-page';

export const revalidate = 0;

export default async function ExceptionalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'cleanleader') redirect('/');

  const { data: students } = await supabase.from('students').select('cicno, name, class, is_exceptional').order('name');
  
  const classes = Array.from(new Set(students?.map(s => s.class).filter(Boolean) || [])).sort();

  return (
    <ExceptionalClient 
      students={students || []} 
      classes={classes as string[]}
    />
  );
}
