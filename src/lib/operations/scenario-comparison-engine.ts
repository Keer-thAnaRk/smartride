/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — OPERATIONAL SCENARIO COMPARISON & DECISION PLANNING ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 13: Multi-scenario comparative decision planning for Admin.
 *
 * Rules:
 * - Purely deterministic, non-mutative, advisory scenario comparison.
 * - Reuses verified Step 12 simulation pipeline (`runOperationalScenarioSimulation`).
 * - Baselines are strictly fetched server-side from verified intelligence;
 *   client-supplied baseline values are strictly ignored.
 * - Minimum 2 scenarios, maximum 5 scenarios.
 * - Zero LLM generation or probabilistic guesswork.
 * - Zero database writes, zero route/schedule mutations, zero audit ledger pollution.
 * - Safe bounded inputs matching Step 12 limits.
 * - Factual trade-off analysis without subjective "best" or "worst" labels.
 */

import {
  runOperationalScenarioSimulation,
  ScenarioSimulationResult,
  HypotheticalAlertSeverity,
  HypotheticalIncidentSeverity,
  RiskTrendScenario,
  SCENARIO_PRESETS,
  ScenarioPreset,
} from '@/lib/operations/scenario-simulation-engine';
import {
  buildOperationalDecisionSupport,
  OperationalStatus,
  RouteOperationalDecisionSupport,
} from '@/lib/operations/decision-support-engine';

export const MANDATORY_SCENARIO_COMPARISON_NOTICE_1 =
  'Scenario comparison is advisory and deterministic. Simulations do not modify routes, schedules, vehicles, drivers, subscriptions, bookings, dispatch assignments, or operational resources.';

export const MANDATORY_SCENARIO_COMPARISON_NOTICE_2 =
  'Scenario results are hypothetical projections generated from verified server-side baseline intelligence. They are not operational commands.';

export interface ScenarioDefinitionInput {
  id?: string;
  name: string;
  description?: string;
  riskModifier: number; // -50 to +50
  demandModifierPercent: number; // -50 to +100
  capacityModifierPercent: number; // -50 to +100
  hypotheticalAlert?: HypotheticalAlertSeverity;
  hypotheticalIncident?: HypotheticalIncidentSeverity;
  riskTrendScenario?: RiskTrendScenario;
}

export interface ScenarioComparisonInput {
  routeId: string;
  scenarios: ScenarioDefinitionInput[];
}

export interface ScenarioComparisonItem {
  id: string;
  name: string;
  description: string;
  isBaseline: boolean;

  // Modifiers applied
  modifiers: {
    riskModifier: number;
    demandModifierPercent: number;
    capacityModifierPercent: number;
    hypotheticalAlert: HypotheticalAlertSeverity;
    hypotheticalIncident: HypotheticalIncidentSeverity;
    riskTrendScenario: RiskTrendScenario;
  };

  // Operational metrics
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskTrend: string;
  predictedDemand: number | null;
  vehicleCapacity: number;
  projectedOccupancy: number | null;
  demandLevel: string | null;
  dataQuality: string;

  // Alerts & Incidents
  activeAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  totalActiveAlerts: number;
  unresolvedIncidents: number;
  criticalIncidents: number;

  // Operational status & shift
  operationalStatus: OperationalStatus;
  statusChange: 'ESCALATED' | 'DE_ESCALATED' | 'UNCHANGED';
  briefing: string;

  // Deltas against BASELINE
  deltas: {
    riskScoreDelta: number;
    demandDelta: number | null;
    capacityDelta: number;
    occupancyDelta: number | null;
    alertDelta: number;
    incidentDelta: number;
  };

  // Recommendation Impact
  recommendationImpact: {
    impactLevel: 'NONE' | 'MONITORING_RECOMMENDATION' | 'HIGH_PRIORITY_RECOMMENDATION' | 'CRITICAL_RECOMMENDATION';
    recommendationCount: number;
    recommendationTypes: string[];
    highestPriorityRecommendation: string | null;
    recommendationSummary: string;
    simulatedDrafts: {
      type: string;
      priority: string;
      title: string;
      recommendation: string;
    }[];
  };

  // Deterministic explanations
  whyStatusChanged: string[];
}

export interface ScenarioComparisonSummary {
  scenariosCompared: number;
  escalatedScenarios: number;
  unchangedScenarios: number;
  deescalatedScenarios: number;
  criticalScenarios: number;
  highDemandScenarios: number;
  highestRiskScoreObserved: number;
  highestOccupancyObserved: number | null;
  totalHypotheticalAlerts: number;
  totalHypotheticalIncidents: number;
}

export interface ScenarioPairwiseDifference {
  pair: string;
  scenarioAId: string;
  scenarioAName: string;
  scenarioBId: string;
  scenarioBName: string;
  riskDifference: number; // A - B
  occupancyDifference: number | null; // A - B percentage points
  demandDifference: number | null; // A - B passengers
  capacityDifference: number; // A - B seats
  alertDifference: number; // A - B alerts
  incidentDifference: number; // A - B incidents
  statusA: OperationalStatus;
  statusB: OperationalStatus;
}

export interface ScenarioComparisonResult {
  success: boolean;
  notices: [string, string];
  route: {
    id: string;
    code: string;
    name: string;
  };
  baseline: ScenarioComparisonItem;
  scenarios: ScenarioComparisonItem[];
  summary: ScenarioComparisonSummary;
  tradeOffs: string[];
  pairwiseDifferences: ScenarioPairwiseDifference[];
  comparedAt: string;
}

/**
 * Validates scenario comparison input. Throws descriptive error if invalid.
 */
export function validateComparisonInput(body: any): ScenarioComparisonInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body: object required');
  }

  const { routeId, scenarios } = body;

  if (!routeId || typeof routeId !== 'string' || routeId.trim().length === 0) {
    throw new Error('routeId is required and must be a non-empty string');
  }

  if (!Array.isArray(scenarios)) {
    throw new Error('scenarios must be an array');
  }

  if (scenarios.length < 2) {
    throw new Error('At least 2 scenarios are required for comparison');
  }

  if (scenarios.length > 5) {
    throw new Error('A maximum of 5 scenarios can be compared simultaneously');
  }

  const validAlerts = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const validIncidents = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const validTrends = ['NO_CHANGE', 'RISING', 'STABLE', 'FALLING'];

  const validatedScenarios: ScenarioDefinitionInput[] = scenarios.map(
    (sc: any, index: number) => {
      if (!sc || typeof sc !== 'object') {
        throw new Error(`Scenario at index ${index} must be an object`);
      }

      const {
        id,
        name,
        description = '',
        riskModifier,
        demandModifierPercent,
        capacityModifierPercent,
        hypotheticalAlert = 'NONE',
        hypotheticalIncident = 'NONE',
        riskTrendScenario = 'NO_CHANGE',
      } = sc;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new Error(`Scenario at index ${index} must have a non-empty name`);
      }

      if (
        typeof riskModifier !== 'number' ||
        Number.isNaN(riskModifier) ||
        !Number.isFinite(riskModifier) ||
        riskModifier < -50 ||
        riskModifier > 50
      ) {
        throw new Error(
          `Scenario "${name}": riskModifier must be a finite number between -50 and 50`
        );
      }

      if (
        typeof demandModifierPercent !== 'number' ||
        Number.isNaN(demandModifierPercent) ||
        !Number.isFinite(demandModifierPercent) ||
        demandModifierPercent < -50 ||
        demandModifierPercent > 100
      ) {
        throw new Error(
          `Scenario "${name}": demandModifierPercent must be a finite number between -50 and 100`
        );
      }

      if (
        typeof capacityModifierPercent !== 'number' ||
        Number.isNaN(capacityModifierPercent) ||
        !Number.isFinite(capacityModifierPercent) ||
        capacityModifierPercent < -50 ||
        capacityModifierPercent > 100
      ) {
        throw new Error(
          `Scenario "${name}": capacityModifierPercent must be a finite number between -50 and 100`
        );
      }

      if (!validAlerts.includes(hypotheticalAlert)) {
        throw new Error(
          `Scenario "${name}": hypotheticalAlert must be one of: ${validAlerts.join(', ')}`
        );
      }

      if (!validIncidents.includes(hypotheticalIncident)) {
        throw new Error(
          `Scenario "${name}": hypotheticalIncident must be one of: ${validIncidents.join(', ')}`
        );
      }

      if (!validTrends.includes(riskTrendScenario)) {
        throw new Error(
          `Scenario "${name}": riskTrendScenario must be one of: ${validTrends.join(', ')}`
        );
      }

      return {
        id: id || `scenario_${index + 1}`,
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        riskModifier,
        demandModifierPercent,
        capacityModifierPercent,
        hypotheticalAlert: hypotheticalAlert as HypotheticalAlertSeverity,
        hypotheticalIncident: hypotheticalIncident as HypotheticalIncidentSeverity,
        riskTrendScenario: riskTrendScenario as RiskTrendScenario,
      };
    }
  );

  return {
    routeId: routeId.trim(),
    scenarios: validatedScenarios,
  };
}

/**
 * Builds deterministic trade-off observations between scenarios without subjective labeling.
 */
function buildTradeOffAnalysis(scenarios: ScenarioComparisonItem[]): string[] {
  const observations: string[] = [];

  for (let i = 0; i < scenarios.length; i++) {
    for (let j = i + 1; j < scenarios.length; j++) {
      const a = scenarios[i];
      const b = scenarios[j];

      // 1. Risk vs Capacity Trade-off
      if (a.riskScore !== b.riskScore) {
        const diff = Math.abs(a.riskScore - b.riskScore);
        const higher = a.riskScore > b.riskScore ? a : b;
        const lower = a.riskScore > b.riskScore ? b : a;
        observations.push(
          `"${higher.name}" exhibits a higher operational risk score (${higher.riskScore} vs ${lower.riskScore}, +${diff} pts) compared to "${lower.name}".`
        );
      }

      // 2. Demand & Occupancy Trade-off
      if (
        a.projectedOccupancy !== null &&
        b.projectedOccupancy !== null &&
        a.projectedOccupancy !== b.projectedOccupancy
      ) {
        const occDiff = Math.abs(a.projectedOccupancy - b.projectedOccupancy);
        const higher = a.projectedOccupancy > b.projectedOccupancy ? a : b;
        const lower = a.projectedOccupancy > b.projectedOccupancy ? b : a;
        observations.push(
          `"${higher.name}" projects ${higher.projectedOccupancy}% vehicle occupancy compared to ${lower.projectedOccupancy}% under "${lower.name}" (variance of ${occDiff} percentage points).`
        );
      }

      // 3. Seating Capacity Difference
      if (a.vehicleCapacity !== b.vehicleCapacity) {
        const capDiff = Math.abs(a.vehicleCapacity - b.vehicleCapacity);
        const higher = a.vehicleCapacity > b.vehicleCapacity ? a : b;
        const lower = a.vehicleCapacity > b.vehicleCapacity ? b : a;
        observations.push(
          `"${higher.name}" provides ${higher.vehicleCapacity} passenger seats (${capDiff} more seats) than "${lower.name}" (${lower.vehicleCapacity} seats).`
        );
      }

      // 4. Operational Status Differences
      if (a.operationalStatus !== b.operationalStatus) {
        observations.push(
          `"${a.name}" results in ${a.operationalStatus} operational status, whereas "${b.name}" operates at ${b.operationalStatus}.`
        );
      }

      // 5. Critical Alerts / Incidents
      if (a.criticalAlerts !== b.criticalAlerts) {
        const higher = a.criticalAlerts > b.criticalAlerts ? a : b;
        const lower = a.criticalAlerts > b.criticalAlerts ? b : a;
        observations.push(
          `"${higher.name}" incorporates ${higher.criticalAlerts} critical alert(s) requiring urgent supervisor intervention, compared to ${lower.criticalAlerts} under "${lower.name}".`
        );
      }
    }
  }

  return observations;
}

/**
 * Builds pairwise difference matrix between scenarios.
 */
function buildPairwiseDifferences(
  scenarios: ScenarioComparisonItem[]
): ScenarioPairwiseDifference[] {
  const differences: ScenarioPairwiseDifference[] = [];

  for (let i = 0; i < scenarios.length; i++) {
    for (let j = i + 1; j < scenarios.length; j++) {
      const a = scenarios[i];
      const b = scenarios[j];

      differences.push({
        pair: `${a.name} vs ${b.name}`,
        scenarioAId: a.id,
        scenarioAName: a.name,
        scenarioBId: b.id,
        scenarioBName: b.name,
        riskDifference: a.riskScore - b.riskScore,
        occupancyDifference:
          a.projectedOccupancy !== null && b.projectedOccupancy !== null
            ? a.projectedOccupancy - b.projectedOccupancy
            : null,
        demandDifference:
          a.predictedDemand !== null && b.predictedDemand !== null
            ? Math.round((a.predictedDemand - b.predictedDemand) * 10) / 10
            : null,
        capacityDifference: a.vehicleCapacity - b.vehicleCapacity,
        alertDifference: a.totalActiveAlerts - b.totalActiveAlerts,
        incidentDifference: a.unresolvedIncidents - b.unresolvedIncidents,
        statusA: a.operationalStatus,
        statusB: b.operationalStatus,
      });
    }
  }

  return differences;
}

/**
 * Executes multi-scenario comparison against verified server-side live baseline intelligence.
 */
export async function runOperationalScenarioComparison(
  rawInput: any
): Promise<ScenarioComparisonResult> {
  const input = validateComparisonInput(rawInput);

  // 1. Fetch server-side authoritative baseline (Steps 1–6)
  const baselineSupport = (await buildOperationalDecisionSupport(
    input.routeId
  )) as RouteOperationalDecisionSupport | null;

  if (!baselineSupport) {
    throw new Error(`Route not found: ${input.routeId}`);
  }

  const nowIso = new Date().toISOString();

  // 2. Simulate baseline run (zero modifiers) using existing Step 12 engine
  const baselineSim = await runOperationalScenarioSimulation({
    routeId: input.routeId,
    riskModifier: 0,
    demandModifierPercent: 0,
    capacityModifierPercent: 0,
    hypotheticalAlert: 'NONE',
    hypotheticalIncident: 'NONE',
    riskTrendScenario: 'NO_CHANGE',
  });

  const baselineItem: ScenarioComparisonItem = {
    id: 'BASELINE',
    name: 'Verified Baseline',
    description: 'Current real-time operational status derived from server intelligence.',
    isBaseline: true,
    modifiers: {
      riskModifier: 0,
      demandModifierPercent: 0,
      capacityModifierPercent: 0,
      hypotheticalAlert: 'NONE',
      hypotheticalIncident: 'NONE',
      riskTrendScenario: 'NO_CHANGE',
    },
    riskScore: baselineSim.baseline.riskScore,
    riskLevel: baselineSim.baseline.riskLevel,
    riskTrend: baselineSim.baseline.riskTrend,
    predictedDemand: baselineSim.baseline.demand,
    vehicleCapacity: baselineSim.baseline.capacity,
    projectedOccupancy: baselineSim.baseline.occupancy,
    demandLevel: baselineSim.simulated.demandLevel,
    dataQuality: baselineSupport.demand.dataQuality,
    activeAlerts: baselineSim.baseline.activeAlerts,
    criticalAlerts: baselineSim.baseline.criticalAlerts,
    highAlerts: baselineSupport.alerts.highCount,
    totalActiveAlerts: baselineSim.baseline.activeAlerts,
    unresolvedIncidents: baselineSim.baseline.unresolvedIncidents,
    criticalIncidents: baselineSim.baseline.criticalIncidents,
    operationalStatus: baselineSim.baseline.operationalStatus,
    statusChange: 'UNCHANGED',
    briefing: baselineSim.baseline.briefing,
    deltas: {
      riskScoreDelta: 0,
      demandDelta: 0,
      capacityDelta: 0,
      occupancyDelta: 0,
      alertDelta: 0,
      incidentDelta: 0,
    },
    recommendationImpact: {
      impactLevel: baselineSim.recommendationImpact.impactLevel,
      recommendationCount: baselineSim.recommendationImpact.simulatedRecommendationCount,
      recommendationTypes: Array.from(
        new Set(baselineSim.recommendationImpact.simulatedDrafts.map((d) => d.type))
      ),
      highestPriorityRecommendation:
        baselineSim.recommendationImpact.simulatedDrafts[0]?.title || null,
      recommendationSummary:
        baselineSim.recommendationImpact.simulatedDrafts.length > 0
          ? `${baselineSim.recommendationImpact.simulatedDrafts.length} active recommendation(s) currently registered.`
          : 'No action recommendations currently pending.',
      simulatedDrafts: baselineSim.recommendationImpact.simulatedDrafts,
    },
    whyStatusChanged: [
      `Operational status reflects live corridor baseline at ${baselineSim.baseline.operationalStatus}.`,
      `Route risk score is ${baselineSim.baseline.riskScore}/100 (${baselineSim.baseline.riskLevel}).`,
    ],
  };

  // 3. Execute all requested scenarios sequentially via existing Step 12 simulation engine
  const simulatedScenarios: ScenarioComparisonItem[] = [];

  for (const def of input.scenarios) {
    const simRes: ScenarioSimulationResult = await runOperationalScenarioSimulation({
      routeId: input.routeId,
      riskModifier: def.riskModifier,
      demandModifierPercent: def.demandModifierPercent,
      capacityModifierPercent: def.capacityModifierPercent,
      hypotheticalAlert: def.hypotheticalAlert,
      hypotheticalIncident: def.hypotheticalIncident,
      riskTrendScenario: def.riskTrendScenario,
    });

    const isBaselineScenario =
      def.riskModifier === 0 &&
      def.demandModifierPercent === 0 &&
      def.capacityModifierPercent === 0 &&
      (!def.hypotheticalAlert || def.hypotheticalAlert === 'NONE') &&
      (!def.hypotheticalIncident || def.hypotheticalIncident === 'NONE') &&
      (!def.riskTrendScenario || def.riskTrendScenario === 'NO_CHANGE');

    // Build specific "Why did this scenario change?" explanation
    const whyStatusChanged: string[] = [];
    if (simRes.comparison.statusChange === 'ESCALATED') {
      if (simRes.comparison.riskDelta > 0) {
        whyStatusChanged.push(
          `Risk score increased from ${baselineItem.riskScore} to ${simRes.simulated.riskScore} (+${simRes.comparison.riskDelta} pts).`
        );
      }
      if (simRes.comparison.occupancyDelta !== null && simRes.comparison.occupancyDelta > 0) {
        whyStatusChanged.push(
          `Projected occupancy increased from ${baselineItem.projectedOccupancy}% to ${simRes.simulated.occupancy}% (+${simRes.comparison.occupancyDelta}%).`
        );
      }
      if (def.hypotheticalAlert && def.hypotheticalAlert !== 'NONE') {
        whyStatusChanged.push(
          `A hypothetical ${def.hypotheticalAlert} safety alert was introduced.`
        );
      }
      if (def.hypotheticalIncident && def.hypotheticalIncident !== 'NONE') {
        whyStatusChanged.push(
          `A hypothetical ${def.hypotheticalIncident} incident case was introduced.`
        );
      }
      whyStatusChanged.push(
        `Operational status escalated from ${baselineItem.operationalStatus} to ${simRes.simulated.operationalStatus}.`
      );
    } else if (simRes.comparison.statusChange === 'DE_ESCALATED') {
      if (simRes.comparison.riskDelta < 0) {
        whyStatusChanged.push(
          `Risk score reduced from ${baselineItem.riskScore} to ${simRes.simulated.riskScore} (${simRes.comparison.riskDelta} pts).`
        );
      }
      if (simRes.comparison.occupancyDelta !== null && simRes.comparison.occupancyDelta < 0) {
        whyStatusChanged.push(
          `Projected occupancy relieved from ${baselineItem.projectedOccupancy}% to ${simRes.simulated.occupancy}% (${simRes.comparison.occupancyDelta}%).`
        );
      }
      whyStatusChanged.push(
        `Operational status de-escalated from ${baselineItem.operationalStatus} to ${simRes.simulated.operationalStatus} under favorable simulated conditions.`
      );
    } else {
      whyStatusChanged.push(
        `Simulated risk (${simRes.simulated.riskScore}/100) remained within the ${simRes.simulated.riskLevel} range.`
      );
      whyStatusChanged.push(
        'No escalation-triggering safety or capacity condition was introduced.'
      );
      whyStatusChanged.push(
        `Operational status remains ${simRes.simulated.operationalStatus}.`
      );
    }

    const uniqueRecTypes = Array.from(
      new Set(simRes.recommendationImpact.simulatedDrafts.map((d) => d.type))
    );

    let highestPriorityRecommendation: string | null = null;
    const criticalDraft = simRes.recommendationImpact.simulatedDrafts.find(
      (d) => d.priority === 'CRITICAL'
    );
    const highDraft = simRes.recommendationImpact.simulatedDrafts.find(
      (d) => d.priority === 'HIGH'
    );
    highestPriorityRecommendation =
      criticalDraft?.title ||
      highDraft?.title ||
      simRes.recommendationImpact.simulatedDrafts[0]?.title ||
      null;

    let recommendationSummary = 'No advisory recommendations triggered under this scenario.';
    if (simRes.recommendationImpact.impactLevel === 'CRITICAL_RECOMMENDATION') {
      recommendationSummary = `${simRes.recommendationImpact.simulatedRecommendationCount} advisory recommendation(s) triggered, including critical safety interventions.`;
    } else if (simRes.recommendationImpact.impactLevel === 'HIGH_PRIORITY_RECOMMENDATION') {
      recommendationSummary = `${simRes.recommendationImpact.simulatedRecommendationCount} advisory recommendation(s) triggered, highlighting operational attention items.`;
    } else if (simRes.recommendationImpact.impactLevel === 'MONITORING_RECOMMENDATION') {
      recommendationSummary = `${simRes.recommendationImpact.simulatedRecommendationCount} advisory monitoring recommendation(s) generated.`;
    }

    simulatedScenarios.push({
      id: def.id || `scenario_${simulatedScenarios.length + 1}`,
      name: def.name,
      description: def.description || '',
      isBaseline: isBaselineScenario,
      modifiers: {
        riskModifier: def.riskModifier,
        demandModifierPercent: def.demandModifierPercent,
        capacityModifierPercent: def.capacityModifierPercent,
        hypotheticalAlert: def.hypotheticalAlert || 'NONE',
        hypotheticalIncident: def.hypotheticalIncident || 'NONE',
        riskTrendScenario: def.riskTrendScenario || 'NO_CHANGE',
      },
      riskScore: simRes.simulated.riskScore,
      riskLevel: simRes.simulated.riskLevel,
      riskTrend: simRes.simulated.riskTrend,
      predictedDemand: simRes.simulated.demand,
      vehicleCapacity: simRes.simulated.capacity,
      projectedOccupancy: simRes.simulated.occupancy,
      demandLevel: simRes.simulated.demandLevel,
      dataQuality: baselineSupport.demand.dataQuality,
      activeAlerts: simRes.simulated.activeAlerts,
      criticalAlerts: simRes.simulated.criticalAlerts,
      highAlerts: baselineSupport.alerts.highCount + (def.hypotheticalAlert === 'HIGH' ? 1 : 0),
      totalActiveAlerts: simRes.simulated.activeAlerts,
      unresolvedIncidents: simRes.simulated.unresolvedIncidents,
      criticalIncidents: simRes.simulated.criticalIncidents,
      operationalStatus: simRes.simulated.operationalStatus,
      statusChange: simRes.comparison.statusChange,
      briefing: simRes.simulated.briefing,
      deltas: {
        riskScoreDelta: simRes.comparison.riskDelta,
        demandDelta: simRes.comparison.demandDelta,
        capacityDelta: simRes.comparison.capacityDelta,
        occupancyDelta: simRes.comparison.occupancyDelta,
        alertDelta: simRes.comparison.alertsDelta,
        incidentDelta: simRes.comparison.incidentsDelta,
      },
      recommendationImpact: {
        impactLevel: simRes.recommendationImpact.impactLevel,
        recommendationCount: simRes.recommendationImpact.simulatedRecommendationCount,
        recommendationTypes: uniqueRecTypes,
        highestPriorityRecommendation,
        recommendationSummary,
        simulatedDrafts: simRes.recommendationImpact.simulatedDrafts,
      },
      whyStatusChanged,
    });
  }

  // 4. Compute Executive Comparison Summary Metrics
  let escalatedCount = 0;
  let unchangedCount = 0;
  let deescalatedCount = 0;
  let criticalCount = 0;
  let highDemandCount = 0;
  let maxRisk = baselineItem.riskScore;
  let maxOccupancy = baselineItem.projectedOccupancy;
  let totalHypAlerts = 0;
  let totalHypIncidents = 0;

  for (const s of simulatedScenarios) {
    if (s.statusChange === 'ESCALATED') escalatedCount++;
    if (s.statusChange === 'UNCHANGED') unchangedCount++;
    if (s.statusChange === 'DE_ESCALATED') deescalatedCount++;

    if (s.operationalStatus === 'URGENT_REVIEW' || s.riskLevel === 'CRITICAL') {
      criticalCount++;
    }

    if (s.projectedOccupancy !== null && s.projectedOccupancy >= 90) {
      highDemandCount++;
    }

    if (s.riskScore > maxRisk) {
      maxRisk = s.riskScore;
    }

    if (s.projectedOccupancy !== null) {
      if (maxOccupancy === null || s.projectedOccupancy > maxOccupancy) {
        maxOccupancy = s.projectedOccupancy;
      }
    }

    if (s.modifiers.hypotheticalAlert !== 'NONE') {
      totalHypAlerts++;
    }
    if (s.modifiers.hypotheticalIncident !== 'NONE') {
      totalHypIncidents++;
    }
  }

  const summary: ScenarioComparisonSummary = {
    scenariosCompared: simulatedScenarios.length,
    escalatedScenarios: escalatedCount,
    unchangedScenarios: unchangedCount,
    deescalatedScenarios: deescalatedCount,
    criticalScenarios: criticalCount,
    highDemandScenarios: highDemandCount,
    highestRiskScoreObserved: maxRisk,
    highestOccupancyObserved: maxOccupancy,
    totalHypotheticalAlerts: totalHypAlerts,
    totalHypotheticalIncidents: totalHypIncidents,
  };

  // 5. Deterministic Trade-Off Analysis
  const tradeOffs = buildTradeOffAnalysis([baselineItem, ...simulatedScenarios]);

  // 6. Pairwise Differences Matrix
  const pairwiseDifferences = buildPairwiseDifferences([
    baselineItem,
    ...simulatedScenarios,
  ]);

  return {
    success: true,
    notices: [
      MANDATORY_SCENARIO_COMPARISON_NOTICE_1,
      MANDATORY_SCENARIO_COMPARISON_NOTICE_2,
    ],
    route: {
      id: baselineSupport.routeId,
      code: baselineSupport.routeCode,
      name: baselineSupport.routeName,
    },
    baseline: baselineItem,
    scenarios: simulatedScenarios,
    summary,
    tradeOffs,
    pairwiseDifferences,
    comparedAt: nowIso,
  };
}
