'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, LayoutDashboard, Brush, Users, Settings, ClipboardList, BarChart3, CheckSquare, StarOff, UserCheck, Calendar } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function DashboardMobileNav({ role }: { role: 'clgleader' | 'classleader' | 'cleanleader' | 'eduleader' }) {
  const [showMore, setShowMore] = useState(false);
  const pathname = usePathname();

  let items: { name: string; href: string; icon: any }[] = [];
  if (role === 'eduleader') {
    items = [
      { name: 'Dashboard', href: '/eduleader/dashboard', icon: LayoutDashboard },
      { name: 'Wafy Calendar', href: '/eduleader/calendar', icon: Calendar },
      { name: 'Manage Students', href: '/eduleader/students', icon: Users },
    ];
  } else if (role === 'clgleader') {
    items = [
      { name: 'Dashboard', href: '/clgleader/dashboard', icon: LayoutDashboard },
      { name: 'Reports', href: '/clgleader/cleaning', icon: Brush },
      { name: 'Students', href: '/clgleader/students', icon: Users },
    ];
  } else if (role === 'classleader') {
    items = [
      { name: 'Dashboard', href: '/classleader/dashboard', icon: LayoutDashboard },
      { name: 'Students', href: '/classleader/manage', icon: Users },
      { name: 'Cleaning', href: '/classleader/cleaning', icon: Brush },
    ];
  } else if (role === 'cleanleader') {
    items = [
      { name: 'Dashboard', href: '/cleanleader/dashboard', icon: LayoutDashboard },
      { name: 'Manage', href: '/cleanleader/manage', icon: Settings },
      { name: 'Assign', href: '/cleanleader/assign', icon: ClipboardList },
      { name: 'Assign Students', href: '/cleanleader/assign-students', icon: UserCheck },
      { name: 'Status', href: '/cleanleader/status', icon: BarChart3 },
      { name: 'Check', href: '/cleanleader/check', icon: CheckSquare },
      { name: 'Students', href: '/cleanleader/students', icon: Users },
      { name: 'Exceptional', href: '/cleanleader/exceptional', icon: StarOff },
    ];
  }

  const maxVisible = 4;
  const needsMore = items.length > maxVisible;
  
  const isItemActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const visibleItems = needsMore ? items.slice(0, 3) : items;
  const moreItems = needsMore ? items.slice(3) : [];
  const isMoreActive = moreItems.some(item => isItemActive(item.href));

  return (
    <>
      {showMore && needsMore && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/60 backdrop-blur-xs" onClick={() => setShowMore(false)}>
          <div 
            className="absolute bottom-16 right-4 p-2 bg-popover text-popover-foreground rounded-lg shadow-lg border border-border flex flex-col gap-1 min-w-[160px] animate-in slide-in-from-bottom-3 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {moreItems.map(item => {
              const Icon = item.icon;
              const isActive = isItemActive(item.href);
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xs border-t border-border px-2 py-1.5 flex justify-around items-center z-40 pb-safe shadow-sm">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = isItemActive(item.href);
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={`flex flex-col items-center py-1 px-2 text-[11px] font-medium transition-colors ${
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate max-w-[64px]">{item.name}</span>
            </Link>
          )
        })}
        
        {needsMore && (
          <button 
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center py-1 px-2 text-[11px] font-medium transition-colors ${
              showMore || isMoreActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {showMore ? <X className="w-4 h-4 mb-0.5" /> : <Menu className="w-4 h-4 mb-0.5" />}
            <span>More</span>
          </button>
        )}
      </nav>
    </>
  );
}
