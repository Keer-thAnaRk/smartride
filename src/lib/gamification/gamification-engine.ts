/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🎮 SMARTRIDE GAMIFICATION & ACHIEVEMENTS — CALCULATION ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Deterministic mathematical calculation engine for:
 * 1. Levels derived from XP
 * 2. On-time boarding evaluation with smart delay forgiveness
 * 3. Achievement progress & sample-size gated unlocking
 * 4. Idempotent XP event recording
 * 5. Privacy-safe leaderboard formatting
 */

import { POINT_RULES, AchievementConfig, INITIAL_ACHIEVEMENTS } from './points-config';

/**
 * Deterministically computes the user's level and progress from their total XP.
 */
export function calculateLevel(totalXp: number): {
  level: number;
  currentLevelBaseXp: number;
  nextLevelXp: number;
  progressPercent: number;
} {
  const safeXp = Math.max(0, totalXp);
  const level = Math.floor(safeXp / POINT_RULES.XP_PER_LEVEL) + 1;
  const currentLevelBaseXp = (level - 1) * POINT_RULES.XP_PER_LEVEL;
  const nextLevelXp = level * POINT_RULES.XP_PER_LEVEL;
  const progressPercent = Math.min(
    100,
    Math.max(
      0,
      Math.round(((safeXp - currentLevelBaseXp) / POINT_RULES.XP_PER_LEVEL) * 100)
    )
  );

  return {
    level,
    currentLevelBaseXp,
    nextLevelXp,
    progressPercent,
  };
}

/**
 * Evaluates whether a boarding was on-time with Smart Delay Forgiveness.
 * If shuttle is delayed by driver/traffic, the commuter is NEVER penalized.
 */
export function isOnTimeBoarding(
  markedAt: Date | string,
  scheduledTimeStr: string, // e.g. "08:20 AM"
  shuttleDelayMinutes: number = 0
): boolean {
  if (!markedAt || !scheduledTimeStr) return true;

  try {
    const boardDate = new Date(markedAt);
    const boardMinutes = boardDate.getHours() * 60 + boardDate.getMinutes();

    // Parse scheduled pickup (e.g. "08:20 AM")
    const match = scheduledTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return true;

    let schedHour = parseInt(match[1], 10);
    const schedMin = parseInt(match[2], 10);
    const meridiem = match[3].toUpperCase();

    if (meridiem === 'PM' && schedHour < 12) schedHour += 12;
    if (meridiem === 'AM' && schedHour === 12) schedHour = 0;

    const scheduledMinutes = schedHour * 60 + schedMin;

    // Smart Delay Forgiveness: Add driver/corridor traffic delay to allowed cutoff
    const allowedDelayMinutes = Math.max(0, shuttleDelayMinutes);
    const maxAllowedArrivalMinutes =
      scheduledMinutes + allowedDelayMinutes + POINT_RULES.ON_TIME_WINDOW_MINUTES;

    return boardMinutes <= maxAllowedArrivalMinutes;
  } catch (err) {
    return true;
  }
}

/**
 * Evaluates progress and unlock status for an achievement against actual user metrics.
 * Strictly enforces minimum sample size to avoid 1-trip instant unlocks.
 */
export function evaluateAchievement(
  ach: AchievementConfig,
  metrics: {
    completedTrips: number;
    onTimeRatePercent: number;
    co2SavedKg: number;
    otpBoardings: number;
    consecutiveStreak: number;
    commuteDays: number;
    eligibleTripsSample: number;
  }
): {
  currentProgress: number;
  progressPercent: number;
  isUnlocked: boolean;
} {
  let currentVal = 0;

  switch (ach.metric) {
    case 'COMPLETED_TRIPS':
      currentVal = metrics.completedTrips;
      break;
    case 'ON_TIME_RATE':
      currentVal = metrics.onTimeRatePercent;
      break;
    case 'CO2_SAVED_KG':
      currentVal = metrics.co2SavedKg;
      break;
    case 'OTP_BOARDINGS':
      currentVal = metrics.otpBoardings;
      break;
    case 'CONSECUTIVE_STREAK':
      currentVal = metrics.consecutiveStreak;
      break;
    case 'COMMUTE_DAYS':
      currentVal = metrics.commuteDays;
      break;
  }

  // Anti-Gaming Sample Size Enforcement
  const meetsSampleSize =
    ach.minSampleSize <= 0 || metrics.eligibleTripsSample >= ach.minSampleSize;

  const isUnlocked = meetsSampleSize && currentVal >= ach.threshold;
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((currentVal / ach.threshold) * 100))
  );

  return {
    currentProgress: Number(currentVal.toFixed(1)),
    progressPercent,
    isUnlocked,
  };
}

/**
 * Sanitizes commuter display name according to their chosen privacy preference.
 */
export function formatPrivacyDisplayName(
  realName: string = 'Commuter',
  option: 'REAL_NAME' | 'INITIALS' | 'ANONYMOUS' = 'ANONYMOUS',
  index: number = 1
): string {
  if (option === 'REAL_NAME') {
    return realName.trim() || `Commuter #${100 + index}`;
  }

  if (option === 'INITIALS') {
    const parts = realName.trim().split(/\s+/);
    if (parts.length >= 2) {
      const firstInitial = parts[0][0]?.toUpperCase() || 'C';
      const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || 'R';
      return `${firstInitial}**** ${lastInitial}`;
    }
    const initial = realName[0]?.toUpperCase() || 'C';
    return `${initial}****`;
  }

  // Default to ANONYMOUS
  return `Commuter #${100 + index}`;
}
