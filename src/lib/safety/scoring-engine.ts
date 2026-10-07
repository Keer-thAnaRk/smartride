/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE (COMMUTESYNC) — DYNAMIC SAFETY SCORING ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Transparent, weighted rule-based operational risk scoring.
 * Clamped strictly between [0, 100].
 * Provides dimensional breakdown, explainability, timeline generation, and
 * privacy-sanitized public projections.
 */

import { SR101_CORRIDOR_WAYPOINTS, WaypointCoord } from '@/lib/ai/smart-eta';
import {
  assessOtpBoardingRisk,
  detectGpsSignalLoss,
  detectRouteDeviation,
  detectSpeedAnomaly,
  detectUnexpectedLongStop,
  SAFETY_CONFIG,
  shouldEmitSafetyEvent,
} from './anomaly-detection';
import {
  RiskLevel,
  SafetyBreakdownItem,
  SafetyEvent,
  SafetyScoreBreakdown,
  SafetyScoreResult,
  SanitizedPublicSafetyIndicator,
} from './types';

export const SAFETY_DISCLAIMER =
  'SmartRide operational risk indicator based on available trip telemetry. It is not a guarantee that a trip is objectively safe.';

export interface SafetyScoreInput {
  tripId: string;
  status?: string; // 'scheduled' | 'in_transit' | 'completed' | 'sos_alert'
  liveLocation?: {
    lat: number;
    lng: number;
    speedKmH?: number;
    heading?: number;
    updatedAt?: string;
  };
  driver?: {
    isVerified?: boolean;
    name?: string;
    licenseNumber?: string;
  };
  vehicle?: {
    isApproved?: boolean;
    rcDocUrl?: string | null;
    insuranceDocUrl?: string | null;
    licensePlate?: string;
    model?: string;
  };
  passengers?: Array<{
    userId?: string;
    name?: string;
    boarded: boolean;
    failedAttempts?: number;
    rideOtp?: string;
  }>;
  sosDetails?: {
    resolved?: boolean;
    triggeredAt?: string;
    triggeredByUserName?: string;
  };
  stoppedDurationSeconds?: number;
  existingEvents?: SafetyEvent[];
  waypoints?: WaypointCoord[];
  referenceDate?: Date;
}

/**
 * Evaluates the Smart Safety Score for an active trip.
 */
export function calculateTripSafetyScore(input: SafetyScoreInput): SafetyScoreResult {
  const refDate = input.referenceDate || new Date();
  const waypoints = input.waypoints || SR101_CORRIDOR_WAYPOINTS;
  const loc = input.liveLocation || {
    lat: waypoints[0]?.lat || 12.9121,
    lng: waypoints[0]?.lng || 77.6446,
    speedKmH: 0,
    updatedAt: refDate.toISOString(),
  };

  const existingEvents = input.existingEvents || [];
  const newlyEmittedEvents: SafetyEvent[] = [];

  // ==========================================================================
  // DIMENSION 1: Driver Verification (Max 20 pts)
  // ==========================================================================
  const isDriverVerified = Boolean(input.driver?.isVerified);
  const driverDeduction = isDriverVerified ? 0 : 20;
  const driverEarned = 20 - driverDeduction;

  const driverVerificationBreakdown: SafetyBreakdownItem = {
    dimension: 'driverVerification',
    name: 'Driver Verification & KYC',
    maxScore: 20,
    earnedScore: driverEarned,
    deduction: driverDeduction,
    isCompliant: isDriverVerified,
    statusText: isDriverVerified ? 'Verified Route Captain' : 'Unverified / Verification Pending',
    reasons: isDriverVerified
      ? ['Route captain KYC and commercial driving license verified.']
      : ['Driver verification pending or background screening incomplete (-20 pts).'],
  };

  if (!isDriverVerified && shouldEmitSafetyEvent(existingEvents, 'DRIVER_VERIFICATION_ISSUE', refDate)) {
    newlyEmittedEvents.push({
      id: `evt-driver-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      tripId: input.tripId,
      type: 'DRIVER_VERIFICATION_ISSUE',
      severity: 'HIGH',
      title: 'Unverified Driver On Route',
      description: 'Assigned driver has not completed mandatory commercial verification screening.',
      status: 'ACTIVE',
      detectedAt: refDate.toISOString(),
    });
  }

  // ==========================================================================
  // DIMENSION 2: Vehicle Documents (Max 15 pts)
  // ==========================================================================
  const isVehicleApproved = Boolean(input.vehicle?.isApproved);
  const hasRc = Boolean(input.vehicle?.rcDocUrl);
  const hasInsurance = Boolean(input.vehicle?.insuranceDocUrl);
  const isVehicleCompliant = isVehicleApproved || (hasRc && hasInsurance);

  const vehicleDeduction = isVehicleCompliant ? 0 : 15;
  const vehicleEarned = 15 - vehicleDeduction;

  const vehicleDocumentsBreakdown: SafetyBreakdownItem = {
    dimension: 'vehicleDocuments',
    name: 'Vehicle Documents & Registration',
    maxScore: 15,
    earnedScore: vehicleEarned,
    deduction: vehicleDeduction,
    isCompliant: isVehicleCompliant,
    statusText: isVehicleCompliant ? 'Valid RC & Insurance' : 'Missing / Unapproved Documents',
    reasons: isVehicleCompliant
      ? ['Commercial vehicle registration and active insurance policy verified.']
      : ['Missing or unapproved registration certificates / insurance documents (-15 pts).'],
  };

  if (!isVehicleCompliant && shouldEmitSafetyEvent(existingEvents, 'VEHICLE_DOCUMENT_ISSUE', refDate)) {
    newlyEmittedEvents.push({
      id: `evt-veh-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      tripId: input.tripId,
      type: 'VEHICLE_DOCUMENT_ISSUE',
      severity: 'HIGH',
      title: 'Vehicle Document Discrepancy',
      description: 'Assigned vehicle has missing or unapproved RC and insurance compliance records.',
      status: 'ACTIVE',
      detectedAt: refDate.toISOString(),
    });
  }

  // ==========================================================================
  // DIMENSION 3: OTP Boarding Verification (Max 15 pts)
  // ==========================================================================
  const otpAssessment = assessOtpBoardingRisk(input.passengers || []);
  const otpDeduction = otpAssessment.deduction;
  const otpEarned = 15 - otpDeduction;

  const otpReasons: string[] = [];
  if (otpAssessment.isCompliant) {
    otpReasons.push(otpAssessment.description);
  } else {
    if (otpAssessment.failedAttemptsTotal > 0) {
      otpReasons.push(
        `${otpAssessment.failedAttemptsTotal} failed OTP attempt(s) recorded (-${Math.min(15, otpAssessment.failedAttemptsTotal * 3)} pts).`
      );
    }
    if (otpAssessment.unboardedCount > 0) {
      otpReasons.push(
        `${otpAssessment.unboardedCount}/${otpAssessment.totalPassengers} unverified passengers pending boarding (-${Math.round((otpAssessment.unboardedCount / (otpAssessment.totalPassengers || 1)) * 15)} pts).`
      );
    }
  }

  const otpBoardingBreakdown: SafetyBreakdownItem = {
    dimension: 'otpBoarding',
    name: 'Passenger OTP Verification',
    maxScore: 15,
    earnedScore: otpEarned,
    deduction: otpDeduction,
    isCompliant: otpAssessment.isCompliant,
    statusText: otpAssessment.isCompliant
      ? 'All Passengers Verified'
      : `${otpAssessment.boardedCount}/${otpAssessment.totalPassengers} Boarded`,
    reasons: otpReasons,
  };

  if (otpAssessment.failedAttemptsTotal >= 2 && shouldEmitSafetyEvent(existingEvents, 'OTP_FAILURE', refDate)) {
    newlyEmittedEvents.push({
      id: `evt-otp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      tripId: input.tripId,
      type: 'OTP_FAILURE',
      severity: 'MEDIUM',
      title: 'Multiple OTP Verification Failures',
      description: `Recorded ${otpAssessment.failedAttemptsTotal} failed OTP verification attempts during boarding manifest verification.`,
      status: 'ACTIVE',
      detectedAt: refDate.toISOString(),
    });
  }

  // ==========================================================================
  // DIMENSION 4: Route Corridor Compliance (Max 20 pts)
  // ==========================================================================
  const routeAssessment = detectRouteDeviation(loc.lat, loc.lng, waypoints);
  const routeDeduction = routeAssessment.deduction;
  const routeEarned = 20 - routeDeduction;

  const routeComplianceBreakdown: SafetyBreakdownItem = {
    dimension: 'routeCompliance',
    name: 'Corridor & Route Compliance',
    maxScore: 20,
    earnedScore: routeEarned,
    deduction: routeDeduction,
    isCompliant: !routeAssessment.isDeviated,
    statusText: !routeAssessment.isDeviated ? 'On Corridor' : `${routeAssessment.distanceMeters}m Deviation`,
    reasons: [routeAssessment.description],
  };

  // Route Deviation Event and Dynamic Recovery
  if (routeAssessment.isDeviated && shouldEmitSafetyEvent(existingEvents, 'ROUTE_DEVIATION', refDate)) {
    newlyEmittedEvents.push({
      id: `evt-route-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      tripId: input.tripId,
      type: 'ROUTE_DEVIATION',
      severity: routeAssessment.severity,
      title: routeAssessment.severity === 'HIGH' ? 'Major Route Deviation' : 'Corridor Deviation Detected',
      description: routeAssessment.description,
      metadata: { distanceMeters: routeAssessment.distanceMeters },
      status: 'ACTIVE',
      detectedAt: refDate.toISOString(),
    });
  } else if (!routeAssessment.isDeviated) {
    // Check if an active route deviation was previously recorded and should be recovered
    const activeDeviation = existingEvents.find(
      (e) => e.type === 'ROUTE_DEVIATION' && e.status === 'ACTIVE'
    );
    if (activeDeviation && shouldEmitSafetyEvent(existingEvents, 'ROUTE_RECOVERY', refDate)) {
      newlyEmittedEvents.push({
        id: `evt-route-rec-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tripId: input.tripId,
        type: 'ROUTE_RECOVERY',
        severity: 'INFO',
        title: 'Vehicle Returned to Assigned Corridor',
        description: `Vehicle successfully realigned with assigned corridor (${routeAssessment.distanceMeters}m from centerline). Safety score recovered.`,
        status: 'RESOLVED',
        detectedAt: refDate.toISOString(),
      });
    }
  }

  // ==========================================================================
  // DIMENSION 5: Speed Monitoring & Compliance (Max 15 pts)
  // ==========================================================================
  const speedAssessment = detectSpeedAnomaly(loc.speedKmH);
  const speedDeduction = speedAssessment.deduction;
  const speedEarned = 15 - speedDeduction;

  const speedMonitoringBreakdown: SafetyBreakdownItem = {
    dimension: 'speedMonitoring',
    name: 'Velocity & Speed Compliance',
    maxScore: 15,
    earnedScore: speedEarned,
    deduction: speedDeduction,
    isCompliant: !speedAssessment.isSpeeding,
    statusText: !speedAssessment.isSpeeding ? 'Normal Speed' : `${speedAssessment.speedKmH} km/h (Excess)`,
    reasons: [speedAssessment.description],
  };

  // Speed Anomaly Event and Dynamic Recovery
  if (speedAssessment.isSpeeding && shouldEmitSafetyEvent(existingEvents, 'SPEED_ANOMALY', refDate)) {
    newlyEmittedEvents.push({
      id: `evt-speed-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      tripId: input.tripId,
      type: 'SPEED_ANOMALY',
      severity: speedAssessment.severity,
      title: speedAssessment.severity === 'CRITICAL' ? 'Severe Speed Violation' : 'Speeding Anomaly Detected',
      description: speedAssessment.description,
      metadata: { speedKmH: speedAssessment.speedKmH, excessKmH: speedAssessment.excessKmH },
      status: 'ACTIVE',
      detectedAt: refDate.toISOString(),
    });
  } else if (!speedAssessment.isSpeeding) {
    const activeSpeeding = existingEvents.find(
      (e) => e.type === 'SPEED_ANOMALY' && e.status === 'ACTIVE'
    );
    if (activeSpeeding && shouldEmitSafetyEvent(existingEvents, 'SPEED_NORMALIZED', refDate)) {
      newlyEmittedEvents.push({
        id: `evt-speed-norm-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tripId: input.tripId,
        type: 'SPEED_NORMALIZED',
        severity: 'INFO',
        title: 'Corridor Transit Speed Normalized',
        description: `Vehicle transit speed normalized to ${loc.speedKmH || 0} km/h. Velocity penalty recovered.`,
        status: 'RESOLVED',
        detectedAt: refDate.toISOString(),
      });
    }
  }

  // ==========================================================================
  // DIMENSION 6: Emergency & Telemetry Health (Max 15 pts)
  // ==========================================================================
  const isSosActive = input.status === 'sos_alert' || (input.sosDetails && !input.sosDetails.resolved);
  const gpsAssessment = detectGpsSignalLoss(loc.updatedAt, refDate);
  const longStopAssessment = detectUnexpectedLongStop(
    loc.lat,
    loc.lng,
    loc.speedKmH || 0,
    input.stoppedDurationSeconds || 0,
    waypoints
  );

  let emergencySubDeduction = 0;
  const emergencyReasons: string[] = [];

  if (isSosActive) {
    emergencySubDeduction += 15;
    emergencyReasons.push('Active high-priority Emergency SOS triggered on trip (-15 pts).');
  }
  if (gpsAssessment.isSignalLost) {
    emergencySubDeduction += gpsAssessment.deduction;
    emergencyReasons.push(gpsAssessment.description);
  }
  if (longStopAssessment.isLongStop) {
    emergencySubDeduction += longStopAssessment.deduction;
    emergencyReasons.push(longStopAssessment.description);
  }

  if (emergencyReasons.length === 0) {
    emergencyReasons.push('Telemetry nominal. No active SOS incidents or unexpected stationary stops.');
  }

  const finalEmergencyDeduction = Math.min(15, emergencySubDeduction);
  const emergencyEarned = 15 - finalEmergencyDeduction;

  const emergencyEventsBreakdown: SafetyBreakdownItem = {
    dimension: 'emergencyEvents',
    name: 'Emergency & Telemetry Health',
    maxScore: 15,
    earnedScore: emergencyEarned,
    deduction: finalEmergencyDeduction,
    isCompliant: finalEmergencyDeduction === 0,
    statusText: isSosActive ? 'Emergency SOS Active' : gpsAssessment.isSignalLost ? 'GPS Interrupted' : 'Nominal Stream',
    reasons: emergencyReasons,
  };

  if (isSosActive && shouldEmitSafetyEvent(existingEvents, 'SOS_TRIGGERED', refDate)) {
    newlyEmittedEvents.push({
      id: `evt-sos-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      tripId: input.tripId,
      type: 'SOS_TRIGGERED',
      severity: 'CRITICAL',
      title: 'Emergency SOS Triggered',
      description: `Emergency incident reported by ${input.sosDetails?.triggeredByUserName || 'passenger'}. Immediate intervention in progress.`,
      status: 'ACTIVE',
      detectedAt: input.sosDetails?.triggeredAt || refDate.toISOString(),
    });
  }

  if (gpsAssessment.isSignalLost && shouldEmitSafetyEvent(existingEvents, 'GPS_SIGNAL_LOSS', refDate)) {
    newlyEmittedEvents.push({
      id: `evt-gps-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      tripId: input.tripId,
      type: 'GPS_SIGNAL_LOSS',
      severity: gpsAssessment.severity,
      title: 'GPS Telemetry Signal Interruption',
      description: gpsAssessment.description,
      status: 'ACTIVE',
      detectedAt: refDate.toISOString(),
    });
  }

  if (longStopAssessment.isLongStop && shouldEmitSafetyEvent(existingEvents, 'LONG_STOP', refDate)) {
    newlyEmittedEvents.push({
      id: `evt-stop-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      tripId: input.tripId,
      type: 'LONG_STOP',
      severity: longStopAssessment.severity,
      title: 'Unexpected Long Stationary Stop',
      description: longStopAssessment.description,
      status: 'ACTIVE',
      detectedAt: refDate.toISOString(),
    });
  }

  // ==========================================================================
  // FINAL SCORE AGGREGATION & CLAMPING [0, 100]
  // ==========================================================================
  const totalDeduction =
    driverDeduction +
    vehicleDeduction +
    otpDeduction +
    routeDeduction +
    speedDeduction +
    finalEmergencyDeduction;

  const rawScore = 100 - totalDeduction;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Risk Classification
  let riskLevel: RiskLevel = 'LOW';
  let riskBadgeColor: 'emerald' | 'amber' | 'orange' | 'rose' = 'emerald';
  let riskLabel = '🟢 LOW RISK';

  if (finalScore >= 90) {
    riskLevel = 'LOW';
    riskBadgeColor = 'emerald';
    riskLabel = '🟢 LOW RISK';
  } else if (finalScore >= 75) {
    riskLevel = 'MODERATE';
    riskBadgeColor = 'amber';
    riskLabel = '🟡 MODERATE RISK';
  } else if (finalScore >= 50) {
    riskLevel = 'HIGH';
    riskBadgeColor = 'orange';
    riskLabel = '🟠 HIGH RISK';
  } else {
    riskLevel = 'CRITICAL';
    riskBadgeColor = 'rose';
    riskLabel = '🔴 CRITICAL RISK';
  }

  // Explainability Synthesis: Pick the primary factor causing score reduction
  let primaryReason = 'Nominal transit: driver verified, vehicle compliant, speed and route corridor adherence on track.';
  const breakdownList = [
    driverVerificationBreakdown,
    vehicleDocumentsBreakdown,
    otpBoardingBreakdown,
    routeComplianceBreakdown,
    speedMonitoringBreakdown,
    emergencyEventsBreakdown,
  ];

  const highestDeduction = breakdownList.reduce((prev, curr) =>
    curr.deduction > prev.deduction ? curr : prev
  );

  if (highestDeduction.deduction > 0) {
    primaryReason = highestDeduction.reasons[0] || `${highestDeduction.name} variance detected.`;
  }

  // Combine existing events and newly emitted events into active events and timeline
  const combinedTimeline = [...newlyEmittedEvents, ...existingEvents].sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );

  const activeEvents = combinedTimeline.filter((e) => e.status === 'ACTIVE');

  return {
    score: finalScore,
    riskLevel,
    riskBadgeColor,
    riskLabel,
    primaryReason,
    breakdown: {
      driverVerification: driverVerificationBreakdown,
      vehicleDocuments: vehicleDocumentsBreakdown,
      otpBoarding: otpBoardingBreakdown,
      routeCompliance: routeComplianceBreakdown,
      speedMonitoring: speedMonitoringBreakdown,
      emergencyEvents: emergencyEventsBreakdown,
    },
    activeEvents,
    timeline: combinedTimeline,
    calculatedAt: refDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    operationalDisclaimer: SAFETY_DISCLAIMER,
  };
}

/**
 * Creates a sanitized public projection suitable for /track/[shareToken].
 * NEVER leaks passenger counts, OTP details, driver phone, or internal audit logs.
 */
export function createSanitizedPublicSafetyIndicator(
  result: SafetyScoreResult
): SanitizedPublicSafetyIndicator {
  return {
    score: result.score,
    riskLevel: result.riskLevel,
    riskLabel: result.riskLabel,
    driverVerified: result.breakdown.driverVerification.isCompliant,
    vehicleVerified: result.breakdown.vehicleDocuments.isCompliant,
    routeCompliant: result.breakdown.routeCompliance.isCompliant,
    noActiveEmergency: result.breakdown.emergencyEvents.isCompliant,
    statusSummary:
      result.riskLevel === 'LOW'
        ? 'Verified Driver • Validated Vehicle • Corridor On Track • Zero Active Emergencies'
        : `${result.riskLabel} • Corridor operational monitoring active`,
    operationalDisclaimer: result.operationalDisclaimer,
  };
}
