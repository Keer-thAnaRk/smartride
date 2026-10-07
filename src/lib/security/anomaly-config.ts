/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🚨 SMARTRIDE (COMMUTESYNC) — ANOMALY DETECTION & SECURITY CONFIGURATION
 * ══════════════════════════════════════════════════════════════════════════════
 * Centralized configuration for all detection limits, velocity bounds,
 * duration thresholds, cooldown windows, and severity ratings.
 */

export const ANOMALY_CONFIG = {
  // ---------------------------------------------------------------------------
  // 1. Sudden Speed Increase / Velocity Anomaly
  // ---------------------------------------------------------------------------
  SPEED_EXPECTED_CORRIDOR_KMH: 45,        // Expected baseline flow speed
  SPEED_SPIKE_DELTA_KMH: 25,              // Sudden increase threshold (e.g. 38 -> 72 km/h is +34 km/h)
  SPEED_PERSISTENCE_MIN_READINGS: 2,      // Requires >= 2 consecutive readings (filters GPS tick noise)
  SPEED_WARNING_THRESHOLD_KMH: 55,        // Moderate speeding threshold
  SPEED_HIGH_THRESHOLD_KMH: 70,           // High speeding threshold
  SPEED_CRITICAL_THRESHOLD_KMH: 85,       // Critical speed limit cap

  // ---------------------------------------------------------------------------
  // 2. Unexpected Route Deviation Thresholds (in meters)
  // ---------------------------------------------------------------------------
  ROUTE_DEVIATION_NORMAL_METERS: 150,     // < 150m: NORMAL corridor buffer
  ROUTE_DEVIATION_TIER1_METERS: 300,      // 150m – 300m: MEDIUM
  ROUTE_DEVIATION_TIER2_METERS: 800,      // 300m – 800m: HIGH (> 800m: CRITICAL)

  // ---------------------------------------------------------------------------
  // 3. Unexpected Long Stop Thresholds
  // ---------------------------------------------------------------------------
  LONG_STOP_SPEED_CUTOFF_KMH: 3,          // <= 3 km/h is considered stationary
  LONG_STOP_DURATION_MEDIUM_SEC: 180,     // > 3 minutes stationary: MEDIUM
  LONG_STOP_DURATION_HIGH_SEC: 300,       // > 5 minutes stationary: HIGH
  LONG_STOP_DURATION_CRITICAL_SEC: 600,   // > 10 minutes stationary: CRITICAL
  DESIGNATED_STOP_EXEMPTION_METERS: 150,  // 150m geo-fence around scheduled pickup/drop stops

  // ---------------------------------------------------------------------------
  // 4. GPS Signal Loss / Telemetry Staleness (in seconds)
  // ---------------------------------------------------------------------------
  GPS_TIMEOUT_NORMAL_SEC: 15,             // < 15s: Normal telemetry stream
  GPS_TIMEOUT_MEDIUM_SEC: 60,             // 15s – 60s: MEDIUM (dead zone/underpass)
  GPS_TIMEOUT_HIGH_SEC: 120,              // 60s – 120s: HIGH (hardware fault/tampering)
  GPS_TIMEOUT_CRITICAL_SEC: 120,          // > 120s: CRITICAL (total loss)

  // ---------------------------------------------------------------------------
  // 5. Trip Lifecycle Guard
  // ---------------------------------------------------------------------------
  MINIMUM_VERIFIED_PASSENGERS_FOR_START: 1, // Driver cannot start dispatch with 0 verified OTPs

  // ---------------------------------------------------------------------------
  // 6. Passenger OTP Verification Failure Thresholds
  // ---------------------------------------------------------------------------
  OTP_FAILURES_WARNING: 1,                // 1 failure: INFO/WARNING
  OTP_FAILURES_MEDIUM: 2,                 // 2 failures: MEDIUM
  OTP_FAILURES_HIGH: 3,                   // 3+ failures: HIGH PRIORITY (Admin Review Recommended)

  // ---------------------------------------------------------------------------
  // Deduplication, Cooldown & Multi-Signal Correlation
  // ---------------------------------------------------------------------------
  EVENT_COOLDOWN_SECONDS: 120,            // 2-minute cooldown before creating a separate new event record
  MULTI_SIGNAL_WINDOW_SECONDS: 180,       // Co-occurring events within 3 mins trigger Multi-Signal Correlation
};
