import { Wrench } from 'lucide-react';

export default function ClassLeaderDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Class Leader Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage your class students and assign cleaning duties.</p>
      </div>
      
      <div className="bg-card text-card-foreground border border-border rounded-lg p-10 flex flex-col items-center justify-center text-center shadow-xs mt-6">
        <div className="relative mb-5">
          <div className="bg-primary/10 text-primary p-3.5 rounded-full relative z-10">
            <Wrench className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1.5 tracking-tight">Class Management Overview</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Use the navigation links above to manage your students or assign students to their assigned cleaning places.
        </p>
      </div>
    </div>
  );
}
