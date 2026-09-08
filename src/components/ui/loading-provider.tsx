'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface LoadingContextType {
  startLoading: () => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

function RouteChangeWatcher({ onDone }: { onDone: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onDone();
  }, [pathname, searchParams, onDone]);

  return null;
}

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  const startLoading = useCallback(() => setIsLoading(true), []);
  const stopLoading = useCallback(() => setIsLoading(false), []);

  return (
    <LoadingContext.Provider value={{ startLoading, stopLoading }}>
      <Suspense fallback={null}>
        <RouteChangeWatcher onDone={stopLoading} />
      </Suspense>
      {children}
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="flex flex-col items-center gap-3 bg-card border border-border text-card-foreground p-6 rounded-lg shadow-lg scale-100 animate-in zoom-in-95 duration-150">
            <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-muted-foreground">Loading, please wait...</p>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('useLoading must be used within LoadingProvider');
  return context;
}
