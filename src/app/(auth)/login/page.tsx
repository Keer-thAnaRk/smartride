'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Car,
  Lock,
  Mail,
  ArrowRight,
  Zap,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  LogOut,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, login, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await login(email, password);
    setLoading(false);

    if (res.success && res.user) {
      let target = '/commuter/dashboard';
      if (callbackUrl) {
        target = callbackUrl;
      } else if (res.user.role === 'ADMIN') {
        target = '/admin/dashboard';
      } else if (res.user.role === 'DRIVER') {
        target = '/driver/dashboard';
      }

      if (typeof window !== 'undefined') {
        window.location.href = target;
      } else {
        router.push(target);
      }
    } else {
      setError(res.error || 'Invalid credentials');
    }
  };

  const handleFillEmail = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('');
    setError(null);
  };

  const handleClear = () => {
    setEmail('');
    setPassword('');
    setError(null);
  };

  return (
    <div className="relative w-full max-w-md">
      {/* Login Card Container */}
      <div className="relative bg-[#111827]/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header Section */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center space-x-2.5 group mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              Commute <span className="text-blue-400">Sync</span>
            </span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Sign In to Commute Sync
          </h1>
          <p className="text-sm text-slate-400">
            Access your daily ride schedule, driver manifest, or admin console
          </p>
        </div>

        {/* Existing Session Notice */}
        {user && (
          <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/80 flex items-center justify-between text-xs text-blue-200">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div>
                <span>Signed in as <strong className="text-white">{user.name}</strong> ({user.role})</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center space-x-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch</span>
            </button>
          </div>
        )}

        {/* Demo Account Autofill Box */}
        <div className="bg-[#0a101f]/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Demo Account Autofill:</span>
            </div>
            {(email || password) && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] text-slate-400 hover:text-rose-400 font-medium flex items-center space-x-0.5"
              >
                <X className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleFillEmail('commuter.rahul@smartride.com')}
              className={`p-2 rounded-lg border text-left transition-all ${
                email === 'commuter.rahul@smartride.com'
                  ? 'bg-blue-950/60 border-blue-500 text-white shadow-sm ring-1 ring-blue-500'
                  : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/80 text-slate-300'
              }`}
            >
              <div className="text-xs font-bold text-blue-400">Commuter</div>
              <div className="text-[10px] text-slate-400 truncate">Rahul V.</div>
            </button>

            <button
              type="button"
              onClick={() => handleFillEmail('driver.rajesh@smartride.com')}
              className={`p-2 rounded-lg border text-left transition-all ${
                email === 'driver.rajesh@smartride.com'
                  ? 'bg-blue-950/60 border-blue-500 text-white shadow-sm ring-1 ring-blue-500'
                  : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/80 text-slate-300'
              }`}
            >
              <div className="text-xs font-bold text-teal-400">Driver</div>
              <div className="text-[10px] text-slate-400 truncate">Rajesh S.</div>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0a101f] border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#0a101f] border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400">
          Don't have an account yet?{' '}
          <Link
            href="/signup"
            className="text-blue-400 font-semibold hover:text-blue-300 hover:underline transition-colors"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#0a101f] text-white overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-blue-600/15 via-teal-500/15 to-indigo-600/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <Suspense fallback={<RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
