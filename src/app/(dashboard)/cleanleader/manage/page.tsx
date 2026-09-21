import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ManagePlacesClient from './client-page';

export const revalidate = 0;

export default async function ManagePlacesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'cleanleader') redirect('/');

  // Fetch places
  const { data: places } = await supabase
    .from('cleaning_places')
    .select('*')
    .order('name');

  return (
    <ManagePlacesClient 
      initialPlaces={places || []}
    />
  );
}
