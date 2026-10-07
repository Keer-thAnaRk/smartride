/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🚨 SMARTRIDE (COMMUTESYNC) — RULE-BASED ANOMALY DETECTION ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Transparent, deterministic rule-based monitoring for active trip telemetry:
 * 1. Sudden Speed Increase (with multi-reading persistence)
 * 2. Unexpected Route Corridor Deviation (vector projection)
 * 3. Unexpected Long Stop (with 150m designated-stop exemption)
 * 4. GPS Signal Loss / Telemetry Interruption
 * 5. Unexpected Trip Start (dispatch attempted before OTP verification)
 * 6. Multiple Failed OTP Attempts (zero OTP leakage)
 * 7. Multi-Signal Anomaly Correlation (combines concurrent signals)
 * 8. Event Deduplication and Duration Accumulation
 */

import { calculateDistanceToCorridorMeters } from '@/lib/safety/anomaly-detection';
import { calculateSmartEta, SR101_CORRIDOR_WAYPOINTS, WaypointCoord, calculateHaversineDistance } from '@/lib/ai/smart-eta';
import { calculateTripSafetyScore } from '@/lib/safety/scoring-engine';
import { ANOMALY_CONFIG } from './anomaly-config';
import {
  AnomalyEvent,
  AnomalyMetadata,
  AnomalySeverity,
  AnomalyType,
  SanitizedOperationalStatus,
} from './anomaly-types';

export interface TelemetryReadingInput {
  tripId: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  driverName?: string;
  routeName?: string;
  currentLocation: {
    lat: number;
    lng: number;
    speedKmH?: number;
    heading?: number;
    updatedAt?: string;
  };
  previousTelemetry?: {
    speedKmH?: number;
    consecutiveSpikeCount?: number;
    updatedAt?: string;
  };
  passengers?: Array<{
    name?: string;
    boarded: boolean;
    failedAttempts?: number;
  }>;
  stoppedDurationSeconds?: number;
  attemptedTripStartBeforeOtp?: boolean;
  existingAnomalies?: AnomalyEvent[];
  waypoints?: WaypointCoord[];
  referenceDate?: Date;
}

export interface AnomalyEvaluationResult {
  anomalies: AnomalyEvent[];
  activeAnomalies: AnomalyEvent[];
  multiSignalAnomaly?: AnomalyEvent | null;
  highestSeverity: AnomalySeverity;
  safetyScoreImpact: {
    previousScore: number;
    currentScore: number;
    delta: number;
    history: number[];
  };
  etaImpact: {
    normalEta: string;
    trafficAdjustedEta: string;
    delayMinutes: number;
    statusIndicator: string;
  };
  sanitizedStatus: SanitizedOperationalStatus;
  evaluatedAt: string;
}

/**
 * Core Anomaly Detection Evaluator
 */
export function evaluateTripAnomalies(input: TelemetryReadingInput): AnomalyEvaluationResult {
  const refDate = input.referenceDate || new Date();
  const waypoints = input.waypoints || SR101_CORRIDOR_WAYPOINTS;
  const loc = input.currentLocation;
  const currentSpeed = Math.max(0, Math.round(loc.speedKmH || 0));
  const previousSpeed = Math.max(0, Math.round(input.previousTelemetry?.speedKmH || 0));

  const existingAnomalies = input.existingAnomalies || [];
  const detectedOrUpdatedEvents: AnomalyEvent[] = [];

  // Helper to find existing active anomaly of a specific type
  const findActive = (type: AnomalyType): AnomalyEvent | undefined =>
    existingAnomalies.find((e) => e.type === type && e.status === 'ACTIVE');

  // ==========================================================================
  // 1. Sudden Speed Increase (with Persistence Verification)
  // ==========================================================================
  const speedDelta = currentSpeed - previousSpeed;
  const isSpike = speedDelta >= ANOMALY_CONFIG.SPEED_SPIKE_DELTA_KMH && currentSpeed > ANOMALY_CONFIG.SPEED_WARNING_THRESHOLD_KMH;
  const consecutiveSpikes = (input.previousTelemetry?.consecutiveSpikeCount || 0) + (isSpike ? 1 : 0);

  // Persistence rule: Must persist for >= 2 consecutive readings to avoid noisy GPS ticks
  if (isSpike && consecutiveSpikes >= ANOMALY_CONFIG.SPEED_PERSISTENCE_MIN_READINGS) {
    let severity: AnomalySeverity = 'MEDIUM';
    if (currentSpeed >= ANOMALY_CONFIG.SPEED_CRITICAL_THRESHOLD_KMH) severity = 'CRITICAL';
    else if (currentSpeed >= ANOMALY_CONFIG.SPEED_HIGH_THRESHOLD_KMH) severity = 'HIGH';

    const existingSpeed = findActive('SPEED_ANOMALY');
    if (existingSpeed) {
      // Deduplication: Update duration and latest values on existing active anomaly
      const prevDur = existingSpeed.metadata.durationSeconds || 0;
      existingSpeed.metadata.durationSeconds = prevDur + 4;
      existingSpeed.metadata.currentSpeedKmH = currentSpeed;
      existingSpeed.metadata.increaseKmH = speedDelta;
      existingSpeed.lastDetectedAt = refDate.toISOString();
      detectedOrUpdatedEvents.push(existingSpeed);
    } else {
      detectedOrUpdatedEvents.push({
        id: `anom-spd-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tripId: input.tripId,
        vehiclePlate: input.vehiclePlate || 'KA-01-MJ-8822',
        driverName: input.driverName || 'Rajesh Sharma',
        routeName: input.routeName || 'Whitefield Tech Express',
        type: 'SPEED_ANOMALY',
        severity,
        status: 'ACTIVE',
        title: severity === 'CRITICAL' ? 'Critical Velocity Violation' : 'Sudden Speed Anomaly',
        description: `Sudden velocity surge from ${previousSpeed} km/h to ${currentSpeed} km/h (+${speedDelta} km/h increase).`,
        metadata: {
          previousSpeedKmH: previousSpeed,
          currentSpeedKmH: currentSpeed,
          increaseKmH: speedDelta,
          durationSeconds: 4,
          safetyScoreImpact: severity === 'CRITICAL' ? -15 : -10,
        },
        detectedAt: refDate.toISOString(),
      });
    }
  }

  // ==========================================================================
  // ==========================================================================
  // 2. Unexpected Route Deviation (Vector Projection)
  // ==========================================================================
  const deviationDistance = calculateDistanceToCorridorMeters(loc.lat, loc.lng, waypoints);

  if (deviationDistance > ANOMALY_CONFIG.ROUTE_DEVIATION_NORMAL_METERS) {
    let severity: AnomalySeverity = 'MEDIUM';
    let scorePenalty = -10;

    if (deviationDistance > ANOMALY_CONFIG.ROUTE_DEVIATION_TIER2_METERS) {
      severity = 'CRITICAL';
      scorePenalty = -25;
    } else if (deviationDistance > ANOMALY_CONFIG.ROUTE_DEVIATION_TIER1_METERS) {
      severity = 'HIGH';
      scorePenalty = -18;
    }

    const existingDev = findActive('ROUTE_DEVIATION');
    if (existingDev) {
      // Deduplicate and accumulate duration & max deviation
      const prevDur = existingDev.metadata.durationSeconds || 0;
      const prevMax = existingDev.metadata.maxDeviationMeters || deviationDistance;
      existingDev.metadata.durationSeconds = prevDur + 4;
      existingDev.metadata.latestDeviationMeters = deviationDistance;
      existingDev.metadata.maxDeviationMeters = Math.max(prevMax, deviationDistance);
      existingDev.severity = severity;
      existingDev.lastDetectedAt = refDate.toISOString();
      detectedOrUpdatedEvents.push(existingDev);
    } else {
      detectedOrUpdatedEvents.push({
        id: `anom-rt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tripId: input.tripId,
        vehiclePlate: input.vehiclePlate || 'KA-01-MJ-8822',
        driverName: input.driverName || 'Rajesh Sharma',
        routeName: input.routeName || 'Whitefield Tech Express',
        type: 'ROUTE_DEVIATION',
        severity,
        status: 'ACTIVE',
        title: severity === 'CRITICAL' ? 'Critical Route Corridor Deviation' : severity === 'HIGH' ? 'Major Route Deviation' : 'Route Corridor Deviation',
        description: `Vehicle is ${deviationDistance}m outside assigned route corridor.`,
        metadata: {
          latestDeviationMeters: deviationDistance,
          maxDeviationMeters: deviationDistance,
          durationSeconds: 4,
          safetyScoreImpact: scorePenalty,
        },
        detectedAt: refDate.toISOString(),
      });
    }
  }

  // ==========================================================================
  // 3. Unexpected Long Stop (with 150m Designated-Stop Exemption)
  // ==========================================================================
  const stoppedDuration = input.stoppedDurationSeconds || 0;
  const isStationary = currentSpeed <= ANOMALY_CONFIG.LONG_STOP_SPEED_CUTOFF_KMH;

  if (isStationary && stoppedDuration >= ANOMALY_CONFIG.LONG_STOP_DURATION_MEDIUM_SEC) {
    // Check proximity to all designated pickup/drop stops
    let nearestStopDist = Infinity;
    let nearestStopName = '';

    for (const stop of waypoints) {
      const dMeters = Math.round(calculateHaversineDistance(loc.lat, loc.lng, stop.lat, stop.lng) * 1000);
      if (dMeters < nearestStopDist) {
        nearestStopDist = dMeters;
        nearestStopName = stop.name;
      }
    }

    // If within 150m of a designated stop -> EXEMPT (No false alarm during boarding!)
    if (nearestStopDist > ANOMALY_CONFIG.DESIGNATED_STOP_EXEMPTION_METERS) {
      let severity: AnomalySeverity = 'MEDIUM';
      let scorePenalty = -8;
      if (stoppedDuration >= ANOMALY_CONFIG.LONG_STOP_DURATION_CRITICAL_SEC) {
        severity = 'CRITICAL';
        scorePenalty = -20;
      } else if (stoppedDuration >= ANOMALY_CONFIG.LONG_STOP_DURATION_HIGH_SEC) {
        severity = 'HIGH';
        scorePenalty = -14;
      }

      const existingStop = findActive('LONG_STOP');
      if (existingStop) {
        existingStop.metadata.stoppedDurationSeconds = stoppedDuration;
        existingStop.severity = severity;
        existingStop.lastDetectedAt = refDate.toISOString();
        detectedOrUpdatedEvents.push(existingStop);
      } else {
        const durMin = Math.floor(stoppedDuration / 60);
        detectedOrUpdatedEvents.push({
          id: `anom-stp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          tripId: input.tripId,
          vehiclePlate: input.vehiclePlate || 'KA-01-MJ-8822',
          driverName: input.driverName || 'Rajesh Sharma',
          routeName: input.routeName || 'Whitefield Tech Express',
          type: 'LONG_STOP',
          severity,
          status: 'ACTIVE',
          title: 'Unexpected Long Stop Outside Designated Stops',
          description: `Vehicle stationary for ${durMin}m outside scheduled stops (${nearestStopDist}m from nearest stop "${nearestStopName}").`,
          metadata: {
            stoppedDurationSeconds: stoppedDuration,
            nearestStopName,
            nearestStopDistanceMeters: nearestStopDist,
            safetyScoreImpact: scorePenalty,
          },
          detectedAt: refDate.toISOString(),
        });
      }
    }
  }

  // ==========================================================================
  // 4. GPS Signal Loss / Telemetry Staleness
  // ==========================================================================
  if (loc.updatedAt) {
    const elapsedSeconds = Math.max(0, Math.floor((refDate.getTime() - new Date(loc.updatedAt).getTime()) / 1000));

    if (elapsedSeconds >= ANOMALY_CONFIG.GPS_TIMEOUT_NORMAL_SEC) {
      let severity: AnomalySeverity = 'MEDIUM';
      let scorePenalty = -6;

      if (elapsedSeconds >= ANOMALY_CONFIG.GPS_TIMEOUT_HIGH_SEC) {
        severity = 'CRITICAL';
        scorePenalty = -20;
      } else if (elapsedSeconds >= ANOMALY_CONFIG.GPS_TIMEOUT_MEDIUM_SEC) {
        severity = 'HIGH';
        scorePenalty = -12;
      }

      const existingGps = findActive('GPS_SIGNAL_LOSS') || findActive('GPS_LOSS');
      if (existingGps) {
        existingGps.metadata.elapsedSecondsWithoutPing = elapsedSeconds;
        existingGps.severity = severity;
        existingGps.lastDetectedAt = refDate.toISOString();
        detectedOrUpdatedEvents.push(existingGps);
      } else {
        detectedOrUpdatedEvents.push({
          id: `anom-gps-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          tripId: input.tripId,
          vehiclePlate: input.vehiclePlate || 'KA-01-MJ-8822',
          driverName: input.driverName || 'Rajesh Sharma',
          routeName: input.routeName || 'Whitefield Tech Express',
          type: 'GPS_SIGNAL_LOSS',
          severity,
          status: 'ACTIVE',
          title: severity === 'CRITICAL' ? 'Critical GPS Signal Loss' : severity === 'HIGH' ? 'High Priority GPS Signal Loss' : 'GPS Telemetry Interruption',
          description: `Telemetry stream interrupted. No ping for ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s.`,
          metadata: {
            elapsedSecondsWithoutPing: elapsedSeconds,
            lastKnownLocation: 'Corridor Transit',
            safetyScoreImpact: scorePenalty,
          },
          detectedAt: refDate.toISOString(),
        });
      }
    }
  }

  // ==========================================================================
  // 5. Unexpected Trip Start Guard Violation
  // ==========================================================================
  if (input.attemptedTripStartBeforeOtp) {
    const existingStart = findActive('UNEXPECTED_TRIP_START');
    if (!existingStart) {
      detectedOrUpdatedEvents.push({
        id: `anom-start-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tripId: input.tripId,
        vehiclePlate: input.vehiclePlate || 'KA-01-MJ-8822',
        driverName: input.driverName || 'Rajesh Sharma',
        routeName: input.routeName || 'Whitefield Tech Express',
        type: 'UNEXPECTED_TRIP_START',
        severity: 'HIGH',
        status: 'ACTIVE',
        title: 'Unauthorized Dispatch Attempt Before Verification',
        description: 'Driver attempted to mark trip started before verifying at least 1 commuter OTP.',
        metadata: {
          verifiedPassengers: 0,
          requiredVerifications: 1,
          guardStatus: 'LIFECYCLE_GUARD_BLOCKED',
          safetyScoreImpact: -12,
        },
        detectedAt: refDate.toISOString(),
      });
    }
  }

  // ==========================================================================
  // 6. Multiple Failed OTP Attempts (Zero OTP Leakage)
  // ==========================================================================
  const totalFailures = (input.passengers || []).reduce((acc, p) => acc + (p.failedAttempts || 0), 0);
  const worstPassenger = (input.passengers || []).find((p) => (p.failedAttempts || 0) >= ANOMALY_CONFIG.OTP_FAILURES_WARNING);

  if (totalFailures >= ANOMALY_CONFIG.OTP_FAILURES_WARNING) {
    let severity: AnomalySeverity = 'WARNING';
    if (totalFailures >= ANOMALY_CONFIG.OTP_FAILURES_HIGH) severity = 'HIGH';
    else if (totalFailures >= ANOMALY_CONFIG.OTP_FAILURES_MEDIUM) severity = 'MEDIUM';

    const existingOtp = findActive('MULTIPLE_FAILED_OTP') || findActive('MULTIPLE_OTP_FAILURES');
    if (existingOtp) {
      existingOtp.metadata.failedAttempts = totalFailures;
      existingOtp.severity = severity;
      existingOtp.lastDetectedAt = refDate.toISOString();
      detectedOrUpdatedEvents.push(existingOtp);
    } else {
      detectedOrUpdatedEvents.push({
        id: `anom-otp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tripId: input.tripId,
        vehiclePlate: input.vehiclePlate || 'KA-01-MJ-8822',
        driverName: input.driverName || 'Rajesh Sharma',
        routeName: input.routeName || 'Whitefield Tech Express',
        type: 'MULTIPLE_FAILED_OTP',
        severity,
        status: 'ACTIVE',
        title: severity === 'HIGH' ? 'Multiple Boarding OTP Failures' : 'OTP Verification Discrepancy',
        description: `Recorded ${totalFailures} failed security OTP verification attempts. Admin review recommended.`,
        metadata: {
          failedAttempts: totalFailures,
          passengerName: worstPassenger?.name || 'Commuter',
          // Notice: Raw OTP values are strictly NOT included here!
          safetyScoreImpact: Math.min(20, totalFailures * 5),
        },
        detectedAt: refDate.toISOString(),
      });
    }
  }

  // Combine newly detected/updated events with untouched existing events
  const existingUntouched = existingAnomalies.filter(
    (e) => !detectedOrUpdatedEvents.some((u) => u.id === e.id)
  );

  let combinedAnomalies = [...detectedOrUpdatedEvents, ...existingUntouched];

  // ==========================================================================
  // 7. Multi-Signal Anomaly Correlation
  // ==========================================================================
  const activeDistinctTypes = Array.from(
    new Set(
      combinedAnomalies
        .filter((e) => e.status === 'ACTIVE' && e.type !== 'MULTI_SIGNAL_ANOMALY')
        .map((e) => e.type)
    )
  );

  let multiSignalEvent: AnomalyEvent | null = null;
  if (activeDistinctTypes.length >= 2) {
    const hasDeviation = activeDistinctTypes.includes('ROUTE_DEVIATION');
    const hasSpeed = activeDistinctTypes.includes('SPEED_ANOMALY');
    const isAggressiveDetour = hasDeviation && hasSpeed;

    const multiSeverity: AnomalySeverity = isAggressiveDetour ? 'CRITICAL' : 'HIGH';
    const multiTitle = isAggressiveDetour
      ? 'Multi-Signal Alert: Aggressive Off-Corridor Detour'
      : 'Multi-Signal Operational Anomaly';
    const multiDesc = isAggressiveDetour
      ? 'Simultaneous off-corridor detour and excessive velocity detected. Elevated operational risk.'
      : `Multiple concurrent telemetry variances detected (${activeDistinctTypes.join(', ')}). Central operator intervention recommended.`;

    const existingMulti = findActive('MULTI_SIGNAL_ANOMALY');
    if (existingMulti) {
      existingMulti.metadata.contributingAnomalies = activeDistinctTypes;
      existingMulti.severity = multiSeverity;
      existingMulti.title = multiTitle;
      existingMulti.description = multiDesc;
      existingMulti.lastDetectedAt = refDate.toISOString();
      multiSignalEvent = existingMulti;
    } else {
      multiSignalEvent = {
        id: `anom-multi-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tripId: input.tripId,
        vehiclePlate: input.vehiclePlate || 'KA-01-MJ-8822',
        driverName: input.driverName || 'Rajesh Sharma',
        routeName: input.routeName || 'Whitefield Tech Express',
        type: 'MULTI_SIGNAL_ANOMALY',
        severity: multiSeverity,
        status: 'ACTIVE',
        title: multiTitle,
        description: multiDesc,
        metadata: {
          contributingAnomalies: activeDistinctTypes,
          safetyScoreImpact: -20,
        },
        detectedAt: refDate.toISOString(),
      };
      combinedAnomalies.unshift(multiSignalEvent);
    }
  }

  // Determine highest severity
  const severityRank: Record<AnomalySeverity, number> = {
    INFO: 0,
    LOW: 0,
    WARNING: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };

  const activeEvents = combinedAnomalies.filter((e) => e.status === 'ACTIVE');
  let highestSeverity: AnomalySeverity = 'INFO';
  for (const e of activeEvents) {
    if (severityRank[e.severity] > severityRank[highestSeverity]) {
      highestSeverity = e.severity;
    }
  }

  // ==========================================================================
  // 8. Connect to Smart Safety Score
  // ==========================================================================
  const baseScore = 100;
  let totalScoreDeduction = 0;
  const history: number[] = [baseScore];

  // Calculate step-by-step score progression
  activeEvents.forEach((evt) => {
    const impact = Math.abs(evt.metadata.safetyScoreImpact || 5);
    totalScoreDeduction += impact;
    history.push(Math.max(0, baseScore - totalScoreDeduction));
  });

  const currentScore = Math.max(0, baseScore - totalScoreDeduction);
  const previousScore = history.length > 1 ? history[history.length - 2] : 100;

  // ==========================================================================
  // 9. Connect to Smart ETA Recalculation
  // ==========================================================================
  const etaCalc = calculateSmartEta({
    lat: loc.lat,
    lng: loc.lng,
    speedKmH: currentSpeed,
  }, waypoints, refDate);

  // If active route deviation exists, add detour penalty to ETA
  const activeDev = findActive('ROUTE_DEVIATION');
  let detourDelayMinutes = 0;
  if (activeDev && activeDev.metadata.latestDeviationMeters) {
    // ~1 minute delay per 150m deviation in city traffic
    detourDelayMinutes = Math.min(15, Math.round(activeDev.metadata.latestDeviationMeters / 150));
  }

  const finalDelayMinutes = etaCalc.currentDelayMinutes + detourDelayMinutes;

  // ==========================================================================
  // 10. Sanitized Public Operational Status
  // ==========================================================================
  let sanitizedStatus: SanitizedOperationalStatus;

  if (highestSeverity === 'CRITICAL' || highestSeverity === 'HIGH' || activeEvents.some((e) => e.type === 'SOS_INCIDENT')) {
    sanitizedStatus = {
      status: 'SAFETY_MONITORING',
      headline: 'Safety Desk Monitoring Active',
      message: 'Our 24/7 central operations team is actively monitoring this shuttle corridor.',
      badgeColor: 'orange',
      updatedEta: etaCalc.trafficAdjustedEta,
      delayMinutes: finalDelayMinutes,
      disclaimer: 'Official SmartRide family transit stream. Operational tracking in progress.',
    };
  } else if (finalDelayMinutes >= 3 || highestSeverity === 'MEDIUM' || highestSeverity === 'WARNING') {
    sanitizedStatus = {
      status: 'MINOR_DELAY',
      headline: 'Minor Corridor Delay',
      message: `Vehicle is experiencing a minor route delay (+${finalDelayMinutes} min expected).`,
      badgeColor: 'amber',
      updatedEta: etaCalc.trafficAdjustedEta,
      delayMinutes: finalDelayMinutes,
      disclaimer: 'Official SmartRide family transit stream.',
    };
  } else {
    sanitizedStatus = {
      status: 'OPERATIONAL_NORMAL',
      headline: 'Operating Normally',
      message: 'Shuttle is running on schedule along assigned corridor.',
      badgeColor: 'emerald',
      updatedEta: etaCalc.trafficAdjustedEta,
      delayMinutes: 0,
      disclaimer: 'Official SmartRide family transit stream.',
    };
  }

  return {
    anomalies: combinedAnomalies,
    activeAnomalies: activeEvents,
    multiSignalAnomaly: multiSignalEvent,
    highestSeverity,
    safetyScoreImpact: {
      previousScore,
      currentScore,
      delta: previousScore - currentScore,
      history,
    },
    etaImpact: {
      normalEta: etaCalc.normalScheduledEta,
      trafficAdjustedEta: etaCalc.trafficAdjustedEta,
      delayMinutes: finalDelayMinutes,
      statusIndicator: etaCalc.statusIndicator,
    },
    sanitizedStatus,
    evaluatedAt: refDate.toISOString(),
  };
}
