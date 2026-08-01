import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ManagePlacesToolsClient from './client-page';

export const revalidate = 0;

export default async function ManagePlacesToolsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'cleanleader') redirect('/');

  // Fetch places and tools concurrently
  const [placesReq, toolsReq] = await Promise.all([
    supabase.from('cleaning_places').select('*').order('name'),
    supabase.from('tools').select('*').order('name')
  ]);

  return (
    <ManagePlacesToolsClient 
      initialPlaces={placesReq.data || []}
      initialTools={toolsReq.data || []}
    />
  );
}
