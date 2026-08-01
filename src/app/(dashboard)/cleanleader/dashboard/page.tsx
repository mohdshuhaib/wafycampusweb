import { Wrench } from 'lucide-react';

export default function CleaningLeaderDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Cleaning Leader Dashboard</h1>
      
      <div className="glass-panel p-12 flex flex-col items-center justify-center text-center mt-10">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 animate-ping rounded-full"></div>
          <div className="bg-primary p-4 rounded-full relative z-10">
            <Wrench className="w-10 h-10 text-white animate-pulse" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Building in Progress</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          We are currently crafting a beautiful and informative dashboard for you. Check back soon for detailed campus-wide statistics.
        </p>
      </div>
    </div>
  );
}
