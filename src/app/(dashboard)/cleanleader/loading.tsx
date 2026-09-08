export default function CleanLeaderLoading() {
  return (
    <div className="w-full min-h-[50vh] flex flex-col items-center justify-center animate-in fade-in duration-150">
      <div className="flex flex-col items-center gap-3 bg-card border border-border text-card-foreground p-6 rounded-lg shadow-sm">
        <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-muted-foreground">Loading cleaning data...</p>
      </div>
    </div>
  );
}
