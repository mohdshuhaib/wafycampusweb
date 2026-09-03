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
        getUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  return (
    <nav className="md:hidden sticky top-0 z-50 bg-background/95 backdrop-blur-xs border-b border-border px-4 py-3 flex justify-between items-center w-full">
      <Link href="/" className="flex items-center gap-2 font-semibold text-primary tracking-tight">
        <School className="w-5 h-5" />
        <span>Wafy Campus</span>
      </Link>
      
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        {user ? (
          <div className="flex items-center gap-1">
            <Link 
              href="/" 
              className="p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors" 
              title="Home Page"
            >
              <School className="w-4 h-4" />
            </Link>
            <button 
              onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} 
              className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors" 
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          pathname !== '/login' && (
            <Link 
              href="/login" 
              className="px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:brightness-95 rounded-md shadow-xs transition-colors"
            >
              Login
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
