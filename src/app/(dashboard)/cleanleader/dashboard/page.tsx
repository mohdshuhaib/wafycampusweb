import { Wrench } from 'lucide-react';

export default function CleaningLeaderDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Cleaning Leader Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage campus zones, daily duties, and team assignments.</p>
      </div>
      
      <div className="bg-card text-card-foreground border border-border rounded-lg p-10 flex flex-col items-center justify-center text-center shadow-xs mt-6">
        <div className="relative mb-5">
          <div className="bg-primary/10 text-primary p-3.5 rounded-full relative z-10">
            <Wrench className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1.5 tracking-tight">Dashboard Overview</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Navigate using the sidebar to manage places, assign duties, check cleaning progress, or configure exceptional students.
        </p>
      </div>
    </div>
  );
}
