import { Loader2 } from 'lucide-react';

export default function GlobalLoading() {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-background">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>
        <Loader2 className="w-16 h-16 text-primary animate-spin relative z-10" />
      </div>
    </div>
  );
}
