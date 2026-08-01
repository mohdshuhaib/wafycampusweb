'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { BellRing, X } from 'lucide-react';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    
    setPermission(Notification.permission);

    const setupRealtime = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's profile to see if they are a Class Leader and what class they are
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, class')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'Class Leader' && profile.class) {
          const userClass = profile.class;
          
          // Subscribe to new class_assignments targeting this class
          const channel = supabase
            .channel('realtime-assignments')
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'class_assignments',
                filter: `class_name=eq.${userClass}` // Only listen for assignments to this specific class
              },
              async (payload) => {
                // Fetch the place name just for a nicer message
                const { data: placeData } = await supabase
                  .from('cleaning_places')
                  .select('name')
                  .eq('id', payload.new.place_id)
                  .single();

                const placeName = placeData?.name || 'a new place';
                const title = 'New Cleaning Assignment';
                const body = `Your class has been assigned to clean ${placeName}.`;

                // Show native browser notification if granted
                if (Notification.permission === 'granted') {
                  new Notification(title, {
                    body,
                    icon: '/icon-192x192.png' // Make sure you add an icon to your public folder later
                  });
                }

                // Show in-app toast
                setToast({ title, body });
                setTimeout(() => setToast(null), 8000);
              }
            )
            .subscribe();

          return () => {
            supabase.removeChannel(channel);
          };
        }
      } catch (err) {
        console.error('Error setting up Realtime notifications:', err);
      }
    };

    if (Notification.permission === 'granted') {
      setupRealtime();
    }
  }, [supabase]);

  const requestPermission = async () => {
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === 'granted') {
      window.location.reload(); // Reload to run setupRealtime
    }
  };

  return (
    <>
      {children}
      
      {/* Toast for in-app notifications */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-slate-900 border-l-4 border-primary shadow-xl rounded-lg p-4 max-w-sm animate-in slide-in-from-top-2">
          <div className="flex justify-between items-start gap-4">
            <div className="flex gap-3 items-start">
              <BellRing className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white">{toast.title}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{toast.body}</p>
              </div>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Banner to request permission if default */}
      {permission === 'default' && (
        <div className="fixed bottom-safe right-safe m-4 z-40 bg-slate-900 dark:bg-slate-800 text-white p-4 rounded-xl shadow-2xl flex flex-col md:flex-row gap-4 items-center max-w-lg animate-in slide-in-from-bottom-4">
          <div className="flex-1">
            <h4 className="font-bold flex items-center gap-2"><BellRing className="w-4 h-4" /> Enable Notifications</h4>
            <p className="text-sm text-slate-300 mt-1">Get instantly notified when new cleaning tasks are assigned.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => setPermission('denied')} className="px-4 py-2 text-sm font-medium hover:bg-white/10 rounded-lg transition-colors flex-1 md:flex-auto">
              Not Now
            </button>
            <button onClick={requestPermission} className="px-4 py-2 text-sm font-bold bg-primary hover:bg-primary/90 rounded-lg transition-colors flex-1 md:flex-auto whitespace-nowrap">
              Turn On
            </button>
          </div>
        </div>
      )}
    </>
  );
}
