'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth-context';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  Car,
  Compass,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  User,
  Users,
  X,
  Zap,
  MapPin,
  CheckCircle2,
  CalendarDays,
  Bell,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function Navbar() {
  const { user, logout, quickDemoLogin } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/commuter/notifications');
      if (res.ok) {
        const data = await res.json();
        if (data.notifications) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch (e) {
      console.warn('Could not fetch notifications:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleNotifUpdate = () => {
      fetchNotifications();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('commuter-notifications-updated', handleNotifUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('commuter-notifications-updated', handleNotifUpdate);
      }
    };
  }, [user]);

  const getNavLinks = (): NavItem[] => {
    const isCommuterSection =
      user?.role === 'COMMUTER' ||
      pathname === '/dashboard' ||
      pathname === '/plans' ||
      pathname.startsWith('/commuter');

    if (isCommuterSection) {
      return [
        { name: 'My Commute', href: user ? '/commuter/dashboard' : '/dashboard?mode=guest', icon: LayoutDashboard },
        { name: 'Plans & Pricing', href: user ? '/commuter/plans' : '/plans?mode=guest', icon: CreditCard },
        { name: 'Invoices', href: '/commuter/invoices', icon: FileText },
        { name: 'My Profile', href: '/commuter/profile', icon: User },
      ];
    }

    if (!user) {
      return [
        { name: 'How It Works', href: '/#how-it-works' },
        { name: 'Corridor Routes', href: '/#routes' },
        { name: 'Subscription Plans', href: '/#pricing' },
        { name: 'Driver Partner', href: '/register?role=DRIVER' },
      ];
    }

    if (user.role === 'DRIVER') {
      const isApprovedDriver = user.driverProfile?.isVerified === true;
      if (isApprovedDriver) {
        return [
          { name: 'Roster & Trips', href: '/driver/dashboard', icon: Compass },
          { name: 'Earnings & Payouts', href: '/driver/earnings', icon: CreditCard },
          { name: 'Vehicle & Documents', href: '/driver/documents', icon: Shield },
        ];
      }
      return [
        { name: 'Verification & Documents', href: '/driver/documents', icon: Shield },
      ];
    }

    if (user.role === 'ADMIN') {
      return [
        { name: 'KPI Command Center', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'AI Demand Intelligence', href: '/admin/dashboard#ai-demand-intelligence', icon: Sparkles },
        { name: 'Driver Approvals', href: '/admin/drivers', icon: Shield },
        { name: 'Leave & Substitutions', href: '/admin/leaves', icon: CalendarDays },
        { name: 'Route Network', href: '/admin/routes', icon: MapPin },
        { name: 'Commuter Allocations', href: '/admin/allocations', icon: Users },
      ];
    }

    return [];
  };

  const navLinks = getNavLinks();

  const checkIsActive = (href: string) => {
    if (pathname === href) return true;
    if (
      href === '/driver/documents' &&
      (pathname === '/driver/documents' || pathname === '/driver/onboarding')
    ) {
      return true;
    }
    if (
      (href.includes('plans') || href.startsWith('/plans')) &&
      (pathname === '/plans' || pathname.startsWith('/commuter/plans'))
    ) {
      return true;
    }
    if (
      (href.includes('dashboard') || href.startsWith('/dashboard')) &&
      (pathname === '/dashboard' || pathname.startsWith('/commuter/dashboard'))
    ) {
      return true;
    }
    return false;
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Car className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight text-slate-900 leading-none">
                  Smart<span className="text-emerald-600">Ride</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase mt-0.5">
                  Daily Commute Network
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((link) => {
              const isActive = checkIsActive(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Action Center & Demo Switcher */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Quick Demo Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDemoMenuOpen(!demoMenuOpen)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                title="Switch demo user roles in 1 click"
              >
                <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                <span>Demo Switcher</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full">
                  {user ? user.role : 'Guest'}
                </span>
              </button>

              {demoMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setDemoMenuOpen(false)}
                >
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Instant Demo Login
                  </div>
                  <button
                    onClick={() => quickDemoLogin('COMMUTER')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 transition-colors"
                  >
                    <div>
                      <div className="font-medium">Commuter (Rahul)</div>
                      <div className="text-xs text-slate-500">Route SR-101 • Monthly Plan</div>
                    </div>
                    {user?.role === 'COMMUTER' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </button>
                  <button
                    onClick={() => quickDemoLogin('DRIVER')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 transition-colors"
                  >
                    <div>
                      <div className="font-medium">Driver (Rajesh)</div>
                      <div className="text-xs text-slate-500">Innova 6S • 4.96 ★ Rating</div>
                    </div>
                    {user?.role === 'DRIVER' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </button>
                </div>
              )}
            </div>

            {user ? (
              <div className="flex items-center space-x-3 pl-2 border-l border-slate-200">
                {/* Notification Bell with unread badge */}
                <div className="relative">
                  <button
                    onClick={() => setNotifMenuOpen(!notifMenuOpen)}
                    className="relative p-1.5 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                    title="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white ring-2 ring-white animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {notifMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50 animate-in fade-in zoom-in-95 duration-100"
                      onClick={() => setNotifMenuOpen(false)}
                    >
                      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 text-xs">
                        <span className="font-bold text-slate-800">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                            {unreadCount} unread
                          </span>
                        )}
                      </div>

                      <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pt-1">
                        {notifications.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-xs">
                            No notifications right now
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <Link
                              key={n.id}
                              href={n.actionUrl || '/plans'}
                              className="block p-2.5 hover:bg-slate-50 rounded-xl transition-colors space-y-1 text-left group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                                  {n.type === 'WARNING' && <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />}
                                  <span>{n.title}</span>
                                </span>
                                {!n.read && (
                                  <span className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 leading-snug">
                                {n.message}
                              </p>
                              <div className="text-[10px] text-emerald-600 font-semibold pt-0.5 group-hover:underline">
                                Click to review your renewal plan →
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <UserAvatar
                    src={user.avatar}
                    name={user.name}
                    size="sm"
                    alt={user.name}
                  />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[100px]">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium">
                      {user.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => logout()}
                  className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm shadow-emerald-600/20 transition-all hover:shadow"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center space-x-2 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3">
          {/* Demo Quick Switcher in Mobile */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <div className="text-xs font-bold text-amber-900 flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Quick Demo Role Switch</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { quickDemoLogin('COMMUTER'); setMobileMenuOpen(false); }}
                className="py-1 px-2 text-xs font-semibold bg-white border border-amber-200 rounded-lg text-slate-800"
              >
                Commuter
              </button>
              <button
                onClick={() => { quickDemoLogin('DRIVER'); setMobileMenuOpen(false); }}
                className="py-1 px-2 text-xs font-semibold bg-white border border-amber-200 rounded-lg text-slate-800"
              >
                Driver
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {navLinks.map((link) => {
              const isActive = checkIsActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-base font-medium ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          {user ? (
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <UserAvatar
                  src={user.avatar}
                  name={user.name}
                  size="md"
                  alt={user.name}
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                  <div className="text-xs text-slate-500">{user.email} • {user.role}</div>
                </div>
              </div>
              <button
                onClick={() => { setMobileMenuOpen(false); logout(); }}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 text-sm font-semibold border border-slate-300 rounded-lg text-slate-700"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
