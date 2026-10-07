/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE (COMMUTESYNC) — SAFETY ANOMALY DETECTION ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Provides real-time corridor compliance, velocity checks, GPS staleness,
 * stationary vehicle inspection (with designated-stop exemption), and
 * event deduplication.
 */

import { calculateHaversineDistance, SR101_CORRIDOR_WAYPOINTS, WaypointCoord } from '@/lib/ai/smart-eta';
import { EventSeverity, SafetyEvent, SafetyEventType } from './types';

export const SAFETY_CONFIG = {
  // Corridor Deviation Thresholds (meters)
  CORRIDOR_DEVIATION_TOLERANCE_METERS: 100, // < 100m is normal corridor tolerance
  CORRIDOR_DEVIATION_MINOR_METERS: 300,     // 100m – 300m: Minor deviation
  CORRIDOR_DEVIATION_WARNING_METERS: 500,   // 300m – 500m: Warning deviation
  // > 500m is Critical/Major deviation

  // Speed Compliance Thresholds (km/h)
  CORRIDOR_EXPECTED_SPEED_KMH: 45,          // Baseline corridor design velocity
  CORRIDOR_SPEEDING_THRESHOLD_KMH: 55,      // Moderate threshold (+10 km/h)
  CORRIDOR_HIGH_SPEEDING_KMH: 70,           // High threshold (+25 km/h)
  CORRIDOR_MAX_OPERATIONAL_SPEED_KMH: 85,   // Severe speed cap

  // Telemetry & Long Stop Thresholds
  GPS_SIGNAL_TIMEOUT_SECONDS: 120,          // 2 minutes without fresh GPS ping
  LONG_STOP_THRESHOLD_SECONDS: 300,         // 5 minutes stationary
  LONG_STOP_SPEED_CUTOFF_KMH: 3,            // <= 3 km/h is stationary
  DESIGNATED_STOP_PROXIMITY_METERS: 150,    // 150m buffer around designated pickup/drop stops

  // Cooldown & Deduplication
  EVENT_ALERT_COOLDOWN_SECONDS: 60,         // Avoid flooding duplicate alerts within 60s
};

/**
 * Calculates perpendicular / minimum distance from a point to a line segment [A, B] in meters.
 */
function distanceToSegmentMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  // Flat-earth approximation in meters for small local segments (~2-5km)
  const degToMeters = 111320;
  const cosLat = Math.cos((pLat * Math.PI) / 180);

  const px = (pLng - aLng) * degToMeters * cosLat;
  const py = (pLat - aLat) * degToMeters;
  const bx = (bLng - aLng) * degToMeters * cosLat;
  const by = (bLat - aLat) * degToMeters;

  const segmentLengthSq = bx * bx + by * by;
  if (segmentLengthSq === 0) {
    return Math.sqrt(px * px + py * py);
  }

  // Projection scalar t of P onto AB
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / segmentLengthSq));
  const projX = t * bx;
  const projY = t * by;

  const dx = px - projX;
  const dy = py - projY;
  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

/**
 * Calculates distance in meters from current GPS coordinate to the closest corridor segment.
 */
export function calculateDistanceToCorridorMeters(
  currentLat: number,
  currentLng: number,
  waypoints: WaypointCoord[] = SR101_CORRIDOR_WAYPOINTS
): number {
  if (!waypoints || waypoints.length === 0) return 0;
  if (waypoints.length === 1) {
    return Math.round(calculateHaversineDistance(currentLat, currentLng, waypoints[0].lat, waypoints[0].lng) * 1000);
  }

  let minDistanceMeters = Infinity;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const d = distanceToSegmentMeters(
      currentLat,
      currentLng,
      waypoints[i].lat,
      waypoints[i].lng,
      waypoints[i + 1].lat,
      waypoints[i + 1].lng
    );
    if (d < minDistanceMeters) {
      minDistanceMeters = d;
    }
  }

  return minDistanceMeters;
}

/**
 * Detects Route Deviation anomalies based on corridor distance.
 */
export function detectRouteDeviation(
  currentLat: number,
  currentLng: number,
  waypoints: WaypointCoord[] = SR101_CORRIDOR_WAYPOINTS
): {
  distanceMeters: number;
  isDeviated: boolean;
  severity: EventSeverity;
  deduction: number;
  description: string;
} {
  const distanceMeters = calculateDistanceToCorridorMeters(currentLat, currentLng, waypoints);

  if (distanceMeters <= SAFETY_CONFIG.CORRIDOR_DEVIATION_TOLERANCE_METERS) {
    return {
      distanceMeters,
      isDeviated: false,
      severity: 'INFO',
      deduction: 0,
      description: `Vehicle operating within corridor (${distanceMeters}m from centerline).`,
    };
  }

  if (distanceMeters <= SAFETY_CONFIG.CORRIDOR_DEVIATION_MINOR_METERS) {
    return {
      distanceMeters,
      isDeviated: true,
      severity: 'LOW',
      deduction: 5,
      description: `Minor corridor deviation: ${distanceMeters}m from assigned route corridor.`,
    };
  }

  if (distanceMeters <= SAFETY_CONFIG.CORRIDOR_DEVIATION_WARNING_METERS) {
    return {
      distanceMeters,
      isDeviated: true,
      severity: 'MEDIUM',
      deduction: 10,
      description: `Warning corridor deviation: ${distanceMeters}m from assigned route corridor.`,
    };
  }

  return {
    distanceMeters,
    isDeviated: true,
    severity: 'HIGH',
    deduction: 20,
    description: `Major route deviation: ${distanceMeters}m off assigned corridor path.`,
  };
}

/**
 * Detects Speeding Anomalies based on corridor velocity.
 */
export function detectSpeedAnomaly(currentSpeedKmH: number = 0): {
  speedKmH: number;
  excessKmH: number;
  isSpeeding: boolean;
  severity: EventSeverity;
  deduction: number;
  description: string;
} {
  const speed = Math.max(0, Math.round(currentSpeedKmH));

  if (speed <= SAFETY_CONFIG.CORRIDOR_SPEEDING_THRESHOLD_KMH) {
    return {
      speedKmH: speed,
      excessKmH: 0,
      isSpeeding: false,
      severity: 'INFO',
      deduction: 0,
      description: `Velocity ${speed} km/h is within safe corridor limits (max ${SAFETY_CONFIG.CORRIDOR_SPEEDING_THRESHOLD_KMH} km/h).`,
    };
  }

  const excess = speed - SAFETY_CONFIG.CORRIDOR_EXPECTED_SPEED_KMH;

  if (speed <= SAFETY_CONFIG.CORRIDOR_HIGH_SPEEDING_KMH) {
    return {
      speedKmH: speed,
      excessKmH: excess,
      isSpeeding: true,
      severity: 'LOW',
      deduction: 5,
      description: `Moderate speeding: ${speed} km/h (+${excess} km/h over expected corridor velocity).`,
    };
  }

  if (speed <= SAFETY_CONFIG.CORRIDOR_MAX_OPERATIONAL_SPEED_KMH) {
    return {
      speedKmH: speed,
      excessKmH: excess,
      isSpeeding: true,
      severity: 'MEDIUM',
      deduction: 10,
      description: `High speed anomaly: ${speed} km/h (+${excess} km/h over expected corridor velocity).`,
    };
  }

  return {
    speedKmH: speed,
    excessKmH: excess,
    isSpeeding: true,
    severity: 'CRITICAL',
    deduction: 15,
    description: `Severe speed violation: ${speed} km/h exceeds maximum operational safety limit of ${SAFETY_CONFIG.CORRIDOR_MAX_OPERATIONAL_SPEED_KMH} km/h.`,
  };
}

/**
 * Detects GPS signal loss / telemetry staleness.
 */
export function detectGpsSignalLoss(
  lastUpdatedAtStr?: string,
  referenceDate: Date = new Date()
): {
  isSignalLost: boolean;
  elapsedSeconds: number;
  severity: EventSeverity;
  deduction: number;
  description: string;
} {
  if (!lastUpdatedAtStr) {
    return {
      isSignalLost: false,
      elapsedSeconds: 0,
      severity: 'INFO',
      deduction: 0,
      description: 'Telemetry stream active.',
    };
  }

  const lastUpdate = new Date(lastUpdatedAtStr).getTime();
  const now = referenceDate.getTime();
  const elapsedSeconds = Math.max(0, Math.floor((now - lastUpdate) / 1000));

  if (elapsedSeconds > SAFETY_CONFIG.GPS_SIGNAL_TIMEOUT_SECONDS) {
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    return {
      isSignalLost: true,
      elapsedSeconds,
      severity: 'HIGH',
      deduction: 8,
      description: `GPS telemetry stream interrupted. No ping for ${elapsedMinutes}m ${elapsedSeconds % 60}s.`,
    };
  }

  return {
    isSignalLost: false,
    elapsedSeconds,
    severity: 'INFO',
    deduction: 0,
    description: `Telemetry ping received ${elapsedSeconds}s ago.`,
  };
}

/**
 * Detects Unexpected Long Stops outside designated passenger boarding stops.
 */
export function detectUnexpectedLongStop(
  currentLat: number,
  currentLng: number,
  currentSpeedKmH: number,
  stoppedDurationSeconds: number,
  designatedStops: WaypointCoord[] = SR101_CORRIDOR_WAYPOINTS
): {
  isLongStop: boolean;
  nearDesignatedStop: boolean;
  nearestStopName?: string;
  nearestStopDistanceMeters?: number;
  severity: EventSeverity;
  deduction: number;
  description: string;
} {
  const isStationary = currentSpeedKmH <= SAFETY_CONFIG.LONG_STOP_SPEED_CUTOFF_KMH;
  if (!isStationary || stoppedDurationSeconds < SAFETY_CONFIG.LONG_STOP_THRESHOLD_SECONDS) {
    return {
      isLongStop: false,
      nearDesignatedStop: false,
      severity: 'INFO',
      deduction: 0,
      description: 'Vehicle in normal transit movement.',
    };
  }

  // Check proximity to all designated stops
  let closestDistMeters = Infinity;
  let closestStopName = '';

  for (const stop of designatedStops) {
    const distMeters = Math.round(
      calculateHaversineDistance(currentLat, currentLng, stop.lat, stop.lng) * 1000
    );
    if (distMeters < closestDistMeters) {
      closestDistMeters = distMeters;
      closestStopName = stop.name;
    }
  }

  // If vehicle is stopped near a designated pickup/drop stop, it is NOT an anomaly!
  if (closestDistMeters <= SAFETY_CONFIG.DESIGNATED_STOP_PROXIMITY_METERS) {
    return {
      isLongStop: false,
      nearDesignatedStop: true,
      nearestStopName: closestStopName,
      nearestStopDistanceMeters: closestDistMeters,
      severity: 'INFO',
      deduction: 0,
      description: `Expected stationary stop: Shuttle is actively boarding/alighting at designated stop "${closestStopName}" (${closestDistMeters}m away).`,
    };
  }

  const durationMin = Math.floor(stoppedDurationSeconds / 60);
  return {
    isLongStop: true,
    nearDesignatedStop: false,
    nearestStopName: closestStopName,
    nearestStopDistanceMeters: closestDistMeters,
    severity: 'MEDIUM',
    deduction: 6,
    description: `Unexpected long stationary stop: Vehicle stationary for ${durationMin}m outside designated stops (${closestDistMeters}m from nearest stop "${closestStopName}").`,
  };
}

/**
 * Evaluates OTP Boarding Risk.
 */
export function assessOtpBoardingRisk(
  passengers: Array<{ boarded: boolean; failedAttempts?: number; name?: string }> = []
): {
  totalPassengers: number;
  boardedCount: number;
  unboardedCount: number;
  failedAttemptsTotal: number;
  deduction: number;
  isCompliant: boolean;
  description: string;
} {
  const total = passengers.length;
  if (total === 0) {
    return {
      totalPassengers: 0,
      boardedCount: 0,
      unboardedCount: 0,
      failedAttemptsTotal: 0,
      deduction: 0,
      isCompliant: true,
      description: 'No scheduled passenger manifest.',
    };
  }

  const boardedCount = passengers.filter((p) => p.boarded).length;
  const unboardedCount = total - boardedCount;
  const failedAttemptsTotal = passengers.reduce((sum, p) => sum + (p.failedAttempts || 0), 0);

  // Proportional deduction for unboarded passengers (up to 15 pts max)
  const proportionalDeduction = Math.round((unboardedCount / total) * 15);
  // Penalty for failed OTP attempts: 3 pts per failed attempt
  const failedAttemptsDeduction = Math.min(15, failedAttemptsTotal * 3);

  const totalDeduction = Math.min(15, proportionalDeduction + failedAttemptsDeduction);
  const isCompliant = totalDeduction === 0;

  let description = `All ${total}/${total} expected passengers verified via OTP.`;
  if (failedAttemptsTotal > 0) {
    description = `OTP verification alert: ${failedAttemptsTotal} failed OTP verification attempt(s) recorded.`;
  } else if (unboardedCount > 0) {
    description = `${boardedCount}/${total} passengers verified with OTP (${unboardedCount} pending boarding).`;
  }

  return {
    totalPassengers: total,
    boardedCount,
    unboardedCount,
    failedAttemptsTotal,
    deduction: totalDeduction,
    isCompliant,
    description,
  };
}

/**
 * Deduplicates safety events to avoid spamming identical alerts within the cooldown window.
 */
export function shouldEmitSafetyEvent(
  existingEvents: SafetyEvent[],
  newEventType: SafetyEventType,
  now: Date = new Date()
): boolean {
  const activeMatching = existingEvents.find(
    (e) => e.type === newEventType && e.status === 'ACTIVE'
  );

  if (!activeMatching) return true;

  const lastDetected = new Date(activeMatching.detectedAt).getTime();
  const elapsedSeconds = (now.getTime() - lastDetected) / 1000;

  return elapsedSeconds > SAFETY_CONFIG.EVENT_ALERT_COOLDOWN_SECONDS;
}
