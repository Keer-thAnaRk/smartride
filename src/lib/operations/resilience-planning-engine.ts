/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — OPERATIONAL RESILIENCE & CONTINGENCY PLANNING ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 15: Deterministic Disruption Modeling, Resilience Status,
 * Capacity Shortfall Analysis, and Human-in-the-Loop Contingency Planning.
 *
 * Rules:
 * - Purely deterministic, non-mutative, advisory contingency modeling.
 * - Baselines are strictly fetched server-side from verified live intelligence;
 *   client-supplied baseline values are strictly ignored.
 * - Zero LLM hallucination, zero probabilistic guesswork.
 * - Zero database writes, zero route/schedule mutations, zero audit ledger pollution.
 * - Safe bounded inputs: risk (-50 to +50), demand (-50% to +100%), capacity (-50% to +100%).
 * - Simulated risk score clamped strictly between 0 and 100; capacity clamped >= 1.
 * - Preserves demand prediction data quality (never fabricates missing demand).
 */

import {
  buildOperationalDecisionSupport,
  OperationalStatus,
  RouteOperationalDecisionSupport,
} from '@/lib/operations/decision-support-engine';
import {
  runOperationalScenarioSimulation,
  HypotheticalAlertSeverity,
  HypotheticalIncidentSeverity,
  RiskTrendScenario,
} from '@/lib/operations/scenario-simulation-engine';

export const MANDATORY_RESILIENCE_PLANNING_NOTICE =
  'Operational resilience planning is advisory and deterministic. Contingency plans are hypothetical recovery options and do not automatically modify routes, schedules, vehicles, drivers, subscriptions, bookings, dispatch assignments, or operational resources.';

export type DisruptionType =
  | 'NONE'
  | 'VEHICLE_UNAVAILABLE'
  | 'DRIVER_UNAVAILABLE'
  | 'ROUTE_DISRUPTION'
  | 'DEMAND_SURGE'
  | 'CAPACITY_REDUCTION'
  | 'SAFETY_ESCALATION'
  | 'COMBINED_DISRUPTION';

export type DisruptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RecoveryMode =
  | 'MONITOR_ONLY'
  | 'MANUAL_REVIEW'
  | 'CONTINGENCY_PREPARATION'
  | 'SUPERVISOR_ESCALATION';

export type ResilienceStatus = 'STABLE' | 'WATCH' | 'DEGRADED' | 'CRITICAL';

export type RecoveryReadiness =
  | 'READY'
  | 'PARTIALLY_READY'
  | 'LIMITED'
  | 'INSUFFICIENT_DATA';

export type RecoveryUrgency = 'ROUTINE' | 'ELEVATED' | 'HIGH' | 'IMMEDIATE';

export type ContingencyOptionType =
  | 'REVIEW_ALTERNATE_CORRIDOR'
  | 'REVIEW_CAPACITY_ADJUSTMENT'
  | 'REVIEW_DRIVER_COVERAGE'
  | 'REVIEW_VEHICLE_COVERAGE'
  | 'REVIEW_DEMAND_PRESSURE'
  | 'REVIEW_SAFETY_ESCALATION'
  | 'REVIEW_INCIDENT_RESPONSE'
  | 'CONTINUE_MONITORING';

export interface ContingencyScenarioInput {
  scenarioId?: string;
  scenarioName: string;
  description?: string;
  disruptionType: DisruptionType;
  severity: DisruptionSeverity;
  affectedResource?: string;
  affectedResourceCount?: number;
  riskModifier?: number; // -50 to +50
  demandModifierPercent?: number; // -50 to +100
  capacityModifierPercent?: number; // -50 to +100
  alertInjection?: HypotheticalAlertSeverity;
  incidentInjection?: HypotheticalIncidentSeverity;
  riskTrendScenario?: RiskTrendScenario;
  durationMinutes?: number; // 1 to 1440 (default 60)
  recoveryMode: RecoveryMode;
}

export interface ResiliencePlanningRequest {
  routeId: string;
  scenario: ContingencyScenarioInput;
}

export interface ContingencyPlanOption {
  type: ContingencyOptionType;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  explanation: string;
  evidence: string;
  affectedMetric: string;
  rationale: string;
}

export interface ResilienceEvidence {
  route: {
    id: string;
    code: string;
    name: string;
  };
  baselineRiskScore: number;
  simulatedRiskScore: number;
  riskDelta: number;

  baselineDemand: number | null;
  simulatedDemand: number | null;
  demandDelta: number | null;

  baselineCapacity: number;
  simulatedCapacity: number;
  capacityDelta: number;

  baselineOccupancy: number | null;
  simulatedOccupancy: number | null;
  occupancyDelta: number | null;

  baselineActiveAlerts: number;
  simulatedActiveAlerts: number;
  alertDelta: number;

  baselineOpenIncidents: number;
  simulatedOpenIncidents: number;
  incidentDelta: number;

  baselineOperationalStatus: OperationalStatus;
  simulatedOperationalStatus: OperationalStatus;

  baselineResilienceStatus: ResilienceStatus;
  simulatedResilienceStatus: ResilienceStatus;

  recoveryReadiness: RecoveryReadiness;
  recoveryUrgency: RecoveryUrgency;
  capacityShortfall: number;
  dataQuality: string;
}

export interface ResiliencePlanningResult {
  success: boolean;
  notice: string;
  safetyStatement: string;
  scenario: {
    id: string;
    name: string;
    description: string;
    disruptionType: DisruptionType;
    severity: DisruptionSeverity;
    affectedResource: string;
    affectedResourceCount: number;
    durationMinutes: number;
    recoveryMode: RecoveryMode;
  };
  metrics: {
    risk: {
      baseline: number;
      simulated: number;
      delta: number;
      level: string;
    };
    demand: {
      baseline: number | null;
      simulated: number | null;
      delta: number | null;
      dataQuality: string;
    };
    capacity: {
      baseline: number;
      simulated: number;
      delta: number;
      shortfall: number;
    };
    occupancy: {
      baseline: number | null;
      simulated: number | null;
      delta: number | null;
    };
    safety: {
      baselineAlerts: number;
      simulatedAlerts: number;
      alertDelta: number;
      baselineIncidents: number;
      simulatedIncidents: number;
      incidentDelta: number;
    };
  };
  resilience: {
    baselineStatus: ResilienceStatus;
    simulatedStatus: ResilienceStatus;
    statusChange: 'ESCALATED' | 'DE_ESCALATED' | 'UNCHANGED';
    recoveryReadiness: RecoveryReadiness;
    recoveryUrgency: RecoveryUrgency;
    readinessStatement: string;
  };
  explanations: {
    whyResilienceChanged: string[];
    whyRecoveryReadiness: string[];
    impactFactors: string[];
    planningEvidence: string[];
  };
  contingencyPlanningOptions: ContingencyPlanOption[];
  evidence: ResilienceEvidence;
  simulatedAt: string;
}

/**
 * Validates resilience planning inputs with strict bounds and enum verification.
 */
export function validateResiliencePlanningInput(body: any): {
  routeId: string;
  scenario: Required<ContingencyScenarioInput>;
} {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request payload: object required');
  }

  const { routeId, scenario } = body;

  if (!routeId || typeof routeId !== 'string' || routeId.trim().length === 0) {
    throw new Error('routeId is required and must be a non-empty string');
  }

  if (!scenario || typeof scenario !== 'object') {
    throw new Error('scenario is required and must be an object');
  }

  const {
    scenarioId,
    scenarioName,
    description,
    disruptionType,
    severity,
    affectedResource,
    affectedResourceCount,
    riskModifier = 0,
    demandModifierPercent = 0,
    capacityModifierPercent = 0,
    alertInjection = 'NONE',
    incidentInjection = 'NONE',
    riskTrendScenario = 'NO_CHANGE',
    durationMinutes = 60,
    recoveryMode,
  } = scenario;

  if (
    !scenarioName ||
    typeof scenarioName !== 'string' ||
    scenarioName.trim().length === 0 ||
    scenarioName.trim().length > 100
  ) {
    throw new Error('scenarioName is required and must be between 1 and 100 characters');
  }

  const validDisruptions: DisruptionType[] = [
    'NONE',
    'VEHICLE_UNAVAILABLE',
    'DRIVER_UNAVAILABLE',
    'ROUTE_DISRUPTION',
    'DEMAND_SURGE',
    'CAPACITY_REDUCTION',
    'SAFETY_ESCALATION',
    'COMBINED_DISRUPTION',
  ];
  if (!disruptionType || !validDisruptions.includes(disruptionType)) {
    throw new Error(`Invalid disruptionType. Must be one of: ${validDisruptions.join(', ')}`);
  }

  const validSeverities: DisruptionSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!severity || !validSeverities.includes(severity)) {
    throw new Error(`Invalid severity. Must be one of: ${validSeverities.join(', ')}`);
  }

  const validRecoveryModes: RecoveryMode[] = [
    'MONITOR_ONLY',
    'MANUAL_REVIEW',
    'CONTINGENCY_PREPARATION',
    'SUPERVISOR_ESCALATION',
  ];
  if (!recoveryMode || !validRecoveryModes.includes(recoveryMode)) {
    throw new Error(`Invalid recoveryMode. Must be one of: ${validRecoveryModes.join(', ')}`);
  }

  if (
    typeof riskModifier !== 'number' ||
    Number.isNaN(riskModifier) ||
    !Number.isFinite(riskModifier) ||
    riskModifier < -50 ||
    riskModifier > 50
  ) {
    throw new Error('riskModifier must be a finite number between -50 and 50');
  }

  if (
    typeof demandModifierPercent !== 'number' ||
    Number.isNaN(demandModifierPercent) ||
    !Number.isFinite(demandModifierPercent) ||
    demandModifierPercent < -50 ||
    demandModifierPercent > 100
  ) {
    throw new Error('demandModifierPercent must be a finite number between -50 and 100');
  }

  if (
    typeof capacityModifierPercent !== 'number' ||
    Number.isNaN(capacityModifierPercent) ||
    !Number.isFinite(capacityModifierPercent) ||
    capacityModifierPercent < -50 ||
    capacityModifierPercent > 100
  ) {
    throw new Error('capacityModifierPercent must be a finite number between -50 and 100');
  }

  if (
    typeof durationMinutes !== 'number' ||
    Number.isNaN(durationMinutes) ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    durationMinutes > 1440
  ) {
    throw new Error('durationMinutes must be a positive integer between 1 and 1440');
  }

  const validAlerts = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validAlerts.includes(alertInjection)) {
    throw new Error(`Invalid alertInjection. Must be one of: ${validAlerts.join(', ')}`);
  }

  const validIncidents = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validIncidents.includes(incidentInjection)) {
    throw new Error(`Invalid incidentInjection. Must be one of: ${validIncidents.join(', ')}`);
  }

  const validTrends = ['NO_CHANGE', 'RISING', 'STABLE', 'FALLING'];
  if (!validTrends.includes(riskTrendScenario)) {
    throw new Error(`Invalid riskTrendScenario. Must be one of: ${validTrends.join(', ')}`);
  }

  const resolvedAffectedResource =
    affectedResource && typeof affectedResource === 'string'
      ? affectedResource.trim()
      : disruptionType === 'VEHICLE_UNAVAILABLE'
      ? 'VEHICLE'
      : disruptionType === 'DRIVER_UNAVAILABLE'
      ? 'DRIVER'
      : disruptionType === 'ROUTE_DISRUPTION'
      ? 'CORRIDOR_ROADWAY'
      : disruptionType === 'CAPACITY_REDUCTION'
      ? 'PASSENGER_SEATING'
      : disruptionType === 'DEMAND_SURGE'
      ? 'SERVICE_CAPACITY'
      : disruptionType === 'SAFETY_ESCALATION'
      ? 'SAFETY_CONTROLS'
      : 'FLEET_OPERATIONS';

  const resolvedResourceCount =
    typeof affectedResourceCount === 'number' && affectedResourceCount > 0
      ? Math.round(affectedResourceCount)
      : 1;

  return {
    routeId: routeId.trim(),
    scenario: {
      scenarioId: scenarioId && typeof scenarioId === 'string' ? scenarioId : `scen_${Date.now()}`,
      scenarioName: scenarioName.trim(),
      description: description && typeof description === 'string' ? description.trim() : '',
      disruptionType,
      severity,
      affectedResource: resolvedAffectedResource,
      affectedResourceCount: resolvedResourceCount,
      riskModifier,
      demandModifierPercent,
      capacityModifierPercent,
      alertInjection: alertInjection as HypotheticalAlertSeverity,
      incidentInjection: incidentInjection as HypotheticalIncidentSeverity,
      riskTrendScenario: riskTrendScenario as RiskTrendScenario,
      durationMinutes,
      recoveryMode,
    },
  };
}

/**
 * Deterministic rank mapping for resilience status.
 */
export function getResilienceRank(status: ResilienceStatus): number {
  switch (status) {
    case 'CRITICAL':
      return 4;
    case 'DEGRADED':
      return 3;
    case 'WATCH':
      return 2;
    case 'STABLE':
      return 1;
    default:
      return 0;
  }
}

/**
 * Calculates deterministic Resilience Status from operational telemetry.
 */
export function calculateResilienceStatus(params: {
  operationalStatus: OperationalStatus;
  riskScore: number;
  activeCriticalAlerts: number;
  activeHighAlerts: number;
  criticalIncidents: number;
  highIncidents: number;
  projectedOccupancy: number | null;
  demandLevel: string | null;
  capacityModifierPercent: number;
  capacityDelta: number;
  disruptionType: DisruptionType;
  severity: DisruptionSeverity;
  riskTrend: string;
}): ResilienceStatus {
  const {
    operationalStatus,
    riskScore,
    activeCriticalAlerts,
    activeHighAlerts,
    criticalIncidents,
    highIncidents,
    projectedOccupancy,
    demandLevel,
    capacityModifierPercent,
    capacityDelta,
    disruptionType,
    severity,
    riskTrend,
  } = params;

  // 1. CRITICAL RULES
  if (
    operationalStatus === 'URGENT_REVIEW' ||
    riskScore >= 75 ||
    activeCriticalAlerts > 0 ||
    criticalIncidents > 0 ||
    (projectedOccupancy !== null && projectedOccupancy >= 100) ||
    (severity === 'CRITICAL' &&
      (disruptionType === 'ROUTE_DISRUPTION' ||
        disruptionType === 'COMBINED_DISRUPTION' ||
        disruptionType === 'SAFETY_ESCALATION'))
  ) {
    return 'CRITICAL';
  }

  // 2. DEGRADED RULES
  if (
    operationalStatus === 'ATTENTION_REQUIRED' ||
    riskScore >= 50 ||
    activeHighAlerts > 0 ||
    highIncidents > 0 ||
    (projectedOccupancy !== null && projectedOccupancy >= 90) ||
    demandLevel === 'CRITICAL' ||
    capacityModifierPercent <= -25 ||
    capacityDelta <= -4 ||
    severity === 'HIGH' ||
    (severity === 'MEDIUM' && disruptionType === 'COMBINED_DISRUPTION')
  ) {
    return 'DEGRADED';
  }

  // 3. WATCH RULES
  if (
    operationalStatus === 'MONITOR' ||
    riskScore >= 25 ||
    (projectedOccupancy !== null && projectedOccupancy >= 75) ||
    demandLevel === 'HIGH' ||
    riskTrend === 'RISING' ||
    severity === 'MEDIUM' ||
    capacityModifierPercent < 0
  ) {
    return 'WATCH';
  }

  // 4. STABLE
  return 'STABLE';
}

/**
 * Calculates factual capacity shortfall.
 * Uses phrasing "Projected capacity shortfall" and never fabricates displaced commuters.
 */
export function calculateCapacityShortfall(
  simulatedDemand: number | null,
  simulatedCapacity: number
): number {
  if (simulatedDemand !== null && simulatedDemand > simulatedCapacity) {
    return Math.round((simulatedDemand - simulatedCapacity) * 10) / 10;
  }
  return 0;
}

/**
 * Calculates deterministic Recovery Readiness based strictly on verified data.
 * Returns INSUFFICIENT_DATA if demand intelligence is missing.
 */
export function calculateRecoveryReadiness(params: {
  dataQuality: string;
  demandAvailable: boolean;
  resilienceStatus: ResilienceStatus;
  capacityShortfall: number;
  simulatedRiskScore: number;
  activeCriticalAlerts: number;
  activeHighAlerts: number;
  criticalIncidents: number;
}): { readiness: RecoveryReadiness; statement: string } {
  const {
    dataQuality,
    demandAvailable,
    resilienceStatus,
    capacityShortfall,
    simulatedRiskScore,
    activeCriticalAlerts,
    activeHighAlerts,
    criticalIncidents,
  } = params;

  if (!demandAvailable || dataQuality === 'INSUFFICIENT_DATA') {
    return {
      readiness: 'INSUFFICIENT_DATA',
      statement:
        'Recovery readiness cannot be fully determined from available operational data because demand intelligence is insufficient.',
    };
  }

  if (
    resilienceStatus === 'CRITICAL' ||
    capacityShortfall > 6 ||
    simulatedRiskScore >= 75 ||
    activeCriticalAlerts > 0 ||
    criticalIncidents > 0
  ) {
    return {
      readiness: 'LIMITED',
      statement:
        'Corridor operations face acute constraints; recovery readiness is limited without administrative intervention and fleet reallocation.',
    };
  }

  if (
    resilienceStatus === 'DEGRADED' ||
    capacityShortfall > 0 ||
    simulatedRiskScore >= 50 ||
    activeHighAlerts > 0
  ) {
    return {
      readiness: 'PARTIALLY_READY',
      statement:
        'Corridor possesses baseline operational coverage, but capacity shortfall and elevated risk require active contingency preparation.',
    };
  }

  return {
    readiness: 'READY',
    statement:
      'Corridor capacity and safety parameters remain within standard operational tolerance with adequate recovery headroom.',
  };
}

/**
 * Calculates deterministic Recovery Urgency.
 */
export function calculateRecoveryUrgency(
  resilienceStatus: ResilienceStatus,
  recoveryMode: RecoveryMode
): RecoveryUrgency {
  if (
    resilienceStatus === 'CRITICAL' ||
    recoveryMode === 'SUPERVISOR_ESCALATION'
  ) {
    return 'IMMEDIATE';
  }

  if (
    resilienceStatus === 'DEGRADED' ||
    recoveryMode === 'CONTINGENCY_PREPARATION'
  ) {
    return 'HIGH';
  }

  if (resilienceStatus === 'WATCH' || recoveryMode === 'MANUAL_REVIEW') {
    return 'ELEVATED';
  }

  return 'ROUTINE';
}

/**
 * Builds factual, deterministic explanation bullet arrays.
 */
export function buildResilienceExplanations(params: {
  scenarioName: string;
  disruptionType: DisruptionType;
  severity: DisruptionSeverity;
  durationMinutes: number;
  baselineResilience: ResilienceStatus;
  simulatedResilience: ResilienceStatus;
  baselineRisk: number;
  simulatedRisk: number;
  riskDelta: number;
  baselineCapacity: number;
  simulatedCapacity: number;
  capacityDelta: number;
  baselineDemand: number | null;
  simulatedDemand: number | null;
  demandDelta: number | null;
  baselineOccupancy: number | null;
  simulatedOccupancy: number | null;
  capacityShortfall: number;
  alertDelta: number;
  incidentDelta: number;
  recoveryReadiness: RecoveryReadiness;
  dataQuality: string;
}): {
  whyResilienceChanged: string[];
  whyRecoveryReadiness: string[];
  impactFactors: string[];
  planningEvidence: string[];
} {
  const {
    scenarioName,
    disruptionType,
    severity,
    durationMinutes,
    baselineResilience,
    simulatedResilience,
    baselineRisk,
    simulatedRisk,
    riskDelta,
    baselineCapacity,
    simulatedCapacity,
    capacityDelta,
    baselineDemand,
    simulatedDemand,
    baselineOccupancy,
    simulatedOccupancy,
    capacityShortfall,
    alertDelta,
    incidentDelta,
    recoveryReadiness,
    dataQuality,
  } = params;

  const whyResilienceChanged: string[] = [];
  const whyRecoveryReadiness: string[] = [];
  const impactFactors: string[] = [];
  const planningEvidence: string[] = [];

  // 1. Why Resilience Changed
  if (baselineResilience !== simulatedResilience) {
    whyResilienceChanged.push(
      `Scenario "${scenarioName}" (${disruptionType}, ${severity} severity) shifts corridor resilience from ${baselineResilience} to ${simulatedResilience}.`
    );
  } else {
    whyResilienceChanged.push(
      `Corridor resilience status remains ${simulatedResilience} under modeled ${disruptionType} parameters.`
    );
  }

  if (riskDelta !== 0) {
    const sign = riskDelta > 0 ? `+${riskDelta}` : `${riskDelta}`;
    whyResilienceChanged.push(
      `Simulated corridor risk shifted from ${baselineRisk}/100 to ${simulatedRisk}/100 (${sign} pts).`
    );
  }

  if (capacityDelta !== 0) {
    whyResilienceChanged.push(
      `Vehicle capacity changed by ${capacityDelta} seats (from ${baselineCapacity} to ${simulatedCapacity} seats).`
    );
  }

  if (simulatedOccupancy !== null && baselineOccupancy !== null && simulatedOccupancy !== baselineOccupancy) {
    whyResilienceChanged.push(
      `Projected passenger occupancy shifted from ${baselineOccupancy}% to ${simulatedOccupancy}%.`
    );
  }

  if (alertDelta > 0) {
    whyResilienceChanged.push(
      `Hypothetical injection of ${alertDelta} safety alert(s) escalated corridor surveillance requirements.`
    );
  }

  if (incidentDelta > 0) {
    whyResilienceChanged.push(
      `Hypothetical injection of ${incidentDelta} incident case(s) elevated operational incident backlog.`
    );
  }

  // 2. Why Recovery Readiness
  if (recoveryReadiness === 'INSUFFICIENT_DATA') {
    whyRecoveryReadiness.push(
      'Recovery readiness cannot be fully determined because demand intelligence is insufficient.'
    );
  } else if (recoveryReadiness === 'LIMITED') {
    whyRecoveryReadiness.push(
      `Readiness is LIMITED due to ${simulatedResilience} resilience status and elevated risk (${simulatedRisk}/100).`
    );
    if (capacityShortfall > 0) {
      whyRecoveryReadiness.push(
        `Projected capacity shortfall of ${capacityShortfall} seats exceeds standard reserve margin.`
      );
    }
  } else if (recoveryReadiness === 'PARTIALLY_READY') {
    whyRecoveryReadiness.push(
      `Readiness is PARTIALLY_READY: corridor maintains baseline operating structure but shows capacity pressure (${simulatedOccupancy}% occupancy).`
    );
  } else {
    whyRecoveryReadiness.push(
      'Readiness is READY: corridor telemetry exhibits adequate seating headroom and manageable risk bounds.'
    );
  }

  // 3. Impact Factors
  impactFactors.push(
    `Disruption Type: ${disruptionType} | Severity: ${severity} | Duration Window: ${durationMinutes} minutes.`
  );
  if (capacityShortfall > 0) {
    impactFactors.push(
      `Projected capacity shortfall: ${capacityShortfall} seats require contingency review.`
    );
  } else {
    impactFactors.push('Capacity balance: Available shuttle seating meets simulated passenger demand.');
  }

  if (simulatedDemand !== null) {
    impactFactors.push(
      `Projected passenger demand: ${simulatedDemand} commuters (Data Quality: ${dataQuality}).`
    );
  }

  // 4. Planning Evidence
  planningEvidence.push(
    `Server-derived baseline: Risk ${baselineRisk}/100, Capacity ${baselineCapacity} seats, Baseline Status: ${baselineResilience}.`
  );
  planningEvidence.push(
    `Mathematical clamping applied: Risk bounded to [0, 100], Capacity bounded to minimum 1 seat.`
  );
  planningEvidence.push(
    'Audit compliance: Hypothetical scenario evaluated purely in-memory with zero persistence mutations.'
  );

  return {
    whyResilienceChanged,
    whyRecoveryReadiness,
    impactFactors,
    planningEvidence,
  };
}

/**
 * Builds advisory contingency planning options.
 * These are NOT automated commands and do not execute operational actions.
 */
export function buildContingencyPlanningOptions(params: {
  disruptionType: DisruptionType;
  severity: DisruptionSeverity;
  resilienceStatus: ResilienceStatus;
  recoveryReadiness: RecoveryReadiness;
  capacityShortfall: number;
  simulatedRiskScore: number;
  simulatedOccupancy: number | null;
  activeCriticalAlerts: number;
  routeCode: string;
}): ContingencyPlanOption[] {
  const {
    disruptionType,
    severity,
    resilienceStatus,
    recoveryReadiness,
    capacityShortfall,
    simulatedRiskScore,
    simulatedOccupancy,
    activeCriticalAlerts,
    routeCode,
  } = params;

  const options: ContingencyPlanOption[] = [];

  // Capacity Adjustment Option
  if (capacityShortfall > 0 || (simulatedOccupancy !== null && simulatedOccupancy >= 90)) {
    options.push({
      type: 'REVIEW_CAPACITY_ADJUSTMENT',
      priority: capacityShortfall > 5 || resilienceStatus === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      title: 'Review Capacity Adjustment',
      explanation: `Projected occupancy reaches ${simulatedOccupancy ?? 'elevated'}% with a projected capacity shortfall of ${capacityShortfall} seats.`,
      evidence: `Simulated demand exceeds capacity on corridor ${routeCode}. Shortfall: ${capacityShortfall} seats.`,
      affectedMetric: 'PASSENGER_CAPACITY',
      rationale:
        'Administrative review of supplemental shuttle scheduling or high-capacity vehicle assignment is advised.',
    });
  }

  // Alternate Corridor Option
  if (
    disruptionType === 'ROUTE_DISRUPTION' ||
    disruptionType === 'COMBINED_DISRUPTION' ||
    simulatedRiskScore >= 65 ||
    resilienceStatus === 'CRITICAL'
  ) {
    options.push({
      type: 'REVIEW_ALTERNATE_CORRIDOR',
      priority: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      title: 'Review Alternate Corridor Feasibility',
      explanation: `Corridor ${routeCode} exhibits significant risk elevation (${simulatedRiskScore}/100) or roadway disruption.`,
      evidence: `Disruption type ${disruptionType} at ${severity} severity impacts transit corridor reliability.`,
      affectedMetric: 'ROUTE_INTEGRITY',
      rationale:
        'Administrators should examine detour waypoints and parallel arterial corridors to minimize travel latency.',
    });
  }

  // Driver Coverage Option
  if (
    disruptionType === 'DRIVER_UNAVAILABLE' ||
    disruptionType === 'COMBINED_DISRUPTION' ||
    severity === 'HIGH' ||
    severity === 'CRITICAL'
  ) {
    options.push({
      type: 'REVIEW_DRIVER_COVERAGE',
      priority: disruptionType === 'DRIVER_UNAVAILABLE' ? 'HIGH' : 'MEDIUM',
      title: 'Review Driver Coverage & Relief Roster',
      explanation:
        'Disruption modeling indicates potential operator shortfall or extended driving duty pressure.',
      evidence: `Driver availability modeled as constrained under ${disruptionType} contingency.`,
      affectedMetric: 'OPERATOR_ROSTER',
      rationale:
        'Supervisors should verify driver rest compliance and standby relief roster availability.',
    });
  }

  // Vehicle Coverage Option
  if (
    disruptionType === 'VEHICLE_UNAVAILABLE' ||
    disruptionType === 'CAPACITY_REDUCTION' ||
    capacityShortfall > 0
  ) {
    options.push({
      type: 'REVIEW_VEHICLE_COVERAGE',
      priority: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      title: 'Review Vehicle Maintenance & Coverage',
      explanation:
        'Fleet availability modeling indicates potential mechanical unavailability or maintenance requirement.',
      evidence: `Vehicle resource impacted under ${disruptionType}.`,
      affectedMetric: 'VEHICLE_INVENTORY',
      rationale:
        'Maintenance supervisors should assess reserve vehicle readiness and turnaround timing.',
    });
  }

  // Safety Escalation Option
  if (
    disruptionType === 'SAFETY_ESCALATION' ||
    activeCriticalAlerts > 0 ||
    simulatedRiskScore >= 70
  ) {
    options.push({
      type: 'REVIEW_SAFETY_ESCALATION',
      priority: 'CRITICAL',
      title: 'Review Safety Protocol Escalation',
      explanation:
        'Simulated safety telemetry indicates critical hazard exposure or active emergency conditions.',
      evidence: `Simulated risk score ${simulatedRiskScore}/100 with active safety alert injection.`,
      affectedMetric: 'SAFETY_PROTOCOLS',
      rationale:
        'Command center should verify speed governor limits, roadway camera feeds, and driver telemetry verification.',
    });
  }

  // Incident Response Option
  if (
    disruptionType === 'COMBINED_DISRUPTION' ||
    resilienceStatus === 'CRITICAL' ||
    resilienceStatus === 'DEGRADED'
  ) {
    options.push({
      type: 'REVIEW_INCIDENT_RESPONSE',
      priority: resilienceStatus === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      title: 'Review Safety Incident Response Protocols',
      explanation:
        'Contingency severity warrants operational incident case logging and supervisor review.',
      evidence: `Resilience status classified as ${resilienceStatus}.`,
      affectedMetric: 'INCIDENT_CASE_MANAGEMENT',
      rationale:
        'Ensures cross-team alignment between dispatch, fleet maintenance, and administrative supervisors.',
    });
  }

  // Default Monitoring Option if conditions are stable
  if (options.length === 0 || resilienceStatus === 'STABLE') {
    options.push({
      type: 'CONTINUE_MONITORING',
      priority: 'LOW',
      title: 'Continue Operational Surveillance',
      explanation:
        'Corridor telemetry remains within acceptable operational boundaries under modeled parameters.',
      evidence: `Resilience status is STABLE (${simulatedRiskScore}/100 risk score, 0 capacity shortfall).`,
      affectedMetric: 'STANDARD_SURVEILLANCE',
      rationale:
        'No active contingency intervention required; continue routine corridor telemetry monitoring.',
    });
  }

  return options;
}

/**
 * Executes a complete Operational Resilience & Contingency Planning evaluation.
 *
 * Rules:
 * - Server-authoritative baseline (client overrides stripped and ignored).
 * - Purely in-memory deterministic simulation (zero database writes).
 * - Zero audit pollution.
 * - Mathematical clamping on risk and capacity.
 */
export async function runOperationalResiliencePlanning(
  rawInput: any
): Promise<ResiliencePlanningResult> {
  const { routeId, scenario } = validateResiliencePlanningInput(rawInput);

  // 1. Fetch server-side authoritative baseline (Step 6)
  const baselineSupport = (await buildOperationalDecisionSupport(
    routeId
  )) as RouteOperationalDecisionSupport | null;

  if (!baselineSupport) {
    throw new Error(`Route not found: ${routeId}`);
  }

  // 2. Execute deterministic simulation reusing Step 12 formulas
  const simResult = await runOperationalScenarioSimulation({
    routeId,
    riskModifier: scenario.riskModifier,
    demandModifierPercent: scenario.demandModifierPercent,
    capacityModifierPercent: scenario.capacityModifierPercent,
    hypotheticalAlert: scenario.alertInjection,
    hypotheticalIncident: scenario.incidentInjection,
    riskTrendScenario: scenario.riskTrendScenario,
  });

  const nowIso = new Date().toISOString();

  // 3. Extract baseline & simulated metrics
  const baselineRiskScore = simResult.baseline.riskScore;
  const simulatedRiskScore = simResult.simulated.riskScore;
  const riskDelta = simResult.comparison.riskDelta;

  const baselineDemand = simResult.baseline.demand;
  const simulatedDemand = simResult.simulated.demand;
  const demandDelta = simResult.comparison.demandDelta;

  const baselineCapacity = simResult.baseline.capacity;
  const simulatedCapacity = simResult.simulated.capacity;
  const capacityDelta = simResult.comparison.capacityDelta;

  const baselineOccupancy = simResult.baseline.occupancy;
  const simulatedOccupancy = simResult.simulated.occupancy;
  const occupancyDelta = simResult.comparison.occupancyDelta;

  const baselineAlerts = simResult.baseline.activeAlerts;
  const simulatedAlerts = simResult.simulated.activeAlerts;
  const alertDelta = simResult.comparison.alertsDelta;

  const baselineIncidents = simResult.baseline.unresolvedIncidents;
  const simulatedIncidents = simResult.simulated.unresolvedIncidents;
  const incidentDelta = simResult.comparison.incidentsDelta;

  const baselineOperationalStatus = simResult.baseline.operationalStatus;
  const simulatedOperationalStatus = simResult.simulated.operationalStatus;
  const dataQuality = baselineSupport.demand.dataQuality;

  // 4. Compute Capacity Shortfall
  const capacityShortfall = calculateCapacityShortfall(
    simulatedDemand,
    simulatedCapacity
  );

  // 5. Compute Baseline & Simulated Resilience Status
  const baselineResilienceStatus = calculateResilienceStatus({
    operationalStatus: baselineOperationalStatus,
    riskScore: baselineRiskScore,
    activeCriticalAlerts: simResult.baseline.criticalAlerts,
    activeHighAlerts: simResult.baseline.activeAlerts - simResult.baseline.criticalAlerts,
    criticalIncidents: simResult.baseline.criticalIncidents,
    highIncidents: simResult.baseline.unresolvedIncidents - simResult.baseline.criticalIncidents,
    projectedOccupancy: baselineOccupancy,
    demandLevel: baselineSupport.demand.demandLevel,
    capacityModifierPercent: 0,
    capacityDelta: 0,
    disruptionType: 'NONE',
    severity: 'LOW',
    riskTrend: simResult.baseline.riskTrend,
  });

  const simulatedResilienceStatus = calculateResilienceStatus({
    operationalStatus: simulatedOperationalStatus,
    riskScore: simulatedRiskScore,
    activeCriticalAlerts: simResult.simulated.criticalAlerts,
    activeHighAlerts: simResult.simulated.activeAlerts - simResult.simulated.criticalAlerts,
    criticalIncidents: simResult.simulated.criticalIncidents,
    highIncidents: simResult.simulated.unresolvedIncidents - simResult.simulated.criticalIncidents,
    projectedOccupancy: simulatedOccupancy,
    demandLevel: simResult.simulated.demandLevel,
    capacityModifierPercent: scenario.capacityModifierPercent,
    capacityDelta,
    disruptionType: scenario.disruptionType,
    severity: scenario.severity,
    riskTrend: simResult.simulated.riskTrend,
  });

  const baseRank = getResilienceRank(baselineResilienceStatus);
  const simRank = getResilienceRank(simulatedResilienceStatus);
  let statusChange: 'ESCALATED' | 'DE_ESCALATED' | 'UNCHANGED' = 'UNCHANGED';
  if (simRank > baseRank) {
    statusChange = 'ESCALATED';
  } else if (simRank < baseRank) {
    statusChange = 'DE_ESCALATED';
  }

  // 6. Compute Recovery Readiness & Urgency
  const { readiness: recoveryReadiness, statement: readinessStatement } =
    calculateRecoveryReadiness({
      dataQuality,
      demandAvailable: simulatedDemand !== null,
      resilienceStatus: simulatedResilienceStatus,
      capacityShortfall,
      simulatedRiskScore,
      activeCriticalAlerts: simResult.simulated.criticalAlerts,
      activeHighAlerts: simResult.simulated.activeAlerts - simResult.simulated.criticalAlerts,
      criticalIncidents: simResult.simulated.criticalIncidents,
    });

  const recoveryUrgency = calculateRecoveryUrgency(
    simulatedResilienceStatus,
    scenario.recoveryMode
  );

  // 7. Build Deterministic Explanations
  const explanations = buildResilienceExplanations({
    scenarioName: scenario.scenarioName,
    disruptionType: scenario.disruptionType,
    severity: scenario.severity,
    durationMinutes: scenario.durationMinutes,
    baselineResilience: baselineResilienceStatus,
    simulatedResilience: simulatedResilienceStatus,
    baselineRisk: baselineRiskScore,
    simulatedRisk: simulatedRiskScore,
    riskDelta,
    baselineCapacity,
    simulatedCapacity,
    capacityDelta,
    baselineDemand,
    simulatedDemand,
    demandDelta,
    baselineOccupancy,
    simulatedOccupancy,
    capacityShortfall,
    alertDelta,
    incidentDelta,
    recoveryReadiness,
    dataQuality,
  });

  // 8. Generate Advisory Contingency Planning Options
  const contingencyPlanningOptions = buildContingencyPlanningOptions({
    disruptionType: scenario.disruptionType,
    severity: scenario.severity,
    resilienceStatus: simulatedResilienceStatus,
    recoveryReadiness,
    capacityShortfall,
    simulatedRiskScore,
    simulatedOccupancy,
    activeCriticalAlerts: simResult.simulated.criticalAlerts,
    routeCode: baselineSupport.routeCode,
  });

  // 9. Assemble Complete Evidence Package
  const evidence: ResilienceEvidence = {
    route: {
      id: baselineSupport.routeId,
      code: baselineSupport.routeCode,
      name: baselineSupport.routeName,
    },
    baselineRiskScore,
    simulatedRiskScore,
    riskDelta,
    baselineDemand,
    simulatedDemand,
    demandDelta,
    baselineCapacity,
    simulatedCapacity,
    capacityDelta,
    baselineOccupancy,
    simulatedOccupancy,
    occupancyDelta,
    baselineActiveAlerts: baselineAlerts,
    simulatedActiveAlerts: simulatedAlerts,
    alertDelta,
    baselineOpenIncidents: baselineIncidents,
    simulatedOpenIncidents: simulatedIncidents,
    incidentDelta,
    baselineOperationalStatus,
    simulatedOperationalStatus,
    baselineResilienceStatus,
    simulatedResilienceStatus,
    recoveryReadiness,
    recoveryUrgency,
    capacityShortfall,
    dataQuality,
  };

  return {
    success: true,
    notice: MANDATORY_RESILIENCE_PLANNING_NOTICE,
    safetyStatement:
      'This is an advisory contingency plan. Administrative review is required before any operational action. No operational resources were modified.',
    scenario: {
      id: scenario.scenarioId,
      name: scenario.scenarioName,
      description: scenario.description,
      disruptionType: scenario.disruptionType,
      severity: scenario.severity,
      affectedResource: scenario.affectedResource,
      affectedResourceCount: scenario.affectedResourceCount,
      durationMinutes: scenario.durationMinutes,
      recoveryMode: scenario.recoveryMode,
    },
    metrics: {
      risk: {
        baseline: baselineRiskScore,
        simulated: simulatedRiskScore,
        delta: riskDelta,
        level: simResult.simulated.riskLevel,
      },
      demand: {
        baseline: baselineDemand,
        simulated: simulatedDemand,
        delta: demandDelta,
        dataQuality,
      },
      capacity: {
        baseline: baselineCapacity,
        simulated: simulatedCapacity,
        delta: capacityDelta,
        shortfall: capacityShortfall,
      },
      occupancy: {
        baseline: baselineOccupancy,
        simulated: simulatedOccupancy,
        delta: occupancyDelta,
      },
      safety: {
        baselineAlerts,
        simulatedAlerts,
        alertDelta,
        baselineIncidents,
        simulatedIncidents,
        incidentDelta,
      },
    },
    resilience: {
      baselineStatus: baselineResilienceStatus,
      simulatedStatus: simulatedResilienceStatus,
      statusChange,
      recoveryReadiness,
      recoveryUrgency,
      readinessStatement,
    },
    explanations,
    contingencyPlanningOptions,
    evidence,
    simulatedAt: nowIso,
  };
}
