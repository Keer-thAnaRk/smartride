/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🎮 SMARTRIDE GAMIFICATION & ACHIEVEMENTS — TYPES
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { AchievementCategory } from './points-config';

export interface AchievementItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  metric: string;
  threshold: number;
  minSampleSize: number;
  xpReward: number;
  currentProgress: number;
  progressPercent: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
  notified: boolean;
}

export interface PersonalRecords {
  longestSharedTripKm: number;
  bestOnTimeStreak: number;
  highestMonthlyXp: number;
  mostCo2SavedInMonthKg: number;
}

export interface MonthlyGamificationHistory {
  month: string;           // e.g. "Sep 2026"
  xpEarned: number;
  achievementsUnlocked: number;
  tripsCompleted: number;
  co2SavedKg: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
  monthlyXp: number;
  totalXp: number;
  level: number;
  achievementsCount: number;
  onTimeStreak: number;
}

export interface CommuterGamificationSummary {
  userId: string;
  totalXp: number;
  currentLevel: number;
  currentLevelBaseXp: number;
  nextLevelXp: number;
  levelProgressPercent: number;
  currentStreak: number;
  bestStreak: number;
  monthlyXp: number;
  unlockedCount: number;
  totalAchievementsCount: number;
  onTimeRatePercent: number;
  totalCompletedTrips: number;
  co2SavedKg: number;
  personalRecords: PersonalRecords;
  history: MonthlyGamificationHistory[];
  achievements: AchievementItem[];
  showOnLeaderboard: boolean;
  privacyDisplayName: 'REAL_NAME' | 'INITIALS' | 'ANONYMOUS';
}

export interface AdminGamificationSummary {
  activeGamifiedUsersCount: number;
  totalAchievementsUnlocked: number;
  fleetMonthlyXpAwarded: number;
  fleetLifetimeXpAwarded: number;
  avgXpPerCommuter: number;
  achievementCompletionRatePercent: number;
  popularAchievements: {
    achievementId: string;
    name: string;
    category: string;
    unlocksCount: number;
    xpReward: number;
  }[];
  recentXpEvents: {
    id: string;
    commuterName: string;
    eventType: string;
    points: number;
    description: string;
    createdAt: string;
  }[];
}
