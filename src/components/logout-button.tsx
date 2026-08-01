'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <button 
      onClick={handleLogout}
      className="flex items-center gap-2 p-3 text-danger hover:bg-danger/10 rounded-lg transition-colors font-medium w-full text-left"
    >
      <LogOut className="w-5 h-5" /> Logout
    </button>
  );
}
