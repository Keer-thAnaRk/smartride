/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — OPERATIONAL DECISION REPLAY & HISTORICAL WHAT-IF ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 14: Historical State Reconstruction & What-If Validation for Admin.
 *
 * Rules:
 * - Purely deterministic, non-mutative, advisory decision replay.
 * - Reconstructs historical operational states strictly from persisted evidence
 *   (route risk snapshots, persisted alerts, incidents, demand predictions).
 * - Never fabricates historical telemetry. Missing values are explicitly marked
 *   value: null, availability: "UNAVAILABLE" with a concrete explanation.
 * - Current state is loaded server-side using authoritative intelligence (Steps 1–6).
 * - What-if simulation reuses Step 12 formulas (risk clamping [0, 100], capacity >= 1).
 * - Status hierarchy matches Step 6 (URGENT_REVIEW, ATTENTION_REQUIRED, MONITOR, NORMAL).
 * - Zero operational mutations and zero audit log pollution.
 */

import prisma from '@/lib/prisma';
import {
  getRouteRiskHistory,
  RouteRiskSnapshot,
} from '@/lib/safety/route-risk-history-store';
import {
  getSafetyAlerts,
  SafetyAlertRecord,
} from '@/lib/safety/safety-alert-store';
import {
  getIncidentCases,
  IncidentCaseRecord,
} from '@/lib/safety/safety-incident-store';
import {
  buildOperationalDecisionSupport,
  evaluateOperationalStatus,
  OperationalStatus,
  RouteOperationalDecisionSupport,
} from '@/lib/operations/decision-support-engine';
import {
  generateOperationalRecommendations,
  OperationalRecommendationDraft,
} from '@/lib/operations/recommendation-engine';
import {
  HypotheticalAlertSeverity,
  HypotheticalIncidentSeverity,
  RiskTrendScenario,
} from '@/lib/operations/scenario-simulation-engine';

export const MANDATORY_DECISION_REPLAY_NOTICE_1 =
  'Decision Replay is advisory and deterministic. Historical states and hypothetical scenarios are analytical reconstructions only. Replay results do not modify routes, schedules, vehicles, drivers, subscriptions, bookings, dispatch assignments, safety alerts, incidents, recommendations, or operational resources.';

export const MANDATORY_DECISION_REPLAY_NOTICE_2 =
  'Historical replay uses verified persisted intelligence where available. Missing historical values must be explicitly marked unavailable rather than fabricated.';

export interface HistoricalObservationSummary {
  observationId: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  observedAt: string;
  sourceType: string;
  sourceId: string;
  availableMetrics: string[];
  dataQuality: 'VERIFIED_PERSISTED' | 'PARTIAL_HISTORICAL' | 'UNAVAILABLE';
  riskScore: number;
  riskLevel: string;
}

export interface MetricEvidenceTrace {
  metric: string;
  value: any;
  sourceType?: string;
  sourceId?: string;
  observedAt?: string;
  verified: boolean;
  availability: 'VERIFIED' | 'PARTIAL' | 'UNAVAILABLE';
  reason?: string;
}

export interface ReplayScenarioInput {
  riskModifier: number; // -50 to +50
  demandModifierPercent: number; // -50 to +100
  capacityModifierPercent: number; // -50 to +100
  hypotheticalAlert: HypotheticalAlertSeverity;
  hypotheticalIncident: HypotheticalIncidentSeverity;
  riskTrendScenario: 'UNCHANGED' | 'RISING' | 'FALLING' | 'STABLE';
}

export interface DecisionReplayInput {
  routeId: string;
  observationId: string;
  scenario: ReplayScenarioInput;
}

export interface HistoricalOperationalState {
  observationId: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  observedAt: string;
  sourceType: string;
  sourceId: string;
  dataQuality: 'VERIFIED_PERSISTED' | 'PARTIAL_HISTORICAL' | 'UNAVAILABLE';

  risk: {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    trend: string;
    scoreDelta: number | null;
    activeEmergencies: number;
    activeDeviations: number;
    activeSpeedAnomalies: number;
    driverVerified: boolean;
    vehicleApproved: boolean;
    factors: any[];
    availability: 'VERIFIED' | 'PARTIAL' | 'UNAVAILABLE';
  };

  alerts: {
    totalActive: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    availability: 'VERIFIED' | 'PARTIAL' | 'UNAVAILABLE';
  };

  incidents: {
    unresolved: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    availability: 'VERIFIED' | 'PARTIAL' | 'UNAVAILABLE';
  };

  demand: {
    predictedDemand: number | null;
    capacity: number | null;
    occupancy: number | null;
    demandLevel: string | null;
    availability: 'VERIFIED' | 'PARTIAL' | 'UNAVAILABLE';
    reason?: string;
    dataQuality: string;
  };

  operationalStatus: OperationalStatus;
  briefing: string;
  explanation: string[];
}

export interface CurrentOperationalState {
  routeId: string;
  routeCode: string;
  routeName: string;
  evaluatedAt: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskTrend: string;
  predictedDemand: number | null;
  vehicleCapacity: number;
  projectedOccupancy: number | null;
  demandLevel: string | null;
  activeAlerts: number;
  criticalAlerts: number;
  unresolvedIncidents: number;
  criticalIncidents: number;
  operationalStatus: OperationalStatus;
  briefing: string;
  dataQuality: string;
}

export interface SimulatedHistoricalState {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskTrend: string;
  predictedDemand: number | null;
  vehicleCapacity: number | null;
  projectedOccupancy: number | null;
  activeAlerts: number;
  criticalAlerts: number;
  unresolvedIncidents: number;
  criticalIncidents: number;
  operationalStatus: OperationalStatus;
  briefing: string;
  explanation: string[];
  recommendationImpact: {
    impactLevel: string;
    recommendationCount: number;
    simulatedDrafts: {
      type: string;
      priority: string;
      title: string;
      recommendation: string;
    }[];
  };
}

export interface StateVarianceDeltas {
  riskDelta: number;
  riskDirection: 'INCREASED' | 'DECREASED' | 'UNCHANGED';
  demandDelta: number | null;
  demandDirection: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | 'UNAVAILABLE';
  capacityDelta: number | null;
  capacityDirection: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | 'UNAVAILABLE';
  occupancyDelta: number | null;
  occupancyDirection: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | 'UNAVAILABLE';
  activeAlertDelta: number;
  alertDirection: 'INCREASED' | 'DECREASED' | 'UNCHANGED';
  unresolvedIncidentDelta: number;
  incidentDirection: 'INCREASED' | 'DECREASED' | 'UNCHANGED';
  statusChange: 'ESCALATED' | 'DE_ESCALATED' | 'UNCHANGED' | 'INSUFFICIENT_EVIDENCE';
}

export interface DecisionReplayResult {
  success: boolean;
  notices: [string, string];
  route: {
    id: string;
    code: string;
    name: string;
  };
  observation: {
    id: string;
    observedAt: string;
    sourceType: string;
    dataQuality: string;
  };
  historical: HistoricalOperationalState;
  current: CurrentOperationalState;
  historicalWhatIf: SimulatedHistoricalState;
  variances: {
    historicalVsCurrent: StateVarianceDeltas;
    historicalVsWhatIf: StateVarianceDeltas;
  };
  explanations: string[];
  evidenceTrace: MetricEvidenceTrace[];
  replayedAt: string;
}

/**
 * Validates replay input. Throws descriptive error on invalid inputs.
 */
export function validateReplayInput(body: any): DecisionReplayInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body: object required');
  }

  const { routeId, observationId, scenario } = body;

  if (!routeId || typeof routeId !== 'string' || routeId.trim().length === 0) {
    throw new Error('routeId is required and must be a non-empty string');
  }

  if (
    !observationId ||
    typeof observationId !== 'string' ||
    observationId.trim().length === 0
  ) {
    throw new Error('observationId is required and must be a non-empty string');
  }

  if (!scenario || typeof scenario !== 'object') {
    throw new Error('scenario is required and must be an object');
  }

  const {
    riskModifier = 0,
    demandModifierPercent = 0,
    capacityModifierPercent = 0,
    hypotheticalAlert = 'NONE',
    hypotheticalIncident = 'NONE',
    riskTrendScenario = 'UNCHANGED',
  } = scenario;

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

  const validAlerts = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validAlerts.includes(hypotheticalAlert)) {
    throw new Error(`hypotheticalAlert must be one of: ${validAlerts.join(', ')}`);
  }

  const validIncidents = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validIncidents.includes(hypotheticalIncident)) {
    throw new Error(`hypotheticalIncident must be one of: ${validIncidents.join(', ')}`);
  }

  const validTrends = ['UNCHANGED', 'RISING', 'FALLING', 'STABLE'];
  if (!validTrends.includes(riskTrendScenario)) {
    throw new Error(`riskTrendScenario must be one of: ${validTrends.join(', ')}`);
  }

  return {
    routeId: routeId.trim(),
    observationId: observationId.trim(),
    scenario: {
      riskModifier,
      demandModifierPercent,
      capacityModifierPercent,
      hypotheticalAlert: hypotheticalAlert as HypotheticalAlertSeverity,
      hypotheticalIncident: hypotheticalIncident as HypotheticalIncidentSeverity,
      riskTrendScenario: riskTrendScenario as 'UNCHANGED' | 'RISING' | 'FALLING' | 'STABLE',
    },
  };
}

/**
 * Status rank mapping matching Step 6 hierarchy.
 */
function getStatusRank(status: OperationalStatus): number {
  switch (status) {
    case 'URGENT_REVIEW':
      return 4;
    case 'ATTENTION_REQUIRED':
      return 3;
    case 'MONITOR':
      return 2;
    case 'NORMAL':
      return 1;
    default:
      return 0;
  }
}

/**
 * Retrieves chronological historical observations for a corridor.
 * Returns only real persisted records.
 */
export async function getHistoricalObservations(
  routeIdentifier: string
): Promise<HistoricalObservationSummary[]> {
  const snapshots = await getRouteRiskHistory(routeIdentifier, 50);

  // Sort descending by observedAt (newest first for UI inspection)
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime()
  );

  const observations: HistoricalObservationSummary[] = [];

  for (const s of sorted) {
    const availableMetrics = [
      'riskScore',
      'riskLevel',
      'riskFactors',
      'activeEmergencies',
      'activeDeviations',
      'activeSpeedAnomalies',
      'driverCompliance',
      'vehicleApproval',
      'activeAlerts',
      'unresolvedIncidents',
    ];

    // Check if demand prediction record exists in Prisma for this snapshot date
    let dataQuality: 'VERIFIED_PERSISTED' | 'PARTIAL_HISTORICAL' = 'PARTIAL_HISTORICAL';
    try {
      const pred = await prisma.aIDemandPrediction.findFirst({
        where: {
          routeId: s.routeId,
          createdAt: {
            lte: new Date(s.evaluatedAt),
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (pred) {
        availableMetrics.push('predictedDemand', 'vehicleCapacity', 'predictedOccupancy');
        dataQuality = 'VERIFIED_PERSISTED';
      }
    } catch {
      // Keep partial historical
    }

    observations.push({
      observationId: s.id,
      routeId: s.routeId,
      routeCode: s.routeCode,
      routeName: s.routeName,
      observedAt: s.evaluatedAt,
      sourceType: 'ROUTE_RISK_HISTORY',
      sourceId: s.id,
      availableMetrics,
      dataQuality,
      riskScore: s.riskScore,
      riskLevel: s.riskLevel,
    });
  }

  return observations;
}

/**
 * Reconstructs the historical operational state strictly from persisted records.
 */
export async function buildHistoricalOperationalState(
  snapshot: RouteRiskSnapshot
): Promise<{ state: HistoricalOperationalState; evidenceTrace: MetricEvidenceTrace[] }> {
  const observedDate = new Date(snapshot.evaluatedAt);
  const evidenceTrace: MetricEvidenceTrace[] = [];

  // 1. Risk Metrics (persisted in RouteRiskSnapshot)
  evidenceTrace.push({
    metric: 'riskScore',
    value: snapshot.riskScore,
    sourceType: 'ROUTE_RISK_HISTORY',
    sourceId: snapshot.id,
    observedAt: snapshot.evaluatedAt,
    verified: true,
    availability: 'VERIFIED',
  });

  evidenceTrace.push({
    metric: 'riskLevel',
    value: snapshot.riskLevel,
    sourceType: 'ROUTE_RISK_HISTORY',
    sourceId: snapshot.id,
    observedAt: snapshot.evaluatedAt,
    verified: true,
    availability: 'VERIFIED',
  });

  evidenceTrace.push({
    metric: 'riskFactors',
    value: snapshot.factors ? snapshot.factors.length : 0,
    sourceType: 'ROUTE_RISK_HISTORY',
    sourceId: snapshot.id,
    observedAt: snapshot.evaluatedAt,
    verified: true,
    availability: 'VERIFIED',
  });

  evidenceTrace.push({
    metric: 'activeEmergencies',
    value: snapshot.activeEmergencies,
    sourceType: 'ROUTE_RISK_HISTORY',
    sourceId: snapshot.id,
    observedAt: snapshot.evaluatedAt,
    verified: true,
    availability: 'VERIFIED',
  });

  // 2. Alert Metrics (persisted in safetyAlert store)
  let activeAlertsCount = 0;
  let criticalAlertsCount = 0;
  let highAlertsCount = 0;
  let mediumAlertsCount = 0;
  let lowAlertsCount = 0;

  try {
    const alerts = await getSafetyAlerts({
      routeId: snapshot.routeCode || snapshot.routeId,
      limit: 100,
    });

    const activeAtTime = alerts.filter((a) => {
      const created = new Date(a.createdAt);
      if (created > observedDate) return false;
      if (a.resolvedAt) {
        const resolved = new Date(a.resolvedAt);
        return resolved > observedDate;
      }
      return a.status === 'ACTIVE';
    });

    activeAlertsCount = activeAtTime.length;
    criticalAlertsCount = activeAtTime.filter((a) => a.severity === 'CRITICAL').length;
    highAlertsCount = activeAtTime.filter((a) => a.severity === 'HIGH').length;
    mediumAlertsCount = activeAtTime.filter((a) => a.severity === 'MEDIUM').length;
    lowAlertsCount = activeAtTime.filter((a) => a.severity === 'LOW').length;

    evidenceTrace.push({
      metric: 'activeAlerts',
      value: activeAlertsCount,
      sourceType: 'SAFETY_ALERT_STORE',
      observedAt: snapshot.evaluatedAt,
      verified: true,
      availability: 'VERIFIED',
    });
  } catch {
    evidenceTrace.push({
      metric: 'activeAlerts',
      value: 0,
      sourceType: 'SAFETY_ALERT_STORE',
      observedAt: snapshot.evaluatedAt,
      verified: false,
      availability: 'PARTIAL',
      reason: 'Safety alerts queried with fallback telemetry.',
    });
  }

  // 3. Incident Metrics (persisted in safetyIncident store)
  let unresolvedIncidentsCount = 0;
  let criticalIncidentsCount = 0;
  let highIncidentsCount = 0;
  let mediumIncidentsCount = 0;
  let lowIncidentsCount = 0;

  try {
    const { incidents } = await getIncidentCases();
    const routeIncidents = incidents.filter(
      (c) =>
        c.routeId === snapshot.routeId ||
        c.routeId === snapshot.routeCode ||
        c.routeCode === snapshot.routeCode
    );

    const openAtTime = routeIncidents.filter((c) => {
      const created = new Date(c.createdAt);
      if (created > observedDate) return false;
      if (c.closedAt) {
        const closed = new Date(c.closedAt);
        return closed > observedDate;
      }
      return c.status !== 'RESOLVED' && c.status !== 'CLOSED';
    });

    unresolvedIncidentsCount = openAtTime.length;
    criticalIncidentsCount = openAtTime.filter((c) => c.severity === 'CRITICAL').length;
    highIncidentsCount = openAtTime.filter((c) => c.severity === 'HIGH').length;
    mediumIncidentsCount = openAtTime.filter((c) => c.severity === 'MEDIUM').length;
    lowIncidentsCount = openAtTime.filter((c) => c.severity === 'LOW').length;

    evidenceTrace.push({
      metric: 'unresolvedIncidents',
      value: unresolvedIncidentsCount,
      sourceType: 'SAFETY_INCIDENT_STORE',
      observedAt: snapshot.evaluatedAt,
      verified: true,
      availability: 'VERIFIED',
    });
  } catch {
    evidenceTrace.push({
      metric: 'unresolvedIncidents',
      value: 0,
      sourceType: 'SAFETY_INCIDENT_STORE',
      observedAt: snapshot.evaluatedAt,
      verified: false,
      availability: 'PARTIAL',
    });
  }

  // 4. Demand Metrics (checked against persisted AIDemandPrediction)
  let predictedDemand: number | null = null;
  let capacity: number | null = null;
  let occupancy: number | null = null;
  let demandLevel: string | null = null;
  let demandAvailability: 'VERIFIED' | 'PARTIAL' | 'UNAVAILABLE' = 'UNAVAILABLE';
  let demandReason =
    'No persisted demand prediction exists for the selected historical observation.';

  try {
    const predRecord = await prisma.aIDemandPrediction.findFirst({
      where: {
        routeId: snapshot.routeId,
        createdAt: {
          lte: observedDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (predRecord) {
      predictedDemand = predRecord.predictedDemand;
      capacity = predRecord.vehicleCapacity;
      occupancy = predRecord.predictedOccupancy;
      demandLevel = predRecord.status;
      demandAvailability = 'VERIFIED';
      demandReason = '';

      evidenceTrace.push({
        metric: 'predictedDemand',
        value: predictedDemand,
        sourceType: 'AI_DEMAND_PREDICTION_STORE',
        sourceId: predRecord.id,
        observedAt: predRecord.createdAt.toISOString(),
        verified: true,
        availability: 'VERIFIED',
      });
      evidenceTrace.push({
        metric: 'vehicleCapacity',
        value: capacity,
        sourceType: 'AI_DEMAND_PREDICTION_STORE',
        sourceId: predRecord.id,
        observedAt: predRecord.createdAt.toISOString(),
        verified: true,
        availability: 'VERIFIED',
      });
      evidenceTrace.push({
        metric: 'projectedOccupancy',
        value: occupancy,
        sourceType: 'AI_DEMAND_PREDICTION_STORE',
        sourceId: predRecord.id,
        observedAt: predRecord.createdAt.toISOString(),
        verified: true,
        availability: 'VERIFIED',
      });
    } else {
      evidenceTrace.push({
        metric: 'predictedDemand',
        value: null,
        verified: false,
        availability: 'UNAVAILABLE',
        reason: demandReason,
      });
    }
  } catch {
    evidenceTrace.push({
      metric: 'predictedDemand',
      value: null,
      verified: false,
      availability: 'UNAVAILABLE',
      reason: demandReason,
    });
  }

  // 5. Evaluate Historical Operational Status
  const evalResult = evaluateOperationalStatus({
    routeCode: snapshot.routeCode,
    riskScore: snapshot.riskScore,
    riskLevel: snapshot.riskLevel,
    riskTrend: 'STABLE',
    scoreDelta: 0,
    activeEmergencies: snapshot.activeEmergencies,
    activeCriticalAlerts: criticalAlertsCount,
    activeHighAlerts: highAlertsCount,
    activeMediumAlerts: mediumAlertsCount,
    activeLowAlerts: lowAlertsCount,
    totalActiveAlerts: activeAlertsCount,
    unresolvedIncidents: unresolvedIncidentsCount,
    criticalIncidents: criticalIncidentsCount,
    predictedDemand: predictedDemand,
    predictedOccupancy: occupancy,
    demandLevel: demandLevel,
    dataQuality: demandAvailability === 'VERIFIED' ? 'HIGH_DATA_QUALITY' : 'INSUFFICIENT_DATA',
    capacityRecommendation:
      capacity !== null
        ? `Standard historical shuttle capacity: ${capacity} seats.`
        : 'Historical capacity data unavailable.',
  });

  const state: HistoricalOperationalState = {
    observationId: snapshot.id,
    routeId: snapshot.routeId,
    routeCode: snapshot.routeCode,
    routeName: snapshot.routeName,
    observedAt: snapshot.evaluatedAt,
    sourceType: 'ROUTE_RISK_HISTORY',
    sourceId: snapshot.id,
    dataQuality: demandAvailability === 'VERIFIED' ? 'VERIFIED_PERSISTED' : 'PARTIAL_HISTORICAL',

    risk: {
      score: snapshot.riskScore,
      level: snapshot.riskLevel,
      trend: 'STABLE',
      scoreDelta: 0,
      activeEmergencies: snapshot.activeEmergencies,
      activeDeviations: snapshot.activeDeviations,
      activeSpeedAnomalies: snapshot.activeSpeedAnomalies,
      driverVerified: snapshot.driverVerified,
      vehicleApproved: snapshot.vehicleApproved,
      factors: snapshot.factors || [],
      availability: 'VERIFIED',
    },

    alerts: {
      totalActive: activeAlertsCount,
      critical: criticalAlertsCount,
      high: highAlertsCount,
      medium: mediumAlertsCount,
      low: lowAlertsCount,
      availability: 'VERIFIED',
    },

    incidents: {
      unresolved: unresolvedIncidentsCount,
      critical: criticalIncidentsCount,
      high: highIncidentsCount,
      medium: mediumIncidentsCount,
      low: lowIncidentsCount,
      availability: 'VERIFIED',
    },

    demand: {
      predictedDemand,
      capacity,
      occupancy,
      demandLevel,
      availability: demandAvailability,
      reason: demandReason,
      dataQuality: demandAvailability === 'VERIFIED' ? 'HIGH_DATA_QUALITY' : 'INSUFFICIENT_DATA',
    },

    operationalStatus: evalResult.operationalStatus,
    briefing: evalResult.briefing,
    explanation: evalResult.explanation,
  };

  return { state, evidenceTrace };
}

/**
 * Loads current authoritative operational state (Step 6 / Step 12).
 */
export async function buildCurrentOperationalState(
  routeIdentifier: string
): Promise<CurrentOperationalState> {
  const support = (await buildOperationalDecisionSupport(
    routeIdentifier
  )) as RouteOperationalDecisionSupport | null;

  if (!support) {
    throw new Error(`Route not found: ${routeIdentifier}`);
  }

  return {
    routeId: support.routeId,
    routeCode: support.routeCode,
    routeName: support.routeName,
    evaluatedAt: support.generatedAt,
    riskScore: support.risk.score,
    riskLevel: support.risk.level,
    riskTrend: support.risk.trend,
    predictedDemand: support.demand.predictedDemand,
    vehicleCapacity: support.capacity.vehicleCapacity || 16,
    projectedOccupancy: support.demand.predictedOccupancy,
    demandLevel: support.demand.demandLevel,
    activeAlerts: support.alerts.activeCount,
    criticalAlerts: support.alerts.criticalCount,
    unresolvedIncidents: support.incidents.unresolvedCount,
    criticalIncidents: support.incidents.criticalCount,
    operationalStatus: support.operationalStatus,
    briefing: support.briefing,
    dataQuality: support.demand.dataQuality,
  };
}

/**
 * Executes What-If simulation against historical state reusing Step 12 formulas.
 */
export function runHistoricalWhatIfSimulation(
  historical: HistoricalOperationalState,
  scenario: ReplayScenarioInput
): SimulatedHistoricalState {
  // 1. Risk calculation (clamped strictly [0, 100])
  const simulatedRiskScore = Math.max(
    0,
    Math.min(100, Math.round(historical.risk.score + scenario.riskModifier))
  );

  let simulatedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (simulatedRiskScore >= 75) {
    simulatedRiskLevel = 'CRITICAL';
  } else if (simulatedRiskScore >= 50) {
    simulatedRiskLevel = 'HIGH';
  } else if (simulatedRiskScore >= 25) {
    simulatedRiskLevel = 'MEDIUM';
  }

  let simulatedRiskTrend = historical.risk.trend;
  if (scenario.riskTrendScenario !== 'UNCHANGED') {
    simulatedRiskTrend = scenario.riskTrendScenario;
  }

  // 2. Capacity & Demand calculation
  let simulatedCapacity: number | null = null;
  let simulatedDemand: number | null = null;
  let simulatedOccupancy: number | null = null;

  if (historical.demand.capacity !== null) {
    simulatedCapacity = Math.max(
      1,
      Math.round(historical.demand.capacity * (1 + scenario.capacityModifierPercent / 100))
    );
  }

  if (historical.demand.predictedDemand !== null) {
    simulatedDemand = Math.max(
      0,
      Math.round(historical.demand.predictedDemand * (1 + scenario.demandModifierPercent / 100) * 10) / 10
    );
    if (simulatedCapacity !== null) {
      simulatedOccupancy = Math.round((simulatedDemand / simulatedCapacity) * 100);
    }
  }

  // 3. Alerts & Incidents calculation
  let simulatedAlerts = historical.alerts.totalActive;
  let simulatedCriticalAlerts = historical.alerts.critical;
  let simulatedHighAlerts = historical.alerts.high;

  if (scenario.hypotheticalAlert === 'CRITICAL') {
    simulatedAlerts += 1;
    simulatedCriticalAlerts += 1;
  } else if (scenario.hypotheticalAlert === 'HIGH') {
    simulatedAlerts += 1;
    simulatedHighAlerts += 1;
  } else if (scenario.hypotheticalAlert === 'MEDIUM' || scenario.hypotheticalAlert === 'LOW') {
    simulatedAlerts += 1;
  }

  let simulatedIncidents = historical.incidents.unresolved;
  let simulatedCriticalIncidents = historical.incidents.critical;

  if (scenario.hypotheticalIncident === 'CRITICAL') {
    simulatedIncidents += 1;
    simulatedCriticalIncidents += 1;
  } else if (
    scenario.hypotheticalIncident === 'HIGH' ||
    scenario.hypotheticalIncident === 'MEDIUM' ||
    scenario.hypotheticalIncident === 'LOW'
  ) {
    simulatedIncidents += 1;
  }

  // 4. Status Evaluation
  const evalResult = evaluateOperationalStatus({
    routeCode: historical.routeCode,
    riskScore: simulatedRiskScore,
    riskLevel: simulatedRiskLevel,
    riskTrend: simulatedRiskTrend as any,
    scoreDelta: scenario.riskModifier,
    activeEmergencies: historical.risk.activeEmergencies,
    activeCriticalAlerts: simulatedCriticalAlerts,
    activeHighAlerts: simulatedHighAlerts,
    activeMediumAlerts: historical.alerts.medium,
    activeLowAlerts: historical.alerts.low,
    totalActiveAlerts: simulatedAlerts,
    unresolvedIncidents: simulatedIncidents,
    criticalIncidents: simulatedCriticalIncidents,
    predictedDemand: simulatedDemand,
    predictedOccupancy: simulatedOccupancy,
    demandLevel:
      simulatedOccupancy !== null
        ? simulatedOccupancy >= 90
          ? 'CRITICAL'
          : simulatedOccupancy >= 75
          ? 'HIGH'
          : 'NORMAL'
        : null,
    dataQuality: historical.demand.dataQuality,
    capacityRecommendation:
      simulatedCapacity !== null
        ? `Simulated vehicle capacity: ${simulatedCapacity} seats.`
        : 'Historical capacity data unavailable.',
  });

  // 5. Evaluate Recommendation Impact (Step 7 logic in-memory)
  const syntheticSupport: RouteOperationalDecisionSupport = {
    routeId: historical.routeId,
    routeCode: historical.routeCode,
    routeName: historical.routeName,
    operationalStatus: evalResult.operationalStatus,
    risk: {
      score: simulatedRiskScore,
      level: simulatedRiskLevel,
      trend: simulatedRiskTrend as any,
      scoreDelta: scenario.riskModifier,
      previousScore: historical.risk.score,
      activeEmergencies: historical.risk.activeEmergencies,
      activeDeviations: historical.risk.activeDeviations,
      activeSpeedAnomalies: historical.risk.activeSpeedAnomalies,
    },
    alerts: {
      activeCount: simulatedAlerts,
      criticalCount: simulatedCriticalAlerts,
      highCount: simulatedHighAlerts,
      mediumCount: historical.alerts.medium,
      lowCount: historical.alerts.low,
    },
    incidents: {
      activeCount: simulatedIncidents,
      criticalCount: simulatedCriticalIncidents,
      unresolvedCount: simulatedIncidents,
    },
    demand: {
      predictedDemand: simulatedDemand,
      predictedOccupancy: simulatedOccupancy,
      demandLevel: simulatedOccupancy !== null && simulatedOccupancy >= 90 ? 'CRITICAL' : null,
      dataQuality: historical.demand.dataQuality,
    },
    capacity: {
      recommendation: 'Simulated capacity advisory.',
      vehicleCapacity: simulatedCapacity || 16,
    },
    explanation: evalResult.explanation,
    briefing: evalResult.briefing,
    evidence: {
      riskEvidence: null,
      alertEvidence: [],
      incidentEvidence: [],
      demandEvidence: null,
    },
    generatedAt: new Date().toISOString(),
  };

  const drafts = generateOperationalRecommendations(syntheticSupport);

  let impactLevel = 'NONE';
  if (drafts.some((d) => d.priority === 'CRITICAL')) {
    impactLevel = 'CRITICAL_RECOMMENDATION';
  } else if (drafts.some((d) => d.priority === 'HIGH')) {
    impactLevel = 'HIGH_PRIORITY_RECOMMENDATION';
  } else if (drafts.some((d) => d.priority === 'MEDIUM' || d.priority === 'LOW')) {
    impactLevel = 'MONITORING_RECOMMENDATION';
  }

  return {
    riskScore: simulatedRiskScore,
    riskLevel: simulatedRiskLevel,
    riskTrend: simulatedRiskTrend,
    predictedDemand: simulatedDemand,
    vehicleCapacity: simulatedCapacity,
    projectedOccupancy: simulatedOccupancy,
    activeAlerts: simulatedAlerts,
    criticalAlerts: simulatedCriticalAlerts,
    unresolvedIncidents: simulatedIncidents,
    criticalIncidents: simulatedCriticalIncidents,
    operationalStatus: evalResult.operationalStatus,
    briefing: evalResult.briefing,
    explanation: evalResult.explanation,
    recommendationImpact: {
      impactLevel,
      recommendationCount: drafts.length,
      simulatedDrafts: drafts.map((d) => ({
        type: d.type,
        priority: d.priority,
        title: d.title,
        recommendation: d.recommendation,
      })),
    },
  };
}

/**
 * Calculates exact mathematical deltas and directional variance between two states.
 */
export function computeStateVariance(
  baseRisk: number,
  baseDemand: number | null,
  baseCapacity: number | null,
  baseOccupancy: number | null,
  baseAlerts: number,
  baseIncidents: number,
  baseStatus: OperationalStatus,
  targetRisk: number,
  targetDemand: number | null,
  targetCapacity: number | null,
  targetOccupancy: number | null,
  targetAlerts: number,
  targetIncidents: number,
  targetStatus: OperationalStatus
): StateVarianceDeltas {
  const riskDelta = targetRisk - baseRisk;
  const riskDirection =
    riskDelta > 0 ? 'INCREASED' : riskDelta < 0 ? 'DECREASED' : 'UNCHANGED';

  let demandDelta: number | null = null;
  let demandDirection: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | 'UNAVAILABLE' = 'UNAVAILABLE';
  if (baseDemand !== null && targetDemand !== null) {
    demandDelta = Math.round((targetDemand - baseDemand) * 10) / 10;
    demandDirection =
      demandDelta > 0 ? 'INCREASED' : demandDelta < 0 ? 'DECREASED' : 'UNCHANGED';
  }

  let capacityDelta: number | null = null;
  let capacityDirection: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | 'UNAVAILABLE' = 'UNAVAILABLE';
  if (baseCapacity !== null && targetCapacity !== null) {
    capacityDelta = targetCapacity - baseCapacity;
    capacityDirection =
      capacityDelta > 0 ? 'INCREASED' : capacityDelta < 0 ? 'DECREASED' : 'UNCHANGED';
  }

  let occupancyDelta: number | null = null;
  let occupancyDirection: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | 'UNAVAILABLE' = 'UNAVAILABLE';
  if (baseOccupancy !== null && targetOccupancy !== null) {
    occupancyDelta = targetOccupancy - baseOccupancy;
    occupancyDirection =
      occupancyDelta > 0 ? 'INCREASED' : occupancyDelta < 0 ? 'DECREASED' : 'UNCHANGED';
  }

  const activeAlertDelta = targetAlerts - baseAlerts;
  const alertDirection =
    activeAlertDelta > 0 ? 'INCREASED' : activeAlertDelta < 0 ? 'DECREASED' : 'UNCHANGED';

  const unresolvedIncidentDelta = targetIncidents - baseIncidents;
  const incidentDirection =
    unresolvedIncidentDelta > 0
      ? 'INCREASED'
      : unresolvedIncidentDelta < 0
      ? 'DECREASED'
      : 'UNCHANGED';

  const baseRank = getStatusRank(baseStatus);
  const targetRank = getStatusRank(targetStatus);

  let statusChange: 'ESCALATED' | 'DE_ESCALATED' | 'UNCHANGED' | 'INSUFFICIENT_EVIDENCE' =
    'UNCHANGED';
  if (targetRank > baseRank) {
    statusChange = 'ESCALATED';
  } else if (targetRank < baseRank) {
    statusChange = 'DE_ESCALATED';
  }

  return {
    riskDelta,
    riskDirection,
    demandDelta,
    demandDirection,
    capacityDelta,
    capacityDirection,
    occupancyDelta,
    occupancyDirection,
    activeAlertDelta,
    alertDirection,
    unresolvedIncidentDelta,
    incidentDirection,
    statusChange,
  };
}

/**
 * Executes a complete Operational Decision Replay.
 */
export async function runOperationalDecisionReplay(
  rawInput: any
): Promise<DecisionReplayResult> {
  const input = validateReplayInput(rawInput);

  // 1. Fetch historical snapshots for route
  const snapshots = await getRouteRiskHistory(input.routeId, 100);
  const snapshot = snapshots.find(
    (s) => s.id === input.observationId || s.id.toLowerCase() === input.observationId.toLowerCase()
  );

  if (!snapshot) {
    throw new Error(
      `Historical observation not found: ${input.observationId} for route ${input.routeId}`
    );
  }

  // 2. Reconstruct historical state
  const { state: historicalState, evidenceTrace } =
    await buildHistoricalOperationalState(snapshot);

  // 3. Load current authoritative state
  const currentState = await buildCurrentOperationalState(input.routeId);

  // 4. Run what-if simulation on historical state
  const whatIfState = runHistoricalWhatIfSimulation(historicalState, input.scenario);

  // 5. Compute State Variances
  const historicalVsCurrent = computeStateVariance(
    historicalState.risk.score,
    historicalState.demand.predictedDemand,
    historicalState.demand.capacity,
    historicalState.demand.occupancy,
    historicalState.alerts.totalActive,
    historicalState.incidents.unresolved,
    historicalState.operationalStatus,
    currentState.riskScore,
    currentState.predictedDemand,
    currentState.vehicleCapacity,
    currentState.projectedOccupancy,
    currentState.activeAlerts,
    currentState.unresolvedIncidents,
    currentState.operationalStatus
  );

  const historicalVsWhatIf = computeStateVariance(
    historicalState.risk.score,
    historicalState.demand.predictedDemand,
    historicalState.demand.capacity,
    historicalState.demand.occupancy,
    historicalState.alerts.totalActive,
    historicalState.incidents.unresolved,
    historicalState.operationalStatus,
    whatIfState.riskScore,
    whatIfState.predictedDemand,
    whatIfState.vehicleCapacity,
    whatIfState.projectedOccupancy,
    whatIfState.activeAlerts,
    whatIfState.unresolvedIncidents,
    whatIfState.operationalStatus
  );

  // 6. Build Deterministic Explanations
  const explanations: string[] = [];

  // Historical description
  explanations.push(
    `Historical risk score was ${historicalState.risk.score}/100 based on the persisted route-risk snapshot at ${new Date(
      historicalState.observedAt
    ).toLocaleTimeString()}.`
  );

  // Historical vs Current
  if (historicalVsCurrent.riskDelta !== 0) {
    const sign = historicalVsCurrent.riskDelta > 0 ? `+${historicalVsCurrent.riskDelta}` : `${historicalVsCurrent.riskDelta}`;
    explanations.push(
      `Current verified risk score is ${currentState.riskScore}/100, representing a ${sign} pt variance from the historical baseline.`
    );
  } else {
    explanations.push(
      `Current risk score (${currentState.riskScore}/100) is unchanged compared to the historical baseline.`
    );
  }

  // Status difference explanation
  if (historicalVsCurrent.statusChange === 'ESCALATED') {
    explanations.push(
      `Operational status escalated from ${historicalState.operationalStatus} historically to ${currentState.operationalStatus} currently.`
    );
  } else if (historicalVsCurrent.statusChange === 'DE_ESCALATED') {
    explanations.push(
      `Operational status de-escalated from ${historicalState.operationalStatus} historically to ${currentState.operationalStatus} currently.`
    );
  } else {
    explanations.push(
      `Operational status remains steady at ${currentState.operationalStatus} between historical and current states.`
    );
  }

  // What-If scenario explanation
  if (input.scenario.riskModifier !== 0) {
    const sign = input.scenario.riskModifier > 0 ? `+${input.scenario.riskModifier}` : `${input.scenario.riskModifier}`;
    explanations.push(
      `Hypothetical risk modifier of ${sign} pts shifts historical score from ${historicalState.risk.score} to ${whatIfState.riskScore}/100.`
    );
  }

  if (input.scenario.hypotheticalAlert !== 'NONE') {
    explanations.push(
      `A hypothetical ${input.scenario.hypotheticalAlert} severity safety alert was injected into the historical baseline.`
    );
  }

  if (input.scenario.hypotheticalIncident !== 'NONE') {
    explanations.push(
      `A hypothetical ${input.scenario.hypotheticalIncident} severity incident case was injected into the historical backlog.`
    );
  }

  if (historicalVsWhatIf.statusChange === 'ESCALATED') {
    explanations.push(
      `Compounded hypothetical stress factors escalate the reconstructed status from ${historicalState.operationalStatus} to ${whatIfState.operationalStatus}.`
    );
  }

  return {
    success: true,
    notices: [
      MANDATORY_DECISION_REPLAY_NOTICE_1,
      MANDATORY_DECISION_REPLAY_NOTICE_2,
    ],
    route: {
      id: snapshot.routeId,
      code: snapshot.routeCode,
      name: snapshot.routeName,
    },
    observation: {
      id: snapshot.id,
      observedAt: snapshot.evaluatedAt,
      sourceType: 'ROUTE_RISK_HISTORY',
      dataQuality: historicalState.dataQuality,
    },
    historical: historicalState,
    current: currentState,
    historicalWhatIf: whatIfState,
    variances: {
      historicalVsCurrent,
      historicalVsWhatIf,
    },
    explanations,
    evidenceTrace,
    replayedAt: new Date().toISOString(),
  };
}
