/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — OPERATIONAL INTELLIGENCE ANALYTICS & EXECUTIVE REPORTING ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 10: Server-Authoritative, Deterministic Executive Analytics &
 * Historical Intelligence Aggregation Layer.
 *
 * Core Governance & Safety Invariants:
 * 1. Strictly READ-ONLY, ANALYTICAL, and ADVISORY:
 *    - Does NOT modify routes, vehicles, drivers, bookings, or dispatch.
 *    - Does NOT alter risk scores, alerts, incidents, or recommendations.
 *    - Administrator remains the final, sole operational authority.
 * 2. Deterministic & Evidence-Backed:
 *    - Pure aggregation without LLM generation or probabilistic hallucinations.
 *    - Every executive insight is supported by verified server-side evidence.
 * 3. Anti-Forgery & Server Authority:
 *    - Consumes verified data from Steps 1–9 stores exclusively.
 *    - Client-supplied scores, metrics, or identities are rejected.
 */

import {
  getAllRoutes,
  getRouteById,
  FirestoreRoute,
  DEFAULT_CORRIDOR_ROUTES,
} from '@/lib/firestore-db';
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
  getOperationalRecommendations,
  OperationalRecommendationRecord,
} from '@/lib/operations/recommendation-engine';
import {
  getOperationalAuditEvents,
  verifyAuditEventIntegrity,
  sanitizeAuditData,
  OperationalAuditEventRecord,
} from '@/lib/operations/operational-audit-store';
import {
  evaluateFleetGovernance,
  FleetGovernanceResponse,
  CorridorGovernanceReport,
  GovernanceException,
} from '@/lib/operations/governance-engine';
import {
  buildOperationalDecisionSupport,
  RouteOperationalDecisionSupport,
} from '@/lib/operations/decision-support-engine';

export type AnalyticsTimeWindow =
  | 'LAST_24_HOURS'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'LAST_90_DAYS'
  | 'CUSTOM';

export interface TimeWindowRange {
  window: AnalyticsTimeWindow;
  from: string; // ISO string
  to: string;   // ISO string
  durationHours: number;
}

export interface RiskAnalyticsMetric {
  routeId: string;
  routeCode: string;
  routeName: string;
  currentRiskScore: number;
  currentRiskLevel: string;
  averageRiskScore: number;
  minimumRiskScore: number;
  maximumRiskScore: number;
  riskTrend: 'RISING' | 'FALLING' | 'STABLE' | 'NO_HISTORY';
  riskScoreDelta: number;
  riskSnapshotCount: number;
  criticalRiskOccurrences: number;
  highRiskOccurrences: number;
  mediumRiskOccurrences: number;
  lowRiskOccurrences: number;
  riskFactorFrequency: Record<string, number>;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
}

export interface SafetyAlertAnalytics {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  lowAlerts: number;
  averageResolutionTimeMinutes: number | null;
  alertsByRoute: Record<string, number>;
  alertsBySeverity: Record<string, number>;
  alertsByType: Record<string, number>;
  alertFrequencyPerDay: number;
  resolutionRatePercent: number;
}

export interface IncidentAnalytics {
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  closedIncidents: number;
  criticalIncidents: number;
  highIncidents: number;
  mediumIncidents: number;
  lowIncidents: number;
  averageResolutionTimeMinutes: number | null;
  incidentRateByRoute: Record<string, number>;
  incidentRateBySeverity: Record<string, number>;
  incidentTypeDistribution: Record<string, number>;
  repeatIncidentCorridors: string[];
}

export interface DemandAnalytics {
  averagePredictedDemand: number;
  peakPredictedDemand: number;
  averageOccupancy: number;
  peakOccupancy: number;
  highDemandOccurrences: number;
  criticalDemandOccurrences: number;
  capacityPressureByRoute: Record<string, { occupancy: number; demandLevel: string }>;
  dataQualityDistribution: Record<string, number>;
  demandStatusMessage?: string;
}

export interface RecommendationAnalytics {
  totalRecommendations: number;
  pendingRecommendations: number;
  approvedRecommendations: number;
  dismissedRecommendations: number;
  completedRecommendations: number;
  stalePendingRecommendations: number;
  overdueApprovedRecommendations: number;
  recommendationsByType: Record<string, number>;
  recommendationsByPriority: Record<string, number>;
  recommendationsByRoute: Record<string, number>;
  approvalRatePercent: number;
  completionRatePercent: number;
  dismissalRatePercent: number;
  averageTimeToApprovalMinutes: number | null;
  averageTimeToCompletionMinutes: number | null;
}

export interface GovernanceAnalytics {
  totalGovernanceExceptions: number;
  criticalExceptions: number;
  highExceptions: number;
  mediumExceptions: number;
  lowExceptions: number;
  compliantRoutes: number;
  monitorRoutes: number;
  atRiskRoutes: number;
  criticalRoutes: number;
  auditCoverageGaps: number;
  auditIntegrityFailures: number;
  auditChainBreaks: number;
  evidenceCompletenessGaps: number;
  actorIdentityGaps: number;
  correlationTraceabilityGaps: number;
  humanGovernanceViolations: number;
  staleRecommendations: number;
  reviewGaps: number;
  persistingIssuesCount: number;
  resolvedIssuesCount: number;
}

export interface AuditAnalytics {
  totalAuditEvents: number;
  eventsByType: Record<string, number>;
  eventsBySourceModule: Record<string, number>;
  eventsByRoute: Record<string, number>;
  eventsByActor: Record<string, number>;
  integrityValidEvents: number;
  integrityInvalidEvents: number;
  chainBreakCount: number;
  administrativeReviewActivity: number;
}

export interface ExecutiveInsight {
  insightId: string;
  category: 'RISK' | 'SAFETY' | 'INCIDENT' | 'DEMAND' | 'RECOMMENDATION' | 'GOVERNANCE' | 'AUDIT';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  description: string;
  routeId?: string | null;
  metric: string;
  metricValue: number | string;
  comparison?: string | null;
  evidence: Record<string, any>;
}

export interface RecurringPattern {
  patternId: string;
  patternType:
    | 'REPEATED_HIGH_RISK'
    | 'REPEATED_ALERT'
    | 'REPEATED_INCIDENT'
    | 'REPEATED_DEMAND_PRESSURE'
    | 'REPEATED_GOVERNANCE_EXCEPTION';
  routeId: string;
  routeCode: string;
  occurrences: number;
  description: string;
  evidence: Record<string, any>;
}

export interface CorridorHealthProfile {
  routeId: string;
  routeCode: string;
  routeName: string;
  riskProfile: {
    currentScore: number;
    currentLevel: string;
    averageScore: number;
    maxScore: number;
    trend: string;
  };
  safetyProfile: {
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
  };
  incidentProfile: {
    totalIncidents: number;
    openIncidents: number;
    resolvedIncidents: number;
  };
  demandProfile: {
    predictedDemand: number;
    predictedOccupancy: number;
    dataQuality: string;
  };
  recommendationProfile: {
    total: number;
    pending: number;
    approved: number;
    completed: number;
    dismissed: number;
  };
  governanceProfile: {
    governanceStatus: string;
    governanceSeverity: string;
    governanceScore: number;
    exceptionCount: number;
  };
  auditProfile: {
    eventCount: number;
    verifiedCount: number;
    lastEventAt: string | null;
  };
  historicalSummary: string;
  evidence: Record<string, any>[];
}

export interface ExecutiveReportData {
  reportId: string;
  title: string;
  generatedAt: string;
  timeWindow: TimeWindowRange;
  routeFilter: string; // 'FLEET' or specific routeId
  executiveSummary: {
    totalRoutes: number;
    averageFleetRisk: number;
    totalAlerts: number;
    totalIncidents: number;
    totalRecommendations: number;
    totalGovernanceExceptions: number;
    overallGovernanceStatus: string;
  };
  riskAnalytics: RiskAnalyticsMetric[];
  safetyAlertAnalytics: SafetyAlertAnalytics;
  incidentAnalytics: IncidentAnalytics;
  demandAnalytics: DemandAnalytics;
  recommendationAnalytics: RecommendationAnalytics;
  governanceAnalytics: GovernanceAnalytics;
  auditAnalytics: AuditAnalytics;
  recurringPatterns: RecurringPattern[];
  insights: ExecutiveInsight[];
  corridorProfiles: CorridorHealthProfile[];
  limitationsNotice: string;
  humanInTheLoopNotice: string;
}

export interface OperationalAnalyticsResponse {
  success: boolean;
  timeWindow: TimeWindowRange;
  routeFilter: string;
  executiveSummary: {
    routesAnalyzed: number;
    averageFleetRisk: number;
    criticalRiskOccurrences: number;
    safetyAlerts: number;
    openIncidents: number;
    highDemandOccurrences: number;
    pendingRecommendations: number;
    governanceExceptions: number;
    overallComplianceStatus: string;
  };
  risk: {
    metrics: RiskAnalyticsMetric[];
    improvingCorridors: string[];
    stableCorridors: string[];
    deterioratingCorridors: string[];
  };
  alerts: SafetyAlertAnalytics;
  incidents: IncidentAnalytics;
  demand: DemandAnalytics;
  recommendations: RecommendationAnalytics;
  governance: GovernanceAnalytics;
  audit: AuditAnalytics;
  insights: ExecutiveInsight[];
  recurringPatterns: RecurringPattern[];
  corridorProfiles: CorridorHealthProfile[];
  report?: ExecutiveReportData;
}

/**
 * Parses and validates deterministic time windows.
 */
export function resolveTimeWindow(
  windowParam?: string | null,
  fromParam?: string | null,
  toParam?: string | null,
  referenceNow?: Date
): TimeWindowRange {
  const now = referenceNow || new Date();
  const nowMs = now.getTime();

  // Custom Window
  if (windowParam === 'CUSTOM' || (fromParam && toParam)) {
    if (!fromParam || !toParam) {
      throw new Error("Custom time window requires both 'from' and 'to' parameters in YYYY-MM-DD format.");
    }

    const fromDate = new Date(fromParam);
    const toDate = new Date(toParam);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new Error("Invalid date format for 'from' or 'to'. Use ISO 8601 or YYYY-MM-DD.");
    }

    if (fromDate >= toDate) {
      throw new Error("Invalid date range: 'from' must be chronologically earlier than 'to'.");
    }

    const durationHours = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (60 * 60 * 1000)));

    return {
      window: 'CUSTOM',
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      durationHours,
    };
  }

  const win = (windowParam?.toUpperCase() as AnalyticsTimeWindow) || 'LAST_7_DAYS';

  let durationHours = 24 * 7; // Default 7 days
  if (win === 'LAST_24_HOURS') durationHours = 24;
  else if (win === 'LAST_7_DAYS') durationHours = 24 * 7;
  else if (win === 'LAST_30_DAYS') durationHours = 24 * 30;
  else if (win === 'LAST_90_DAYS') durationHours = 24 * 90;
  else {
    durationHours = 24 * 7;
  }

  const fromDate = new Date(nowMs - durationHours * 60 * 60 * 1000);

  return {
    window: win,
    from: fromDate.toISOString(),
    to: now.toISOString(),
    durationHours,
  };
}

/**
 * Deterministic Executive Analytics Engine.
 * Evaluates verified historical operational intelligence across all dimensions.
 */
export async function computeOperationalAnalytics(params: {
  window?: AnalyticsTimeWindow | string;
  from?: string;
  to?: string;
  routeId?: string;
  generateReport?: boolean;
}): Promise<OperationalAnalyticsResponse> {
  const timeWindow = resolveTimeWindow(params.window, params.from, params.to);
  const fromMs = new Date(timeWindow.from).getTime();
  const toMs = new Date(timeWindow.to).getTime();

  // Retrieve base routes
  const routes = await getAllRoutes();
  const activeRoutes = routes.length > 0 ? routes : DEFAULT_CORRIDOR_ROUTES;

  // Filter routes if specific corridor requested
  let targetRoutes = activeRoutes;
  if (params.routeId) {
    const trimmed = params.routeId.trim().toLowerCase();
    targetRoutes = activeRoutes.filter(
      (r) =>
        r.id.toLowerCase() === trimmed ||
        r.code.toLowerCase() === trimmed ||
        (r as any).routeCode?.toLowerCase() === trimmed
    );
    if (targetRoutes.length === 0) {
      throw new Error(`Corridor '${params.routeId}' not found.`);
    }
  }

  // 1. Fetch Authoritative Datasets
  const [
    { events: allAuditEvents },
    { recommendations: allRecs },
    { incidents: allIncidents },
    allAlerts,
    governanceResult,
  ] = await Promise.all([
    getOperationalAuditEvents({ limit: 200 }),
    getOperationalRecommendations({ limit: 200 }),
    getIncidentCases({ limit: 100 }),
    getSafetyAlerts({ limit: 100 }),
    evaluateFleetGovernance(),
  ]);

  // 2. Filter Datasets to Time Window & Target Routes
  const targetRouteIds = new Set(targetRoutes.map((r) => r.id));
  const targetRouteCodes = new Set(targetRoutes.map((r) => r.code || (r as any).routeCode || r.id));

  const isRouteMatch = (rId?: string | null, rCode?: string | null) => {
    if (!params.routeId) return true;
    if (rId && targetRouteIds.has(rId)) return true;
    if (rCode && targetRouteCodes.has(rCode)) return true;
    return false;
  };

  const isTimeMatch = (isoDate?: string | null) => {
    if (!isoDate) return false;
    const t = new Date(isoDate).getTime();
    return t >= fromMs && t <= toMs;
  };

  const filteredAlerts = allAlerts.filter(
    (a) => isRouteMatch(a.routeId, a.routeCode) && isTimeMatch(a.triggeredAt || a.createdAt)
  );

  const filteredIncidents = allIncidents.filter(
    (i) => isRouteMatch(i.routeId, i.routeCode) && isTimeMatch(i.createdAt)
  );

  const filteredRecs = allRecs.filter(
    (r) => isRouteMatch(r.routeId, r.routeCode) && isTimeMatch(r.createdAt)
  );

  const filteredAuditEvents = allAuditEvents.filter(
    (e) => (isRouteMatch(e.routeId, e.routeCode) || !e.routeId) && isTimeMatch(e.createdAt)
  );

  // 3. Compute Risk Analytics per Route
  const riskMetrics: RiskAnalyticsMetric[] = [];
  const improvingCorridors: string[] = [];
  const stableCorridors: string[] = [];
  const deterioratingCorridors: string[] = [];

  let fleetRiskSum = 0;
  let criticalRiskOccurrencesTotal = 0;

  for (const route of targetRoutes) {
    const routeCode = route.code || (route as any).routeCode || route.id;
    const snapshots: RouteRiskSnapshot[] = await getRouteRiskHistory(routeCode, 50);

    // Filter snapshots in window
    const windowSnapshots = snapshots.filter((s) => isTimeMatch(s.evaluatedAt));
    const activeSnapshots = windowSnapshots.length > 0 ? windowSnapshots : snapshots.slice(-5);

    const scores = activeSnapshots.map((s) => s.riskScore);
    const latestScore = scores.length > 0 ? scores[scores.length - 1] : 0;
    const earliestScore = scores.length > 0 ? scores[0] : 0;

    const avgScore =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const delta = latestScore - earliestScore;

    let trend: 'RISING' | 'FALLING' | 'STABLE' | 'NO_HISTORY' = 'STABLE';
    if (activeSnapshots.length < 2) {
      trend = 'NO_HISTORY';
    } else if (delta > 0) {
      trend = 'RISING';
      deterioratingCorridors.push(routeCode);
    } else if (delta < 0) {
      trend = 'FALLING';
      improvingCorridors.push(routeCode);
    } else {
      trend = 'STABLE';
      stableCorridors.push(routeCode);
    }

    let critOcc = 0;
    let highOcc = 0;
    let medOcc = 0;
    let lowOcc = 0;
    const factorFreq: Record<string, number> = {};

    for (const snap of activeSnapshots) {
      if (snap.riskLevel === 'CRITICAL' || snap.riskScore >= 75) critOcc++;
      else if (snap.riskLevel === 'HIGH' || snap.riskScore >= 50) highOcc++;
      else if (snap.riskLevel === 'MEDIUM' || snap.riskScore >= 25) medOcc++;
      else lowOcc++;

      if (snap.emergencyPoints > 0) factorFreq['emergencyEvents'] = (factorFreq['emergencyEvents'] || 0) + 1;
      if (snap.deviationPoints > 0) factorFreq['routeDeviation'] = (factorFreq['routeDeviation'] || 0) + 1;
      if (snap.speedPoints > 0) factorFreq['speedAnomaly'] = (factorFreq['speedAnomaly'] || 0) + 1;
      if (snap.stopGpsPoints > 0) factorFreq['offRouteStopGps'] = (factorFreq['offRouteStopGps'] || 0) + 1;
      if (snap.compliancePoints > 0) factorFreq['driverCompliance'] = (factorFreq['driverCompliance'] || 0) + 1;
      if (snap.complexityPoints > 0) factorFreq['routeComplexity'] = (factorFreq['routeComplexity'] || 0) + 1;
    }

    criticalRiskOccurrencesTotal += critOcc;
    fleetRiskSum += avgScore;

    riskMetrics.push({
      routeId: route.id,
      routeCode,
      routeName: route.name,
      currentRiskScore: latestScore,
      currentRiskLevel:
        latestScore >= 75
          ? 'CRITICAL'
          : latestScore >= 50
          ? 'HIGH'
          : latestScore >= 25
          ? 'MEDIUM'
          : 'LOW',
      averageRiskScore: avgScore,
      minimumRiskScore: minScore,
      maximumRiskScore: maxScore,
      riskTrend: trend,
      riskScoreDelta: delta,
      riskSnapshotCount: activeSnapshots.length,
      criticalRiskOccurrences: critOcc,
      highRiskOccurrences: highOcc,
      mediumRiskOccurrences: medOcc,
      lowRiskOccurrences: lowOcc,
      riskFactorFrequency: factorFreq,
      firstObservedAt: activeSnapshots.length > 0 ? activeSnapshots[0].evaluatedAt : null,
      lastObservedAt: activeSnapshots.length > 0 ? activeSnapshots[activeSnapshots.length - 1].evaluatedAt : null,
    });
  }

  const averageFleetRisk =
    targetRoutes.length > 0 ? Math.round((fleetRiskSum / targetRoutes.length) * 10) / 10 : 0;

  // 4. Compute Safety Alert Analytics
  const alertRoutes: Record<string, number> = {};
  const alertSeverities: Record<string, number> = {};
  const alertTypes: Record<string, number> = {};
  let resolvedAlertCount = 0;
  let activeAlertCount = 0;
  let alertDurationSum = 0;
  let alertDurationCount = 0;

  for (const alt of filteredAlerts) {
    alertRoutes[alt.routeCode] = (alertRoutes[alt.routeCode] || 0) + 1;
    alertSeverities[alt.severity] = (alertSeverities[alt.severity] || 0) + 1;
    alertTypes[alt.type] = (alertTypes[alt.type] || 0) + 1;

    if (alt.status === 'RESOLVED') {
      resolvedAlertCount++;
      if (alt.resolvedAt && alt.triggeredAt) {
        const dur = (new Date(alt.resolvedAt).getTime() - new Date(alt.triggeredAt).getTime()) / (60 * 1000);
        if (dur >= 0) {
          alertDurationSum += dur;
          alertDurationCount++;
        }
      }
    } else {
      activeAlertCount++;
    }
  }

  const totalAlerts = filteredAlerts.length;
  const daysInWindow = Math.max(1, timeWindow.durationHours / 24);
  const alertFrequencyPerDay = Math.round((totalAlerts / daysInWindow) * 100) / 100;
  const resolutionRatePercent =
    totalAlerts > 0 ? Math.round((resolvedAlertCount / totalAlerts) * 100) : 100;
  const averageAlertResolutionMinutes =
    alertDurationCount > 0 ? Math.round(alertDurationSum / alertDurationCount) : null;

  const safetyAlertAnalytics: SafetyAlertAnalytics = {
    totalAlerts,
    activeAlerts: activeAlertCount,
    resolvedAlerts: resolvedAlertCount,
    criticalAlerts: alertSeverities['CRITICAL'] || 0,
    highAlerts: alertSeverities['HIGH'] || 0,
    mediumAlerts: alertSeverities['MEDIUM'] || 0,
    lowAlerts: alertSeverities['LOW'] || 0,
    averageResolutionTimeMinutes: averageAlertResolutionMinutes,
    alertsByRoute: alertRoutes,
    alertsBySeverity: alertSeverities,
    alertsByType: alertTypes,
    alertFrequencyPerDay,
    resolutionRatePercent,
  };

  // 5. Compute Incident Analytics
  const incRoutes: Record<string, number> = {};
  const incSeverities: Record<string, number> = {};
  const incTypes: Record<string, number> = {};
  let openIncidents = 0;
  let resolvedIncidents = 0;
  let closedIncidents = 0;
  let incDurationSum = 0;
  let incDurationCount = 0;

  for (const inc of filteredIncidents) {
    incRoutes[inc.routeCode] = (incRoutes[inc.routeCode] || 0) + 1;
    incSeverities[inc.severity] = (incSeverities[inc.severity] || 0) + 1;
    incTypes[inc.sourceAlertType] = (incTypes[inc.sourceAlertType] || 0) + 1;

    if (inc.status === 'RESOLVED') {
      resolvedIncidents++;
      if (inc.resolvedAt && inc.createdAt) {
        const dur = (new Date(inc.resolvedAt).getTime() - new Date(inc.createdAt).getTime()) / (60 * 1000);
        if (dur >= 0) {
          incDurationSum += dur;
          incDurationCount++;
        }
      }
    } else if (inc.status === 'CLOSED') {
      closedIncidents++;
      if (inc.closedAt && inc.createdAt) {
        const dur = (new Date(inc.closedAt).getTime() - new Date(inc.createdAt).getTime()) / (60 * 1000);
        if (dur >= 0) {
          incDurationSum += dur;
          incDurationCount++;
        }
      }
    } else {
      openIncidents++;
    }
  }

  const repeatIncidentCorridors = Object.entries(incRoutes)
    .filter(([, count]) => count >= 2)
    .map(([code]) => code);

  const averageIncResolutionMinutes =
    incDurationCount > 0 ? Math.round(incDurationSum / incDurationCount) : null;

  const incidentAnalytics: IncidentAnalytics = {
    totalIncidents: filteredIncidents.length,
    openIncidents,
    resolvedIncidents,
    closedIncidents,
    criticalIncidents: incSeverities['CRITICAL'] || 0,
    highIncidents: incSeverities['HIGH'] || 0,
    mediumIncidents: incSeverities['MEDIUM'] || 0,
    lowIncidents: incSeverities['LOW'] || 0,
    averageResolutionTimeMinutes: averageIncResolutionMinutes,
    incidentRateByRoute: incRoutes,
    incidentRateBySeverity: incSeverities,
    incidentTypeDistribution: incTypes,
    repeatIncidentCorridors,
  };

  // 6. Compute Demand Analytics
  const capacityPressure: Record<string, { occupancy: number; demandLevel: string }> = {};
  const dataQualityDist: Record<string, number> = {
    HIGH_DATA_QUALITY: 0,
    MEDIUM_DATA_QUALITY: 0,
    LOW_DATA_QUALITY: 0,
    INSUFFICIENT_DATA: 0,
  };

  let demandSum = 0;
  let occupancySum = 0;
  let peakDemand = 0;
  let peakOccupancy = 0;
  let highDemandOccurrences = 0;
  let criticalDemandOccurrences = 0;
  let evaluatedRoutesWithDemand = 0;

  for (const route of targetRoutes) {
    const routeCode = route.code || (route as any).routeCode || route.id;
    try {
      const ds = (await buildOperationalDecisionSupport(route.id)) as RouteOperationalDecisionSupport;
      if (ds && ds.demand) {
        const demand = ds.demand.predictedDemand ?? 0;
        const occ = ds.demand.predictedOccupancy ?? 0;
        const q = ds.demand.dataQuality || 'INSUFFICIENT_DATA';

        dataQualityDist[q] = (dataQualityDist[q] || 0) + 1;
        capacityPressure[routeCode] = { occupancy: occ, demandLevel: ds.demand.demandLevel || 'LOW' };

        demandSum += demand;
        occupancySum += occ;
        if (demand > peakDemand) peakDemand = demand;
        if (occ > peakOccupancy) peakOccupancy = occ;

        if (occ >= 75) highDemandOccurrences++;
        if (occ >= 90) criticalDemandOccurrences++;
        evaluatedRoutesWithDemand++;
      }
    } catch {
      dataQualityDist['INSUFFICIENT_DATA'] = (dataQualityDist['INSUFFICIENT_DATA'] || 0) + 1;
    }
  }

  const demandAnalytics: DemandAnalytics = {
    averagePredictedDemand:
      evaluatedRoutesWithDemand > 0 ? Math.round(demandSum / evaluatedRoutesWithDemand) : 0,
    peakPredictedDemand: peakDemand,
    averageOccupancy:
      evaluatedRoutesWithDemand > 0 ? Math.round(occupancySum / evaluatedRoutesWithDemand) : 0,
    peakOccupancy,
    highDemandOccurrences,
    criticalDemandOccurrences,
    capacityPressureByRoute: capacityPressure,
    dataQualityDistribution: dataQualityDist,
    demandStatusMessage:
      evaluatedRoutesWithDemand === 0 || dataQualityDist['INSUFFICIENT_DATA'] === targetRoutes.length
        ? 'Demand analytics unavailable due to insufficient historical data.'
        : undefined,
  };

  // 7. Compute Recommendation Analytics
  let pendingRecs = 0;
  let approvedRecs = 0;
  let dismissedRecs = 0;
  let completedRecs = 0;
  let stalePendingRecs = 0;
  let overdueApprovedRecs = 0;

  const recTypes: Record<string, number> = {};
  const recPriorities: Record<string, number> = {};
  const recRoutes: Record<string, number> = {};

  let approvalDurSum = 0;
  let approvalDurCount = 0;
  let completeDurSum = 0;
  let completeDurCount = 0;

  const nowMs = Date.now();

  for (const rec of filteredRecs) {
    recTypes[rec.type] = (recTypes[rec.type] || 0) + 1;
    recPriorities[rec.priority] = (recPriorities[rec.priority] || 0) + 1;
    recRoutes[rec.routeCode] = (recRoutes[rec.routeCode] || 0) + 1;

    if (rec.status === 'PENDING') {
      pendingRecs++;
      const ageMs = nowMs - new Date(rec.createdAt).getTime();
      if (ageMs > 24 * 60 * 60 * 1000) stalePendingRecs++;
    } else if (rec.status === 'APPROVED') {
      approvedRecs++;
      const approvedTime = new Date(rec.approvedAt || rec.updatedAt).getTime();
      if (nowMs - approvedTime > 24 * 60 * 60 * 1000) overdueApprovedRecs++;
      if (rec.approvedAt && rec.createdAt) {
        const dur = (new Date(rec.approvedAt).getTime() - new Date(rec.createdAt).getTime()) / (60 * 1000);
        if (dur >= 0) {
          approvalDurSum += dur;
          approvalDurCount++;
        }
      }
    } else if (rec.status === 'DISMISSED') {
      dismissedRecs++;
    } else if (rec.status === 'COMPLETED') {
      completedRecs++;
      if (rec.completedAt && rec.approvedAt) {
        const dur = (new Date(rec.completedAt).getTime() - new Date(rec.approvedAt).getTime()) / (60 * 1000);
        if (dur >= 0) {
          completeDurSum += dur;
          completeDurCount++;
        }
      }
    }
  }

  const totalRecs = filteredRecs.length;
  const approvalRatePercent =
    totalRecs > 0 ? Math.round(((approvedRecs + completedRecs) / totalRecs) * 100) : 0;
  const completionRatePercent =
    approvedRecs + completedRecs > 0
      ? Math.round((completedRecs / (approvedRecs + completedRecs)) * 100)
      : 0;
  const dismissalRatePercent =
    totalRecs > 0 ? Math.round((dismissedRecs / totalRecs) * 100) : 0;

  const recommendationAnalytics: RecommendationAnalytics = {
    totalRecommendations: totalRecs,
    pendingRecommendations: pendingRecs,
    approvedRecommendations: approvedRecs,
    dismissedRecommendations: dismissedRecs,
    completedRecommendations: completedRecs,
    stalePendingRecommendations: stalePendingRecs,
    overdueApprovedRecommendations: overdueApprovedRecs,
    recommendationsByType: recTypes,
    recommendationsByPriority: recPriorities,
    recommendationsByRoute: recRoutes,
    approvalRatePercent,
    completionRatePercent,
    dismissalRatePercent,
    averageTimeToApprovalMinutes:
      approvalDurCount > 0 ? Math.round(approvalDurSum / approvalDurCount) : null,
    averageTimeToCompletionMinutes:
      completeDurCount > 0 ? Math.round(completeDurSum / completeDurCount) : null,
  };

  // 8. Compute Governance Analytics
  const govSummary = governanceResult.summary;
  const governanceAnalytics: GovernanceAnalytics = {
    totalGovernanceExceptions: govSummary.totalGovernanceExceptions,
    criticalExceptions: govSummary.criticalExceptions,
    highExceptions: govSummary.highExceptions,
    mediumExceptions: govSummary.mediumExceptions,
    lowExceptions: govSummary.lowExceptions,
    compliantRoutes: govSummary.compliantRoutes,
    monitorRoutes: govSummary.monitorRoutes,
    atRiskRoutes: govSummary.atRiskRoutes,
    criticalRoutes: govSummary.criticalRoutes,
    auditCoverageGaps: govSummary.totalGovernanceExceptions - govSummary.auditIntegrityFailures,
    auditIntegrityFailures: govSummary.auditIntegrityFailures,
    auditChainBreaks: govSummary.auditChainBreaks,
    evidenceCompletenessGaps: govSummary.evidenceCompletenessGaps,
    actorIdentityGaps: govSummary.actorIdentityGaps,
    correlationTraceabilityGaps: govSummary.correlationTraceabilityGaps,
    humanGovernanceViolations: govSummary.humanGovernanceViolations,
    staleRecommendations: govSummary.stalePendingRecommendations,
    reviewGaps: govSummary.riskReviewGaps + govSummary.capacityReviewGaps,
    persistingIssuesCount: govSummary.criticalExceptions + govSummary.highExceptions,
    resolvedIssuesCount: 0,
  };

  // 9. Compute Audit Analytics
  const auditEventsByType: Record<string, number> = {};
  const auditEventsBySource: Record<string, number> = {};
  const auditEventsByRoute: Record<string, number> = {};
  const auditEventsByActor: Record<string, number> = {};

  let validIntegrityEvents = 0;
  let invalidIntegrityEvents = 0;
  let adminReviewsCount = 0;

  for (const ev of filteredAuditEvents) {
    auditEventsByType[ev.eventType] = (auditEventsByType[ev.eventType] || 0) + 1;
    auditEventsBySource[ev.sourceModule] = (auditEventsBySource[ev.sourceModule] || 0) + 1;
    if (ev.routeCode) auditEventsByRoute[ev.routeCode] = (auditEventsByRoute[ev.routeCode] || 0) + 1;
    if (ev.actorUserId) auditEventsByActor[ev.actorUserId] = (auditEventsByActor[ev.actorUserId] || 0) + 1;

    if (verifyAuditEventIntegrity(ev)) {
      validIntegrityEvents++;
    } else {
      invalidIntegrityEvents++;
    }

    if (
      ev.eventType === 'GOVERNANCE_REVIEWED' ||
      ev.eventType === 'DECISION_SUPPORT_VIEWED' ||
      ev.eventType === 'ROUTE_RISK_VIEWED' ||
      ev.eventType === 'AUDIT_LOG_VIEWED' ||
      ev.eventType === 'OPERATIONAL_ANALYTICS_VIEWED' ||
      ev.eventType === 'EXECUTIVE_REPORT_GENERATED'
    ) {
      adminReviewsCount++;
    }
  }

  const auditAnalytics: AuditAnalytics = {
    totalAuditEvents: filteredAuditEvents.length,
    eventsByType: auditEventsByType,
    eventsBySourceModule: auditEventsBySource,
    eventsByRoute: auditEventsByRoute,
    eventsByActor: auditEventsByActor,
    integrityValidEvents: validIntegrityEvents,
    integrityInvalidEvents: invalidIntegrityEvents,
    chainBreakCount: govSummary.auditChainBreaks,
    administrativeReviewActivity: adminReviewsCount,
  };

  // 10. Generate Deterministic Executive Insights (Part 12)
  const insights: ExecutiveInsight[] = [];

  // Insight 1: Highest average risk corridor
  if (riskMetrics.length > 0) {
    const highestRisk = [...riskMetrics].sort((a, b) => b.averageRiskScore - a.averageRiskScore)[0];
    if (highestRisk.averageRiskScore > 0) {
      insights.push({
        insightId: `ins_risk_highest_${highestRisk.routeCode}`,
        category: 'RISK',
        severity: highestRisk.averageRiskScore >= 50 ? 'HIGH' : 'MEDIUM',
        title: `Highest Average Risk Corridor: ${highestRisk.routeCode}`,
        description: `Corridor ${highestRisk.routeCode} (${highestRisk.routeName}) recorded the highest average route risk score (${highestRisk.averageRiskScore}/100) during the selected period.`,
        routeId: highestRisk.routeId,
        metric: 'averageRiskScore',
        metricValue: highestRisk.averageRiskScore,
        comparison: `Fleet average is ${averageFleetRisk}/100.`,
        evidence: {
          routeCode: highestRisk.routeCode,
          averageRiskScore: highestRisk.averageRiskScore,
          maxScore: highestRisk.maximumRiskScore,
          criticalOccurrences: highestRisk.criticalRiskOccurrences,
        },
      });
    }
  }

  // Insight 2: Highest alert volume corridor
  const topAlertEntry = Object.entries(alertRoutes).sort((a, b) => b[1] - a[1])[0];
  if (topAlertEntry && topAlertEntry[1] > 0) {
    insights.push({
      insightId: `ins_alert_top_${topAlertEntry[0]}`,
      category: 'SAFETY',
      severity: 'HIGH',
      title: `Elevated Alert Volume: ${topAlertEntry[0]}`,
      description: `Corridor ${topAlertEntry[0]} recorded the highest frequency of operational safety alerts (${topAlertEntry[1]} alert(s)) during the selected period.`,
      routeId: topAlertEntry[0],
      metric: 'totalAlerts',
      metricValue: topAlertEntry[1],
      comparison: `Fleet total is ${totalAlerts} alerts.`,
      evidence: {
        routeCode: topAlertEntry[0],
        alertCount: topAlertEntry[1],
        activeAlerts: activeAlertCount,
      },
    });
  }

  // Insight 3: Demand analytics availability
  if (demandAnalytics.demandStatusMessage) {
    insights.push({
      insightId: 'ins_demand_data_quality',
      category: 'DEMAND',
      severity: 'INFO',
      title: 'Demand Prediction Data Baseline',
      description: demandAnalytics.demandStatusMessage,
      metric: 'dataQuality',
      metricValue: 'INSUFFICIENT_DATA',
      evidence: {
        distribution: dataQualityDist,
      },
    });
  } else if (demandAnalytics.highDemandOccurrences > 0) {
    insights.push({
      insightId: 'ins_demand_capacity_pressure',
      category: 'DEMAND',
      severity: 'MEDIUM',
      title: 'Corridor Capacity Pressure Observed',
      description: `${demandAnalytics.highDemandOccurrences} corridor(s) observed high predicted passenger occupancy (>75%). Peak fleet occupancy reached ${demandAnalytics.peakOccupancy}%.`,
      metric: 'highDemandOccurrences',
      metricValue: demandAnalytics.highDemandOccurrences,
      evidence: {
        peakOccupancy: demandAnalytics.peakOccupancy,
        pressureByRoute: capacityPressure,
      },
    });
  }

  // Insight 4: Governance status overview
  if (govSummary.totalGovernanceExceptions === 0) {
    insights.push({
      insightId: 'ins_gov_clean',
      category: 'GOVERNANCE',
      severity: 'INFO',
      title: 'Full Operational Governance Compliance',
      description: `All ${targetRoutes.length} corridor(s) meet deterministic governance rules with zero recorded compliance exceptions.`,
      metric: 'totalGovernanceExceptions',
      metricValue: 0,
      evidence: {
        compliantRoutes: govSummary.compliantRoutes,
        auditIntegrityFailures: govSummary.auditIntegrityFailures,
      },
    });
  } else {
    insights.push({
      insightId: 'ins_gov_exceptions',
      category: 'GOVERNANCE',
      severity: govSummary.criticalExceptions > 0 ? 'CRITICAL' : 'HIGH',
      title: 'Operational Governance Exceptions Require Review',
      description: `${govSummary.totalGovernanceExceptions} governance exception(s) detected across ${govSummary.atRiskRoutes + govSummary.criticalRoutes} corridor(s). Human administrative review recommended.`,
      metric: 'totalGovernanceExceptions',
      metricValue: govSummary.totalGovernanceExceptions,
      evidence: {
        critical: govSummary.criticalExceptions,
        high: govSummary.highExceptions,
        medium: govSummary.mediumExceptions,
      },
    });
  }

  // Insight 5: Audit ledger cryptographic integrity
  if (invalidIntegrityEvents === 0 && govSummary.auditChainBreaks === 0) {
    insights.push({
      insightId: 'ins_audit_integrity_verified',
      category: 'AUDIT',
      severity: 'INFO',
      title: 'Cryptographic Audit Ledger Verified',
      description: `All ${validIntegrityEvents} examined operational audit records passed SHA-256 verification and sequential chain linking.`,
      metric: 'validIntegrityEvents',
      metricValue: validIntegrityEvents,
      evidence: {
        verifiedEvents: validIntegrityEvents,
        chainBreaks: 0,
      },
    });
  }

  // 11. Recurring Pattern Detection (Part 13)
  const patterns: RecurringPattern[] = [];

  // Pattern A: Repeated High-Risk Corridors (>= 2 high/critical occurrences)
  for (const rm of riskMetrics) {
    const totalElevated = rm.criticalRiskOccurrences + rm.highRiskOccurrences;
    if (totalElevated >= 2) {
      patterns.push({
        patternId: `pat_risk_${rm.routeCode}`,
        patternType: 'REPEATED_HIGH_RISK',
        routeId: rm.routeId,
        routeCode: rm.routeCode,
        occurrences: totalElevated,
        description: `Corridor ${rm.routeCode} experienced ${totalElevated} elevated risk evaluations (HIGH or CRITICAL) across consecutive observations.`,
        evidence: {
          criticalOccurrences: rm.criticalRiskOccurrences,
          highOccurrences: rm.highRiskOccurrences,
          averageRisk: rm.averageRiskScore,
        },
      });
    }
  }

  // Pattern B: Repeated Safety Alert Category (>= 2 alerts on route)
  for (const [routeCode, count] of Object.entries(alertRoutes)) {
    if (count >= 2) {
      patterns.push({
        patternId: `pat_alert_${routeCode}`,
        patternType: 'REPEATED_ALERT',
        routeId: routeCode,
        routeCode,
        occurrences: count,
        description: `Corridor ${routeCode} triggered ${count} safety alerts within the selected period.`,
        evidence: {
          alertCount: count,
          severities: alertSeverities,
        },
      });
    }
  }

  // Pattern C: Repeated Incidents (>= 2 incidents on route)
  for (const [routeCode, count] of Object.entries(incRoutes)) {
    if (count >= 2) {
      patterns.push({
        patternId: `pat_inc_${routeCode}`,
        patternType: 'REPEATED_INCIDENT',
        routeId: routeCode,
        routeCode,
        occurrences: count,
        description: `Corridor ${routeCode} recorded ${count} operational safety incidents requiring investigation.`,
        evidence: {
          incidentCount: count,
          types: incTypes,
        },
      });
    }
  }

  // Pattern D: Repeated Demand Pressure (high occupancy >= 80)
  for (const [routeCode, pres] of Object.entries(capacityPressure)) {
    if (pres.occupancy >= 80) {
      patterns.push({
        patternId: `pat_demand_${routeCode}`,
        patternType: 'REPEATED_DEMAND_PRESSURE',
        routeId: routeCode,
        routeCode,
        occurrences: 1,
        description: `Corridor ${routeCode} demonstrates sustained high capacity pressure (${pres.occupancy}% occupancy).`,
        evidence: {
          occupancy: pres.occupancy,
          demandLevel: pres.demandLevel,
        },
      });
    }
  }

  // 12. Build Corridor Health Profiles (Part 14)
  const corridorProfiles: CorridorHealthProfile[] = [];

  for (const route of targetRoutes) {
    const routeCode = route.code || (route as any).routeCode || route.id;
    const rMetrics = riskMetrics.find((m) => m.routeCode === routeCode) || {
      currentRiskScore: 0,
      currentRiskLevel: 'LOW',
      averageRiskScore: 0,
      maximumRiskScore: 0,
      riskTrend: 'STABLE' as const,
    };

    const govCorridor = governanceResult.corridors.find(
      (c) => c.routeId === route.id || c.routeCode === routeCode
    );

    const rAlerts = filteredAlerts.filter((a) => a.routeId === route.id || a.routeCode === routeCode);
    const rIncidents = filteredIncidents.filter((i) => i.routeId === route.id || i.routeCode === routeCode);
    const rRecs = filteredRecs.filter((r) => r.routeId === route.id || r.routeCode === routeCode);
    const rAudit = filteredAuditEvents.filter((e) => e.routeId === route.id || e.routeCode === routeCode);

    const activeAlts = rAlerts.filter((a) => a.status === 'ACTIVE').length;
    const resolvedAlts = rAlerts.filter((a) => a.status === 'RESOLVED').length;
    const openIncs = rIncidents.filter((i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length;
    const resolvedIncs = rIncidents.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length;

    const summaryText = `Corridor ${routeCode} (${route.name}) exhibits ${rMetrics.currentRiskLevel} risk (${rMetrics.currentRiskScore}/100, trend: ${rMetrics.riskTrend}). In selected period: ${rAlerts.length} alert(s), ${rIncidents.length} incident(s), and governance status is ${govCorridor?.governanceStatus || 'GOVERNANCE_COMPLIANT'}.`;

    corridorProfiles.push({
      routeId: route.id,
      routeCode,
      routeName: route.name,
      riskProfile: {
        currentScore: rMetrics.currentRiskScore,
        currentLevel: rMetrics.currentRiskLevel,
        averageScore: rMetrics.averageRiskScore,
        maxScore: rMetrics.maximumRiskScore,
        trend: rMetrics.riskTrend,
      },
      safetyProfile: {
        totalAlerts: rAlerts.length,
        activeAlerts: activeAlts,
        resolvedAlerts: resolvedAlts,
      },
      incidentProfile: {
        totalIncidents: rIncidents.length,
        openIncidents: openIncs,
        resolvedIncidents: resolvedIncs,
      },
      demandProfile: {
        predictedDemand: demandAnalytics.averagePredictedDemand,
        predictedOccupancy: capacityPressure[routeCode]?.occupancy || 0,
        dataQuality: demandAnalytics.demandStatusMessage ? 'INSUFFICIENT_DATA' : 'HIGH_DATA_QUALITY',
      },
      recommendationProfile: {
        total: rRecs.length,
        pending: rRecs.filter((r) => r.status === 'PENDING').length,
        approved: rRecs.filter((r) => r.status === 'APPROVED').length,
        completed: rRecs.filter((r) => r.status === 'COMPLETED').length,
        dismissed: rRecs.filter((r) => r.status === 'DISMISSED').length,
      },
      governanceProfile: {
        governanceStatus: govCorridor?.governanceStatus || 'GOVERNANCE_COMPLIANT',
        governanceSeverity: govCorridor?.governanceSeverity || 'INFO',
        governanceScore: govCorridor?.governanceScore ?? 100,
        exceptionCount: govCorridor?.exceptionCount ?? 0,
      },
      auditProfile: {
        eventCount: rAudit.length,
        verifiedCount: rAudit.filter((e) => verifyAuditEventIntegrity(e)).length,
        lastEventAt: rAudit.length > 0 ? rAudit[0].createdAt : null,
      },
      historicalSummary: summaryText,
      evidence: [
        {
          riskMetrics: rMetrics,
          alertsCount: rAlerts.length,
          incidentsCount: rIncidents.length,
        },
      ],
    });
  }

  // 13. Optional Executive Report Generation (Part 24 & 25)
  let reportData: ExecutiveReportData | undefined = undefined;
  if (params.generateReport) {
    reportData = {
      reportId: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: 'SmartRide Operational Intelligence & Governance Executive Report',
      generatedAt: new Date().toISOString(),
      timeWindow,
      routeFilter: params.routeId || 'FLEET',
      executiveSummary: {
        totalRoutes: targetRoutes.length,
        averageFleetRisk,
        totalAlerts,
        totalIncidents: filteredIncidents.length,
        totalRecommendations: totalRecs,
        totalGovernanceExceptions: govSummary.totalGovernanceExceptions,
        overallGovernanceStatus:
          govSummary.criticalRoutes > 0
            ? 'GOVERNANCE_CRITICAL'
            : govSummary.atRiskRoutes > 0
            ? 'GOVERNANCE_AT_RISK'
            : govSummary.monitorRoutes > 0
            ? 'GOVERNANCE_MONITOR'
            : 'GOVERNANCE_COMPLIANT',
      },
      riskAnalytics: riskMetrics,
      safetyAlertAnalytics,
      incidentAnalytics,
      demandAnalytics,
      recommendationAnalytics,
      governanceAnalytics,
      auditAnalytics,
      recurringPatterns: patterns,
      insights,
      corridorProfiles,
      limitationsNotice:
        'This executive report is derived strictly from server-authoritative databases and historical logs. It does not replace human operational authority.',
      humanInTheLoopNotice:
        'Operational decisions, driver reassignments, route modifications, and dispatch remain under the exclusive authority of authorized administrators.',
    };
  }

  return {
    success: true,
    timeWindow,
    routeFilter: params.routeId || 'FLEET',
    executiveSummary: {
      routesAnalyzed: targetRoutes.length,
      averageFleetRisk,
      criticalRiskOccurrences: criticalRiskOccurrencesTotal,
      safetyAlerts: totalAlerts,
      openIncidents,
      highDemandOccurrences,
      pendingRecommendations: pendingRecs,
      governanceExceptions: govSummary.totalGovernanceExceptions,
      overallComplianceStatus:
        govSummary.criticalRoutes > 0
          ? 'GOVERNANCE_CRITICAL'
          : govSummary.atRiskRoutes > 0
          ? 'GOVERNANCE_AT_RISK'
          : govSummary.monitorRoutes > 0
          ? 'GOVERNANCE_MONITOR'
          : 'GOVERNANCE_COMPLIANT',
    },
    risk: {
      metrics: riskMetrics,
      improvingCorridors,
      stableCorridors,
      deterioratingCorridors,
    },
    alerts: safetyAlertAnalytics,
    incidents: incidentAnalytics,
    demand: demandAnalytics,
    recommendations: recommendationAnalytics,
    governance: governanceAnalytics,
    audit: auditAnalytics,
    insights,
    recurringPatterns: patterns,
    corridorProfiles,
    report: reportData,
  };
}
