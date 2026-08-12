"use client";

import Link from "next/link";
import { School, LogIn, LogOut } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";

export function MobileTopNav() {
  const [user, setUser] = useState<any>(null);
  const [dashboardPath, setDashboardPath] = useState<string>('/');
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile) {
          if (profile.role === 'clgleader') setDashboardPath('/clgleader/dashboard');
          else if (profile.role === 'cleanleader') setDashboardPath('/cleanleader/dashboard');
          else if (profile.role === 'classleader') setDashboardPath('/classleader/dashboard');
        }
      }
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        getUser(); // Refresh role on login
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  return (
    <nav className="md:hidden sticky top-0 z-50 glass border-b border-slate-200 dark:border-white/10 p-3 flex justify-between items-center w-full">
      <Link href="/" className="flex items-center gap-2 font-bold text-primary">
        <School className="w-5 h-5" />
        <span>Wafy Campus</span>
      </Link>
      
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {user ? (
          <div className="flex items-center gap-1">
            <Link href="/" className="p-2 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Home Page">
              <School className="w-5 h-5" />
            </Link>
            <button 
              onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} 
              className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors" 
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          pathname !== '/login' && (
            <Link href="/login" className="p-2 text-primary hover:bg-primary/10 rounded-lg">
              <LogIn className="w-5 h-5" />
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
