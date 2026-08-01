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
          <Link href={dashboardPath} className="p-2 text-primary hover:bg-primary/10 rounded-lg flex items-center gap-2">
            <School className="w-5 h-5" />
          </Link>
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
