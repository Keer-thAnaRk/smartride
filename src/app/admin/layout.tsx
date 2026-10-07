'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/components/auth-context';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login?callbackUrl=/admin/dashboard');
      } else if (user.role !== 'ADMIN') {
        const destination = user.role === 'DRIVER' ? '/driver/dashboard' : '/commuter/dashboard';
        router.replace(destination);
      }
    }
  }, [user, loading, router]);

  // While checking authentication state, display a secure loading screen and do not render children
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-300">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          <span className="text-sm font-medium">Verifying administrator credentials...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated or non-admin, render Access Denied guard and do not render children
  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-red-500/30 rounded-2xl p-6 text-center shadow-xl">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-sm text-slate-400 mb-6">
            Administrator privileges are required to access the SmartRide Command Center.
          </p>
          <button
            onClick={() => {
              const destination = user?.role === 'DRIVER' ? '/driver/dashboard' : user?.role === 'COMMUTER' ? '/commuter/dashboard' : '/';
              router.replace(destination);
            }}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Go to Your Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
