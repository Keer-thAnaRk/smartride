/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🚨 SMARTRIDE — DETERMINISTIC ANOMALY DETECTION ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Server-side deterministic operational anomaly detection built strictly on
 * available project telemetry, corridor route waypoints, and safety event data.
 *
 * Supported Anomaly Categories:
 * 1. SPEED_ANOMALY: Velocity exceeding corridor limits (55, 70, 85 km/h) or sudden spike.
 * 2. ROUTE_DEVIATION: Perpendicular distance from corridor centerline (100, 150, 300, 800 m).
 * 3. LONG_STATIONARY_STOP: Stationary vehicle (<= 3 km/h) outside designated stops (> 150m).
 * 4. GPS_SIGNAL_DROP: Staleness of telemetry updates (15, 30, 60, 120 s).
 * 5. UNEXPECTED_TRIP_DELAY: Operational delay against scheduled arrival (4, 8, 15, 30 min).
 * 6. UNEXPECTED_TRIP_START: Dispatch attempted prior to commuter verification.
 * 7. MULTIPLE_FAILED_OTP: Security OTP verification discrepancies (1, 2, 3+ failures).
 * 8. SOS_INCIDENT: Emergency distress signals.
 * 9. MULTI_SIGNAL_ANOMALY: Deterministic correlation of 2+ concurrent operational signals.
 */

import prisma from '@/lib/prisma';
import { calculateDistanceToCorridorMeters } from '@/lib/safety/anomaly-detection';
import { calculateHaversineDistance, SR101_CORRIDOR_WAYPOINTS, WaypointCoord } from '@/lib/ai/smart-eta';
import { ANOMALY_CONFIG } from '@/lib/security/anomaly-config';

export type AnomalyDetectionType =
  | 'SPEED_ANOMALY'
  | 'ROUTE_DEVIATION'
  | 'LONG_STATIONARY_STOP'
  | 'LONG_STOP'
  | 'GPS_SIGNAL_DROP'
  | 'GPS_SIGNAL_LOSS'
  | 'GPS_LOSS'
  | 'UNEXPECTED_TRIP_DELAY'
  | 'UNEXPECTED_TRIP_START'
  | 'MULTIPLE_FAILED_OTP'
  | 'MULTIPLE_OTP_FAILURES'
  | 'MULTI_SIGNAL_ANOMALY'
  | 'SOS_INCIDENT';

export type AnomalySeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AnomalyLifecycleStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export interface AnomalyEvidence {
  metricName: string;
  observedValue: number | string | boolean;
  thresholdValue: number | string | boolean;
  units?: string;
  details?: Record<string, any>;
  [key: string]: any;
}

export interface DetectedAnomaly {
  id: string;
  routeId: string;
  tripId?: string;
  driverId?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  type: AnomalyDetectionType;
  severity: AnomalySeverityLevel;
  status: AnomalyLifecycleStatus;
  detectedAt: string;
  lastDetectedAt?: string;
  title: string;
  explanation: string;
  evidence: AnomalyEvidence;
  metrics?: Record<string, any>;
  dedupKey: string;
}

export interface AnomalyDetectionInput {
  routeId: string;
  tripId?: string;
  driverId?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  driverName?: string;
  routeName?: string;
  currentLocation?: {
    lat: number;
    lng: number;
    speedKmH?: number;
    heading?: number;
    updatedAt?: string | Date;
  };
  previousTelemetry?: {
    speedKmH?: number;
    consecutiveSpikeCount?: number;
    updatedAt?: string | Date;
  };
  previousSpeedKmH?: number;
  stoppedDurationSeconds?: number;
  waypoints?: WaypointCoord[];
  expectedScheduledEta?: string | Date;
  currentEstimatedEta?: string | Date;
  delayMinutes?: number;
  attemptedTripStartBeforeOtp?: boolean;
  passengers?: Array<{
    name?: string;
    boarded: boolean;
    failedAttempts?: number;
  }>;
  hasActiveSos?: boolean;
  sosReason?: string;
  existingAnomalies?: Array<any>;
  referenceDate?: Date;
}

export interface AnomalyDetectionResult {
  routeId: string;
  tripId?: string;
  detectedCount: number;
  activeCount: number;
  highestSeverity: AnomalySeverityLevel | 'NONE';
  anomalies: DetectedAnomaly[];
  activeAnomalies: DetectedAnomaly[];
  multiSignalCorrelation: DetectedAnomaly | null;
  evaluatedAt: string;
}

/**
 * Normalizes severity comparison into numeric rank.
 */
export function getSeverityRank(sev: AnomalySeverityLevel | 'INFO' | 'WARNING' | 'NONE'): number {
  switch (sev) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'MEDIUM':
    case 'WARNING':
      return 2;
    case 'LOW':
    case 'INFO':
      return 1;
    default:
      return 0;
  }
}

/**
 * Deterministic Anomaly Detection Rule Engine
 */
export function detectAnomalies(input: AnomalyDetectionInput): AnomalyDetectionResult {
  const refDate = input.referenceDate || new Date();
  const nowIso = refDate.toISOString();
  const routeId = input.routeId || 'route-sr-101';
  const tripId = input.tripId || `trip-${routeId}-today`;
  const driverId = input.driverId;
  const vehicleId = input.vehicleId;
  const vehiclePlate = input.vehiclePlate || 'KA-01-MJ-8822';
  const waypoints = input.waypoints && input.waypoints.length > 0 ? input.waypoints : SR101_CORRIDOR_WAYPOINTS;

  const loc = input.currentLocation;
  const currentSpeed = loc ? Math.max(0, Math.round(loc.speedKmH || 0)) : undefined;
  const previousSpeed = input.previousSpeedKmH !== undefined
    ? Math.max(0, Math.round(input.previousSpeedKmH))
    : input.previousTelemetry?.speedKmH !== undefined
    ? Math.max(0, Math.round(input.previousTelemetry.speedKmH))
    : 0;

  const existingAnomalies = input.existingAnomalies || [];
  const candidateAnomalies: DetectedAnomaly[] = [];

  // Helper to find an active existing anomaly by type
  const findExistingActive = (typeCandidates: AnomalyDetectionType[]): any | undefined => {
    return existingAnomalies.find((e: any) => {
      const isStatusActive = e.status === 'ACTIVE' || e.status === 'INVESTIGATING' || e.status === 'ACKNOWLEDGED';
      const isMatchingType = typeCandidates.includes(e.type);
      const isMatchingScope = (e.tripId && e.tripId === tripId) ||
        (e.routeId && e.routeId === routeId) ||
        (e.metadata && (typeof e.metadata === 'string' ? e.metadata : JSON.stringify(e.metadata)).includes(routeId));
      return isStatusActive && isMatchingType && isMatchingScope;
    });
  };

  // Helper to construct or deduplicate an anomaly
  const emitOrUpdateAnomaly = (candidate: {
    type: AnomalyDetectionType;
    typesToMatch: AnomalyDetectionType[];
    severity: AnomalySeverityLevel;
    title: string;
    explanation: string;
    evidence: AnomalyEvidence;
    metrics?: Record<string, any>;
  }): void => {
    const dedupKey = `${tripId || routeId}:${candidate.type}`;
    const existing = findExistingActive(candidate.typesToMatch);

    if (existing) {
      // Deduplicate: Reuse existing ID and original detection timestamp
      candidateAnomalies.push({
        id: existing.id,
        routeId,
        tripId,
        driverId,
        vehicleId,
        vehiclePlate,
        type: candidate.type,
        severity: candidate.severity,
        status: existing.status || 'ACTIVE',
        detectedAt: existing.detectedAt ? new Date(existing.detectedAt).toISOString() : nowIso,
        lastDetectedAt: nowIso,
        title: candidate.title,
        explanation: candidate.explanation,
        evidence: candidate.evidence,
        metrics: candidate.metrics,
        dedupKey,
      });
    } else {
      // Create new deterministic anomaly record
      const idPrefix = candidate.type.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4);
      candidateAnomalies.push({
        id: `anom-${idPrefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        routeId,
        tripId,
        driverId,
        vehicleId,
        vehiclePlate,
        type: candidate.type,
        severity: candidate.severity,
        status: 'ACTIVE',
        detectedAt: nowIso,
        lastDetectedAt: nowIso,
        title: candidate.title,
        explanation: candidate.explanation,
        evidence: candidate.evidence,
        metrics: candidate.metrics,
        dedupKey,
      });
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. SPEED_ANOMALY DETECTION
  // ──────────────────────────────────────────────────────────────────────────
  if (currentSpeed !== undefined) {
    const speedDelta = currentSpeed - previousSpeed;
    const isOverSpeed = currentSpeed >= ANOMALY_CONFIG.SPEED_WARNING_THRESHOLD_KMH; // 55 km/h
    const isSuddenSpike = speedDelta >= ANOMALY_CONFIG.SPEED_SPIKE_DELTA_KMH && currentSpeed > 45; // +25 km/h surge

    if (isOverSpeed || isSuddenSpike) {
      let severity: AnomalySeverityLevel = 'MEDIUM';
      if (currentSpeed >= ANOMALY_CONFIG.SPEED_CRITICAL_THRESHOLD_KMH) {
        severity = 'CRITICAL'; // >= 85 km/h
      } else if (currentSpeed >= ANOMALY_CONFIG.SPEED_HIGH_THRESHOLD_KMH) {
        severity = 'HIGH'; // >= 70 km/h
      } else if (currentSpeed < ANOMALY_CONFIG.SPEED_WARNING_THRESHOLD_KMH && isSuddenSpike) {
        severity = 'LOW';
      }

      const threshold = severity === 'CRITICAL'
        ? ANOMALY_CONFIG.SPEED_CRITICAL_THRESHOLD_KMH
        : severity === 'HIGH'
        ? ANOMALY_CONFIG.SPEED_HIGH_THRESHOLD_KMH
        : ANOMALY_CONFIG.SPEED_WARNING_THRESHOLD_KMH;

      emitOrUpdateAnomaly({
        type: 'SPEED_ANOMALY',
        typesToMatch: ['SPEED_ANOMALY'],
        severity,
        title: severity === 'CRITICAL' ? 'Critical Velocity Limit Exceeded' : 'Corridor Speed Anomaly',
        explanation: `Observed vehicle velocity of ${currentSpeed} km/h exceeds operational corridor threshold of ${threshold} km/h (${speedDelta >= 0 ? `+${speedDelta}` : speedDelta} km/h surge).`,
        evidence: {
          metricName: 'speedKmH',
          observedValue: currentSpeed,
          thresholdValue: threshold,
          units: 'km/h',
          observedSpeed: currentSpeed,
          threshold: threshold,
          previousSpeed,
          speedDeltaKmH: speedDelta,
        },
        metrics: {
          currentSpeedKmH: currentSpeed,
          previousSpeedKmH: previousSpeed,
          speedDeltaKmH: speedDelta,
        },
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ROUTE_DEVIATION DETECTION
  // ──────────────────────────────────────────────────────────────────────────
  if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    const deviationDistance = calculateDistanceToCorridorMeters(loc.lat, loc.lng, waypoints);

    if (deviationDistance > ANOMALY_CONFIG.ROUTE_DEVIATION_NORMAL_METERS) { // > 150m
      let severity: AnomalySeverityLevel = 'MEDIUM';
      if (deviationDistance > ANOMALY_CONFIG.ROUTE_DEVIATION_TIER2_METERS) {
        severity = 'CRITICAL'; // > 800m
      } else if (deviationDistance > ANOMALY_CONFIG.ROUTE_DEVIATION_TIER1_METERS) {
        severity = 'HIGH'; // > 300m
      }

      emitOrUpdateAnomaly({
        type: 'ROUTE_DEVIATION',
        typesToMatch: ['ROUTE_DEVIATION'],
        severity,
        title: severity === 'CRITICAL' ? 'Critical Off-Corridor Route Deviation' : 'Route Corridor Deviation',
        explanation: `Vehicle is ${deviationDistance}m outside assigned corridor centerline (tolerance: ${ANOMALY_CONFIG.ROUTE_DEVIATION_NORMAL_METERS}m).`,
        evidence: {
          metricName: 'deviationMeters',
          observedValue: deviationDistance,
          thresholdValue: ANOMALY_CONFIG.ROUTE_DEVIATION_NORMAL_METERS,
          units: 'meters',
          observedDeviationMeters: deviationDistance,
          thresholdMeters: ANOMALY_CONFIG.ROUTE_DEVIATION_NORMAL_METERS,
          lat: loc.lat,
          lng: loc.lng,
        },
        metrics: {
          deviationDistanceMeters: deviationDistance,
          currentCoordinates: { lat: loc.lat, lng: loc.lng },
        },
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. LONG_STATIONARY_STOP DETECTION
  // ──────────────────────────────────────────────────────────────────────────
  const stoppedDuration = input.stoppedDurationSeconds || 0;
  const isStationary = currentSpeed !== undefined && currentSpeed <= ANOMALY_CONFIG.LONG_STOP_SPEED_CUTOFF_KMH; // <= 3 km/h

  if (isStationary && stoppedDuration >= 120) { // >= 2 min
    // Calculate proximity to scheduled stops (150m designated-stop exemption)
    let nearestStopDist = Infinity;
    let nearestStopName = '';

    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      for (const stop of waypoints) {
        const dMeters = Math.round(calculateHaversineDistance(loc.lat, loc.lng, stop.lat, stop.lng) * 1000);
        if (dMeters < nearestStopDist) {
          nearestStopDist = dMeters;
          nearestStopName = stop.name || 'Designated Stop';
        }
      }
    }

    // Only flag if vehicle is outside designated boarding stops
    if (nearestStopDist > ANOMALY_CONFIG.DESIGNATED_STOP_EXEMPTION_METERS || !loc) {
      if (stoppedDuration >= ANOMALY_CONFIG.LONG_STOP_DURATION_MEDIUM_SEC) { // >= 180s
        let severity: AnomalySeverityLevel = 'MEDIUM';
        if (stoppedDuration >= ANOMALY_CONFIG.LONG_STOP_DURATION_CRITICAL_SEC) {
          severity = 'CRITICAL'; // >= 600s
        } else if (stoppedDuration >= ANOMALY_CONFIG.LONG_STOP_DURATION_HIGH_SEC) {
          severity = 'HIGH'; // >= 300s
        }

        const durMin = Math.floor(stoppedDuration / 60);
        const threshold = severity === 'CRITICAL'
          ? ANOMALY_CONFIG.LONG_STOP_DURATION_CRITICAL_SEC
          : severity === 'HIGH'
          ? ANOMALY_CONFIG.LONG_STOP_DURATION_HIGH_SEC
          : ANOMALY_CONFIG.LONG_STOP_DURATION_MEDIUM_SEC;

        emitOrUpdateAnomaly({
          type: 'LONG_STATIONARY_STOP',
          typesToMatch: ['LONG_STATIONARY_STOP', 'LONG_STOP'],
          severity,
          title: 'Unexpected Long Stop Outside Designated Stops',
          explanation: `Vehicle stationary for ${durMin}m ${stoppedDuration % 60}s outside scheduled stops (${nearestStopDist !== Infinity ? `${nearestStopDist}m from nearest stop "${nearestStopName}"` : 'corridor transit'}).`,
          evidence: {
            metricName: 'stoppedDurationSeconds',
            observedValue: stoppedDuration,
            thresholdValue: threshold,
            units: 'seconds',
            stoppedDurationSeconds: stoppedDuration,
            thresholdDurationSeconds: threshold,
            nearestStopDistanceMeters: nearestStopDist !== Infinity ? nearestStopDist : undefined,
            nearestStopName: nearestStopName || undefined,
          },
          metrics: {
            stoppedDurationSeconds: stoppedDuration,
            nearestStopDistanceMeters: nearestStopDist,
          },
        });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. GPS_SIGNAL_DROP DETECTION
  // ──────────────────────────────────────────────────────────────────────────
  if (loc && loc.updatedAt) {
    const lastPingTime = new Date(loc.updatedAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((refDate.getTime() - lastPingTime) / 1000));

    if (elapsedSeconds >= ANOMALY_CONFIG.GPS_TIMEOUT_NORMAL_SEC) { // >= 15s
      let severity: AnomalySeverityLevel = 'LOW';
      if (elapsedSeconds >= ANOMALY_CONFIG.GPS_TIMEOUT_HIGH_SEC) {
        severity = 'CRITICAL'; // >= 120s
      } else if (elapsedSeconds >= ANOMALY_CONFIG.GPS_TIMEOUT_MEDIUM_SEC) {
        severity = 'HIGH'; // >= 60s
      } else if (elapsedSeconds >= 30) {
        severity = 'MEDIUM'; // >= 30s
      }

      emitOrUpdateAnomaly({
        type: 'GPS_SIGNAL_DROP',
        typesToMatch: ['GPS_SIGNAL_DROP', 'GPS_SIGNAL_LOSS', 'GPS_LOSS'],
        severity,
        title: severity === 'CRITICAL' ? 'Critical Telemetry Stream Failure' : 'GPS Telemetry Signal Drop',
        explanation: `Telemetry ping interrupted. No fresh telemetry update received for ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s (threshold: ${ANOMALY_CONFIG.GPS_TIMEOUT_NORMAL_SEC}s).`,
        evidence: {
          metricName: 'elapsedSecondsWithoutPing',
          observedValue: elapsedSeconds,
          thresholdValue: ANOMALY_CONFIG.GPS_TIMEOUT_NORMAL_SEC,
          units: 'seconds',
          elapsedSecondsWithoutPing: elapsedSeconds,
          thresholdSignalLossSeconds: ANOMALY_CONFIG.GPS_TIMEOUT_NORMAL_SEC,
          lastPingReceivedAt: new Date(loc.updatedAt).toISOString(),
        },
        metrics: {
          elapsedSecondsWithoutPing: elapsedSeconds,
        },
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. UNEXPECTED_TRIP_DELAY DETECTION
  // ──────────────────────────────────────────────────────────────────────────
  let calculatedDelayMinutes = input.delayMinutes;
  if (calculatedDelayMinutes === undefined && input.expectedScheduledEta && input.currentEstimatedEta) {
    const scheduled = new Date(input.expectedScheduledEta).getTime();
    const estimated = new Date(input.currentEstimatedEta).getTime();
    if (!isNaN(scheduled) && !isNaN(estimated)) {
      calculatedDelayMinutes = Math.max(0, Math.round((estimated - scheduled) / (1000 * 60)));
    }
  }

  if (calculatedDelayMinutes !== undefined && calculatedDelayMinutes >= 4) { // >= 4 min
    let severity: AnomalySeverityLevel = 'LOW';
    if (calculatedDelayMinutes >= 30) {
      severity = 'CRITICAL';
    } else if (calculatedDelayMinutes >= 15) {
      severity = 'HIGH';
    } else if (calculatedDelayMinutes >= 8) {
      severity = 'MEDIUM';
    }

    emitOrUpdateAnomaly({
      type: 'UNEXPECTED_TRIP_DELAY',
      typesToMatch: ['UNEXPECTED_TRIP_DELAY'],
      severity,
      title: 'Unexpected Trip Operational Delay',
      explanation: `Current route execution is delayed by ${calculatedDelayMinutes} minutes against scheduled corridor timeline.`,
      evidence: {
        metricName: 'delayMinutes',
        observedValue: calculatedDelayMinutes,
        thresholdValue: 4,
        units: 'minutes',
        delayMinutes: calculatedDelayMinutes,
        thresholdDelayMinutes: 4,
      },
      metrics: {
        delayMinutes: calculatedDelayMinutes,
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. UNEXPECTED_TRIP_START DETECTION
  // ──────────────────────────────────────────────────────────────────────────
  if (input.attemptedTripStartBeforeOtp) {
    emitOrUpdateAnomaly({
      type: 'UNEXPECTED_TRIP_START',
      typesToMatch: ['UNEXPECTED_TRIP_START'],
      severity: 'HIGH',
      title: 'Unauthorized Dispatch Before Verification',
      explanation: 'Driver initiated trip departure sequence before passenger boarding verification was confirmed.',
      evidence: {
        metricName: 'verifiedPassengers',
        observedValue: 0,
        thresholdValue: 1,
        units: 'passengers',
      },
      metrics: {
        attemptedTripStartBeforeOtp: true,
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. MULTIPLE_FAILED_OTP DETECTION
  // ──────────────────────────────────────────────────────────────────────────
  const totalFailures = (input.passengers || []).reduce((sum, p) => sum + (p.failedAttempts || 0), 0);
  if (totalFailures >= 1) {
    let severity: AnomalySeverityLevel = 'LOW';
    if (totalFailures >= ANOMALY_CONFIG.OTP_FAILURES_HIGH) {
      severity = 'HIGH'; // >= 3
    } else if (totalFailures >= ANOMALY_CONFIG.OTP_FAILURES_MEDIUM) {
      severity = 'MEDIUM'; // >= 2
    }

    emitOrUpdateAnomaly({
      type: 'MULTIPLE_FAILED_OTP',
      typesToMatch: ['MULTIPLE_FAILED_OTP', 'MULTIPLE_OTP_FAILURES'],
      severity,
      title: severity === 'HIGH' ? 'High Volume Boarding OTP Failures' : 'Commuter OTP Verification Discrepancy',
      explanation: `Recorded ${totalFailures} failed security OTP boarding verification attempt(s). Central dispatch review recommended.`,
      evidence: {
        metricName: 'failedOtpAttempts',
        observedValue: totalFailures,
        thresholdValue: 1,
        units: 'attempts',
        failedAttempts: totalFailures,
      },
      metrics: {
        totalFailedOtpAttempts: totalFailures,
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. SOS_INCIDENT DETECTION
  // ──────────────────────────────────────────────────────────────────────────
  if (input.hasActiveSos) {
    emitOrUpdateAnomaly({
      type: 'SOS_INCIDENT',
      typesToMatch: ['SOS_INCIDENT'],
      severity: 'CRITICAL',
      title: 'Emergency Passenger SOS Triggered',
      explanation: input.sosReason || 'Active distress notification dispatched from corridor vehicle.',
      evidence: {
        metricName: 'activeEmergencyStatus',
        observedValue: true,
        thresholdValue: false,
      },
      metrics: {
        hasActiveSos: true,
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 9. MULTI_SIGNAL_ANOMALY CORRELATION
  // ──────────────────────────────────────────────────────────────────────────
  let multiSignalCorrelation: DetectedAnomaly | null = null;
  const distinctActiveTypes = Array.from(
    new Set(candidateAnomalies.map((a) => a.type).filter((t) => t !== 'MULTI_SIGNAL_ANOMALY'))
  );

  if (distinctActiveTypes.length >= 2) {
    const hasDeviation = distinctActiveTypes.includes('ROUTE_DEVIATION');
    const hasSpeed = distinctActiveTypes.includes('SPEED_ANOMALY');
    const isAggressiveDetour = hasDeviation && hasSpeed;

    const severity: AnomalySeverityLevel = isAggressiveDetour ? 'CRITICAL' : 'HIGH';
    const title = isAggressiveDetour
      ? 'Multi-Signal Alert: Aggressive Off-Corridor Velocity Surge'
      : 'Multi-Signal Operational Correlation Alert';
    const explanation = isAggressiveDetour
      ? 'Simultaneous off-corridor detour and excessive speed violation detected concurrently.'
      : `Multiple correlated operational telemetry anomalies active concurrently (${distinctActiveTypes.join(', ')}). Central operator intervention recommended.`;

    const dedupKey = `${tripId || routeId}:MULTI_SIGNAL_ANOMALY`;
    const existingMulti = findExistingActive(['MULTI_SIGNAL_ANOMALY']);

    multiSignalCorrelation = {
      id: existingMulti ? existingMulti.id : `anom-mult-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      routeId,
      tripId,
      driverId,
      vehicleId,
      vehiclePlate,
      type: 'MULTI_SIGNAL_ANOMALY',
      severity,
      status: existingMulti ? existingMulti.status || 'ACTIVE' : 'ACTIVE',
      detectedAt: existingMulti?.detectedAt ? new Date(existingMulti.detectedAt).toISOString() : nowIso,
      lastDetectedAt: nowIso,
      title,
      explanation,
      evidence: {
        metricName: 'concurrentAnomalyCount',
        observedValue: distinctActiveTypes.length,
        thresholdValue: 2,
        contributingAnomalies: distinctActiveTypes,
      },
      metrics: {
        contributingTypes: distinctActiveTypes,
      },
      dedupKey,
    };

    candidateAnomalies.unshift(multiSignalCorrelation);
  }

  // Compute highest severity
  let highestSeverity: AnomalySeverityLevel | 'NONE' = 'NONE';
  let maxRank = 0;
  for (const anom of candidateAnomalies) {
    const rank = getSeverityRank(anom.severity);
    if (rank > maxRank) {
      maxRank = rank;
      highestSeverity = anom.severity;
    }
  }

  const activeAnomalies = candidateAnomalies.filter((a) => a.status === 'ACTIVE');

  return {
    routeId,
    tripId,
    detectedCount: candidateAnomalies.length,
    activeCount: activeAnomalies.length,
    highestSeverity,
    anomalies: candidateAnomalies,
    activeAnomalies,
    multiSignalCorrelation,
    evaluatedAt: nowIso,
  };
}

/**
 * Persists detected anomalies into SQLite prisma.safetyEvent with full deduplication.
 */
export async function persistDetectedAnomalies(anomalies: DetectedAnomaly[]): Promise<void> {
  for (const anom of anomalies) {
    try {
      await prisma.safetyEvent.upsert({
        where: { id: anom.id },
        create: {
          id: anom.id,
          tripId: anom.tripId || `trip-${anom.routeId}-today`,
          vehicleId: anom.vehicleId,
          driverId: anom.driverId,
          type: anom.type,
          severity: anom.severity,
          status: anom.status,
          title: anom.title,
          description: anom.explanation,
          detectedAt: new Date(anom.detectedAt),
          metadata: JSON.stringify({
            routeId: anom.routeId,
            driverId: anom.driverId,
            vehicleId: anom.vehicleId,
            vehiclePlate: anom.vehiclePlate,
            evidence: anom.evidence,
            metrics: anom.metrics,
            dedupKey: anom.dedupKey,
            lastDetectedAt: anom.lastDetectedAt || anom.detectedAt,
          }),
        },
        update: {
          severity: anom.severity,
          status: anom.status,
          title: anom.title,
          description: anom.explanation,
          metadata: JSON.stringify({
            routeId: anom.routeId,
            driverId: anom.driverId,
            vehicleId: anom.vehicleId,
            vehiclePlate: anom.vehiclePlate,
            evidence: anom.evidence,
            metrics: anom.metrics,
            dedupKey: anom.dedupKey,
            lastDetectedAt: anom.lastDetectedAt || anom.detectedAt,
          }),
        },
      });
    } catch (err) {
      console.warn(`[AnomalyEngine] Failed to persist safetyEvent ${anom.id}:`, err);
    }
  }
}
