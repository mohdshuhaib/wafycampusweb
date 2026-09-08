'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Brush } from 'lucide-react';

export function PublicSidebarNav() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isCleaning = pathname.startsWith('/cleaning');

  return (
    <nav className="flex flex-col gap-1.5">
      <Link 
        href="/" 
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isHome
            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
            : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        }`}
      >
        <Home className="w-4 h-4" /> Home
      </Link>
      <Link 
        href="/cleaning" 
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isCleaning
            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
            : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        }`}
      >
        <Brush className="w-4 h-4" /> Cleaning
      </Link>
    </nav>
  );
}

export function PublicMobileBottomNav() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isCleaning = pathname.startsWith('/cleaning');

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xs border-t border-border px-3 py-2 flex justify-around items-center z-40 shadow-sm">
      <Link 
        href="/" 
        className={`flex flex-col items-center py-1 px-3 text-xs font-medium transition-colors ${
          isHome ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Home className="w-5 h-5 mb-0.5" /> Home
      </Link>
      <Link 
        href="/cleaning" 
        className={`flex flex-col items-center py-1 px-3 text-xs font-medium transition-colors ${
          isCleaning ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Brush className="w-5 h-5 mb-0.5" /> Cleaning
      </Link>
    </nav>
  );
}
