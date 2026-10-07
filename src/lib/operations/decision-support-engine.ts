/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — OPERATIONAL DECISION SUPPORT ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 6: Unified, explainable operational decision support for Admin.
 *
 * Synthesizes existing verified server-side intelligence:
 * 1. Current Route Risk Score & Factors (Step 1)
 * 2. Route Risk History & Trend Analysis (Step 2)
 * 3. Operational Safety Alerts (Step 3)
 * 4. Operational Incident Response & Cases (Step 4)
 * 5. AI Demand Prediction & Occupancy (Step 5)
 *
 * Rules:
 * - Purely deterministic aggregation and evaluation.
 * - Zero black-box or LLM-generated decision-making.
 * - Zero automatic operational mutations (advisory only).
 * - Client cannot override any scores, alerts, counts, or operational statuses.
 */

import prisma from '@/lib/prisma';
import {
  getAllRoutes,
  getRouteById,
  getRouteByCode,
  DEFAULT_CORRIDOR_ROUTES,
} from '@/lib/firestore-db';
import {
  recordRouteRiskSnapshot,
  getRouteRiskHistory,
  calculateRouteRiskTrend,
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
  runDemandPredictionPipeline,
  DemandPredictionPipelineResult,
} from '@/lib/ai/prediction-engine';
import { RoutePredictionResult } from '@/lib/ai/business-rules';

export type OperationalStatus =
  | 'NORMAL'
  | 'MONITOR'
  | 'ATTENTION_REQUIRED'
  | 'URGENT_REVIEW';

export interface RouteOperationalRiskFactor {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  trend: 'RISING' | 'FALLING' | 'STABLE' | 'NO_HISTORY';
  scoreDelta: number | null;
  previousScore: number | null;
  activeEmergencies: number;
  activeDeviations: number;
  activeSpeedAnomalies: number;
}

export interface RouteOperationalAlertsFactor {
  activeCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface RouteOperationalIncidentsFactor {
  activeCount: number;
  criticalCount: number;
  unresolvedCount: number;
}

export interface RouteOperationalDemandFactor {
  predictedDemand: number | null;
  predictedOccupancy: number | null;
  demandLevel: string | null;
  dataQuality: string;
}

export interface RouteOperationalCapacityFactor {
  recommendation: string;
  vehicleCapacity: number;
}

export interface RouteOperationalDecisionSupport {
  routeId: string;
  routeCode: string;
  routeName: string;
  operationalStatus: OperationalStatus;

  risk: RouteOperationalRiskFactor;
  alerts: RouteOperationalAlertsFactor;
  incidents: RouteOperationalIncidentsFactor;
  demand: RouteOperationalDemandFactor;
  capacity: RouteOperationalCapacityFactor;

  explanation: string[];
  briefing: string;

  evidence: {
    riskEvidence: any;
    alertEvidence: SafetyAlertRecord[];
    incidentEvidence: IncidentCaseRecord[];
    demandEvidence: any;
  };

  generatedAt: string;
}

export interface FleetDecisionSupportSummary {
  totalRoutes: number;
  normal: number;
  monitor: number;
  attentionRequired: number;
  urgentReview: number;

  criticalRiskRoutes: number;
  highRiskRoutes: number;

  activeCriticalAlerts: number;
  activeHighAlerts: number;

  unresolvedIncidents: number;

  highDemandRoutes: number;
  criticalDemandRoutes: number;
}

export interface FleetDecisionSupportResult {
  success: boolean;
  summary: FleetDecisionSupportSummary;
  routes: RouteOperationalDecisionSupport[];
  generatedAt: string;
}

/**
 * Determines operational status and generates deterministic explanations based on
 * verified conditions across risk, alerts, incidents, and demand.
 */
export function evaluateOperationalStatus(data: {
  routeCode: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskTrend: 'RISING' | 'FALLING' | 'STABLE' | 'NO_HISTORY';
  scoreDelta: number | null;
  activeEmergencies: number;
  activeCriticalAlerts: number;
  activeHighAlerts: number;
  activeMediumAlerts: number;
  activeLowAlerts: number;
  totalActiveAlerts: number;
  unresolvedIncidents: number;
  criticalIncidents: number;
  predictedDemand?: number | null;
  predictedOccupancy: number | null;
  demandLevel: string | null;
  dataQuality: string;
  capacityRecommendation: string;
}): {
  operationalStatus: OperationalStatus;
  explanation: string[];
  briefing: string;
} {
  const {
    routeCode,
    riskScore,
    riskLevel,
    riskTrend,
    scoreDelta,
    activeEmergencies,
    activeCriticalAlerts,
    activeHighAlerts,
    activeMediumAlerts,
    totalActiveAlerts,
    unresolvedIncidents,
    criticalIncidents,
    predictedDemand = null,
    predictedOccupancy,
    demandLevel,
    dataQuality,
    capacityRecommendation,
  } = data;

  const explanation: string[] = [];
  const urgentTriggers: string[] = [];
  const attentionTriggers: string[] = [];
  const monitorTriggers: string[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CONDITION CHECKS
  // ──────────────────────────────────────────────────────────────────────────

  // Check URGENT_REVIEW conditions:
  // - Risk CRITICAL
  // - Active emergency
  // - CRITICAL safety alert
  // - Unresolved critical incident
  if (riskLevel === 'CRITICAL' || riskScore >= 75) {
    urgentTriggers.push(`route risk is CRITICAL (${riskScore}/100)`);
  }
  if (activeEmergencies > 0) {
    urgentTriggers.push(`${activeEmergencies} active emergency event(s) detected`);
  }
  if (activeCriticalAlerts > 0) {
    urgentTriggers.push(`${activeCriticalAlerts} active CRITICAL safety alert(s)`);
  }
  if (criticalIncidents > 0) {
    urgentTriggers.push(`${criticalIncidents} unresolved CRITICAL incident case(s)`);
  }

  // Check ATTENTION_REQUIRED conditions:
  // - Risk HIGH
  // - HIGH safety alert
  // - HIGH demand / capacity pressure (occupancy >= 90% or CRITICAL demand level)
  // - Multiple operational conditions deteriorating
  if (riskLevel === 'HIGH' || (riskScore >= 50 && riskScore < 75)) {
    attentionTriggers.push(`route risk is HIGH (${riskScore}/100)`);
  }
  if (activeHighAlerts > 0) {
    attentionTriggers.push(`${activeHighAlerts} active HIGH-severity safety alert(s)`);
  }
  if (
    (predictedOccupancy !== null && predictedOccupancy >= 90) ||
    demandLevel === 'CRITICAL'
  ) {
    attentionTriggers.push(
      `predicted occupancy is ${predictedOccupancy}% (${demandLevel || 'CRITICAL'} demand level)`
    );
  }
  if (riskTrend === 'RISING' && scoreDelta !== null && scoreDelta >= 10) {
    attentionTriggers.push(`risk score is rapidly rising (+${scoreDelta} pts)`);
  }
  if (totalActiveAlerts >= 2 && activeCriticalAlerts === 0 && activeHighAlerts === 0) {
    attentionTriggers.push(`multiple active safety alerts (${totalActiveAlerts} alerts)`);
  }
  if (riskTrend === 'RISING' && totalActiveAlerts > 0 && attentionTriggers.length === 0) {
    attentionTriggers.push(`rising risk trend with active alerts`);
  }

  // Check MONITOR conditions:
  // - Risk MEDIUM
  // - Demand HIGH (occupancy 75-89.9% or HIGH demand level)
  // - Non-critical active alert (medium/low)
  // - Moderate unresolved incident (non-critical)
  // - Risk trend RISING
  if (riskLevel === 'MEDIUM' || (riskScore >= 25 && riskScore < 50)) {
    monitorTriggers.push(`route risk is MEDIUM (${riskScore}/100)`);
  }
  if (
    demandLevel === 'HIGH' ||
    (predictedOccupancy !== null && predictedOccupancy >= 75 && predictedOccupancy < 90)
  ) {
    monitorTriggers.push(`passenger demand is HIGH (${predictedOccupancy}% occupancy)`);
  }
  if (activeMediumAlerts > 0 && activeCriticalAlerts === 0 && activeHighAlerts === 0) {
    monitorTriggers.push(`${activeMediumAlerts} active MEDIUM-severity alert(s)`);
  }
  if (unresolvedIncidents > 0 && criticalIncidents === 0 && urgentTriggers.length === 0) {
    monitorTriggers.push(`${unresolvedIncidents} unresolved operational incident case(s)`);
  }
  if (riskTrend === 'RISING' && urgentTriggers.length === 0 && attentionTriggers.length === 0) {
    monitorTriggers.push(`risk score trend is RISING${scoreDelta ? ` (+${scoreDelta} pts)` : ''}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. STATUS RESOLUTION
  // ──────────────────────────────────────────────────────────────────────────
  let operationalStatus: OperationalStatus = 'NORMAL';
  let briefing = '';

  if (urgentTriggers.length > 0) {
    operationalStatus = 'URGENT_REVIEW';
    briefing = `Route ${routeCode} requires urgent administrative review because ${urgentTriggers.join(', ')}.`;
  } else if (attentionTriggers.length > 0) {
    operationalStatus = 'ATTENTION_REQUIRED';
    briefing = `Route ${routeCode} requires administrative attention because ${attentionTriggers.join(', ')}.`;
  } else if (monitorTriggers.length > 0) {
    operationalStatus = 'MONITOR';
    briefing = `Route ${routeCode} requires operational monitoring because ${monitorTriggers.join(', ')}.`;
  } else {
    operationalStatus = 'NORMAL';
    const occText =
      predictedOccupancy !== null
        ? ` and predicted occupancy remains within the normal operating range (${predictedOccupancy}%)`
        : '';
    briefing = `Route ${routeCode} is operating normally: no active high-severity safety conditions were detected${occText}.`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. DETAILED EXPLANATION ITEMS
  // ──────────────────────────────────────────────────────────────────────────
  // Risk Explanation
  const trendPhrase =
    riskTrend === 'RISING'
      ? ` and rising by ${scoreDelta || 0} points`
      : riskTrend === 'FALLING'
      ? ` and improving by ${Math.abs(scoreDelta || 0)} points`
      : riskTrend === 'STABLE'
      ? ' and stable'
      : ' (baseline snapshot)';
  explanation.push(`Route risk is ${riskLevel} at ${riskScore}/100${trendPhrase}.`);

  // Alert Explanation
  if (totalActiveAlerts > 0) {
    explanation.push(
      `${totalActiveAlerts} active safety alert(s) recorded: ${activeCriticalAlerts} CRITICAL, ${activeHighAlerts} HIGH, ${activeMediumAlerts} MEDIUM.`
    );
  } else {
    explanation.push('No active safety alerts on this corridor.');
  }

  // Incident Explanation
  if (unresolvedIncidents > 0) {
    explanation.push(
      `${unresolvedIncidents} unresolved incident case(s) open in case management (${criticalIncidents} CRITICAL).`
    );
  } else {
    explanation.push('All incident response cases are currently resolved or closed.');
  }

  // Demand Explanation
  if (dataQuality === 'INSUFFICIENT_DATA' || predictedOccupancy === null) {
    explanation.push('Demand intelligence unavailable due to insufficient historical data.');
  } else {
    explanation.push(
      `Predicted passenger demand is ${data.predictedDemand ?? 0} commuters (${predictedOccupancy}% vehicle occupancy, ${demandLevel} demand band).`
    );
  }

  // Capacity Guidance
  if (capacityRecommendation) {
    explanation.push(capacityRecommendation);
  }

  return {
    operationalStatus,
    explanation,
    briefing,
  };
}

/**
 * Builds decision support factors for a single route from existing server-side intelligence.
 */
export async function buildSingleRouteDecisionSupport(
  route: {
    id: string;
    code: string;
    name: string;
    assignedVehicle?: { capacity?: number } | null;
  },
  demandPipelineResult?: DemandPredictionPipelineResult
): Promise<RouteOperationalDecisionSupport> {
  const routeId = route.id;
  const routeCode = route.code;
  const routeName = route.name;
  const vehicleCapacity = route.assignedVehicle?.capacity || 16;
  const nowIso = new Date().toISOString();

  // 1. Step 1 & 2: Risk History & Trend
  let snapshots: RouteRiskSnapshot[] = await getRouteRiskHistory(route.code || routeId, 10);
  if (!snapshots || snapshots.length === 0) {
    try {
      const recorded = await recordRouteRiskSnapshot(route.code || routeId);
      if (recorded) {
        snapshots = [recorded];
      }
    } catch (recErr) {
      console.warn(`[DecisionSupportEngine] Snapshot record notice for ${route.code}:`, recErr);
    }
  }

  const trendResult = calculateRouteRiskTrend(snapshots);
  const currentSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  const riskScore = currentSnapshot ? currentSnapshot.riskScore : 0;
  const riskLevel = currentSnapshot ? currentSnapshot.riskLevel : 'LOW';
  const riskTrend = trendResult.trend;
  const scoreDelta = trendResult.scoreDelta;
  const previousScore = trendResult.previousScore;
  const activeEmergencies = currentSnapshot ? currentSnapshot.activeEmergencies : 0;
  const activeDeviations = currentSnapshot ? currentSnapshot.activeDeviations : 0;
  const activeSpeedAnomalies = currentSnapshot ? currentSnapshot.activeSpeedAnomalies : 0;

  // 2. Step 3: Active Safety Alerts
  const activeAlerts = await getSafetyAlerts({
    routeId: route.code || routeId,
    status: 'ACTIVE',
    limit: 50,
  });

  const activeCount = activeAlerts.length;
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'CRITICAL');
  const highAlerts = activeAlerts.filter((a) => a.severity === 'HIGH');
  const mediumAlerts = activeAlerts.filter((a) => a.severity === 'MEDIUM');
  const lowAlerts = activeAlerts.filter((a) => a.severity === 'LOW');

  // 3. Step 4: Active Incidents
  const { incidents: allIncidents } = await getIncidentCases();
  const routeIncidents = allIncidents.filter(
    (c) =>
      (c.routeId && (c.routeId === routeId || c.routeId === route.code)) ||
      (c.routeCode && (c.routeCode === route.code || c.routeCode === routeId))
  );
  const unresolvedCases = routeIncidents.filter(
    (c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED'
  );
  const criticalCases = unresolvedCases.filter((c) => c.severity === 'CRITICAL');

  // 4. Step 5: AI Demand Prediction
  let matchingPred: RoutePredictionResult | undefined;
  let demandDataQuality = 'HIGH_DATA_QUALITY';
  let predictedDemand: number | null = null;
  let predictedOccupancy: number | null = null;
  let demandLevel: string | null = null;
  let capacityRecommendation =
    'Standard shuttle capacity is adequate for current route schedule.';

  if (demandPipelineResult) {
    if (demandPipelineResult.status === 'INSUFFICIENT_DATA') {
      demandDataQuality = 'INSUFFICIENT_DATA';
    } else {
      matchingPred = demandPipelineResult.routePredictions.find(
        (p) =>
          (p.routeId === routeId || p.routeCode.toLowerCase() === routeCode.toLowerCase()) &&
          p.shift === 'MORNING_PICKUP'
      ) || demandPipelineResult.routePredictions.find(
        (p) => p.routeId === routeId || p.routeCode.toLowerCase() === routeCode.toLowerCase()
      );

      if (matchingPred) {
        predictedDemand = matchingPred.predictedDemand;
        predictedOccupancy = matchingPred.predictedOccupancy;
        demandLevel = matchingPred.demandLevel;
        demandDataQuality = matchingPred.dataQualityStatus;
        capacityRecommendation = matchingPred.recommendation;
      }
    }
  }

  // 5. Operational Status & Explainability Evaluation
  const evalResult = evaluateOperationalStatus({
    routeCode,
    riskScore,
    riskLevel,
    riskTrend,
    scoreDelta,
    activeEmergencies,
    activeCriticalAlerts: criticalAlerts.length,
    activeHighAlerts: highAlerts.length,
    activeMediumAlerts: mediumAlerts.length,
    activeLowAlerts: lowAlerts.length,
    totalActiveAlerts: activeCount,
    unresolvedIncidents: unresolvedCases.length,
    criticalIncidents: criticalCases.length,
    predictedDemand,
    predictedOccupancy,
    demandLevel,
    dataQuality: demandDataQuality,
    capacityRecommendation,
  });

  return {
    routeId,
    routeCode,
    routeName,
    operationalStatus: evalResult.operationalStatus,

    risk: {
      score: riskScore,
      level: riskLevel,
      trend: riskTrend,
      scoreDelta,
      previousScore,
      activeEmergencies,
      activeDeviations,
      activeSpeedAnomalies,
    },

    alerts: {
      activeCount,
      criticalCount: criticalAlerts.length,
      highCount: highAlerts.length,
      mediumCount: mediumAlerts.length,
      lowCount: lowAlerts.length,
    },

    incidents: {
      activeCount: unresolvedCases.length,
      criticalCount: criticalCases.length,
      unresolvedCount: unresolvedCases.length,
    },

    demand: {
      predictedDemand,
      predictedOccupancy,
      demandLevel,
      dataQuality: demandDataQuality,
    },

    capacity: {
      recommendation: capacityRecommendation,
      vehicleCapacity,
    },

    explanation: evalResult.explanation,
    briefing: evalResult.briefing,

    evidence: {
      riskEvidence: currentSnapshot
        ? {
            factors: currentSnapshot.factors,
            emergencyPoints: currentSnapshot.emergencyPoints,
            deviationPoints: currentSnapshot.deviationPoints,
            speedPoints: currentSnapshot.speedPoints,
            driverVerified: currentSnapshot.driverVerified,
            vehicleApproved: currentSnapshot.vehicleApproved,
          }
        : null,
      alertEvidence: activeAlerts,
      incidentEvidence: unresolvedCases,
      demandEvidence: matchingPred || null,
    },

    generatedAt: nowIso,
  };
}

/**
 * Deterministic rank mapping for operational status sorting.
 */
function getOperationalStatusRank(status: OperationalStatus): number {
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
 * Builds unified operational decision support across the entire fleet or for a single route.
 */
export async function buildOperationalDecisionSupport(
  targetRouteIdentifier?: string
): Promise<FleetDecisionSupportResult | RouteOperationalDecisionSupport | null> {
  // 1. Fetch routes from Prisma DB or fallback to Firestore
  let activeRoutes: any[] = [];
  try {
    const pRoutes = await prisma.route.findMany({
      where: { status: 'ACTIVE' },
      include: { assignedVehicle: true },
    });
    if (pRoutes.length > 0) {
      activeRoutes = pRoutes.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        assignedVehicle: r.assignedVehicle || { capacity: 16 },
      }));
    }
  } catch (err) {
    console.warn('[DecisionSupportEngine] Prisma route query notice:', err);
  }

  if (activeRoutes.length === 0) {
    const dbRoutes = await getAllRoutes();
    activeRoutes =
      dbRoutes.length > 0
        ? dbRoutes
        : DEFAULT_CORRIDOR_ROUTES.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            assignedVehicle: { capacity: 16 },
          }));
  }

  // 2. Fetch Demand Pipeline result for routes
  let demandResult: DemandPredictionPipelineResult | undefined;
  try {
    demandResult = await runDemandPredictionPipeline();
  } catch (dErr) {
    console.warn('[DecisionSupportEngine] Demand pipeline query notice:', dErr);
  }

  // 3. Single Route Query
  if (targetRouteIdentifier) {
    const trimmed = targetRouteIdentifier.trim().toLowerCase();
    const matchedRoute = activeRoutes.find(
      (r) =>
        r.id.toLowerCase() === trimmed ||
        r.code.toLowerCase() === trimmed
    );

    if (!matchedRoute) {
      return null;
    }

    return await buildSingleRouteDecisionSupport(matchedRoute, demandResult);
  }

  // 4. Fleet-Wide Query
  const routeSupports: RouteOperationalDecisionSupport[] = [];
  for (const route of activeRoutes) {
    const support = await buildSingleRouteDecisionSupport(route, demandResult);
    routeSupports.push(support);
  }

  // 5. Deterministic Urgency Sorting:
  // Status Urgency: URGENT_REVIEW > ATTENTION_REQUIRED > MONITOR > NORMAL
  // Within same status:
  // 1. risk.score descending
  // 2. alerts.activeCount descending
  // 3. demand.predictedOccupancy descending
  routeSupports.sort((a, b) => {
    const rankDiff =
      getOperationalStatusRank(b.operationalStatus) -
      getOperationalStatusRank(a.operationalStatus);
    if (rankDiff !== 0) return rankDiff;

    const riskDiff = b.risk.score - a.risk.score;
    if (riskDiff !== 0) return riskDiff;

    const alertDiff = b.alerts.activeCount - a.alerts.activeCount;
    if (alertDiff !== 0) return alertDiff;

    const occA = a.demand.predictedOccupancy ?? -1;
    const occB = b.demand.predictedOccupancy ?? -1;
    return occB - occA;
  });

  // 6. Calculate internally consistent Fleet Summary metrics
  const summary: FleetDecisionSupportSummary = {
    totalRoutes: routeSupports.length,
    normal: routeSupports.filter((r) => r.operationalStatus === 'NORMAL').length,
    monitor: routeSupports.filter((r) => r.operationalStatus === 'MONITOR').length,
    attentionRequired: routeSupports.filter(
      (r) => r.operationalStatus === 'ATTENTION_REQUIRED'
    ).length,
    urgentReview: routeSupports.filter(
      (r) => r.operationalStatus === 'URGENT_REVIEW'
    ).length,

    criticalRiskRoutes: routeSupports.filter((r) => r.risk.level === 'CRITICAL')
      .length,
    highRiskRoutes: routeSupports.filter((r) => r.risk.level === 'HIGH').length,

    activeCriticalAlerts: routeSupports.reduce(
      (sum, r) => sum + r.alerts.criticalCount,
      0
    ),
    activeHighAlerts: routeSupports.reduce(
      (sum, r) => sum + r.alerts.highCount,
      0
    ),

    unresolvedIncidents: routeSupports.reduce(
      (sum, r) => sum + r.incidents.unresolvedCount,
      0
    ),

    highDemandRoutes: routeSupports.filter(
      (r) => r.demand.demandLevel === 'HIGH'
    ).length,
    criticalDemandRoutes: routeSupports.filter(
      (r) => r.demand.demandLevel === 'CRITICAL'
    ).length,
  };

  return {
    success: true,
    summary,
    routes: routeSupports,
    generatedAt: new Date().toISOString(),
  };
}
