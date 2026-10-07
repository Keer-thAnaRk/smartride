/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔄 DRIVER NO-SHOW & AUTOMATED CONTINGENCY ENGINE — CENTRAL CONFIGURATION
 * ══════════════════════════════════════════════════════════════════════════════
 * Centralizes operational thresholds, grace periods, suitability scoring weights,
 * and standby driver matching parameters.
 */

export const DRIVER_MONITOR_CONFIG = {
  // Check-In Timeline Policies
  CHECK_IN_DEADLINE_MINUTES_PRIOR: 15, // Required check-in: 15 mins before scheduled departure
  GRACE_PERIOD_MINUTES: 5,            // 0 - 5 min after deadline: LATE advisory warning
  NO_SHOW_RISK_MINUTES: 10,           // 5 - 10 min after deadline: NO_SHOW_RISK alert & standby prep
  NO_SHOW_CONFIRMATION_MINUTES: 10,   // > 10 min after deadline: NO_SHOW_CONFIRMED (replacement mandatory)

  // Candidate Scoring Weights (sum = 1.0)
  WEIGHTS: {
    availability: 0.30,         // Unassigned standby driver ready to roll
    routeCompatibility: 0.25,   // Experience on same or adjacent corridor
    proximity: 0.20,            // Haversine distance to pickup origin
    shiftCompatibility: 0.15,   // Shift matching and driver rating
    vehicleCompatibility: 0.10, // Approved vehicle capacity meets active passenger load
  },

  // Operational Constraints
  MAX_ACCEPTABLE_DISTANCE_KM: 15.0,  // Standby drivers farther than 15km are excluded
  SIMILAR_SCORE_THRESHOLD: 3.0,      // Score diff <= 3.0 indicates close suitability requiring Admin discretion
  DEFAULT_SUBSTITUTION_DELAY_MINS: 7,// Dispatch delay added to Smart ETA upon standby driver assignment

  // Fallback / Demo Settings
  DEFAULT_DEMO_TRIP_ID: 'trip-sr101-today',
  DEFAULT_DEMO_ROUTE_CODE: 'SR-101',
  DEFAULT_DEPOT_LAT: 12.9141,        // Central Silk Board transit hub
  DEFAULT_DEPOT_LNG: 77.6200,
};

export type DriverMonitorWeights = typeof DRIVER_MONITOR_CONFIG.WEIGHTS;
