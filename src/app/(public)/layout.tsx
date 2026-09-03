import Link from 'next/link';
import { Home, School, Brush, LogIn } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileTopNav } from '@/components/mobile-top-nav';
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
        <nav className="flex flex-col gap-1.5">
          <Link 
            href="/" 
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Home className="w-4 h-4" /> Home
          </Link>
          <Link 
            href="/cleaning" 
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Brush className="w-4 h-4" /> Cleaning
          </Link>
        </nav>
        
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

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xs border-t border-border px-3 py-2 flex justify-around items-center z-40 shadow-sm">
        <Link href="/" className="flex flex-col items-center py-1 px-3 text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          <Home className="w-5 h-5 mb-0.5" /> Home
        </Link>
        <Link href="/cleaning" className="flex flex-col items-center py-1 px-3 text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          <Brush className="w-5 h-5 mb-0.5" /> Cleaning
        </Link>
      </nav>
    </div>
  );
}
