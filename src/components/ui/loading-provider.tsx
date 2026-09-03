'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingContextType {
  startLoading: () => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <LoadingContext.Provider value={{ startLoading: () => setIsLoading(true), stopLoading: () => setIsLoading(false) }}>
      {children}
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="flex flex-col items-center gap-3 bg-card border border-border text-card-foreground p-6 rounded-lg shadow-lg scale-100 animate-in zoom-in-95 duration-150">
            <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-muted-foreground">Processing, please wait...</p>
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
