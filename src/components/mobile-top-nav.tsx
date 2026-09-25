"use client";

import Link from "next/link";
import { School, LogIn, LogOut, LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";

export function MobileTopNav() {
  const [user, setUser] = useState<any>(null);
  const [dashboardPath, setDashboardPath] = useState<string>('/cleanleader/dashboard');
  const [roleTitle, setRoleTitle] = useState<string>('Dashboard');
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role, designation').eq('id', user.id).single();
        if (profile) {
          if (profile.role === 'eduleader' || profile.designation?.toLowerCase().includes('academic')) {
            setDashboardPath('/eduleader/dashboard');
            setRoleTitle('Academic Leader');
          } else if (profile.role === 'clgleader') {
            setDashboardPath('/clgleader/dashboard');
            setRoleTitle('College Leader');
          } else if (profile.role === 'cleanleader') {
            setDashboardPath('/cleanleader/dashboard');
            setRoleTitle('Cleaning Leader');
          } else if (profile.role === 'classleader') {
            setDashboardPath('/classleader/dashboard');
            setRoleTitle('Class Leader');
          }
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

  const isDashboard = pathname.startsWith('/cleanleader') || 
                      pathname.startsWith('/classleader') || 
                      pathname.startsWith('/clgleader') ||
                      pathname.startsWith('/eduleader');

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
            {isDashboard ? (
              // In Dashboard: Show Home button and Logout button
              <>
                <Link 
                  href="/" 
                  className="p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors" 
                  title="View Home Page"
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
              </>
            ) : (
              // In Public / Home: Show Dashboard button to return to dashboard, no Logout button
              <Link 
                href={dashboardPath} 
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:brightness-95 rounded-md shadow-xs transition-colors" 
                title={`Go to ${roleTitle}`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
            )}
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
