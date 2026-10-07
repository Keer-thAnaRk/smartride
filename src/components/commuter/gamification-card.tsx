'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Trophy,
  Award,
  Flame,
  Zap,
  Leaf,
  Bus,
  Clock,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Crown,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Globe,
  Compass,
  Calendar,
  Eye,
  EyeOff,
  UserCheck,
  X,
  History,
  Sliders,
  HelpCircle,
} from 'lucide-react';
import {
  CommuterGamificationSummary,
  AchievementItem,
  LeaderboardEntry,
} from '@/lib/gamification/gamification-types';

export default function GamificationCard() {
  const [data, setData] = useState<CommuterGamificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  // Modals
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Privacy form state
  const [privacyForm, setPrivacyForm] = useState<{
    showOnLeaderboard: boolean;
    privacyDisplayName: 'REAL_NAME' | 'INITIALS' | 'ANONYMOUS';
  }>({
    showOnLeaderboard: true,
    privacyDisplayName: 'ANONYMOUS',
  });
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const loadGamificationData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/commuter/gamification');
      if (res.data?.success) {
        setData(res.data.summary);
        setPrivacyForm({
          showOnLeaderboard: res.data.summary.showOnLeaderboard,
          privacyDisplayName: res.data.summary.privacyDisplayName,
        });
      }
    } catch (err) {
      console.error('Failed to load gamification summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      setLoadingLeaderboard(true);
      const res = await axios.get('/api/gamification/leaderboard');
      if (res.data?.success) {
        setLeaderboard(res.data.leaderboard);
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    loadGamificationData();
  }, []);

  const handleOpenLeaderboard = () => {
    setShowLeaderboardModal(true);
    loadLeaderboard();
  };

  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPrivacy(true);
      const res = await axios.post('/api/commuter/gamification/privacy', privacyForm);
      if (res.data?.success) {
        setShowPrivacyModal(false);
        loadGamificationData();
        if (showLeaderboardModal) loadLeaderboard();
      }
    } catch (err) {
      console.error('Error saving privacy:', err);
    } finally {
      setSavingPrivacy(false);
    }
  };

  // Filter achievements
  const filteredAchievements = data?.achievements.filter((a) => {
    if (activeCategory === 'ALL') return true;
    return a.category === activeCategory;
  }) || [];

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Leaf': return Leaf;
      case 'Globe': return Globe;
      case 'Sparkles': return Sparkles;
      case 'Compass': return Compass;
      case 'Bus': return Bus;
      case 'Award': return Award;
      case 'Calendar': return Calendar;
      case 'Clock': return Clock;
      case 'Trophy': return Trophy;
      case 'Flame': return Flame;
      case 'Lock': return Lock;
      case 'ShieldCheck': return ShieldCheck;
      case 'CheckCircle2': return CheckCircle2;
      case 'Crown': return Crown;
      default: return Trophy;
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-indigo-100 shadow-sm relative overflow-hidden space-y-6">
      {/* Subtle background glow */}
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-50/70 rounded-full blur-2xl pointer-events-none" />

      {/* Header with Level & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 relative z-10">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-indigo-500/20">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900">My Smart Commute</h2>
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                Level {data?.currentLevel || 1}
              </span>
            </div>
            <p className="text-xs text-slate-500">Earn XP and unlock badges for verified positive commuting habits</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenLeaderboard}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200/70 transition"
          >
            <Crown className="w-3.5 h-3.5 text-amber-600" />
            <span>Leaderboard</span>
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            title="View History & Records"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Records</span>
          </button>
          <button
            onClick={() => setShowPrivacyModal(true)}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 transition"
            title="Privacy Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-10 flex items-center justify-center space-x-2 text-slate-400">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Loading commute achievements...</span>
        </div>
      ) : data ? (
        <div className="space-y-6 relative z-10">
          {/* XP & Level Progress Hero Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white border border-indigo-500/30 shadow-lg shadow-indigo-500/5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <span className="text-2xl font-black text-white">Level {data.currentLevel}</span>
                <span className="text-xs font-bold px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 rounded-full">
                  {data.totalXp.toLocaleString()} Total XP
                </span>
              </div>
              <span className="text-xs text-indigo-200 font-mono">
                {data.totalXp} / {data.nextLevelXp} XP to Level {data.currentLevel + 1}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800/80 rounded-full h-3 p-0.5 border border-indigo-500/20">
              <div
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.max(5, data.levelProgressPercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
              <span>{data.currentLevelBaseXp} XP (Level {data.currentLevel})</span>
              <span className="font-bold text-indigo-300">{data.levelProgressPercent}% progress</span>
              <span>{data.nextLevelXp} XP (Level {data.currentLevel + 1})</span>
            </div>
          </div>

          {/* 5 Core Commute Stats Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Tile 1: Achievements */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                Badges
              </span>
              <div className="mt-2">
                <span className="text-2xl font-black text-indigo-950">{data.unlockedCount}</span>
                <span className="text-xs text-indigo-600 font-medium ml-1">/ {data.totalAchievementsCount}</span>
              </div>
              <span className="text-[10px] text-indigo-600/70 mt-1">unlocked</span>
            </div>

            {/* Tile 2: CO2 Saved */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                CO₂ Saved
              </span>
              <div className="mt-2">
                <span className="text-2xl font-black text-emerald-950">{data.co2SavedKg}</span>
                <span className="text-xs text-emerald-600 font-medium ml-1">kg</span>
              </div>
              <span className="text-[10px] text-emerald-600/70 mt-1">Eco-Sync</span>
            </div>

            {/* Tile 3: Shared Trips */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                <Bus className="w-3.5 h-3.5 text-slate-500" />
                Shared Rides
              </span>
              <div className="mt-2">
                <span className="text-2xl font-black text-slate-900">{data.totalCompletedTrips}</span>
                <span className="text-xs text-slate-500 font-medium ml-1">trips</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">verified</span>
            </div>

            {/* Tile 4: On-Time Boarding */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                On-Time
              </span>
              <div className="mt-2">
                <span className="text-2xl font-black text-slate-900">{data.onTimeRatePercent}%</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">punctuality rate</span>
            </div>

            {/* Tile 5: On-Time Streak */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/70 flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                Trip Streak
              </span>
              <div className="mt-2">
                <span className="text-2xl font-black text-amber-950">{data.currentStreak}</span>
                <span className="text-xs text-amber-700 font-bold ml-1">rides</span>
              </div>
              <span className="text-[10px] text-amber-700/80 mt-1">Best: {data.bestStreak}</span>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 border-b border-slate-100 text-xs font-bold">
            {[
              { id: 'ALL', label: 'All Badges' },
              { id: 'SUSTAINABILITY', label: '🌱 Sustainability' },
              { id: 'CONSISTENCY', label: '🚌 Consistency' },
              { id: 'RELIABILITY', label: '⏱ Reliability' },
              { id: 'SAFETY', label: '🔐 Safety' },
              { id: 'MILESTONE', label: '🏆 Milestones' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${
                  activeCategory === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Achievements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredAchievements.map((ach) => {
              const Icon = getIconComponent(ach.icon);
              return (
                <div
                  key={ach.id}
                  className={`p-4 rounded-2xl border transition relative overflow-hidden flex flex-col justify-between space-y-3 ${
                    ach.isUnlocked
                      ? 'bg-white border-indigo-200/90 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200/80 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                          ach.isUnlocked
                            ? 'bg-indigo-50 border border-indigo-200 text-indigo-600'
                            : 'bg-slate-200/70 text-slate-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <h4 className="text-xs font-bold text-slate-900">{ach.name}</h4>
                          {ach.isUnlocked && (
                            <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full">
                              Unlocked
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">{ach.description}</p>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 whitespace-nowrap flex-shrink-0">
                      +{ach.xpReward} XP
                    </span>
                  </div>

                  {/* Progress Indicator */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                      <span>
                        {ach.currentProgress} / {ach.threshold}
                      </span>
                      <span>{ach.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          ach.isUnlocked ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${Math.min(100, ach.progressPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Anti-Gaming Guarantee Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-100/90 border border-slate-200 text-slate-600 flex items-start space-x-2.5 text-xs">
            <HelpCircle className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] leading-relaxed">
              <strong>SmartRide Fair Play Guarantee:</strong> XP is earned exclusively through verified physical boarding, on-time arrivals, and prompt OTP validation. Booking without completing trips generates 0 XP.
            </p>
          </div>
        </div>
      ) : null}

      {/* MODAL 1: MONTHLY LEADERBOARD */}
      {showLeaderboardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Monthly Corridor Leaderboard</h3>
                  <span className="text-[10px] text-slate-400">Resets monthly • Unlocked achievements stay permanent</span>
                </div>
              </div>
              <button
                onClick={() => setShowLeaderboardModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingLeaderboard ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading ranking...</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.rank}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition ${
                      entry.isCurrentUser
                        ? 'bg-indigo-50/80 border-indigo-300 font-bold'
                        : 'bg-slate-50/60 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                          entry.rank === 1
                            ? 'bg-amber-400 text-amber-950 shadow-xs'
                            : entry.rank === 2
                            ? 'bg-slate-300 text-slate-800'
                            : entry.rank === 3
                            ? 'bg-amber-700/20 text-amber-900'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {entry.rank}
                      </span>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-900">{entry.displayName}</span>
                          {entry.isCurrentUser && (
                            <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.2 rounded-full">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          Level {entry.level} • {entry.onTimeStreak} ride streak
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-indigo-950 text-sm">
                        {entry.monthlyXp.toLocaleString()} XP
                      </span>
                      <span className="text-[10px] text-slate-400 block">this month</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-500">Want to change how you appear?</span>
              <button
                onClick={() => {
                  setShowLeaderboardModal(false);
                  setShowPrivacyModal(true);
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                Privacy Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PERSONAL RECORDS & MONTHLY HISTORY */}
      {showHistoryModal && data && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Personal Records & Monthly History</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Personal Records Cards */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Personal Bests</span>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Longest Commute</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">
                    {data.personalRecords.longestSharedTripKm} km
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Best Streak</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">
                    {data.personalRecords.bestOnTimeStreak} trips
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Peak Monthly XP</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">
                    {data.personalRecords.highestMonthlyXp} XP
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Peak CO₂ Saved</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">
                    {data.personalRecords.mostCo2SavedInMonthKg} kg
                  </span>
                </div>
              </div>
            </div>

            {/* Monthly History Table */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Historical Months</span>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Month</th>
                      <th className="py-2.5 px-3">XP Earned</th>
                      <th className="py-2.5 px-3">Badges</th>
                      <th className="py-2.5 px-3">CO₂ Saved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {data.history.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{h.month}</td>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-700">+{h.xpEarned}</td>
                        <td className="py-2 px-3 text-slate-600">{h.achievementsUnlocked} unlocked</td>
                        <td className="py-2 px-3 text-emerald-700 font-medium">{h.co2SavedKg} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PRIVACY PREFERENCES */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Leaderboard Privacy Settings</h3>
              </div>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePrivacy} className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="flex items-center space-x-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyForm.showOnLeaderboard}
                    onChange={(e) =>
                      setPrivacyForm({ ...privacyForm, showOnLeaderboard: e.target.checked })
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Show me on monthly corridor leaderboard</span>
                </label>
                <p className="text-[11px] text-slate-500 ml-6">
                  If unchecked, your profile and score will remain completely hidden from other riders.
                </p>
              </div>

              {privacyForm.showOnLeaderboard && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-800 block">Display Name Option</span>
                  <div className="space-y-1.5">
                    {[
                      { id: 'ANONYMOUS', title: 'Anonymous (Recommended)', desc: 'Displays as "Commuter #104"' },
                      { id: 'INITIALS', title: 'Initials Only', desc: 'Displays as "R**** V"' },
                      { id: 'REAL_NAME', title: 'Full Real Name', desc: 'Displays your profile name publicly' },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className={`p-3 rounded-2xl border flex items-start space-x-2.5 cursor-pointer transition ${
                          privacyForm.privacyDisplayName === opt.id
                            ? 'bg-indigo-50/70 border-indigo-400 text-indigo-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="privacyOption"
                          value={opt.id}
                          checked={privacyForm.privacyDisplayName === opt.id}
                          onChange={(e) =>
                            setPrivacyForm({ ...privacyForm, privacyDisplayName: e.target.value as any })
                          }
                          className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="block">{opt.title}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{opt.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPrivacy}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition disabled:opacity-50"
                >
                  {savingPrivacy ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
