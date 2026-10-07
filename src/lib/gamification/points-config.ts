/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🎮 SMARTRIDE GAMIFICATION & ACHIEVEMENTS — POINTS CONFIGURATION
 * ══════════════════════════════════════════════════════════════════════════════
 * Centralized, auditable XP points rules and anti-gaming configurations.
 *
 * IMPORTANT ANTI-GAMING PRINCIPLES:
 * 1. Points are awarded ONLY for verifiable completed trips, OTP security, and punctuality.
 * 2. Zero points for creating, initiating, or cancelling bookings.
 * 3. Cancelled, failed, or simulated duplicate trips generate 0 XP.
 * 4. Failed OTP boarding attempts yield 0 XP.
 */

export const POINT_RULES = {
  // Positive commuting behavior
  COMPLETED_SHARED_TRIP: 25,       // Verifiable completed shared commute leg
  OTP_VERIFIED_BOARDING: 15,       // Successful boarding with 4-digit security OTP
  ON_TIME_BOARDING: 10,            // Commuter arrives within on-time boarding window
  MONTHLY_CONSISTENCY_BONUS: 100,  // Completing >= 15 commute days in a calendar month
  SUSTAINABILITY_CO2_TIER: 50,     // Per 10 kg CO2e saved milestone
  CONSECUTIVE_STREAK_BONUS: 50,    // Every 5 consecutive on-time boardings

  // Operational thresholds
  ON_TIME_WINDOW_MINUTES: 3,       // Grace window past scheduled pickup stop arrival
  MIN_STREAK_THRESHOLD: 3,         // Minimum consecutive on-time trips to activate streak badge
  XP_PER_LEVEL: 250,               // Exactly 250 XP required per progression level
  WORKING_DAYS_THRESHOLD: 15,      // Monthly consistency threshold in days
};

export type AchievementCategory =
  | 'SUSTAINABILITY'
  | 'CONSISTENCY'
  | 'RELIABILITY'
  | 'SAFETY'
  | 'MILESTONE';

export interface AchievementConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  metric:
    | 'COMPLETED_TRIPS'
    | 'ON_TIME_RATE'
    | 'CO2_SAVED_KG'
    | 'OTP_BOARDINGS'
    | 'CONSECUTIVE_STREAK'
    | 'COMMUTE_DAYS';
  threshold: number;
  minSampleSize: number; // Prevents single-trip 100% instant unlocks
  xpReward: number;
}

export const INITIAL_ACHIEVEMENTS: AchievementConfig[] = [
  // 🌱 Sustainability Category
  {
    id: 'ach-eco-explorer',
    name: 'Eco Explorer',
    description: 'Avoid an estimated 10 kg of CO₂e by choosing shared corporate shuttles.',
    icon: 'Leaf',
    category: 'SUSTAINABILITY',
    metric: 'CO2_SAVED_KG',
    threshold: 10.0,
    minSampleSize: 0,
    xpReward: 75,
  },
  {
    id: 'ach-eco-saver',
    name: 'Eco Saver',
    description: 'Avoid an estimated 30 kg of CO₂e through shared commuting.',
    icon: 'Globe',
    category: 'SUSTAINABILITY',
    metric: 'CO2_SAVED_KG',
    threshold: 30.0,
    minSampleSize: 0,
    xpReward: 150,
  },
  {
    id: 'ach-planet-champion',
    name: 'Planet Champion',
    description: 'Avoid an estimated 75 kg of CO₂e across metropolitan tech corridors.',
    icon: 'Sparkles',
    category: 'SUSTAINABILITY',
    metric: 'CO2_SAVED_KG',
    threshold: 75.0,
    minSampleSize: 0,
    xpReward: 300,
  },

  // 🚌 Consistency Category
  {
    id: 'ach-first-mile',
    name: 'First Mile',
    description: 'Complete your first verified SmartRide shared shuttle trip.',
    icon: 'Compass',
    category: 'CONSISTENCY',
    metric: 'COMPLETED_TRIPS',
    threshold: 1,
    minSampleSize: 0,
    xpReward: 25,
  },
  {
    id: 'ach-regular-rider',
    name: 'Regular Rider',
    description: 'Complete 10 verified shared commute trips.',
    icon: 'Bus',
    category: 'CONSISTENCY',
    metric: 'COMPLETED_TRIPS',
    threshold: 10,
    minSampleSize: 0,
    xpReward: 50,
  },
  {
    id: 'ach-green-commuter',
    name: 'Green Commuter',
    description: 'Complete 20 verified shared commute trips.',
    icon: 'Award',
    category: 'CONSISTENCY',
    metric: 'COMPLETED_TRIPS',
    threshold: 20,
    minSampleSize: 0,
    xpReward: 100,
  },
  {
    id: 'ach-consistent-commuter',
    name: 'Consistent Commuter',
    description: 'Commute via SmartRide on at least 15 distinct working days in a calendar month.',
    icon: 'Calendar',
    category: 'CONSISTENCY',
    metric: 'COMMUTE_DAYS',
    threshold: 15,
    minSampleSize: 0,
    xpReward: 100,
  },

  // ⏱ Reliability Category
  {
    id: 'ach-punctual-pioneer',
    name: 'Punctual Pioneer',
    description: 'Board on time for 5 verified corridor trips.',
    icon: 'Clock',
    category: 'RELIABILITY',
    metric: 'CONSECUTIVE_STREAK',
    threshold: 5,
    minSampleSize: 0,
    xpReward: 50,
  },
  {
    id: 'ach-route-champion',
    name: 'Route Champion',
    description: 'Maintain a 95%+ on-time boarding rate across at least 10 eligible corridor trips.',
    icon: 'Trophy',
    category: 'RELIABILITY',
    metric: 'ON_TIME_RATE',
    threshold: 95.0,
    minSampleSize: 10,
    xpReward: 150,
  },
  {
    id: 'ach-streak-master',
    name: 'Streak Master',
    description: 'Achieve an unbroken 10-trip on-time boarding streak.',
    icon: 'Flame',
    category: 'RELIABILITY',
    metric: 'CONSECUTIVE_STREAK',
    threshold: 10,
    minSampleSize: 0,
    xpReward: 100,
  },

  // 🔐 Safety Category
  {
    id: 'ach-security-conscious',
    name: 'Security Conscious',
    description: 'Verify boarding with your 4-digit ride OTP on 5 trips.',
    icon: 'Lock',
    category: 'SAFETY',
    metric: 'OTP_BOARDINGS',
    threshold: 5,
    minSampleSize: 0,
    xpReward: 50,
  },
  {
    id: 'ach-verified-rider',
    name: 'Verified Rider',
    description: 'Verify boarding with your 4-digit ride OTP on 10 trips.',
    icon: 'ShieldCheck',
    category: 'SAFETY',
    metric: 'OTP_BOARDINGS',
    threshold: 10,
    minSampleSize: 0,
    xpReward: 100,
  },
  {
    id: 'ach-zero-fail-star',
    name: 'Zero-Fail Star',
    description: 'Complete 25 verified OTP boardings without a single incorrect code attempt.',
    icon: 'CheckCircle2',
    category: 'SAFETY',
    metric: 'OTP_BOARDINGS',
    threshold: 25,
    minSampleSize: 25,
    xpReward: 200,
  },

  // 🏆 Milestones Category
  {
    id: 'ach-century-club',
    name: 'Century Club',
    description: 'Complete 100 lifetime verified shared shuttle trips with SmartRide.',
    icon: 'Crown',
    category: 'MILESTONE',
    metric: 'COMPLETED_TRIPS',
    threshold: 100,
    minSampleSize: 0,
    xpReward: 500,
  },
];
