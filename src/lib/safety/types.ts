/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE (COMMUTESYNC) — SMART TRIP SAFETY SCORE TYPES
 * ══════════════════════════════════════════════════════════════════════════════
 */

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type SafetyEventType =
  | 'ROUTE_DEVIATION'
  | 'ROUTE_RECOVERY'
  | 'SPEED_ANOMALY'
  | 'SPEED_NORMALIZED'
  | 'OTP_FAILURE'
  | 'MISSING_OTP'
  | 'DRIVER_VERIFICATION_ISSUE'
  | 'VEHICLE_DOCUMENT_ISSUE'
  | 'GPS_SIGNAL_LOSS'
  | 'GPS_SIGNAL_RESTORED'
  | 'LONG_STOP'
  | 'SOS_TRIGGERED'
  | 'SOS_RESOLVED'
  | 'UNEXPECTED_TRIP_STATE';

export type EventSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type EventStatus = 'ACTIVE' | 'INVESTIGATED' | 'RESOLVED';

export interface SafetyBreakdownItem {
  dimension: string;
  name: string;
  maxScore: number;
  earnedScore: number;
  deduction: number;
  isCompliant: boolean;
  statusText: string;
  reasons: string[];
}

export interface SafetyScoreBreakdown {
  driverVerification: SafetyBreakdownItem;
  vehicleDocuments: SafetyBreakdownItem;
  otpBoarding: SafetyBreakdownItem;
  routeCompliance: SafetyBreakdownItem;
  speedMonitoring: SafetyBreakdownItem;
  emergencyEvents: SafetyBreakdownItem;
}

export interface SafetyEvent {
  id: string;
  tripId: string;
  type: SafetyEventType;
  severity: EventSeverity;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  status: EventStatus;
  detectedAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}

export interface SafetyScoreResult {
  score: number; // Clamped 0-100
  riskLevel: RiskLevel;
  riskBadgeColor: 'emerald' | 'amber' | 'orange' | 'rose';
  riskLabel: string; // e.g. "🟢 LOW RISK"
  primaryReason: string;
  breakdown: SafetyScoreBreakdown;
  activeEvents: SafetyEvent[];
  timeline: SafetyEvent[];
  calculatedAt: string;
  operationalDisclaimer: string;
}

export interface SanitizedPublicSafetyIndicator {
  score: number;
  riskLevel: RiskLevel;
  riskLabel: string;
  driverVerified: boolean;
  vehicleVerified: boolean;
  routeCompliant: boolean;
  noActiveEmergency: boolean;
  statusSummary: string;
  operationalDisclaimer: string;
}
