import Link from 'next/link';
import { School, LogIn } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileTopNav } from '@/components/mobile-top-nav';
import { PublicSidebarNav, PublicMobileBottomNav } from '@/components/public-nav';
import { createClient } from '@/utils/supabase/server';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let profile = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    profile = data;
  }

  let roleLabel = "Dashboard";
  let dashboardPath = "/";
  if (profile?.role === 'clgleader') { roleLabel = "College Leader"; dashboardPath = "/clgleader/dashboard"; }
  else if (profile?.role === 'cleanleader') { roleLabel = "Cleaning Leader"; dashboardPath = "/cleanleader/dashboard"; }
  else if (profile?.role === 'classleader') { roleLabel = "Class Leader"; dashboardPath = "/classleader/dashboard"; }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground">
      <MobileTopNav />
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-5 fixed h-full z-10">
        <div className="text-xl font-bold mb-8 text-primary flex items-center gap-2.5 tracking-tight">
          <School className="w-5 h-5 text-primary" /> Wafy Campus
        </div>
        <PublicSidebarNav />
        
        <div className="mt-auto flex flex-col gap-3 pt-6 border-t border-sidebar-border">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          {user ? (
            <Link 
              href={dashboardPath} 
              className="flex items-center justify-center gap-2 px-3 py-2 w-full bg-primary text-primary-foreground hover:brightness-95 rounded-md font-medium text-sm shadow-xs transition-colors"
            >
              <School className="w-4 h-4" /> {roleLabel}
            </Link>
          ) : (
            <Link 
              href="/login" 
              className="flex items-center justify-center gap-2 px-3 py-2 w-full bg-primary text-primary-foreground hover:brightness-95 rounded-md font-medium text-sm shadow-xs transition-colors"
            >
              <LogIn className="w-4 h-4" /> Login
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav with Active Page Highlighting */}
      <PublicMobileBottomNav />
    </div>
  );
}
