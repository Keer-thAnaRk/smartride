'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  Calendar,
  Award,
  RefreshCw,
  Clock,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';

export default function DriverEarningsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEarnings() {
      try {
        const res = await axios.get('/api/driver/earnings');
        if (res.data?.success) {
          setData(res.data);
        }
      } catch (err) {
        console.error('Failed to load driver earnings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadEarnings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const isVerified = (user as any)?.driverProfile?.isVerified === true;
  const stats = data?.stats || {};
  const payouts = isVerified ? (data?.payouts || []) : [];
  const recentTrips = isVerified ? (data?.recentTrips || []) : [];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-black text-slate-900">Driver Earnings & Payouts</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Guaranteed monthly corridor rider stipends, bonus incentives, and automated bi-weekly deposits
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{isVerified ? 'Next Payout: 1st of Next Month' : 'Next Payout: Available after activation'}</span>
          </div>
        </div>

        {/* 🟠 Pending Approval Status Notice */}
        {!isVerified && (
          <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start sm:items-center space-x-4 shadow-sm">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0 text-amber-800 font-bold">
              <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-extrabold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full">
                  🟠 Pending Approval
                </span>
              </div>
              <p className="text-xs font-medium text-amber-800 leading-relaxed">
                Your earnings dashboard will become available after your driver account is approved and you begin completing eligible trips.
              </p>
            </div>
          </div>
        )}

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Earnings (Lifetime)
            </div>
            <div className="text-3xl font-black text-slate-900">
              ₹{isVerified && stats.totalEarnings != null ? stats.totalEarnings.toLocaleString('en-IN') : '0'}
            </div>
            {isVerified ? (
              <div className="text-xs text-emerald-700 font-semibold flex items-center">
                <TrendingUp className="w-3.5 h-3.5 mr-1" /> Active earnings
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                Pending activation
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Projected This Month
            </div>
            <div className="text-3xl font-black text-emerald-700">
              ₹{isVerified && stats.monthlyProjection != null ? stats.monthlyProjection.toLocaleString('en-IN') : '0'}
            </div>
            <div className="text-xs text-slate-500">
              Based on {isVerified ? (stats.activeRiders || 0) : 0} active subscribers
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Completed Trips
            </div>
            <div className="text-3xl font-black text-slate-900">
              {isVerified ? (stats.completedTrips || 0) : 0}
            </div>
            <div className="text-xs text-slate-500">
              Morning & Evening shifts
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Captain Quality Rating
            </div>
            <div className="text-3xl font-black text-amber-500">
              {isVerified && stats.rating ? `★ ${stats.rating}` : 'No rating yet'}
            </div>
            <div className="text-xs text-slate-500">
              {isVerified && stats.rating ? 'Verified Corridor Captain' : 'Pending verification & initial trips'}
            </div>
          </div>
        </div>

        {/* Payout History & Trip Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Direct Bank Payout History (Col 7) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900">Direct Deposit Payouts</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {isVerified ? 'Bank Account: •••• 9821' : 'Account: Pending Verification'}
              </span>
            </div>

            {!isVerified ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                No payouts yet. Your account is pending verification.
              </div>
            ) : payouts.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                No past payout records yet.
              </div>
            ) : (
              <div className="space-y-3">
                {payouts.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900">₹{p.amount?.toLocaleString('en-IN')}</span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          {p.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">{p.reference}</div>
                    </div>

                    <div className="text-right text-xs text-slate-500">
                      <div>
                        {new Date(p.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                        {new Date(p.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Automated Bank Transfer</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: How Payouts Are Calculated (Col 5) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
            <h3 className="text-lg font-bold text-slate-900">Earning Rate Structure</h3>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-800">Fixed Subscriber Base Rate</div>
                  <div className="text-slate-500">Guaranteed per commuter seat per month</div>
                </div>
                <div className="text-sm font-black text-emerald-700">₹2,400/seat</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-800">On-Time Trip Completion Bonus</div>
                  <div className="text-slate-500">Paid for every morning/evening shift dispatched</div>
                </div>
                <div className="text-sm font-black text-emerald-700">₹350/trip</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-800">High Rating (★ &gt; 4.9) Incentive</div>
                  <div className="text-slate-500">Quarterly quality bonus pool reward</div>
                </div>
                <div className="text-sm font-black text-emerald-700">+₹4,500/qtr</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
              <strong>Guaranteed Income Promise:</strong> Even if a commuter marks absent or skips a ride, your fixed base subscription payout for that seat remains 100% protected!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
