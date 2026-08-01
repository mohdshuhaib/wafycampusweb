import Link from 'next/link';
import { Home, School, Brush, LogIn, LogOut } from 'lucide-react';
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
    <div className="flex flex-col md:flex-row min-h-screen">
      <MobileTopNav />
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 glass border-r border-slate-200 dark:border-white/10 p-6 fixed h-full z-10">
        <div className="text-2xl font-bold mb-10 text-primary flex items-center gap-2">
          <School className="w-6 h-6" /> Wafy Campus
        </div>
        <nav className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors">
            <Home className="w-5 h-5" /> Home
          </Link>
          <Link href="/cleaning" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors">
            <Brush className="w-5 h-5" /> Cleaning
          </Link>
        </nav>
        
        <div className="mt-auto flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-sm font-medium text-slate-500">Theme</span>
            <ThemeToggle />
          </div>
          {user ? (
            <Link href={dashboardPath} className="flex items-center justify-center gap-2 p-3 w-full bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors font-medium">
              <School className="w-5 h-5" /> {roleLabel}
            </Link>
          ) : (
            <Link href="/login" className="flex items-center justify-center gap-2 p-3 w-full bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors font-medium">
              <LogIn className="w-5 h-5" /> Login
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-slate-200 dark:border-white/10 p-3 flex justify-around items-center z-40">
        <Link href="/" className="flex flex-col items-center p-2 text-sm">
          <Home className="w-6 h-6 mb-1" /> Home
        </Link>
        <Link href="/cleaning" className="flex flex-col items-center p-2 text-sm">
          <Brush className="w-6 h-6 mb-1" /> Cleaning
        </Link>
      </nav>
    </div>
  );
}
