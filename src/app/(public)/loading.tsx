import { Loader2 } from 'lucide-react';

export default function PublicLoading() {
  return (
    <div className="w-full h-[60vh] flex flex-col items-center justify-center animate-in fade-in duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
        <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
      </div>
      <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium animate-pulse">Loading status...</p>
    </div>
  );
}
