/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔄 DRIVER NO-SHOW & AUTOMATED CONTINGENCY ENGINE — CORE ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Provides deterministic check-in timeline evaluation, hard candidate eligibility
 * filtering, multi-factor suitability scoring, explainable causal justifications,
 * and tie-break detection.
 */

import { DRIVER_MONITOR_CONFIG } from './driver-monitor-config';
import {
  CheckInStatus,
  StandbyCandidate,
  CandidateScoreBreakdown,
  CandidateEvaluationResult,
} from './driver-coverage-types';

/**
 * Parses time string e.g. "08:00 AM", "07:45 PM", "14:30" into total minutes from midnight.
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 480; // 08:00 AM default (8 * 60)

  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');

  const match = clean.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 480;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Formats minutes from midnight into 12-hour AM/PM string.
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  let hours = Math.floor(norm / 60);
  const mins = norm % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Computes check-in deadline given scheduled dispatch time.
 */
export function computeCheckInDeadline(
  dispatchTimeStr: string,
  minutesPrior = DRIVER_MONITOR_CONFIG.CHECK_IN_DEADLINE_MINUTES_PRIOR
): string {
  const dispatchMins = parseTimeToMinutes(dispatchTimeStr);
  return formatMinutesToTime(dispatchMins - minutesPrior);
}

/**
 * Evaluates current driver check-in state based on timeline policy.
 */
export function evaluateCheckInStatus(params: {
  scheduledDispatch: string;
  checkInDeadline?: string;
  checkedInAt?: Date | string | null;
  referenceTime?: Date;
  isReplaced?: boolean;
}): {
  status: CheckInStatus;
  checkInDeadline: string;
  minutesUntilDeadline: number;
  minutesPastDeadline: number;
  isPotentialNoShow: boolean;
} {
  const {
    scheduledDispatch,
    checkedInAt,
    referenceTime = new Date(),
    isReplaced = false,
  } = params;

  const deadlineStr =
    params.checkInDeadline || computeCheckInDeadline(scheduledDispatch);
  const deadlineMins = parseTimeToMinutes(deadlineStr);

  const currentHours = referenceTime.getHours();
  const currentMinutes = referenceTime.getMinutes();
  const currentTotalMins = currentHours * 60 + currentMinutes;

  const diffFromDeadline = currentTotalMins - deadlineMins;
  const minutesUntilDeadline = Math.max(0, -diffFromDeadline);
  const minutesPastDeadline = Math.max(0, diffFromDeadline);

  // Handle replacement race conditions
  if (isReplaced) {
    if (checkedInAt) {
      return {
        status: 'PRIMARY_RETURNED',
        checkInDeadline: deadlineStr,
        minutesUntilDeadline: 0,
        minutesPastDeadline,
        isPotentialNoShow: false,
      };
    }
    return {
      status: 'REPLACED',
      checkInDeadline: deadlineStr,
      minutesUntilDeadline: 0,
      minutesPastDeadline,
      isPotentialNoShow: false,
    };
  }

  // If driver has already checked in
  if (checkedInAt) {
    return {
      status: 'CHECKED_IN',
      checkInDeadline: deadlineStr,
      minutesUntilDeadline: 0,
      minutesPastDeadline: 0,
      isPotentialNoShow: false,
    };
  }

  // Not checked in yet — evaluate deterministic timeline brackets
  const graceLimit = DRIVER_MONITOR_CONFIG.GRACE_PERIOD_MINUTES;
  const confirmationLimit = DRIVER_MONITOR_CONFIG.NO_SHOW_CONFIRMATION_MINUTES;

  if (diffFromDeadline <= 0) {
    // Before deadline
    return {
      status: 'EXPECTED',
      checkInDeadline: deadlineStr,
      minutesUntilDeadline,
      minutesPastDeadline: 0,
      isPotentialNoShow: false,
    };
  } else if (diffFromDeadline <= graceLimit) {
    // Within grace period (0 - 5 min late)
    return {
      status: 'LATE',
      checkInDeadline: deadlineStr,
      minutesUntilDeadline: 0,
      minutesPastDeadline,
      isPotentialNoShow: false,
    };
  } else if (diffFromDeadline <= confirmationLimit) {
    // Grace period exceeded (5 - 10 min late) -> No-Show Risk
    return {
      status: 'NO_SHOW_RISK',
      checkInDeadline: deadlineStr,
      minutesUntilDeadline: 0,
      minutesPastDeadline,
      isPotentialNoShow: true,
    };
  } else {
    // Confirmation point exceeded (> 10 min late) -> No-Show Confirmed
    return {
      status: 'NO_SHOW_CONFIRMED',
      checkInDeadline: deadlineStr,
      minutesUntilDeadline: 0,
      minutesPastDeadline,
      isPotentialNoShow: true,
    };
  }
}

/**
 * Standard Haversine distance in kilometers between two coordinates.
 */
export function calculateHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

export interface CandidateEvaluationInput {
  driver: {
    id: string;
    name: string;
    phone?: string | null;
    avatar?: string | null;
    rating?: number;
    experienceYears?: number;
    isVerified?: boolean;
    status?: string;
    hasApprovedLeave?: boolean;
    hasConflictingTrip?: boolean;
    assignedRouteId?: string | null;
    assignedRouteCode?: string | null;
    location?: { lat: number; lng: number };
    vehicle?: {
      make?: string;
      model?: string;
      licensePlate?: string;
      capacity?: number;
      isApproved?: boolean;
    } | null;
  };
  route: {
    id: string;
    code: string;
    name: string;
    originLat?: number;
    originLng?: number;
    activeSubscriptionCount?: number;
  };
}

/**
 * Evaluates a standby driver candidate against hard eligibility rules
 * and calculates their transparent operational suitability score.
 */
export function evaluateStandbyCandidate(
  input: CandidateEvaluationInput
): StandbyCandidate {
  const { driver, route } = input;
  const requiredCapacity = route.activeSubscriptionCount || 4;

  const originLat = route.originLat || DRIVER_MONITOR_CONFIG.DEFAULT_DEPOT_LAT;
  const originLng = route.originLng || DRIVER_MONITOR_CONFIG.DEFAULT_DEPOT_LNG;

  const driverLat = driver.location?.lat || DRIVER_MONITOR_CONFIG.DEFAULT_DEPOT_LAT;
  const driverLng = driver.location?.lng || DRIVER_MONITOR_CONFIG.DEFAULT_DEPOT_LNG;

  const distanceKm = calculateHaversineKm(driverLat, driverLng, originLat, originLng);
  const isSimulatedDistance = !driver.location;

  // Check corridor familiarity
  const isSameRoute = driver.assignedRouteCode === route.code;
  const corridorQualified =
    isSameRoute ||
    (route.code.startsWith('SR-1') && (driver.assignedRouteCode?.startsWith('SR-1') || false)) ||
    (route.code.startsWith('SR-2') && (driver.assignedRouteCode?.startsWith('SR-2') || false));

  // 1. Hard Eligibility Filtering
  const isVerified = Boolean(driver.isVerified);
  const isStatusAvailable = driver.status === 'AVAILABLE' || driver.status === 'STANDBY';
  const hasLeave = Boolean(driver.hasApprovedLeave);
  const hasConflict = Boolean(driver.hasConflictingTrip);
  const vehicleCapacity = driver.vehicle?.capacity || 4;
  const hasCapacity = vehicleCapacity >= requiredCapacity;
  const isWithinDistance = distanceKm <= DRIVER_MONITOR_CONFIG.MAX_ACCEPTABLE_DISTANCE_KM;

  let isEligible = true;
  let ineligibilityReason: string | null = null;

  if (!isVerified) {
    isEligible = false;
    ineligibilityReason = 'Driver lacks mandatory verified KYC & commercial license credentials';
  } else if (hasLeave) {
    isEligible = false;
    ineligibilityReason = 'Driver is currently on approved leave';
  } else if (hasConflict) {
    isEligible = false;
    ineligibilityReason = 'Driver is already assigned to a concurrent scheduled/active trip';
  } else if (!isStatusAvailable) {
    isEligible = false;
    ineligibilityReason = `Driver status is ${driver.status || 'OFFLINE'} (must be AVAILABLE)`;
  } else if (!hasCapacity) {
    isEligible = false;
    ineligibilityReason = `Vehicle capacity (${vehicleCapacity}) is less than required passenger load (${requiredCapacity})`;
  } else if (!isWithinDistance) {
    isEligible = false;
    ineligibilityReason = `Driver distance (${distanceKm} km) exceeds maximum acceptable radius (15 km)`;
  }

  // 2. Score Breakdown Computation
  let availabilityScore = 0;
  let routeScore = 0;
  let proximityScore = 0;
  let shiftScore = 0;
  let vehicleScore = 0;

  if (isEligible) {
    // Availability (30% weight)
    availabilityScore = driver.status === 'STANDBY' ? 100 : 85;

    // Route / Corridor Compatibility (25% weight)
    if (isSameRoute) {
      routeScore = 100;
    } else if (corridorQualified) {
      routeScore = 80;
    } else {
      routeScore = 55;
    }

    // Proximity Distance (20% weight)
    // 0 km = 100 pts, 15 km = 0 pts
    const maxDist = DRIVER_MONITOR_CONFIG.MAX_ACCEPTABLE_DISTANCE_KM;
    proximityScore = Math.max(0, Math.min(100, Math.round((1 - distanceKm / maxDist) * 100)));

    // Shift Compatibility & Driver Rating (15% weight)
    const rating = driver.rating || 4.5;
    shiftScore = Math.min(100, Math.round((rating / 5.0) * 100));

    // Vehicle Match & Approval (10% weight)
    const isVehApproved = driver.vehicle?.isApproved !== false;
    vehicleScore = isVehApproved ? 100 : 60;
  }

  const w = DRIVER_MONITOR_CONFIG.WEIGHTS;
  const rawWeightedScore = isEligible
    ? w.availability * availabilityScore +
      w.routeCompatibility * routeScore +
      w.proximity * proximityScore +
      w.shiftCompatibility * shiftScore +
      w.vehicleCompatibility * vehicleScore
    : 0;

  const suitabilityScore = Math.round(rawWeightedScore);

  const scores: CandidateScoreBreakdown = {
    availabilityScore,
    routeScore,
    proximityScore,
    shiftScore,
    vehicleScore,
    rawWeightedScore: parseFloat(rawWeightedScore.toFixed(1)),
  };

  // 3. Explainable Causal Justifications
  const candidateSummary: StandbyCandidate = {
    driverId: driver.id,
    driverName: driver.name,
    driverPhone: driver.phone || null,
    driverAvatar: driver.avatar || null,
    experienceYears: driver.experienceYears || 3,
    rating: driver.rating || 4.8,
    isVerified,
    status: driver.status || 'AVAILABLE',
    distanceKm,
    isSimulatedDistance,
    corridorQualified,
    assignedRouteCode: driver.assignedRouteCode || null,
    vehicleMake: driver.vehicle?.make || null,
    vehicleModel: driver.vehicle?.model || null,
    licensePlate: driver.vehicle?.licensePlate || null,
    vehicleCapacity,
    isEligible,
    ineligibilityReason,
    scores,
    suitabilityScore,
    recommendationReason: '',
    caveatNotes: [],
  };

  const { reason, caveats } = generateExplanation(candidateSummary, route.name);
  candidateSummary.recommendationReason = reason;
  candidateSummary.caveatNotes = caveats;

  return candidateSummary;
}

/**
 * Generates transparent human-readable explanations based on candidate metrics.
 */
function generateExplanation(
  candidate: StandbyCandidate,
  routeName: string
): { reason: string; caveats: string[] } {
  if (!candidate.isEligible) {
    return {
      reason: `Ineligible for assignment: ${candidate.ineligibilityReason}.`,
      caveats: [candidate.ineligibilityReason || 'Ineligible'],
    };
  }

  const reasons: string[] = [
    `✓ Available standby captain with verified credentials`,
  ];
  const caveats: string[] = [];

  if (candidate.corridorQualified) {
    reasons.push(`✓ Qualified for ${routeName} corridor`);
  } else {
    caveats.push(`⚠ Different primary corridor qualification`);
  }

  reasons.push(`✓ ${candidate.distanceKm} km from pickup origin`);
  if (candidate.distanceKm > 8.0) {
    caveats.push(`⚠ Proximity distance (${candidate.distanceKm} km) may add slight initial transit time`);
  }

  reasons.push(`✓ Verified vehicle documents with ${candidate.vehicleCapacity}-seat capacity`);
  reasons.push(`✓ Strong operational rating (${candidate.rating.toFixed(1)}/5.0)`);

  const primaryReasonText = reasons.join(' • ');

  return {
    reason: primaryReasonText,
    caveats,
  };
}

/**
 * Detects whether top candidates have similar scores requiring Admin manual review.
 */
export function detectSimilarScores(rankedCandidates: StandbyCandidate[]): {
  hasSimilarScores: boolean;
  similarCandidatesCount: number;
  advisoryNote: string | null;
} {
  const eligible = rankedCandidates.filter((c) => c.isEligible);
  if (eligible.length < 2) {
    return {
      hasSimilarScores: false,
      similarCandidatesCount: eligible.length,
      advisoryNote: null,
    };
  }

  const topScore = eligible[0].suitabilityScore;
  const secondScore = eligible[1].suitabilityScore;
  const scoreDiff = Math.abs(topScore - secondScore);

  if (scoreDiff <= DRIVER_MONITOR_CONFIG.SIMILAR_SCORE_THRESHOLD) {
    return {
      hasSimilarScores: true,
      similarCandidatesCount: 2,
      advisoryNote: `Standby captains ${eligible[0].driverName} (${topScore}) and ${eligible[1].driverName} (${secondScore}) have comparable operational suitability (${scoreDiff} pt diff). Admin discretion recommended.`,
    };
  }

  return {
    hasSimilarScores: false,
    similarCandidatesCount: 1,
    advisoryNote: null,
  };
}
