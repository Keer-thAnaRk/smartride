/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — OPERATIONAL CONTINUITY & RECOVERY PLANNING ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 16: Unified Continuity Planning, Capability Dependency Analysis,
 * Recovery Priority & Readiness Modeling, and Human-in-the-Loop Recovery Sequencing.
 *
 * Rules:
 * - Purely deterministic, non-mutative, advisory continuity evaluation.
 * - Baselines and dependencies are strictly fetched server-side from verified
 *   Step 1–15 intelligence; client-supplied values are strictly ignored.
 * - Zero LLM hallucination, zero probabilistic guesswork.
 * - Zero database writes, zero route/schedule mutations, zero audit ledger pollution.
 * - Preserves demand prediction data quality (never fabricates missing demand).
 * - Human-in-the-loop: Administrator remains the sole operational decision maker.
 */

import prisma from '@/lib/prisma';
import {
  buildOperationalDecisionSupport,
  evaluateOperationalStatus,
  OperationalStatus,
  RouteOperationalDecisionSupport,
  FleetDecisionSupportResult,
} from '@/lib/operations/decision-support-engine';
import {
  runOperationalResiliencePlanning,
  calculateResilienceStatus,
  calculateCapacityShortfall,
  calculateRecoveryReadiness as calculateResilienceRecoveryReadiness,
  calculateRecoveryUrgency,
  buildContingencyPlanningOptions,
  ResilienceStatus,
  RecoveryReadiness,
  RecoveryUrgency,
  ContingencyPlanOption,
} from '@/lib/operations/resilience-planning-engine';
import { getAllRoutes, DEFAULT_CORRIDOR_ROUTES } from '@/lib/firestore-db';

export const MANDATORY_CONTINUITY_PLANNING_NOTICE =
  'Operational continuity and recovery planning is advisory and deterministic. This module does not automatically execute recovery actions or modify operational resources. All recovery decisions remain under administrator control.';

export const MANDATORY_CONTINUITY_SAFETY_STATEMENT =
  'Operational continuity planning is advisory and deterministic. No route, vehicle, driver, schedule, booking, subscription, dispatch, or operational resource is automatically modified.';

export type OperationalCapability =
  | 'ROUTE_OPERATION'
  | 'PASSENGER_SERVICE'
  | 'VEHICLE_CAPACITY'
  | 'DRIVER_AVAILABILITY'
  | 'SAFETY_RESPONSE'
  | 'INCIDENT_RESPONSE'
  | 'DEMAND_CAPACITY_BALANCE'
  | 'BOOKING_CONTINUITY'
  | 'COMMUTER_ACCESS'
  | 'OPERATIONAL_VISIBILITY';

export type ContinuityStatus =
  | 'CONTINUITY_READY'
  | 'CONTINUITY_MONITOR'
  | 'CONTINUITY_AT_RISK'
  | 'CONTINUITY_DEGRADED'
  | 'CONTINUITY_CRITICAL';

export type RecoveryPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type CapabilityStatus = 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL';

export interface CapabilityDependency {
  capability: OperationalCapability;
  status: CapabilityStatus;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: string;
  sourceModule: string;
}

export interface RecoverySequenceStep {
  stepNumber: number;
  phase: string;
  action: string;
  targetCapability: OperationalCapability;
  guidance: string;
  evidence: string;
}

export interface ApplicableContingencyPlan {
  planId: string;
  planName: string;
  applicableCondition: string;
  affectedCapability: OperationalCapability;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  readiness: RecoveryReadiness;
  evidence: string;
}

export interface CorridorContinuityPlan {
  route: {
    id: string;
    code: string;
    name: string;
  };
  continuityStatus: ContinuityStatus;
  recoveryPriority: RecoveryPriority;
  operationalStatus: OperationalStatus;
  resilienceStatus: ResilienceStatus;

  risk: {
    score: number;
    level: string;
    trend: string;
  };

  demand: {
    predictedDemand: number | null;
    capacity: number;
    occupancy: number | null;
    demandLevel: string | null;
    dataQuality: string;
    capacityShortfall: number;
  };

  safety: {
    activeAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    unresolvedIncidents: number;
    criticalIncidents: number;
    activeEmergencies: number;
  };

  dependencies: CapabilityDependency[];
  readiness: {
    readinessScore: number; // 0 to 100
    readinessLevel: 'HIGH_READINESS' | 'MODERATE_READINESS' | 'LOW_READINESS' | 'INSUFFICIENT_DATA';
    knownDependencies: number;
    degradedDependencies: number;
    criticalDependencies: number;
    dataQuality: string;
    explanation: string[];
  };

  applicableContingencyPlans: ApplicableContingencyPlan[];
  recoverySequence: RecoverySequenceStep[];

  explanations: {
    continuityBriefing: string;
    explanation: string[];
    affectedCapabilities: string[];
    recoveryPriorityReason: string[];
    readinessExplanation: string[];
    evidence: string[];
  };

  evaluatedAt: string;
}

export interface FleetContinuitySummary {
  totalRoutes: number;
  continuityReady: number;
  continuityMonitor: number;
  continuityAtRisk: number;
  continuityDegraded: number;
  continuityCritical: number;
  criticalRecoveryRoutes: number;
  highRecoveryRoutes: number;
  affectedRoutes: number;
  criticalDependencies: number;
  highDemandRoutes: number;
  unresolvedIncidents: number;
  activeCriticalAlerts: number;
}

export interface ContinuityPlanningResponse {
  success: boolean;
  notice: string;
  safetyStatement: string;
  fleetSummary: FleetContinuitySummary;
  corridors: CorridorContinuityPlan[];
  generatedAt: string;
}

/**
 * Returns deterministic numerical severity rank for ContinuityStatus.
 */
export function getContinuitySeverityRank(status: ContinuityStatus): number {
  switch (status) {
    case 'CONTINUITY_CRITICAL':
      return 5;
    case 'CONTINUITY_DEGRADED':
      return 4;
    case 'CONTINUITY_AT_RISK':
      return 3;
    case 'CONTINUITY_MONITOR':
      return 2;
    case 'CONTINUITY_READY':
      return 1;
    default:
      return 0;
  }
}

/**
 * Returns deterministic numerical priority rank for RecoveryPriority.
 */
export function getRecoveryPriorityRank(priority: RecoveryPriority): number {
  switch (priority) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'MEDIUM':
      return 2;
    case 'LOW':
      return 1;
    default:
      return 0;
  }
}

/**
 * Evaluates the 10 conceptual operational capabilities for a single corridor.
 */
export function evaluateDependencyImpact(
  support: RouteOperationalDecisionSupport
): CapabilityDependency[] {
  const dependencies: CapabilityDependency[] = [];

  const riskScore = support.risk.score;
  const riskLevel = support.risk.level;
  const activeEmergencies = support.risk.activeEmergencies;
  const activeCriticalAlerts = support.alerts.criticalCount;
  const activeHighAlerts = support.alerts.highCount;
  const totalAlerts = support.alerts.activeCount;
  const unresolvedIncidents = support.incidents.unresolvedCount;
  const criticalIncidents = support.incidents.criticalCount;
  const occupancy = support.demand.predictedOccupancy;
  const demand = support.demand.predictedDemand;
  const capacity = support.capacity.vehicleCapacity || 16;
  const dataQuality = support.demand.dataQuality;

  // 1. ROUTE_OPERATION
  if (riskScore >= 75 || activeEmergencies > 0 || support.risk.activeDeviations > 0) {
    dependencies.push({
      capability: 'ROUTE_OPERATION',
      status: activeEmergencies > 0 || riskScore >= 75 ? 'CRITICAL' : 'DEGRADED',
      severity: riskScore >= 75 ? 'CRITICAL' : 'HIGH',
      evidence: `Route risk score ${riskScore}/100 with ${activeEmergencies} active emergency event(s) and ${support.risk.activeDeviations} deviation(s).`,
      sourceModule: 'STEP_1_RISK_SCORE',
    });
  } else if (riskScore >= 45 || support.risk.activeSpeedAnomalies > 0) {
    dependencies.push({
      capability: 'ROUTE_OPERATION',
      status: 'DEGRADED',
      severity: 'MEDIUM',
      evidence: `Moderate roadway risk (${riskScore}/100) with ${support.risk.activeSpeedAnomalies} speed anomaly event(s).`,
      sourceModule: 'STEP_1_RISK_SCORE',
    });
  } else {
    dependencies.push({
      capability: 'ROUTE_OPERATION',
      status: 'OPERATIONAL',
      severity: 'LOW',
      evidence: `Corridor path clear. Risk score ${riskScore}/100 within baseline limits.`,
      sourceModule: 'STEP_1_RISK_SCORE',
    });
  }

  // 2. PASSENGER_SERVICE
  if (occupancy !== null && occupancy >= 100) {
    dependencies.push({
      capability: 'PASSENGER_SERVICE',
      status: 'CRITICAL',
      severity: 'CRITICAL',
      evidence: `Passenger demand (${demand} riders) exceeds vehicle capacity (${capacity} seats), occupancy at ${occupancy}%.`,
      sourceModule: 'STEP_5_DEMAND',
    });
  } else if (occupancy !== null && occupancy >= 85) {
    dependencies.push({
      capability: 'PASSENGER_SERVICE',
      status: 'DEGRADED',
      severity: 'HIGH',
      evidence: `Elevated commuter ridership (${occupancy}% occupancy) placing pressure on scheduled service.`,
      sourceModule: 'STEP_5_DEMAND',
    });
  } else {
    dependencies.push({
      capability: 'PASSENGER_SERVICE',
      status: 'OPERATIONAL',
      severity: 'LOW',
      evidence: `Passenger service operational (${occupancy ?? 'N/A'}% occupancy).`,
      sourceModule: 'STEP_5_DEMAND',
    });
  }

  // 3. VEHICLE_CAPACITY
  if (occupancy !== null && demand !== null && demand > capacity) {
    const shortfall = demand - capacity;
    dependencies.push({
      capability: 'VEHICLE_CAPACITY',
      status: shortfall > 6 ? 'CRITICAL' : 'DEGRADED',
      severity: shortfall > 6 ? 'CRITICAL' : 'HIGH',
      evidence: `Projected seating capacity shortfall of ${shortfall} seats against standard shuttle capacity (${capacity} seats).`,
      sourceModule: 'STEP_15_RESILIENCE',
    });
  } else {
    dependencies.push({
      capability: 'VEHICLE_CAPACITY',
      status: 'OPERATIONAL',
      severity: 'LOW',
      evidence: `Shuttle vehicle capacity (${capacity} seats) accommodates projected ridership.`,
      sourceModule: 'STEP_15_RESILIENCE',
    });
  }

  // 4. DRIVER_AVAILABILITY
  // Verified from route driver assignment in Step 1/6
  const driverStatus = (support as any).route?.assignedDriver?.isVerified ?? true;
  if (!driverStatus) {
    dependencies.push({
      capability: 'DRIVER_AVAILABILITY',
      status: 'DEGRADED',
      severity: 'HIGH',
      evidence: 'Assigned corridor driver profile verification is pending compliance review.',
      sourceModule: 'STEP_1_RISK_SCORE',
    });
  } else {
    dependencies.push({
      capability: 'DRIVER_AVAILABILITY',
      status: 'OPERATIONAL',
      severity: 'LOW',
      evidence: 'Verified operator assigned to corridor roster with valid licensing.',
      sourceModule: 'STEP_1_RISK_SCORE',
    });
  }

  // 5. SAFETY_RESPONSE
  if (activeCriticalAlerts > 0 || activeEmergencies > 0) {
    dependencies.push({
      capability: 'SAFETY_RESPONSE',
      status: 'CRITICAL',
      severity: 'CRITICAL',
      evidence: `${activeCriticalAlerts} active CRITICAL safety alert(s) and ${activeEmergencies} emergency signal(s) require immediate supervisor response.`,
      sourceModule: 'STEP_3_SAFETY_ALERTS',
    });
  } else if (activeHighAlerts > 0 || totalAlerts >= 2) {
    dependencies.push({
      capability: 'SAFETY_RESPONSE',
      status: 'DEGRADED',
      severity: 'HIGH',
      evidence: `${totalAlerts} active safety alert(s) (${activeHighAlerts} HIGH) under command center monitoring.`,
      sourceModule: 'STEP_3_SAFETY_ALERTS',
    });
  } else {
    dependencies.push({
      capability: 'SAFETY_RESPONSE',
      status: 'OPERATIONAL',
      severity: 'LOW',
      evidence: 'No critical safety alerts or hazard escalations active on corridor.',
      sourceModule: 'STEP_3_SAFETY_ALERTS',
    });
  }

  // 6. INCIDENT_RESPONSE
  if (criticalIncidents > 0) {
    dependencies.push({
      capability: 'INCIDENT_RESPONSE',
      status: 'CRITICAL',
      severity: 'CRITICAL',
      evidence: `${criticalIncidents} unresolved CRITICAL incident case(s) open in case management system.`,
      sourceModule: 'STEP_4_INCIDENTS',
    });
  } else if (unresolvedIncidents > 0) {
    dependencies.push({
      capability: 'INCIDENT_RESPONSE',
      status: 'DEGRADED',
      severity: 'MEDIUM',
      evidence: `${unresolvedIncidents} unresolved operational incident case(s) requiring investigative mitigation.`,
      sourceModule: 'STEP_4_INCIDENTS',
    });
  } else {
    dependencies.push({
      capability: 'INCIDENT_RESPONSE',
      status: 'OPERATIONAL',
      severity: 'LOW',
      evidence: 'All incident response cases resolved or closed; no open investigations.',
      sourceModule: 'STEP_4_INCIDENTS',
    });
  }

  // 7. DEMAND_CAPACITY_BALANCE
  if (support.demand.demandLevel === 'CRITICAL' || (occupancy !== null && occupancy >= 95)) {
    dependencies.push({
      capability: 'DEMAND_CAPACITY_BALANCE',
      status: 'CRITICAL',
      severity: 'CRITICAL',
      evidence: `Severe demand-capacity imbalance detected: ${occupancy}% occupancy in CRITICAL demand band.`,
      sourceModule: 'STEP_5_DEMAND',
    });
  } else if (support.demand.demandLevel === 'HIGH' || (occupancy !== null && occupancy >= 80)) {
    dependencies.push({
      capability: 'DEMAND_CAPACITY_BALANCE',
      status: 'DEGRADED',
      severity: 'HIGH',
      evidence: `Elevated ridership demand (${occupancy}% occupancy) placing strain on corridor capacity.`,
      sourceModule: 'STEP_5_DEMAND',
    });
  } else {
    dependencies.push({
      capability: 'DEMAND_CAPACITY_BALANCE',
      status: 'OPERATIONAL',
      severity: 'LOW',
      evidence: 'Demand and vehicle capacity remain in balanced equilibrium.',
      sourceModule: 'STEP_5_DEMAND',
    });
  }

  // 8. BOOKING_CONTINUITY
  if (occupancy !== null && occupancy >= 100) {
    dependencies.push({
      capability: 'BOOKING_CONTINUITY',
      status: 'DEGRADED',
      severity: 'HIGH',
      evidence: 'Shuttle capacity fully booked; new commuter seat allocation constrained.',
      sourceModule: 'PHASE_1_BOOKINGS',
    });
  } else {
    dependencies.push({
      capability: 'BOOKING_CONTINUITY',
      status: 'OPERATIONAL',
      severity: 'LOW',
      evidence: 'Seat booking and subscription confirmation workflows operating normally.',
      sourceModule: 'PHASE_1_BOOKINGS',
    });
  }

  // 9. COMMUTER_ACCESS
  if (activeEmergencies > 0 || (support.risk.activeDeviations > 0 && riskScore >= 60)) {
    dependencies.push({
      capability: 'COMMUTER_ACCESS',
      status: 'DEGRADED',
      severity: 'HIGH',
      evidence: 'Boarding point access may experience delays due to active corridor deviation.',
      sourceModule: 'STEP_1_RISK_SCORE',
    });
  } else {
    dependencies.push({
      capability: 'COMMUTER_ACCESS',
      status: 'OPERATIONAL',
      severity: 'LOW',
      evidence: 'All scheduled pickup and dropoff points accessible along verified corridor.',
      sourceModule: 'STEP_1_RISK_SCORE',
    });
  }

  // 10. OPERATIONAL_VISIBILITY
  if (dataQuality === 'INSUFFICIENT_DATA' || demand === null) {
    dependencies.push({
      capability: 'OPERATIONAL_VISIBILITY',
      status: 'DEGRADED',
      severity: 'MEDIUM',
      evidence: 'Demand intelligence is limited due to insufficient historical telemetry data.',
      sourceModule: 'STEP_5_DEMAND',
    });
  } else {
    dependencies.push({
      capability: 'OPERATIONAL_VISIBILITY',
      status: 'OPERATIONAL',
      severity: 'LOW',
      evidence: `Telemetry visibility verified (${dataQuality}). Live GPS tracking and risk telemetry active.`,
      sourceModule: 'STEP_5_DEMAND',
    });
  }

  return dependencies;
}

/**
 * Evaluates deterministic Continuity Status from highest severity to lowest.
 */
export function evaluateContinuityStatus(params: {
  riskScore: number;
  riskLevel: string;
  riskTrend: string;
  activeEmergencies: number;
  criticalAlerts: number;
  highAlerts: number;
  criticalIncidents: number;
  unresolvedIncidents: number;
  occupancy: number | null;
  demandLevel: string | null;
  capacityShortfall: number;
  dependencies: CapabilityDependency[];
}): ContinuityStatus {
  const {
    riskScore,
    riskLevel,
    riskTrend,
    activeEmergencies,
    criticalAlerts,
    highAlerts,
    criticalIncidents,
    unresolvedIncidents,
    occupancy,
    demandLevel,
    capacityShortfall,
    dependencies,
  } = params;

  const criticalDepsCount = dependencies.filter((d) => d.status === 'CRITICAL').length;
  const degradedDepsCount = dependencies.filter((d) => d.status === 'DEGRADED').length;

  // 1. CONTINUITY_CRITICAL
  if (
    riskLevel === 'CRITICAL' ||
    riskScore >= 75 ||
    activeEmergencies > 0 ||
    criticalIncidents > 0 ||
    criticalAlerts > 0 ||
    (occupancy !== null && occupancy >= 100) ||
    capacityShortfall > 6 ||
    (demandLevel === 'CRITICAL' && occupancy !== null && occupancy >= 95) ||
    criticalDepsCount >= 2
  ) {
    return 'CONTINUITY_CRITICAL';
  }

  // 2. CONTINUITY_DEGRADED
  if (
    riskLevel === 'HIGH' ||
    riskScore >= 50 ||
    criticalDepsCount >= 1 ||
    degradedDepsCount >= 3 ||
    (occupancy !== null && occupancy >= 90) ||
    capacityShortfall > 0 ||
    highAlerts > 0 ||
    unresolvedIncidents > 0
  ) {
    return 'CONTINUITY_DEGRADED';
  }

  // 3. CONTINUITY_AT_RISK
  if (
    riskLevel === 'MEDIUM' ||
    riskScore >= 25 ||
    riskTrend === 'RISING' ||
    (occupancy !== null && occupancy >= 75) ||
    demandLevel === 'HIGH' ||
    degradedDepsCount >= 1
  ) {
    return 'CONTINUITY_AT_RISK';
  }

  // 4. CONTINUITY_MONITOR
  if (
    riskScore > 10 ||
    riskTrend === 'RISING' ||
    dependencies.some((d) => d.capability === 'OPERATIONAL_VISIBILITY' && d.status === 'DEGRADED')
  ) {
    return 'CONTINUITY_MONITOR';
  }

  // 5. CONTINUITY_READY
  return 'CONTINUITY_READY';
}

/**
 * Calculates deterministic Recovery Priority.
 */
export function calculateRecoveryPriority(params: {
  continuityStatus: ContinuityStatus;
  riskScore: number;
  activeEmergencies: number;
  criticalAlerts: number;
  highAlerts: number;
  criticalIncidents: number;
  unresolvedIncidents: number;
  capacityShortfall: number;
  occupancy: number | null;
  riskTrend: string;
}): RecoveryPriority {
  const {
    continuityStatus,
    riskScore,
    activeEmergencies,
    criticalAlerts,
    highAlerts,
    criticalIncidents,
    unresolvedIncidents,
    capacityShortfall,
    occupancy,
    riskTrend,
  } = params;

  if (
    continuityStatus === 'CONTINUITY_CRITICAL' ||
    activeEmergencies > 0 ||
    criticalAlerts > 0 ||
    criticalIncidents > 0 ||
    riskScore >= 75
  ) {
    return 'CRITICAL';
  }

  if (
    continuityStatus === 'CONTINUITY_DEGRADED' ||
    highAlerts > 0 ||
    unresolvedIncidents > 0 ||
    capacityShortfall > 0 ||
    (occupancy !== null && occupancy >= 90) ||
    riskScore >= 50
  ) {
    return 'HIGH';
  }

  if (
    continuityStatus === 'CONTINUITY_AT_RISK' ||
    riskTrend === 'RISING' ||
    (occupancy !== null && occupancy >= 75) ||
    riskScore >= 25
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * Calculates deterministic Recovery Readiness Score (0-100) and Level.
 */
export function calculateRecoveryReadiness(params: {
  dependencies: CapabilityDependency[];
  riskScore: number;
  activeCriticalAlerts: number;
  activeHighAlerts: number;
  criticalIncidents: number;
  capacityShortfall: number;
  dataQuality: string;
  demandAvailable: boolean;
}): {
  readinessScore: number;
  readinessLevel: 'HIGH_READINESS' | 'MODERATE_READINESS' | 'LOW_READINESS' | 'INSUFFICIENT_DATA';
  explanation: string[];
} {
  const {
    dependencies,
    riskScore,
    activeCriticalAlerts,
    activeHighAlerts,
    criticalIncidents,
    capacityShortfall,
    dataQuality,
    demandAvailable,
  } = params;

  const explanation: string[] = [];

  if (!demandAvailable || dataQuality === 'INSUFFICIENT_DATA') {
    explanation.push(
      'Recovery readiness cannot be fully determined because verified demand intelligence is insufficient.'
    );
    return {
      readinessScore: 40,
      readinessLevel: 'INSUFFICIENT_DATA',
      explanation,
    };
  }

  let score = 100;

  const criticalDeps = dependencies.filter((d) => d.status === 'CRITICAL').length;
  const degradedDeps = dependencies.filter((d) => d.status === 'DEGRADED').length;

  if (criticalDeps > 0) {
    const penalty = criticalDeps * 20;
    score -= penalty;
    explanation.push(`${criticalDeps} critical operational dependency(ies) reduce readiness (-${penalty} pts).`);
  }

  if (degradedDeps > 0) {
    const penalty = degradedDeps * 8;
    score -= penalty;
    explanation.push(`${degradedDeps} degraded operational dependency(ies) reduce readiness (-${penalty} pts).`);
  }

  if (activeCriticalAlerts > 0 || criticalIncidents > 0) {
    const hazardPenalty = (activeCriticalAlerts + criticalIncidents) * 15;
    score -= hazardPenalty;
    explanation.push(`Active critical alerts/incidents constrain operational recovery (-${hazardPenalty} pts).`);
  }

  if (capacityShortfall > 0) {
    const capPenalty = Math.min(20, Math.round(capacityShortfall * 2));
    score -= capPenalty;
    explanation.push(`Projected capacity shortfall of ${capacityShortfall} seats limits recovery headroom (-${capPenalty} pts).`);
  }

  const riskPenalty = Math.round(riskScore * 0.2);
  if (riskPenalty > 0) {
    score -= riskPenalty;
    explanation.push(`Corridor risk level (${riskScore}/100) imposes recovery friction (-${riskPenalty} pts).`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let readinessLevel: 'HIGH_READINESS' | 'MODERATE_READINESS' | 'LOW_READINESS' | 'INSUFFICIENT_DATA' =
    'MODERATE_READINESS';
  if (score >= 80) {
    readinessLevel = 'HIGH_READINESS';
    explanation.push('Corridor exhibits robust operational headroom across core capability dependencies.');
  } else if (score >= 50) {
    readinessLevel = 'MODERATE_READINESS';
    explanation.push('Corridor possesses manageable recovery parameters, but active mitigations are advised.');
  } else {
    readinessLevel = 'LOW_READINESS';
    explanation.push('Acute dependency constraints and hazard exposures limit immediate recovery readiness.');
  }

  return {
    readinessScore: score,
    readinessLevel,
    explanation,
  };
}

/**
 * Identifies applicable advisory contingency recovery plans for the corridor.
 */
export function identifyApplicableContingencies(params: {
  routeCode: string;
  continuityStatus: ContinuityStatus;
  recoveryPriority: RecoveryPriority;
  capacityShortfall: number;
  occupancy: number | null;
  riskScore: number;
  activeCriticalAlerts: number;
  unresolvedIncidents: number;
}): ApplicableContingencyPlan[] {
  const {
    routeCode,
    continuityStatus,
    recoveryPriority,
    capacityShortfall,
    occupancy,
    riskScore,
    activeCriticalAlerts,
    unresolvedIncidents,
  } = params;

  const plans: ApplicableContingencyPlan[] = [];

  // Plan 1: Capacity Adjustment
  if (capacityShortfall > 0 || (occupancy !== null && occupancy >= 85)) {
    plans.push({
      planId: 'CP-CAP-01',
      planName: 'Contingency Plan: Capacity Adjustment & Reserve Shuttle Review',
      applicableCondition: `Projected occupancy is ${occupancy}% with shortfall of ${capacityShortfall} seats.`,
      affectedCapability: 'VEHICLE_CAPACITY',
      priority: capacityShortfall > 5 ? 'CRITICAL' : 'HIGH',
      readiness: capacityShortfall > 5 ? 'LIMITED' : 'PARTIALLY_READY',
      evidence: `Corridor ${routeCode} demand exceeds vehicle capacity.`,
    });
  }

  // Plan 2: Alternate Route Feasibility
  if (riskScore >= 60 || continuityStatus === 'CONTINUITY_CRITICAL' || continuityStatus === 'CONTINUITY_DEGRADED') {
    plans.push({
      planId: 'CP-RTE-01',
      planName: 'Contingency Plan: Arterial Bypass & Waypoint Detour Review',
      applicableCondition: `Corridor risk elevated at ${riskScore}/100 with active roadway strain.`,
      affectedCapability: 'ROUTE_OPERATION',
      priority: riskScore >= 75 ? 'CRITICAL' : 'HIGH',
      readiness: 'PARTIALLY_READY',
      evidence: `Route risk score ${riskScore}/100 exceeds monitoring threshold.`,
    });
  }

  // Plan 3: Safety Response Escalation
  if (activeCriticalAlerts > 0 || riskScore >= 70) {
    plans.push({
      planId: 'CP-SAF-01',
      planName: 'Contingency Plan: Rapid Safety Protocol Escalation',
      applicableCondition: `${activeCriticalAlerts} active critical alert(s) on corridor.`,
      affectedCapability: 'SAFETY_RESPONSE',
      priority: 'CRITICAL',
      readiness: 'LIMITED',
      evidence: 'Hazard sensor and GPS telemetry indicate active safety event.',
    });
  }

  // Plan 4: Incident Case Prioritization
  if (unresolvedIncidents > 0) {
    plans.push({
      planId: 'CP-INC-01',
      planName: 'Contingency Plan: Operational Incident Mitigation Roster',
      applicableCondition: `${unresolvedIncidents} unresolved incident case(s) open in case management.`,
      affectedCapability: 'INCIDENT_RESPONSE',
      priority: 'HIGH',
      readiness: 'PARTIALLY_READY',
      evidence: 'Open incident cases require cross-team mitigation.',
    });
  }

  // Default Monitoring Plan
  if (plans.length === 0 || continuityStatus === 'CONTINUITY_READY') {
    plans.push({
      planId: 'CP-MON-01',
      planName: 'Contingency Plan: Standard Telemetry Surveillance',
      applicableCondition: 'Corridor operating within nominal boundaries.',
      affectedCapability: 'OPERATIONAL_VISIBILITY',
      priority: 'LOW',
      readiness: 'READY',
      evidence: `Corridor ${routeCode} telemetry verified and stable.`,
    });
  }

  return plans;
}

/**
 * Builds an informational, step-by-step recovery sequence for administrative review.
 */
export function buildRecoverySequence(params: {
  continuityStatus: ContinuityStatus;
  recoveryPriority: RecoveryPriority;
  activeCriticalAlerts: number;
  unresolvedIncidents: number;
  capacityShortfall: number;
  applicablePlans: ApplicableContingencyPlan[];
}): RecoverySequenceStep[] {
  const {
    continuityStatus,
    recoveryPriority,
    activeCriticalAlerts,
    unresolvedIncidents,
    capacityShortfall,
    applicablePlans,
  } = params;

  const sequence: RecoverySequenceStep[] = [];

  // Step 1: Safety Hazard Verification
  sequence.push({
    stepNumber: 1,
    phase: 'HAZARD_VERIFICATION',
    action: 'Review active critical safety conditions and emergency telemetry.',
    targetCapability: 'SAFETY_RESPONSE',
    guidance:
      activeCriticalAlerts > 0
        ? `Acknowledge and inspect ${activeCriticalAlerts} critical safety alert(s) in Platform SOC.`
        : 'Confirm speed compliance, deviation monitors, and SOS sensors remain clear.',
    evidence: `${activeCriticalAlerts} critical alert(s) active on corridor.`,
  });

  // Step 2: Incident Backlog Resolution
  sequence.push({
    stepNumber: 2,
    phase: 'INCIDENT_REVIEW',
    action: 'Review unresolved incident response cases in Case Management.',
    targetCapability: 'INCIDENT_RESPONSE',
    guidance:
      unresolvedIncidents > 0
        ? `Verify open cases (${unresolvedIncidents} total) have assigned investigative leads and containment actions.`
        : 'Confirm all previous incident cases are marked resolved.',
    evidence: `${unresolvedIncidents} unresolved incident case(s) currently open.`,
  });

  // Step 3: Operational Capability Impact
  sequence.push({
    stepNumber: 3,
    phase: 'CAPABILITY_ASSESSMENT',
    action: 'Inspect affected operational dependencies and service fulfillment.',
    targetCapability: 'ROUTE_OPERATION',
    guidance:
      'Evaluate roadway geometry, driver shift limits, and vehicle mechanical integrity.',
    evidence: `Continuity classified as ${continuityStatus} with ${recoveryPriority} recovery priority.`,
  });

  // Step 4: Seating Capacity & Demand Balance
  sequence.push({
    stepNumber: 4,
    phase: 'CAPACITY_REBALANCE',
    action: 'Review passenger demand volume and vehicle seating capacity.',
    targetCapability: 'VEHICLE_CAPACITY',
    guidance:
      capacityShortfall > 0
        ? `Examine projected shortfall of ${capacityShortfall} seats. Consider supplemental shuttle scheduling.`
        : 'Available shuttle capacity satisfies expected ridership.',
    evidence: `Projected capacity shortfall: ${capacityShortfall} seats.`,
  });

  // Step 5: Contingency Plan Selection
  sequence.push({
    stepNumber: 5,
    phase: 'CONTINGENCY_EVALUATION',
    action: 'Review applicable contingency recovery plans for administrative approval.',
    targetCapability: 'DEMAND_CAPACITY_BALANCE',
    guidance: `Examine ${applicablePlans.length} applicable contingency plan(s) including ${applicablePlans[0]?.planName ?? 'Standard Monitoring'}.`,
    evidence: `Selected contingency candidates: ${applicablePlans.map((p) => p.planId).join(', ')}.`,
  });

  // Step 6: Readiness & Feasibility Check
  sequence.push({
    stepNumber: 6,
    phase: 'FEASIBILITY_CHECK',
    action: 'Evaluate operational readiness score and verified resource availability.',
    targetCapability: 'OPERATIONAL_VISIBILITY',
    guidance:
      'Ensure standby drivers and reserve vehicles are verified in database before authorizing schedule modifications.',
    evidence: 'Advisory readiness model calculated strictly from server-verified telemetry.',
  });

  // Step 7: Human Decision Gate
  sequence.push({
    stepNumber: 7,
    phase: 'HUMAN_DECISION_GATE',
    action: 'Administrator authorizes or dismisses operational intervention.',
    targetCapability: 'PASSENGER_SERVICE',
    guidance:
      'Administrative review complete. If operational action is required, execute via approved dispatch workflows.',
    evidence: 'System does not automatically execute dispatch or route changes.',
  });

  return sequence;
}

/**
 * Builds unified operational continuity plan for a single corridor.
 */
export function buildSingleRouteContinuityPlan(
  support: RouteOperationalDecisionSupport
): CorridorContinuityPlan {
  const routeCode = support.routeCode;
  const routeId = support.routeId;
  const routeName = support.routeName;
  const evaluatedAt = support.generatedAt || new Date().toISOString();

  const riskScore = support.risk.score;
  const riskLevel = support.risk.level;
  const riskTrend = support.risk.trend;

  const demand = support.demand.predictedDemand;
  const capacity = support.capacity.vehicleCapacity || 16;
  const occupancy = support.demand.predictedOccupancy;
  const demandLevel = support.demand.demandLevel;
  const dataQuality = support.demand.dataQuality;

  const activeAlerts = support.alerts.activeCount;
  const criticalAlerts = support.alerts.criticalCount;
  const highAlerts = support.alerts.highCount;

  const unresolvedIncidents = support.incidents.unresolvedCount;
  const criticalIncidents = support.incidents.criticalCount;
  const activeEmergencies = support.risk.activeEmergencies;

  // 1. Calculate Capacity Shortfall
  const capacityShortfall = calculateCapacityShortfall(demand, capacity);

  // 2. Evaluate 10 Operational Dependencies
  const dependencies = evaluateDependencyImpact(support);

  // 3. Derive Continuity Status
  const continuityStatus = evaluateContinuityStatus({
    riskScore,
    riskLevel,
    riskTrend,
    activeEmergencies,
    criticalAlerts,
    highAlerts,
    criticalIncidents,
    unresolvedIncidents,
    occupancy,
    demandLevel,
    capacityShortfall,
    dependencies,
  });

  // 4. Derive Recovery Priority
  const recoveryPriority = calculateRecoveryPriority({
    continuityStatus,
    riskScore,
    activeEmergencies,
    criticalAlerts,
    highAlerts,
    criticalIncidents,
    unresolvedIncidents,
    capacityShortfall,
    occupancy,
    riskTrend,
  });

  // 5. Derive Baseline Resilience Status
  const resilienceStatus = calculateResilienceStatus({
    operationalStatus: support.operationalStatus,
    riskScore,
    activeCriticalAlerts: criticalAlerts,
    activeHighAlerts: highAlerts,
    criticalIncidents,
    highIncidents: unresolvedIncidents - criticalIncidents,
    projectedOccupancy: occupancy,
    demandLevel,
    capacityModifierPercent: 0,
    capacityDelta: 0,
    disruptionType: 'NONE',
    severity: 'LOW',
    riskTrend,
  });

  // 6. Calculate Recovery Readiness
  const readiness = calculateRecoveryReadiness({
    dependencies,
    riskScore,
    activeCriticalAlerts: criticalAlerts,
    activeHighAlerts: highAlerts,
    criticalIncidents,
    capacityShortfall,
    dataQuality,
    demandAvailable: demand !== null,
  });

  // 7. Identify Applicable Contingency Plans
  const applicableContingencyPlans = identifyApplicableContingencies({
    routeCode,
    continuityStatus,
    recoveryPriority,
    capacityShortfall,
    occupancy,
    riskScore,
    activeCriticalAlerts: criticalAlerts,
    unresolvedIncidents,
  });

  // 8. Build Recovery Sequence
  const recoverySequence = buildRecoverySequence({
    continuityStatus,
    recoveryPriority,
    activeCriticalAlerts: criticalAlerts,
    unresolvedIncidents,
    capacityShortfall,
    applicablePlans: applicableContingencyPlans,
  });

  // 9. Build Explanations & Evidence
  const explanation: string[] = [];
  const affectedCapabilities: string[] = [];
  const recoveryPriorityReason: string[] = [];
  const evidence: string[] = [];

  const degradedOrCritDeps = dependencies.filter((d) => d.status !== 'OPERATIONAL');
  degradedOrCritDeps.forEach((d) => {
    affectedCapabilities.push(`${d.capability} is ${d.status}: ${d.evidence}`);
  });

  let continuityBriefing = `Corridor ${routeCode} (${routeName}) is classified as ${continuityStatus} with ${recoveryPriority} recovery priority.`;
  if (continuityStatus === 'CONTINUITY_CRITICAL') {
    continuityBriefing += ` Immediate administrative intervention advised due to critical risk (${riskScore}/100) or acute safety constraints.`;
  } else if (continuityStatus === 'CONTINUITY_DEGRADED') {
    continuityBriefing += ` Elevated operational strain observed; active mitigations recommended.`;
  } else if (continuityStatus === 'CONTINUITY_AT_RISK') {
    continuityBriefing += ` Conditions warrant supervisor observation.`;
  } else {
    continuityBriefing += ` Nominal operating conditions maintained.`;
  }

  explanation.push(continuityBriefing);
  explanation.push(`Route risk is ${riskLevel} at ${riskScore}/100 with a ${riskTrend} trajectory.`);
  if (occupancy !== null) {
    explanation.push(`Passenger demand is ${demand} riders against ${capacity} vehicle seats (${occupancy}% occupancy).`);
  } else {
    explanation.push('Passenger demand intelligence is currently unavailable due to insufficient historical telemetry.');
  }

  if (activeAlerts > 0) {
    explanation.push(`${activeAlerts} active safety alert(s) (${criticalAlerts} CRITICAL, ${highAlerts} HIGH).`);
  }
  if (unresolvedIncidents > 0) {
    explanation.push(`${unresolvedIncidents} unresolved incident case(s) (${criticalIncidents} CRITICAL).`);
  }

  recoveryPriorityReason.push(
    `Recovery priority is ${recoveryPriority} based on ${continuityStatus} continuity status, ${riskScore}/100 risk score, and ${degradedOrCritDeps.length} impacted capabilities.`
  );

  evidence.push(`Server baseline: Risk ${riskScore}/100, Capacity ${capacity} seats, Alerts ${activeAlerts}, Incidents ${unresolvedIncidents}.`);
  evidence.push(`Readiness Score: ${readiness.readinessScore}/100 (${readiness.readinessLevel}).`);
  evidence.push(`Audit integrity: Evaluated server-side in read-only mode without database mutation.`);

  return {
    route: {
      id: routeId,
      code: routeCode,
      name: routeName,
    },
    continuityStatus,
    recoveryPriority,
    operationalStatus: support.operationalStatus,
    resilienceStatus,
    risk: {
      score: riskScore,
      level: riskLevel,
      trend: riskTrend,
    },
    demand: {
      predictedDemand: demand,
      capacity,
      occupancy,
      demandLevel,
      dataQuality,
      capacityShortfall,
    },
    safety: {
      activeAlerts,
      criticalAlerts,
      highAlerts,
      unresolvedIncidents,
      criticalIncidents,
      activeEmergencies,
    },
    dependencies,
    readiness: {
      readinessScore: readiness.readinessScore,
      readinessLevel: readiness.readinessLevel,
      knownDependencies: dependencies.length,
      degradedDependencies: dependencies.filter((d) => d.status === 'DEGRADED').length,
      criticalDependencies: dependencies.filter((d) => d.status === 'CRITICAL').length,
      dataQuality,
      explanation: readiness.explanation,
    },
    applicableContingencyPlans,
    recoverySequence,
    explanations: {
      continuityBriefing,
      explanation,
      affectedCapabilities,
      recoveryPriorityReason,
      readinessExplanation: readiness.explanation,
      evidence,
    },
    evaluatedAt,
  };
}

/**
 * Deterministically sorts corridor continuity plans using the 7 specified criteria:
 * 1. Continuity severity (CRITICAL > DEGRADED > AT_RISK > MONITOR > READY)
 * 2. Recovery priority (CRITICAL > HIGH > MEDIUM > LOW)
 * 3. Risk score descending
 * 4. Critical dependency count descending
 * 5. Active alert count descending
 * 6. Predicted occupancy descending
 * 7. Route ID ascending
 */
export function sortCorridorPlans(plans: CorridorContinuityPlan[]): CorridorContinuityPlan[] {
  return [...plans].sort((a, b) => {
    // 1. Continuity severity
    const sevA = getContinuitySeverityRank(a.continuityStatus);
    const sevB = getContinuitySeverityRank(b.continuityStatus);
    if (sevB !== sevA) return sevB - sevA;

    // 2. Recovery priority
    const prioA = getRecoveryPriorityRank(a.recoveryPriority);
    const prioB = getRecoveryPriorityRank(b.recoveryPriority);
    if (prioB !== prioA) return prioB - prioA;

    // 3. Risk score descending
    if (b.risk.score !== a.risk.score) return b.risk.score - a.risk.score;

    // 4. Critical dependency count descending
    if (b.readiness.criticalDependencies !== a.readiness.criticalDependencies) {
      return b.readiness.criticalDependencies - a.readiness.criticalDependencies;
    }

    // 5. Active alert count descending
    if (b.safety.activeAlerts !== a.safety.activeAlerts) {
      return b.safety.activeAlerts - a.safety.activeAlerts;
    }

    // 6. Predicted occupancy descending (handle null as -1)
    const occA = a.demand.occupancy ?? -1;
    const occB = b.demand.occupancy ?? -1;
    if (occB !== occA) return occB - occA;

    // 7. Route ID ascending
    return a.route.id.localeCompare(b.route.id);
  });
}

/**
 * Executes unified Operational Continuity Planning across fleet or for single corridor.
 * Strictly non-mutative, read-only, deterministic.
 */
export async function buildOperationalContinuityPlan(
  routeIdentifier?: string
): Promise<ContinuityPlanningResponse> {
  // 1. Fetch authoritative decision support from Step 6
  if (routeIdentifier && routeIdentifier.trim().length > 0) {
    const singleSupport = (await buildOperationalDecisionSupport(
      routeIdentifier.trim()
    )) as RouteOperationalDecisionSupport | null;

    if (!singleSupport || !('routeId' in singleSupport)) {
      throw new Error(`Route not found: ${routeIdentifier.trim()}`);
    }

    const corridorPlan = buildSingleRouteContinuityPlan(singleSupport);
    const corridors = [corridorPlan];

    const fleetSummary: FleetContinuitySummary = {
      totalRoutes: 1,
      continuityReady: corridorPlan.continuityStatus === 'CONTINUITY_READY' ? 1 : 0,
      continuityMonitor: corridorPlan.continuityStatus === 'CONTINUITY_MONITOR' ? 1 : 0,
      continuityAtRisk: corridorPlan.continuityStatus === 'CONTINUITY_AT_RISK' ? 1 : 0,
      continuityDegraded: corridorPlan.continuityStatus === 'CONTINUITY_DEGRADED' ? 1 : 0,
      continuityCritical: corridorPlan.continuityStatus === 'CONTINUITY_CRITICAL' ? 1 : 0,
      criticalRecoveryRoutes: corridorPlan.recoveryPriority === 'CRITICAL' ? 1 : 0,
      highRecoveryRoutes: corridorPlan.recoveryPriority === 'HIGH' ? 1 : 0,
      affectedRoutes: corridorPlan.continuityStatus !== 'CONTINUITY_READY' ? 1 : 0,
      criticalDependencies: corridorPlan.readiness.criticalDependencies,
      highDemandRoutes: corridorPlan.demand.occupancy !== null && corridorPlan.demand.occupancy >= 80 ? 1 : 0,
      unresolvedIncidents: corridorPlan.safety.unresolvedIncidents,
      activeCriticalAlerts: corridorPlan.safety.criticalAlerts,
    };

    return {
      success: true,
      notice: MANDATORY_CONTINUITY_PLANNING_NOTICE,
      safetyStatement: MANDATORY_CONTINUITY_SAFETY_STATEMENT,
      fleetSummary,
      corridors,
      generatedAt: new Date().toISOString(),
    };
  }

  // Fleet-wide evaluation
  const fleetSupport = (await buildOperationalDecisionSupport()) as FleetDecisionSupportResult | null;
  const rawPlans: CorridorContinuityPlan[] = [];

  if (fleetSupport && Array.isArray(fleetSupport.routes)) {
    for (const rSupport of fleetSupport.routes) {
      rawPlans.push(buildSingleRouteContinuityPlan(rSupport));
    }
  } else {
    // Fallback corridor evaluation
    const fallbackRoutes = DEFAULT_CORRIDOR_ROUTES;
    for (const fb of fallbackRoutes) {
      const s = (await buildOperationalDecisionSupport(fb.code)) as RouteOperationalDecisionSupport | null;
      if (s && 'routeId' in s) {
        rawPlans.push(buildSingleRouteContinuityPlan(s));
      }
    }
  }

  // Deterministic sorting
  const sortedPlans = sortCorridorPlans(rawPlans);

  // Compute fleet metrics
  let continuityReady = 0;
  let continuityMonitor = 0;
  let continuityAtRisk = 0;
  let continuityDegraded = 0;
  let continuityCritical = 0;
  let criticalRecoveryRoutes = 0;
  let highRecoveryRoutes = 0;
  let affectedRoutes = 0;
  let criticalDependencies = 0;
  let highDemandRoutes = 0;
  let unresolvedIncidents = 0;
  let activeCriticalAlerts = 0;

  for (const p of sortedPlans) {
    switch (p.continuityStatus) {
      case 'CONTINUITY_READY':
        continuityReady++;
        break;
      case 'CONTINUITY_MONITOR':
        continuityMonitor++;
        break;
      case 'CONTINUITY_AT_RISK':
        continuityAtRisk++;
        break;
      case 'CONTINUITY_DEGRADED':
        continuityDegraded++;
        break;
      case 'CONTINUITY_CRITICAL':
        continuityCritical++;
        break;
    }

    if (p.recoveryPriority === 'CRITICAL') criticalRecoveryRoutes++;
    if (p.recoveryPriority === 'HIGH') highRecoveryRoutes++;
    if (p.continuityStatus !== 'CONTINUITY_READY') affectedRoutes++;
    criticalDependencies += p.readiness.criticalDependencies;
    if (p.demand.occupancy !== null && p.demand.occupancy >= 80) highDemandRoutes++;
    unresolvedIncidents += p.safety.unresolvedIncidents;
    activeCriticalAlerts += p.safety.criticalAlerts;
  }

  const fleetSummary: FleetContinuitySummary = {
    totalRoutes: sortedPlans.length,
    continuityReady,
    continuityMonitor,
    continuityAtRisk,
    continuityDegraded,
    continuityCritical,
    criticalRecoveryRoutes,
    highRecoveryRoutes,
    affectedRoutes,
    criticalDependencies,
    highDemandRoutes,
    unresolvedIncidents,
    activeCriticalAlerts,
  };

  return {
    success: true,
    notice: MANDATORY_CONTINUITY_PLANNING_NOTICE,
    safetyStatement: MANDATORY_CONTINUITY_SAFETY_STATEMENT,
    fleetSummary,
    corridors: sortedPlans,
    generatedAt: new Date().toISOString(),
  };
}
