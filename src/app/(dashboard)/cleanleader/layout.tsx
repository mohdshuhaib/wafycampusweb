import Link from 'next/link';
import { LayoutDashboard, Settings, ClipboardList, BarChart3, CheckSquare, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileTopNav } from '@/components/mobile-top-nav';
import { DashboardMobileNav } from '@/components/dashboard-mobile-nav';
import { LogoutButton } from '@/components/logout-button';

export default function CleaningLeaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-900">
      <MobileTopNav />
      <aside className="w-full md:w-64 glass border-r border-slate-200 dark:border-white/10 p-6 hidden md:flex flex-col md:fixed h-auto md:h-full z-10">
        <div className="text-xl font-bold mb-8 text-primary flex items-center gap-2">
          <Settings className="w-5 h-5" /> Cleaning Leader
        </div>
        <nav className="flex flex-col gap-2">
          <Link href="/cleanleader/dashboard" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap">
            <LayoutDashboard className="w-5 h-5" /> <span>Dashboard</span>
          </Link>
          <Link href="/cleanleader/manage" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap">
            <Settings className="w-5 h-5" /> <span>Manage</span>
          </Link>
          <Link href="/cleanleader/assign" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap">
            <ClipboardList className="w-5 h-5" /> <span>Assign</span>
          </Link>
          <Link href="/cleanleader/status" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap">
            <BarChart3 className="w-5 h-5" /> <span>Status</span>
          </Link>
          <Link href="/cleanleader/check" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap">
            <CheckSquare className="w-5 h-5" /> <span>Check</span>
          </Link>
        </nav>
        
        <div className="mt-auto flex flex-col gap-4 pt-8">
          <div className="flex items-center justify-between px-2">
            <span className="text-sm font-medium text-slate-500">Theme</span>
            <ThemeToggle />
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      <DashboardMobileNav role="cleanleader" />
    </div>
  );
}
