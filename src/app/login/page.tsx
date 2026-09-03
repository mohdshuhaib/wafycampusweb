'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { School, User, Key, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile) {
          if (profile.role === 'clgleader') router.push('/clgleader/dashboard');
          else if (profile.role === 'cleanleader') router.push('/cleanleader/dashboard');
          else if (profile.role === 'classleader') router.push('/classleader/dashboard');
          else router.push('/');
        }
      }
    };
    checkUser();
  }, [router, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Fetch user profile to determine role
    if (authData.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        setError('Could not find user profile or role.');
        setLoading(false);
        return;
      }

      // Redirect based on role
      if (profile.role === 'clgleader') {
        router.push('/clgleader/dashboard');
      } else if (profile.role === 'cleanleader') {
        router.push('/cleanleader/dashboard');
      } else if (profile.role === 'classleader') {
        router.push('/classleader/dashboard');
      } else {
        router.push('/');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2.5 text-xl font-bold text-primary mb-8 hover:opacity-90 transition-opacity tracking-tight">
          <School className="w-6 h-6 text-primary" />
          <span>Wafy Campus</span>
        </Link>
        
        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-sm p-6 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              Welcome Back
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Sign in to manage cleaning duties & reports
            </p>
          </div>
          
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-xs mb-4 border border-destructive/20 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground z-10">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors shadow-xs"
                  placeholder="leader@wafycampus.edu"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground z-10">
                  <Key className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors shadow-xs"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:brightness-95 text-primary-foreground font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center justify-center gap-2 mt-6 shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
