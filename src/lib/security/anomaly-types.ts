/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🚨 SMARTRIDE (COMMUTESYNC) — ANOMALY DETECTION & SECURITY TYPES
 * ══════════════════════════════════════════════════════════════════════════════
 */

export type AnomalyType =
  | 'SPEED_ANOMALY'
  | 'ROUTE_DEVIATION'
  | 'LONG_STOP'
  | 'GPS_SIGNAL_LOSS'
  | 'GPS_LOSS'
  | 'UNEXPECTED_TRIP_START'
  | 'MULTIPLE_OTP_FAILURES'
  | 'MULTIPLE_FAILED_OTP'
  | 'MULTI_SIGNAL_ANOMALY'
  | 'SOS_INCIDENT';

export type AnomalySeverity = 'INFO' | 'LOW' | 'WARNING' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AnomalyStatus =
  | 'ACTIVE'
  | 'ACKNOWLEDGED'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'DISMISSED';

export interface AnomalyMetadata {
  durationSeconds?: number;
  maxDeviationMeters?: number;
  latestDeviationMeters?: number;
  previousSpeedKmH?: number;
  currentSpeedKmH?: number;
  increaseKmH?: number;
  stoppedDurationSeconds?: number;
  elapsedSecondsWithoutPing?: number;
  failedAttempts?: number;
  passengerName?: string; // Privacy: only shown to authorized admin
  lastKnownLocation?: string;
  contributingAnomalies?: AnomalyType[];
  safetyScoreImpact?: number;
  previousScore?: number;
  currentScore?: number;
  recalculatedEta?: string;
  delayMinutes?: number;
  [key: string]: any;
}

export interface AnomalyEvent {
  id: string;
  tripId: string;
  vehicleId?: string;
  driverId?: string;
  vehiclePlate?: string;
  driverName?: string;
  routeName?: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  title: string;
  description: string;
  metadata: AnomalyMetadata;
  detectedAt: string;
  lastDetectedAt?: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  investigatingAt?: string | null;
  investigatingBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionReason?: string | null;
  resolutionNote?: string | null;
}

export interface SecurityAuditLogEntry {
  id: string;
  action:
    | 'ANOMALY_DETECTED'
    | 'ADMIN_ACKNOWLEDGED'
    | 'ANOMALY_ACKNOWLEDGED'
    | 'ADMIN_INVESTIGATING'
    | 'INVESTIGATION_OPENED'
    | 'ANOMALY_RESOLVED'
    | 'ANOMALY_DISMISSED'
    | 'FALSE_POSITIVE_DISMISSED'
    | 'UNAUTHORIZED_DISPATCH_ATTEMPT'
    | 'SIMULATION_TRIGGERED'
    | 'STANDBY_DRIVER_ASSIGNED'
    | 'PRIMARY_DRIVER_LATE_CHECKIN';
  tripId?: string;
  eventId?: string;
  actorId: string;
  actorName: string;
  details: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface SanitizedOperationalStatus {
  status: 'OPERATIONAL_NORMAL' | 'MINOR_DELAY' | 'SAFETY_MONITORING';
  headline: string;
  message: string;
  badgeColor: 'emerald' | 'amber' | 'orange';
  updatedEta?: string;
  delayMinutes?: number;
  disclaimer: string;
}
