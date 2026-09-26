'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Brush, Home, CalendarCheck, ClipboardList } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileTopNav } from '@/components/mobile-top-nav';
import { DashboardMobileNav } from '@/components/dashboard-mobile-nav';
import { LogoutButton } from '@/components/logout-button';

export default function ClassLeaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/classleader/dashboard', icon: LayoutDashboard },
    { name: 'Day Attendance', href: '/classleader/day-attendance', icon: CalendarCheck },
    { name: 'Special Attendance', href: '/classleader/special-attendance', icon: ClipboardList },
    { name: 'Students', href: '/classleader/manage', icon: Users },
    { name: 'Cleaning', href: '/classleader/cleaning', icon: Brush },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground">
      <MobileTopNav />
      <aside className="w-full md:w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-5 hidden md:flex flex-col md:fixed h-auto md:h-full z-10">
        <div className="text-xl font-bold mb-8 text-primary flex items-center gap-2.5 tracking-tight">
          <Users className="w-5 h-5 text-primary" />
          <span>Class Leader</span>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive 
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs' 
                    : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className="w-4 h-4" /> <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>
        
        <div className="mt-auto flex flex-col gap-3 pt-6 border-t border-sidebar-border">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          <Link 
            href="/" 
            className="flex items-center justify-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md transition-colors text-sm font-medium"
          >
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

      <DashboardMobileNav role="classleader" />
    </div>
  );
}
