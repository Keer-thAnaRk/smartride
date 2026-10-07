'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Car,
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  AlertCircle,
  Shield,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';

function SignUpForm() {
  const searchParams = useSearchParams();
  const initialRole = (searchParams.get('role') as any) || 'COMMUTER';
  const [role, setRole] = useState<'COMMUTER' | 'DRIVER'>(
    initialRole === 'DRIVER' ? 'DRIVER' : 'COMMUTER'
  );

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    licenseNumber: '',
    vehicleMake: '',
    vehicleModel: '',
    vehiclePlate: '',
    vehicleCapacity: '4',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const { register, quickDemoLogin } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await register({
      ...formData,
      role,
    });
    setLoading(false);

    if (res.success) {
      if (role === 'DRIVER') {
        router.push('/driver/onboarding');
      } else {
        router.push('/commuter/plans');
      }
    } else {
      setError(res.error || 'Registration failed');
    }
  };

  const handleGoogleSSO = async () => {
    setError(null);
    setSocialLoading(true);
    try {
      await quickDemoLogin(role);
    } catch (err: any) {
      setError(err?.message || 'Google SSO sign-in failed. Please use email registration.');
    } finally {
      setSocialLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-xl">
      {/* 2. Sign-Up Card Container */}
      <div className="relative bg-[#111827]/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 space-y-6">
        {/* Header Section */}
        <div className="text-center space-y-2">
          {/* Logo / Brand Name: Commute Sync */}
          <Link href="/" className="inline-flex items-center space-x-2.5 group mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              Commute <span className="text-blue-400">Sync</span>
            </span>
          </Link>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Create Your Commute Account
          </h1>

          {/* Subtitle */}
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Enter your details to manage monthly subscriptions and rides.
          </p>
        </div>

        {/* 3. Role Selection Toggle (Commuter / Driver) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Account Type
          </label>
          <div className="grid grid-cols-2 p-1.5 bg-[#0a101f] border border-slate-800 rounded-xl gap-1.5">
            <button
              type="button"
              onClick={() => setRole('COMMUTER')}
              className={`py-2.5 px-3 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all duration-200 ${
                role === 'COMMUTER'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span className="text-base sm:text-lg">👤</span>
              <span>Commuter Pass</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('DRIVER')}
              className={`py-2.5 px-3 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all duration-200 ${
                role === 'DRIVER'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span className="text-base sm:text-lg">🚗</span>
              <span>Driver Captain</span>
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Fields & Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Alex Johnson"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0a101f] border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0a101f] border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@work.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0a101f] border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
          </div>

          {/* Additional fields when Driver Captain role is selected */}
          {role === 'DRIVER' && (
            <div className="pt-4 border-t border-slate-800 space-y-4 animate-in fade-in duration-200">
              <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Shield className="w-4 h-4" />
                <span>Vehicle & License Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Commercial License #
                  </label>
                  <input
                    type="text"
                    required={role === 'DRIVER'}
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    placeholder="DL-BLR-2023-XXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a101f] border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Vehicle License Plate
                  </label>
                  <input
                    type="text"
                    required={role === 'DRIVER'}
                    value={formData.vehiclePlate}
                    onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
                    placeholder="KA-01-XX-0000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a101f] border border-slate-700 text-white placeholder-slate-400 text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Make
                  </label>
                  <input
                    type="text"
                    value={formData.vehicleMake}
                    onChange={(e) => setFormData({ ...formData, vehicleMake: e.target.value })}
                    placeholder="Toyota"
                    className="w-full px-3 py-2 rounded-xl bg-[#0a101f] border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Model
                  </label>
                  <input
                    type="text"
                    value={formData.vehicleModel}
                    onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                    placeholder="Innova"
                    className="w-full px-3 py-2 rounded-xl bg-[#0a101f] border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Seats
                  </label>
                  <select
                    value={formData.vehicleCapacity}
                    onChange={(e) => setFormData({ ...formData, vehicleCapacity: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0a101f] border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="4" className="bg-slate-900 text-white">4 Seats (Sedan)</option>
                    <option value="6" className="bg-slate-900 text-white">6 Seats (SUV)</option>
                    <option value="12" className="bg-slate-900 text-white">12 Seats (Mini-Bus)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 4. Primary Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Social / Alternative Logins */}
        <div className="space-y-4">
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#111827] px-3 text-slate-400 font-medium tracking-wider">
                Or continue with
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSSO}
            disabled={socialLoading}
            className="w-full py-2.5 px-4 bg-slate-800/70 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 rounded-xl font-medium text-sm flex items-center justify-center space-x-3 transition-all duration-200 shadow-sm disabled:opacity-50"
          >
            {socialLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Footer Navigation Link */}
        <div className="pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-blue-400 font-semibold hover:text-blue-300 hover:underline transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignUpContent() {
  return (
    // 1. Layout & Background Styling
    <div className="relative min-h-[calc(100vh-4rem)] w-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#0a101f] text-white overflow-hidden">
      {/* Ambient Glow: Subtle blurred radial gradient background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft blue/teal glow at opacity: 0.15 centered behind the form container */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/15 via-teal-500/15 to-indigo-600/10 blur-[130px] rounded-full" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-teal-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 left-1/4 w-[450px] h-[450px] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <Suspense fallback={<RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />}>
        <SignUpForm />
      </Suspense>
    </div>
  );
}
