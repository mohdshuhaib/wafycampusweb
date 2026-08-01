'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, LayoutDashboard, Brush, Users, Settings, ClipboardList, BarChart3, CheckSquare } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function DashboardMobileNav({ role }: { role: 'clgleader' | 'classleader' | 'cleanleader' }) {
  const [showMore, setShowMore] = useState(false);
  const pathname = usePathname();

  let items: { name: string; href: string; icon: any }[] = [];
  if (role === 'clgleader') {
    items = [
      { name: 'Dashboard', href: '/clgleader/dashboard', icon: LayoutDashboard },
      { name: 'Reports', href: '/clgleader/cleaning', icon: Brush },
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
      { name: 'Status', href: '/cleanleader/status', icon: BarChart3 },
      { name: 'Check', href: '/cleanleader/check', icon: CheckSquare },
    ];
  }

  const maxVisible = 4;
  const needsMore = items.length > maxVisible;
  
  const visibleItems = needsMore ? items.slice(0, 3) : items;
  const moreItems = needsMore ? items.slice(3) : [];

  return (
    <>
      {showMore && needsMore && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setShowMore(false)}>
          <div 
            className="absolute bottom-16 right-4 p-2 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2 min-w-[150px] animate-in slide-in-from-bottom-5"
            onClick={e => e.stopPropagation()}
          >
            {moreItems.map(item => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  <Icon className="w-4 h-4" /> {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-slate-200 dark:border-white/10 p-2 flex justify-around items-center z-40 pb-safe">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={`flex flex-col items-center p-2 text-xs transition-colors ${isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="truncate max-w-[64px]">{item.name}</span>
            </Link>
          )
        })}
        
        {needsMore && (
          <button 
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center p-2 text-xs transition-colors ${showMore ? 'text-primary' : 'text-slate-500'}`}
          >
            {showMore ? <X className="w-5 h-5 mb-1" /> : <Menu className="w-5 h-5 mb-1" />}
            <span>More</span>
          </button>
        )}
      </nav>
    </>
  );
}
