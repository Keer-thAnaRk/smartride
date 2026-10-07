'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Trophy,
  Users,
  Award,
  Zap,
  TrendingUp,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Flame,
  ArrowRight,
  Info,
  Sparkles,
} from 'lucide-react';
import { AdminGamificationSummary } from '@/lib/gamification/gamification-types';

export default function GamificationAnalyticsCenter() {
  const [summary, setSummary] = useState<AdminGamificationSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/gamification');
      if (res.data?.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Failed to load admin gamification analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-black text-xl">
            <Trophy className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black text-slate-900">
                Gamification & Engagement Center
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                Active Rewards
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Fleet-wide commuter positive behavioral reinforcement, achievement adoption & XP ledger
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition self-end sm:self-auto"
          title="Refresh metrics"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {loading && !summary ? (
        <div className="py-12 flex items-center justify-center space-x-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Aggregating commuter achievement metrics...</span>
        </div>
      ) : summary ? (
        <div className="space-y-6">
          {/* 4 Fleet-Level KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50/50 border border-indigo-200/80 space-y-2">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                Active Gamified Riders
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-indigo-950">
                  {summary.activeGamifiedUsersCount}
                </span>
                <span className="text-xs font-bold text-indigo-700">commuters</span>
              </div>
              <span className="text-[11px] text-indigo-700 block">
                {summary.achievementCompletionRatePercent}% achievement completion rate
              </span>
            </div>

            {/* KPI 2 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-slate-500" />
                Badges Unlocked
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-slate-900">
                  {summary.totalAchievementsUnlocked.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-500">milestones</span>
              </div>
              <span className="text-[11px] text-slate-500 block">Across 14 achievement tiers</span>
            </div>

            {/* KPI 3 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-slate-500" />
                Monthly XP Awarded
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-slate-900">
                  {summary.fleetMonthlyXpAwarded.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-500">XP</span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                {summary.fleetLifetimeXpAwarded.toLocaleString()} total lifetime XP
              </span>
            </div>

            {/* KPI 4 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-slate-500" />
                Avg XP / Commuter
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-slate-900">
                  {summary.avgXpPerCommuter.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-500">XP / rider</span>
              </div>
              <span className="text-[11px] text-slate-500 block">Strong corridor engagement</span>
            </div>
          </div>

          {/* 2-Column Split: Popular Achievements & Real-Time XP Ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Popular Achievements */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Award className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Top Unlocked Achievements</h3>
                </div>
                <span className="text-xs text-slate-500">By adoption count</span>
              </div>

              <div className="space-y-3 text-xs">
                {summary.popularAchievements.map((item, idx) => {
                  const percent = Math.round(
                    (item.unlocksCount / summary.activeGamifiedUsersCount) * 100
                  );
                  return (
                    <div
                      key={item.achievementId}
                      className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900">{item.name}</span>
                            <span className="text-[10px] text-slate-400 block uppercase">
                              {item.category}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-indigo-950">
                            {item.unlocksCount} riders
                          </span>
                          <span className="text-[10px] text-slate-400 block">+{item.xpReward} XP</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Real-Time XP Event Ledger */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">Verified XP Event Ledger</h3>
                </div>
                <span className="text-xs text-slate-500">Idempotent log</span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
                {summary.recentXpEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{evt.commuterName}</span>
                        <span className="text-[9px] font-bold px-2 py-0.2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full">
                          {evt.eventType}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{evt.description}</p>
                    </div>
                    <span className="font-mono font-bold text-emerald-600 text-xs whitespace-nowrap ml-2">
                      +{evt.points} XP
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Anti-Gaming Assurance Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 flex items-start space-x-2.5 text-slate-600">
            <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs leading-relaxed">
              <strong>Anti-Gaming Integrity:</strong> XP awards require verified physical boarding timestamps and cryptographic idempotency hashing. Cancelled trips, duplicate events, and incorrect OTP attempts generate 0 XP.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
