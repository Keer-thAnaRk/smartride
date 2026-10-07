/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔄 DRIVER NO-SHOW & AUTOMATED CONTINGENCY ENGINE — TYPE DEFINITIONS
 * ══════════════════════════════════════════════════════════════════════════════
 */

export type CheckInStatus =
  | 'EXPECTED'
  | 'CHECKED_IN'
  | 'LATE'
  | 'NO_SHOW_RISK'
  | 'NO_SHOW_CONFIRMED'
  | 'REPLACED'
  | 'PRIMARY_RETURNED';

export type CoverageEventStatus =
  | 'NO_SHOW_RISK'
  | 'NO_SHOW_CONFIRMED'
  | 'REPLACED'
  | 'RESOLVED'
  | 'CANCELLED';

export interface DriverCheckInInfo {
  tripId: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  driverId: string;
  driverName: string;
  driverPhone?: string;
  scheduledDispatch: string; // e.g. "08:00 AM"
  checkInDeadline: string;   // e.g. "07:45 AM"
  status: CheckInStatus;
  checkedInAt?: string | null;
  minutesUntilDeadline: number;
  minutesPastDeadline: number;
  isPotentialNoShow: boolean;
  notes?: string | null;
}

export interface CandidateScoreBreakdown {
  availabilityScore: number;     // 0 - 100
  routeScore: number;            // 0 - 100
  proximityScore: number;        // 0 - 100
  shiftScore: number;            // 0 - 100
  vehicleScore: number;          // 0 - 100
  rawWeightedScore: number;      // 0 - 100
}

export interface StandbyCandidate {
  driverId: string;
  driverName: string;
  driverPhone?: string | null;
  driverAvatar?: string | null;
  experienceYears: number;
  rating: number;
  isVerified: boolean;
  status: string;                // AVAILABLE, etc.
  distanceKm: number;            // Distance to route pickup origin
  isSimulatedDistance?: boolean;
  corridorQualified: boolean;
  assignedRouteCode?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  licensePlate?: string | null;
  vehicleCapacity?: number;
  isEligible: boolean;
  ineligibilityReason?: string | null;
  scores: CandidateScoreBreakdown;
  suitabilityScore: number;      // Final 0 - 100 rounded
  recommendationReason: string;
  caveatNotes?: string[];
}

export interface CandidateEvaluationResult {
  tripId: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  primaryDriverId: string;
  primaryDriverName: string;
  scheduledDispatch: string;
  checkInDeadline: string;
  currentCheckInStatus: CheckInStatus;
  recommendedDriver: StandbyCandidate | null;
  allCandidates: StandbyCandidate[];
  hasSimilarScores: boolean;
  similarCandidatesCount: number;
  advisoryNote?: string | null;
  evaluatedAt: string;
}

export interface FleetCoverageSummary {
  tripsToday: number;
  checkedInCount: number;
  expectedCount: number;
  lateCount: number;
  noShowRiskCount: number;
  replacementsCount: number;
  activeAlerts: DriverCheckInInfo[];
}
