'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, ClipboardList, BarChart3, CheckSquare, LogOut, Users, Home, StarOff } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileTopNav } from '@/components/mobile-top-nav';
import { DashboardMobileNav } from '@/components/dashboard-mobile-nav';
import { LogoutButton } from '@/components/logout-button';

export default function CleaningLeaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/cleanleader/dashboard', icon: LayoutDashboard },
    { name: 'Manage', href: '/cleanleader/manage', icon: Settings },
    { name: 'Assign', href: '/cleanleader/assign', icon: ClipboardList },
    { name: 'Status', href: '/cleanleader/status', icon: BarChart3 },
    { name: 'Check', href: '/cleanleader/check', icon: CheckSquare },
    { name: 'Students', href: '/cleanleader/students', icon: Users },
    { name: 'Exceptional', href: '/cleanleader/exceptional', icon: StarOff },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-900">
      <MobileTopNav />
      <aside className="w-full md:w-64 glass border-r border-slate-200 dark:border-white/10 p-6 hidden md:flex flex-col md:fixed h-auto md:h-full z-10">
        <div className="text-xl font-bold mb-8 text-primary flex items-center gap-2">
          <Settings className="w-5 h-5" /> Cleaning Leader
        </div>
        <nav className="flex flex-col gap-2">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`flex items-center gap-3 p-3 rounded-lg transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-primary text-white font-bold shadow-md shadow-primary/20' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" /> <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>
        
        <div className="mt-auto flex flex-col gap-4 pt-8">
          <div className="flex items-center justify-between px-2">
            <span className="text-sm font-medium text-slate-500">Theme</span>
            <ThemeToggle />
          </div>
          <Link href="/" className="flex items-center justify-center gap-2 p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors font-medium">
            <Home className="w-4 h-4" /> Home Page
          </Link>
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
