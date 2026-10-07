/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 👨‍👩‍👧 SMARTRIDE (COMMUTESYNC) — SAFE ARRIVAL & FAMILY TRACKING CONFIG
 * ══════════════════════════════════════════════════════════════════════════════
 * Centralized operational parameters, geofence radii, speed cutoffs,
 * delay brackets, and token security settings for family tracking.
 */

export const FAMILY_TRACKING_CONFIG = {
  // 1. Safe Arrival Geofence Detection
  DESTINATION_GEOFENCE_RADIUS_METERS: 100, // Distance threshold to confirm arrival
  ARRIVAL_SPEED_MAX_KMH: 3.0,              // Vehicle must be stopped or crawling (<= 3 km/h)
  ARRIVAL_CONFIRMATION_PING_COUNT: 1,      // Consecutive pings needed to confirm arrival

  // 2. Delay Classification Thresholds (Minutes)
  DELAY_THRESHOLDS: {
    ON_TIME_MAX: 5,            // 0 - 5 min delay: ON_TIME (🟢)
    MINOR_DELAY_MAX: 10,       // 5 - 10 min delay: MINOR_DELAY (🟡)
    SIGNIFICANT_DELAY_MAX: 20, // 10 - 20 min delay: SIGNIFICANT_DELAY (🟠)
    // > 20 min delay: MAJOR_DELAY (🔴)
  },

  // 3. Security & Token Expiration
  TOKEN_PREFIX: 'st_',
  TOKEN_BYTE_LENGTH: 16,                   // 32-character hexadecimal token
  EXPIRATION_POST_ARRIVAL_MINUTES: 60,     // Link expires 60 min after arrival
  EXPIRATION_DEFAULT_ACTIVE_HOURS: 6,      // Fallback expiration for in-flight trips

  // 4. Default Demo Constants
  DEFAULT_DEMO_SHARE_TOKEN: 'smart-live-sr101-7x9q',
  DEFAULT_TRIP_ID: 'trip-sr101-today',
  DEFAULT_COMMUTER_NAME: 'Rahul Verma',
  DEFAULT_DESTINATION_STOP: 'Bellandur EcoSpace Flyover',
  DEFAULT_DESTINATION_LAT: 12.9360,
  DEFAULT_DESTINATION_LNG: 77.6920,
  DEFAULT_SCHEDULED_ARRIVAL: '08:25 AM',
} as const;

export type DelayCategory =
  | 'ON_TIME'
  | 'MINOR_DELAY'
  | 'SIGNIFICANT_DELAY'
  | 'MAJOR_DELAY'
  | 'ARRIVED';

export type TrackingSessionStatus = 'ACTIVE' | 'ARRIVED' | 'EXPIRED';
