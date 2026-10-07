/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — OPERATIONAL SCENARIO SIMULATION & WHAT-IF ANALYSIS ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 12: Deterministic What-If Scenario Simulator for Admin.
 *
 * Rules:
 * - Purely deterministic, non-mutative, advisory simulation.
 * - Baselines are strictly fetched server-side from verified Step 1–6 intelligence;
 *   client-supplied baseline values are strictly ignored.
 * - Zero LLM generation or probabilistic guesswork.
 * - Zero database writes, zero route/schedule mutations, zero audit ledger pollution.
 * - Safe bounded inputs: risk (-50 to +50), demand (-50% to +100%), capacity (-50% to +100%).
 * - Simulated risk score clamped strictly between 0 and 100.
 */

import {
  buildOperationalDecisionSupport,
  evaluateOperationalStatus,
  OperationalStatus,
  RouteOperationalDecisionSupport,
} from '@/lib/operations/decision-support-engine';
import { generateOperationalRecommendations } from '@/lib/operations/recommendation-engine';

export const MANDATORY_SCENARIO_SIMULATION_NOTICE =
  'Hypothetical simulation only. Simulation results do not modify routes, schedules, vehicles, drivers, subscriptions, bookings, alerts, incidents, recommendations, or dispatch operations.';

export type HypotheticalAlertSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type HypotheticalIncidentSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskTrendScenario = 'NO_CHANGE' | 'RISING' | 'STABLE' | 'FALLING';

export interface ScenarioSimulationInput {
  routeId: string;
  riskModifier: number; // -50 to +50
  demandModifierPercent: number; // -50 to +100
  capacityModifierPercent: number; // -50 to +100
  hypotheticalAlert?: HypotheticalAlertSeverity;
  hypotheticalIncident?: HypotheticalIncidentSeverity;
  riskTrendScenario?: RiskTrendScenario;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  modifiers: {
    riskModifier: number;
    demandModifierPercent: number;
    capacityModifierPercent: number;
    hypotheticalAlert: HypotheticalAlertSeverity;
    hypotheticalIncident: HypotheticalIncidentSeverity;
    riskTrendScenario: RiskTrendScenario;
  };
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'NORMAL_BASELINE',
    name: 'Normal Baseline',
    description: 'Current real-time operational parameters with zero modifications.',
    modifiers: {
      riskModifier: 0,
      demandModifierPercent: 0,
      capacityModifierPercent: 0,
      hypotheticalAlert: 'NONE',
      hypotheticalIncident: 'NONE',
      riskTrendScenario: 'NO_CHANGE',
    },
  },
  {
    id: 'DEMAND_SURGE',
    name: 'Demand Surge',
    description: 'Simulates a 40% passenger demand increase with standard capacity.',
    modifiers: {
      riskModifier: 0,
      demandModifierPercent: 40,
      capacityModifierPercent: 0,
      hypotheticalAlert: 'NONE',
      hypotheticalIncident: 'NONE',
      riskTrendScenario: 'NO_CHANGE',
    },
  },
  {
    id: 'CAPACITY_REDUCTION',
    name: 'Capacity Reduction',
    description: 'Simulates a 30% reduction in vehicle capacity due to fleet maintenance.',
    modifiers: {
      riskModifier: 0,
      demandModifierPercent: 0,
      capacityModifierPercent: -30,
      hypotheticalAlert: 'NONE',
      hypotheticalIncident: 'NONE',
      riskTrendScenario: 'NO_CHANGE',
    },
  },
  {
    id: 'RISING_RISK',
    name: 'Rising Risk',
    description: 'Simulates a 25-point risk score surge with an escalating trend.',
    modifiers: {
      riskModifier: 25,
      demandModifierPercent: 0,
      capacityModifierPercent: 0,
      hypotheticalAlert: 'NONE',
      hypotheticalIncident: 'NONE',
      riskTrendScenario: 'RISING',
    },
  },
  {
    id: 'HIGH_SEVERITY_ALERT',
    name: 'New High-Severity Alert',
    description: 'Injects a high-severity safety alert with moderate risk increase.',
    modifiers: {
      riskModifier: 10,
      demandModifierPercent: 0,
      capacityModifierPercent: 0,
      hypotheticalAlert: 'HIGH',
      hypotheticalIncident: 'NONE',
      riskTrendScenario: 'RISING',
    },
  },
  {
    id: 'CRITICAL_SAFETY_SCENARIO',
    name: 'Critical Safety Scenario',
    description: 'Injects critical alert and critical incident with +35 risk surge.',
    modifiers: {
      riskModifier: 35,
      demandModifierPercent: 0,
      capacityModifierPercent: 0,
      hypotheticalAlert: 'CRITICAL',
      hypotheticalIncident: 'CRITICAL',
      riskTrendScenario: 'RISING',
    },
  },
  {
    id: 'COMBINED_STRESS_SCENARIO',
    name: 'Combined Stress Scenario',
    description: 'Compound stress: +50% demand, -25% capacity, +30 risk, and High alert.',
    modifiers: {
      riskModifier: 30,
      demandModifierPercent: 50,
      capacityModifierPercent: -25,
      hypotheticalAlert: 'HIGH',
      hypotheticalIncident: 'MEDIUM',
      riskTrendScenario: 'RISING',
    },
  },
];

export interface ScenarioSimulationResult {
  success: boolean;
  notice: string;
  route: {
    id: string;
    code: string;
    name: string;
  };
  modifiersApplied: {
    riskModifier: number;
    demandModifierPercent: number;
    capacityModifierPercent: number;
    hypotheticalAlert: HypotheticalAlertSeverity;
    hypotheticalIncident: HypotheticalIncidentSeverity;
    riskTrendScenario: RiskTrendScenario;
  };
  baseline: {
    operationalStatus: OperationalStatus;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskTrend: string;
    demand: number | null;
    capacity: number;
    occupancy: number | null;
    activeAlerts: number;
    criticalAlerts: number;
    unresolvedIncidents: number;
    criticalIncidents: number;
    briefing: string;
  };
  simulated: {
    operationalStatus: OperationalStatus;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskTrend: string;
    demand: number | null;
    capacity: number;
    occupancy: number | null;
    demandLevel: string | null;
    activeAlerts: number;
    criticalAlerts: number;
    unresolvedIncidents: number;
    criticalIncidents: number;
    briefing: string;
    explanation: string[];
    capacityRecommendation: string;
  };
  comparison: {
    riskDelta: number;
    statusChange: 'ESCALATED' | 'DE_ESCALATED' | 'UNCHANGED';
    occupancyDelta: number | null;
    capacityDelta: number;
    demandDelta: number | null;
    alertsDelta: number;
    incidentsDelta: number;
  };
  recommendationImpact: {
    impactLevel: 'NONE' | 'MONITORING_RECOMMENDATION' | 'HIGH_PRIORITY_RECOMMENDATION' | 'CRITICAL_RECOMMENDATION';
    simulatedRecommendationCount: number;
    simulatedDrafts: {
      type: string;
      priority: string;
      title: string;
      recommendation: string;
    }[];
  };
  simulationExplanations: string[];
  simulatedAt: string;
}

/**
 * Validates simulation parameters. Throws descriptive error if invalid.
 */
export function validateSimulationInput(body: any): ScenarioSimulationInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body: object required');
  }

  const {
    routeId,
    riskModifier,
    demandModifierPercent,
    capacityModifierPercent,
    hypotheticalAlert = 'NONE',
    hypotheticalIncident = 'NONE',
    riskTrendScenario = 'NO_CHANGE',
  } = body;

  if (!routeId || typeof routeId !== 'string' || routeId.trim().length === 0) {
    throw new Error('routeId is required and must be a non-empty string');
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

  const validAlerts = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validAlerts.includes(hypotheticalAlert)) {
    throw new Error(`hypotheticalAlert must be one of: ${validAlerts.join(', ')}`);
  }

  const validIncidents = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validIncidents.includes(hypotheticalIncident)) {
    throw new Error(`hypotheticalIncident must be one of: ${validIncidents.join(', ')}`);
  }

  const validTrends = ['NO_CHANGE', 'RISING', 'STABLE', 'FALLING'];
  if (!validTrends.includes(riskTrendScenario)) {
    throw new Error(`riskTrendScenario must be one of: ${validTrends.join(', ')}`);
  }

  return {
    routeId: routeId.trim(),
    riskModifier,
    demandModifierPercent,
    capacityModifierPercent,
    hypotheticalAlert: hypotheticalAlert as HypotheticalAlertSeverity,
    hypotheticalIncident: hypotheticalIncident as HypotheticalIncidentSeverity,
    riskTrendScenario: riskTrendScenario as RiskTrendScenario,
  };
}

/**
 * Deterministic rank mapping for operational status comparison.
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
 * Executes a deterministic what-if scenario simulation against verified live baseline intelligence.
 */
export async function runOperationalScenarioSimulation(
  rawInput: any
): Promise<ScenarioSimulationResult> {
  const input = validateSimulationInput(rawInput);

  // 1. Fetch server-side verified baseline intelligence
  // Client-supplied baseline values are strictly ignored
  const baselineSupport = (await buildOperationalDecisionSupport(
    input.routeId
  )) as RouteOperationalDecisionSupport | null;

  if (!baselineSupport) {
    throw new Error(`Route not found: ${input.routeId}`);
  }

  const nowIso = new Date().toISOString();

  // 2. Extract baseline values
  const baselineRiskScore = baselineSupport.risk.score;
  const baselineRiskLevel = baselineSupport.risk.level;
  const baselineRiskTrend = baselineSupport.risk.trend;
  const baselineCapacity = baselineSupport.capacity.vehicleCapacity || 16;
  const baselineDemand = baselineSupport.demand.predictedDemand;
  const baselineOccupancy = baselineSupport.demand.predictedOccupancy;
  const baselineStatus = baselineSupport.operationalStatus;

  // 3. Compute Simulated Risk Score & Level
  // Clamped strictly between 0 and 100
  const simulatedRiskScore = Math.max(
    0,
    Math.min(100, Math.round(baselineRiskScore + input.riskModifier))
  );

  let simulatedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (simulatedRiskScore >= 75) {
    simulatedRiskLevel = 'CRITICAL';
  } else if (simulatedRiskScore >= 50) {
    simulatedRiskLevel = 'HIGH';
  } else if (simulatedRiskScore >= 25) {
    simulatedRiskLevel = 'MEDIUM';
  } else {
    simulatedRiskLevel = 'LOW';
  }

  // 4. Compute Simulated Risk Trend
  let simulatedRiskTrend: 'RISING' | 'FALLING' | 'STABLE' | 'NO_HISTORY' =
    baselineRiskTrend as any;
  if (input.riskTrendScenario && input.riskTrendScenario !== 'NO_CHANGE') {
    simulatedRiskTrend = input.riskTrendScenario;
  }

  // Calculate score delta for trend evaluation
  const riskDelta = simulatedRiskScore - baselineRiskScore;
  const scoreDelta =
    simulatedRiskTrend === 'RISING'
      ? Math.max(riskDelta > 0 ? riskDelta : 10, 10)
      : simulatedRiskTrend === 'FALLING'
      ? -Math.abs(riskDelta)
      : 0;

  // 5. Compute Simulated Capacity
  // Vehicle capacity cannot drop below 1
  const simulatedCapacity = Math.max(
    1,
    Math.round(baselineCapacity * (1 + input.capacityModifierPercent / 100))
  );

  // 6. Compute Simulated Demand & Occupancy
  let simulatedDemand: number | null = null;
  let simulatedOccupancy: number | null = null;
  let simulatedDemandLevel: string | null = null;
  let simulatedDataQuality = baselineSupport.demand.dataQuality;

  if (baselineDemand !== null && baselineSupport.demand.dataQuality !== 'INSUFFICIENT_DATA') {
    simulatedDemand = Math.max(
      0,
      Math.round(baselineDemand * (1 + input.demandModifierPercent / 100) * 10) / 10
    );
    simulatedOccupancy = Math.round((simulatedDemand / simulatedCapacity) * 100);

    if (simulatedOccupancy >= 90) {
      simulatedDemandLevel = 'CRITICAL';
    } else if (simulatedOccupancy >= 75) {
      simulatedDemandLevel = 'HIGH';
    } else if (simulatedOccupancy >= 50) {
      simulatedDemandLevel = 'MODERATE';
    } else {
      simulatedDemandLevel = 'LOW';
    }
  } else {
    // Honest handling of insufficient data
    simulatedDemand = null;
    simulatedOccupancy = null;
    simulatedDemandLevel = null;
    simulatedDataQuality = 'INSUFFICIENT_DATA';
  }

  // 7. Compute Simulated Capacity Recommendation
  let simulatedCapacityRecommendation = 'Standard shuttle capacity is adequate for current route schedule.';
  if (simulatedOccupancy !== null) {
    if (simulatedOccupancy >= 90) {
      simulatedCapacityRecommendation = `Capacity strain imminent (${simulatedOccupancy}% occupancy). Additional vehicle capacity or high-capacity shuttle recommended.`;
    } else if (simulatedOccupancy >= 75) {
      simulatedCapacityRecommendation = `Moderate capacity utilization (${simulatedOccupancy}% occupancy). Monitor corridor ridership.`;
    } else {
      simulatedCapacityRecommendation = `Standard shuttle capacity is adequate (${simulatedOccupancy}% occupancy).`;
    }
  } else {
    simulatedCapacityRecommendation = 'Capacity analysis unavailable due to insufficient historical demand data.';
  }

  // 8. Compute Simulated Alerts
  const simulatedAlerts = {
    activeCount: baselineSupport.alerts.activeCount,
    criticalCount: baselineSupport.alerts.criticalCount,
    highCount: baselineSupport.alerts.highCount,
    mediumCount: baselineSupport.alerts.mediumCount,
    lowCount: baselineSupport.alerts.lowCount,
  };

  if (input.hypotheticalAlert === 'CRITICAL') {
    simulatedAlerts.criticalCount += 1;
    simulatedAlerts.activeCount += 1;
  } else if (input.hypotheticalAlert === 'HIGH') {
    simulatedAlerts.highCount += 1;
    simulatedAlerts.activeCount += 1;
  } else if (input.hypotheticalAlert === 'MEDIUM') {
    simulatedAlerts.mediumCount += 1;
    simulatedAlerts.activeCount += 1;
  } else if (input.hypotheticalAlert === 'LOW') {
    simulatedAlerts.lowCount += 1;
    simulatedAlerts.activeCount += 1;
  }

  // 9. Compute Simulated Incidents
  const simulatedIncidents = {
    activeCount: baselineSupport.incidents.activeCount,
    criticalCount: baselineSupport.incidents.criticalCount,
    unresolvedCount: baselineSupport.incidents.unresolvedCount,
  };

  if (input.hypotheticalIncident === 'CRITICAL') {
    simulatedIncidents.criticalCount += 1;
    simulatedIncidents.activeCount += 1;
    simulatedIncidents.unresolvedCount += 1;
  } else if (input.hypotheticalIncident === 'HIGH' || input.hypotheticalIncident === 'MEDIUM' || input.hypotheticalIncident === 'LOW') {
    simulatedIncidents.activeCount += 1;
    simulatedIncidents.unresolvedCount += 1;
  }

  // 10. Evaluate Simulated Operational Status using deterministic engine (Step 6)
  const evalResult = evaluateOperationalStatus({
    routeCode: baselineSupport.routeCode,
    riskScore: simulatedRiskScore,
    riskLevel: simulatedRiskLevel,
    riskTrend: simulatedRiskTrend,
    scoreDelta,
    activeEmergencies: baselineSupport.risk.activeEmergencies,
    activeCriticalAlerts: simulatedAlerts.criticalCount,
    activeHighAlerts: simulatedAlerts.highCount,
    activeMediumAlerts: simulatedAlerts.mediumCount,
    activeLowAlerts: simulatedAlerts.lowCount,
    totalActiveAlerts: simulatedAlerts.activeCount,
    unresolvedIncidents: simulatedIncidents.unresolvedCount,
    criticalIncidents: simulatedIncidents.criticalCount,
    predictedDemand: simulatedDemand,
    predictedOccupancy: simulatedOccupancy,
    demandLevel: simulatedDemandLevel,
    dataQuality: simulatedDataQuality,
    capacityRecommendation: simulatedCapacityRecommendation,
  });

  const simulatedStatus = evalResult.operationalStatus;

  // 11. Status Change Determination
  const baselineRank = getStatusRank(baselineStatus);
  const simulatedRank = getStatusRank(simulatedStatus);

  let statusChange: 'ESCALATED' | 'DE_ESCALATED' | 'UNCHANGED' = 'UNCHANGED';
  if (simulatedRank > baselineRank) {
    statusChange = 'ESCALATED';
  } else if (simulatedRank < baselineRank) {
    statusChange = 'DE_ESCALATED';
  }

  // 12. Evaluate Simulated Recommendations Impact (Step 7)
  const hypotheticalDecisionSupport: RouteOperationalDecisionSupport = {
    ...baselineSupport,
    operationalStatus: simulatedStatus,
    risk: {
      ...baselineSupport.risk,
      score: simulatedRiskScore,
      level: simulatedRiskLevel,
      trend: simulatedRiskTrend,
      scoreDelta,
    },
    alerts: simulatedAlerts,
    incidents: simulatedIncidents,
    demand: {
      predictedDemand: simulatedDemand,
      predictedOccupancy: simulatedOccupancy,
      demandLevel: simulatedDemandLevel,
      dataQuality: simulatedDataQuality,
    },
    capacity: {
      vehicleCapacity: simulatedCapacity,
      recommendation: simulatedCapacityRecommendation,
    },
    explanation: evalResult.explanation,
    briefing: evalResult.briefing,
  };

  const simulatedDrafts = generateOperationalRecommendations(hypotheticalDecisionSupport);

  let impactLevel: 'NONE' | 'MONITORING_RECOMMENDATION' | 'HIGH_PRIORITY_RECOMMENDATION' | 'CRITICAL_RECOMMENDATION' = 'NONE';
  if (simulatedDrafts.some((d) => d.priority === 'CRITICAL')) {
    impactLevel = 'CRITICAL_RECOMMENDATION';
  } else if (simulatedDrafts.some((d) => d.priority === 'HIGH')) {
    impactLevel = 'HIGH_PRIORITY_RECOMMENDATION';
  } else if (simulatedDrafts.some((d) => d.priority === 'MEDIUM' || d.priority === 'LOW')) {
    impactLevel = 'MONITORING_RECOMMENDATION';
  }

  // 13. Generate Deterministic Simulation Explanations
  const simulationExplanations: string[] = [];

  // Risk change explanation
  if (input.riskModifier !== 0) {
    const sign = input.riskModifier > 0 ? `+${input.riskModifier}` : `${input.riskModifier}`;
    simulationExplanations.push(
      `Risk modifier applied: ${sign} pts shifted score from ${baselineRiskScore} to ${simulatedRiskScore}/100 (${simulatedRiskLevel} level).`
    );
  } else {
    simulationExplanations.push(
      `Risk score remains at baseline: ${baselineRiskScore}/100 (${baselineRiskLevel} level).`
    );
  }

  // Trend explanation
  if (input.riskTrendScenario !== 'NO_CHANGE') {
    simulationExplanations.push(
      `Risk trend modified from ${baselineRiskTrend} to hypothetical ${input.riskTrendScenario} trajectory.`
    );
  }

  // Demand & Capacity explanation
  if (input.demandModifierPercent !== 0 || input.capacityModifierPercent !== 0) {
    if (simulatedOccupancy !== null && baselineOccupancy !== null) {
      const occDelta = simulatedOccupancy - baselineOccupancy;
      const occSign = occDelta >= 0 ? `+${occDelta}` : `${occDelta}`;
      simulationExplanations.push(
        `Demand adjustment (${input.demandModifierPercent >= 0 ? `+${input.demandModifierPercent}%` : `${input.demandModifierPercent}%`}) and capacity adjustment (${input.capacityModifierPercent >= 0 ? `+${input.capacityModifierPercent}%` : `${input.capacityModifierPercent}%`}) shifted vehicle occupancy by ${occSign}% (from ${baselineOccupancy}% to ${simulatedOccupancy}%).`
      );
    } else if (simulatedDataQuality === 'INSUFFICIENT_DATA') {
      simulationExplanations.push(
        'Demand intelligence unavailable due to insufficient historical telemetry on corridor.'
      );
    }
  }

  // Hypothetical Alert explanation
  if (input.hypotheticalAlert !== 'NONE') {
    simulationExplanations.push(
      `Hypothetical ${input.hypotheticalAlert} severity safety alert injected into corridor evaluation (total active: ${simulatedAlerts.activeCount}).`
    );
  }

  // Hypothetical Incident explanation
  if (input.hypotheticalIncident !== 'NONE') {
    simulationExplanations.push(
      `Hypothetical ${input.hypotheticalIncident} severity incident case added to corridor response backlog (unresolved: ${simulatedIncidents.unresolvedCount}).`
    );
  }

  // Operational Status shift explanation
  if (statusChange === 'ESCALATED') {
    simulationExplanations.push(
      `CRITICAL NOTICE: Operational status escalated from ${baselineStatus} to ${simulatedStatus} due to compounded hypothetical stress factors.`
    );
  } else if (statusChange === 'DE_ESCALATED') {
    simulationExplanations.push(
      `Operational status de-escalated from ${baselineStatus} to ${simulatedStatus} under favorable simulated conditions.`
    );
  } else {
    simulationExplanations.push(
      `Operational status remains steady at ${simulatedStatus}.`
    );
  }

  return {
    success: true,
    notice: MANDATORY_SCENARIO_SIMULATION_NOTICE,
    route: {
      id: baselineSupport.routeId,
      code: baselineSupport.routeCode,
      name: baselineSupport.routeName,
    },
    modifiersApplied: {
      riskModifier: input.riskModifier,
      demandModifierPercent: input.demandModifierPercent,
      capacityModifierPercent: input.capacityModifierPercent,
      hypotheticalAlert: input.hypotheticalAlert || 'NONE',
      hypotheticalIncident: input.hypotheticalIncident || 'NONE',
      riskTrendScenario: input.riskTrendScenario || 'NO_CHANGE',
    },
    baseline: {
      operationalStatus: baselineStatus,
      riskScore: baselineRiskScore,
      riskLevel: baselineRiskLevel,
      riskTrend: baselineRiskTrend,
      demand: baselineDemand,
      capacity: baselineCapacity,
      occupancy: baselineOccupancy,
      activeAlerts: baselineSupport.alerts.activeCount,
      criticalAlerts: baselineSupport.alerts.criticalCount,
      unresolvedIncidents: baselineSupport.incidents.unresolvedCount,
      criticalIncidents: baselineSupport.incidents.criticalCount,
      briefing: baselineSupport.briefing,
    },
    simulated: {
      operationalStatus: simulatedStatus,
      riskScore: simulatedRiskScore,
      riskLevel: simulatedRiskLevel,
      riskTrend: simulatedRiskTrend,
      demand: simulatedDemand,
      capacity: simulatedCapacity,
      occupancy: simulatedOccupancy,
      demandLevel: simulatedDemandLevel,
      activeAlerts: simulatedAlerts.activeCount,
      criticalAlerts: simulatedAlerts.criticalCount,
      unresolvedIncidents: simulatedIncidents.unresolvedCount,
      criticalIncidents: simulatedIncidents.criticalCount,
      briefing: evalResult.briefing,
      explanation: evalResult.explanation,
      capacityRecommendation: simulatedCapacityRecommendation,
    },
    comparison: {
      riskDelta,
      statusChange,
      occupancyDelta:
        simulatedOccupancy !== null && baselineOccupancy !== null
          ? simulatedOccupancy - baselineOccupancy
          : null,
      capacityDelta: simulatedCapacity - baselineCapacity,
      demandDelta:
        simulatedDemand !== null && baselineDemand !== null
          ? Math.round((simulatedDemand - baselineDemand) * 10) / 10
          : null,
      alertsDelta: simulatedAlerts.activeCount - baselineSupport.alerts.activeCount,
      incidentsDelta: simulatedIncidents.unresolvedCount - baselineSupport.incidents.unresolvedCount,
    },
    recommendationImpact: {
      impactLevel,
      simulatedRecommendationCount: simulatedDrafts.length,
      simulatedDrafts: simulatedDrafts.map((d) => ({
        type: d.type,
        priority: d.priority,
        title: d.title,
        recommendation: d.recommendation,
      })),
    },
    simulationExplanations,
    simulatedAt: nowIso,
  };
}
