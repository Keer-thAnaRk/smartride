/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — OPERATIONAL RECOMMENDATION & ACTION PLANNING ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 7: Deterministic Operational Recommendation Engine.
 *
 * Rules:
 * - Purely deterministic, explainable advisory recommendations.
 * - Derived strictly from verified Steps 1–6 intelligence:
 *     - Step 1: Current Route Risk Score & Factors
 *     - Step 2: Route Risk History & Trend Deltas
 *     - Step 3: Operational Safety Alerts
 *     - Step 4: Incident Response & Case Management
 *     - Step 5: AI Demand Prediction & Occupancy
 *     - Step 6: Operational Decision Support
 * - Zero LLM generation or probabilistic guesswork.
 * - Human-in-the-loop: approval/dismissal/completion does NOT mutate routes,
 *   schedules, bookings, subscriptions, vehicles, or drivers.
 * - Deterministic deduplication prevents recommendation storms.
 */

import prisma from '@/lib/prisma';
import {
  RouteOperationalDecisionSupport,
  buildOperationalDecisionSupport,
} from '@/lib/operations/decision-support-engine';
import {
  getRouteRiskHistory,
  calculateRouteRiskTrend,
  RouteRiskSnapshot,
  FactorDeltas,
} from '@/lib/safety/route-risk-history-store';
import { recordOperationalAuditEvent } from '@/lib/operations/operational-audit-store';

export type RecommendationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type RecommendationStatus = 'PENDING' | 'APPROVED' | 'DISMISSED' | 'COMPLETED';

export type RecommendationType =
  | 'CRITICAL_SAFETY_REVIEW'
  | 'HIGH_RISK_REVIEW'
  | 'RISK_DETERIORATION_REVIEW'
  | 'EMERGENCY_RESPONSE_REVIEW'
  | 'ROUTE_DEVIATION_REVIEW'
  | 'SPEED_ANOMALY_REVIEW'
  | 'DRIVER_COMPLIANCE_REVIEW'
  | 'VEHICLE_COMPLIANCE_REVIEW'
  | 'CAPACITY_REVIEW'
  | 'DEMAND_MONITORING'
  | 'MULTI_FACTOR_REVIEW'
  | 'INCIDENT_REVIEW'
  | 'RISING_RISK_MONITORING';

export interface OperationalRecommendationRecord {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  recommendation: string;
  rationale: string;
  evidence: Record<string, any>;
  status: RecommendationStatus;
  dedupKey: string;
  sourceSnapshotId: string | null;
  sourceDecisionState: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  dismissedAt: string | null;
  dismissedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalRecommendationDraft {
  routeId: string;
  routeCode: string;
  routeName: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  recommendation: string;
  rationale: string;
  evidence: Record<string, any>;
  dedupKey: string;
  sourceSnapshotId?: string | null;
  sourceDecisionState?: string | null;
}

export interface OperationalRecommendationsSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  pending: number;
  approved: number;
  dismissed: number;
  completed: number;
}

export interface RecommendationQueryFilters {
  routeId?: string;
  priority?: RecommendationPriority;
  status?: RecommendationStatus;
  limit?: number;
}

// In-memory fallback store for database resilience
const inMemoryRecommendations: Map<string, OperationalRecommendationRecord> = new Map();

/**
 * Pure deterministic rule engine transforming verified Step 1–6 intelligence
 * into structured operational recommendation drafts.
 */
export function generateOperationalRecommendations(
  decisionSupport: RouteOperationalDecisionSupport,
  factorDeltas: FactorDeltas | null = null
): OperationalRecommendationDraft[] {
  if (!decisionSupport) {
    return [];
  }

  const recommendations: OperationalRecommendationDraft[] = [];
  const {
    routeId,
    routeCode,
    routeName,
    risk,
    alerts,
    incidents,
    demand,
    capacity,
    operationalStatus,
  } = decisionSupport;

  const makeDedupKey = (type: RecommendationType) => `${routeId}_${type}_PENDING`;

  // ──────────────────────────────────────────────────────────────────────────
  // RULE A — CRITICAL SAFETY REVIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (
    risk.score >= 75 ||
    risk.level === 'CRITICAL' ||
    risk.activeEmergencies > 0 ||
    alerts.criticalCount > 0 ||
    incidents.criticalCount > 0
  ) {
    const triggerReasons: string[] = [];
    if (risk.score >= 75 || risk.level === 'CRITICAL') {
      triggerReasons.push(`route risk is CRITICAL (${risk.score}/100)`);
    }
    if (risk.activeEmergencies > 0) {
      triggerReasons.push(`${risk.activeEmergencies} active emergency event(s)`);
    }
    if (alerts.criticalCount > 0) {
      triggerReasons.push(`${alerts.criticalCount} active CRITICAL safety alert(s)`);
    }
    if (incidents.criticalCount > 0) {
      triggerReasons.push(`${incidents.criticalCount} unresolved CRITICAL incident case(s)`);
    }

    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'CRITICAL_SAFETY_REVIEW',
      priority: 'CRITICAL',
      title: 'Critical Safety Review Required',
      recommendation: `Immediate administrative safety review is recommended for ${routeCode}.`,
      rationale: `Corridor is under severe operational risk: ${triggerReasons.join(', ')}.`,
      evidence: {
        riskScore: risk.score,
        riskLevel: risk.level,
        activeEmergencies: risk.activeEmergencies,
        criticalAlerts: alerts.criticalCount,
        criticalIncidents: incidents.criticalCount,
      },
      dedupKey: makeDedupKey('CRITICAL_SAFETY_REVIEW'),
      sourceDecisionState: operationalStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE B — HIGH RISK CORRIDOR REVIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (risk.score >= 50 && risk.score < 75 && risk.level === 'HIGH') {
    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'HIGH_RISK_REVIEW',
      priority: 'HIGH',
      title: 'High Risk Corridor Review',
      recommendation: `Review the current operating conditions of ${routeCode} because route risk is HIGH.`,
      rationale: `Route risk score has reached ${risk.score}/100 in the HIGH severity range.`,
      evidence: {
        riskScore: risk.score,
        riskLevel: risk.level,
        trend: risk.trend,
      },
      dedupKey: makeDedupKey('HIGH_RISK_REVIEW'),
      sourceDecisionState: operationalStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE C — RAPID RISK DETERIORATION
  // ──────────────────────────────────────────────────────────────────────────
  if (risk.scoreDelta !== null && risk.scoreDelta >= 15) {
    const isCriticalDelta = risk.scoreDelta >= 25;
    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'RISK_DETERIORATION_REVIEW',
      priority: isCriticalDelta ? 'CRITICAL' : 'HIGH',
      title: 'Rapid Risk Deterioration Alert',
      recommendation: `Review recent operational changes on ${routeCode} due to rapid risk score deterioration (+${risk.scoreDelta} pts).`,
      rationale: `Risk score escalated significantly from ${risk.previousScore ?? 0} to ${risk.score} (+${risk.scoreDelta} points).`,
      evidence: {
        previousScore: risk.previousScore,
        currentScore: risk.score,
        scoreDelta: risk.scoreDelta,
        riskLevel: risk.level,
      },
      dedupKey: makeDedupKey('RISK_DETERIORATION_REVIEW'),
      sourceDecisionState: operationalStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE D — ACTIVE EMERGENCY RESPONSE REVIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (risk.activeEmergencies > 0) {
    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'EMERGENCY_RESPONSE_REVIEW',
      priority: 'CRITICAL',
      title: 'Active Emergency Response Review',
      recommendation: `Conduct immediate administrative review of active emergency response status on ${routeCode}.`,
      rationale: `${risk.activeEmergencies} active emergency SOS signal(s) recorded on this route corridor.`,
      evidence: {
        activeEmergencies: risk.activeEmergencies,
        riskScore: risk.score,
        routeCode,
      },
      dedupKey: makeDedupKey('EMERGENCY_RESPONSE_REVIEW'),
      sourceDecisionState: operationalStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE E — ROUTE DEVIATION REVIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (risk.activeDeviations > 0) {
    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'ROUTE_DEVIATION_REVIEW',
      priority: 'HIGH',
      title: 'Active Route Deviation Review',
      recommendation: `Review reported corridor deviation(s) on ${routeCode} with the assigned driver.`,
      rationale: `${risk.activeDeviations} active route deviation event(s) recorded along corridor stops.`,
      evidence: {
        activeDeviations: risk.activeDeviations,
        riskScore: risk.score,
        routeCode,
      },
      dedupKey: makeDedupKey('ROUTE_DEVIATION_REVIEW'),
      sourceDecisionState: operationalStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE F — SPEED ANOMALY REVIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (risk.activeSpeedAnomalies > 0) {
    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'SPEED_ANOMALY_REVIEW',
      priority: 'HIGH',
      title: 'Speed Anomaly Review',
      recommendation: `Review recorded vehicle velocity violations on ${routeCode}.`,
      rationale: `${risk.activeSpeedAnomalies} active velocity violation event(s) logged by vehicle telemetry.`,
      evidence: {
        activeSpeedAnomalies: risk.activeSpeedAnomalies,
        riskScore: risk.score,
        routeCode,
      },
      dedupKey: makeDedupKey('SPEED_ANOMALY_REVIEW'),
      sourceDecisionState: operationalStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE G — DRIVER COMPLIANCE REVIEW
  // ──────────────────────────────────────────────────────────────────────────
  const driverVerified = decisionSupport.evidence?.riskEvidence?.driverVerified;
  if (driverVerified === false) {
    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'DRIVER_COMPLIANCE_REVIEW',
      priority: 'HIGH',
      title: 'Driver Compliance Verification Review',
      recommendation: 'Review driver verification status before continuing normal corridor operations.',
      rationale: 'Assigned driver verification credentials or KYC documentation remain unverified.',
      evidence: {
        driverVerified: false,
        routeCode,
      },
      dedupKey: makeDedupKey('DRIVER_COMPLIANCE_REVIEW'),
      sourceDecisionState: operationalStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE H — VEHICLE COMPLIANCE REVIEW
  // ──────────────────────────────────────────────────────────────────────────
  const vehicleApproved = decisionSupport.evidence?.riskEvidence?.vehicleApproved;
  if (vehicleApproved === false) {
    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'VEHICLE_COMPLIANCE_REVIEW',
      priority: 'HIGH',
      title: 'Vehicle Compliance Review',
      recommendation: 'Review vehicle compliance status before continued operational use.',
      rationale: 'Assigned shuttle registration or insurance document approval is pending.',
      evidence: {
        vehicleApproved: false,
        routeCode,
      },
      dedupKey: makeDedupKey('VEHICLE_COMPLIANCE_REVIEW'),
      sourceDecisionState: operationalStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE I — CAPACITY REVIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (
    demand.dataQuality !== 'INSUFFICIENT_DATA' &&
    demand.predictedOccupancy !== null &&
    (demand.predictedOccupancy >= 90 || demand.demandLevel === 'CRITICAL')
  ) {
    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'CAPACITY_REVIEW',
      priority: 'HIGH',
      title: 'High Capacity Pressure Review',
      recommendation: `Review available vehicle capacity for ${routeCode} because predicted occupancy is critically high.`,
      rationale: `Predicted passenger demand is near or above physical shuttle seating capacity (${demand.predictedOccupancy}% occupancy).`,
      evidence: {
        predictedDemand: demand.predictedDemand,
        predictedOccupancy: demand.predictedOccupancy,
        vehicleCapacity: capacity.vehicleCapacity,
        demandLevel: demand.demandLevel,
      },
      dedupKey: makeDedupKey('CAPACITY_REVIEW'),
      sourceDecisionState: operationalStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE J — HIGH DEMAND MONITORING
  // ──────────────────────────────────────────────────────────────────────────
  if (
    demand.dataQuality !== 'INSUFFICIENT_DATA' &&
    demand.predictedOccupancy !== null &&
    ((demand.predictedOccupancy >= 75 && demand.predictedOccupancy < 90) ||
      demand.demandLevel === 'HIGH')
  ) {
    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'DEMAND_MONITORING',
      priority: 'MEDIUM',
      title: 'Elevated Corridor Demand Monitoring',
      recommendation: `Monitor passenger reservation levels on ${routeCode} for potential overflow.`,
      rationale: `Corridor is operating in the elevated demand band (${demand.predictedOccupancy}% occupancy).`,
      evidence: {
        predictedDemand: demand.predictedDemand,
        predictedOccupancy: demand.predictedOccupancy,
        vehicleCapacity: capacity.vehicleCapacity,
        dataQuality: demand.dataQuality,
      },
      dedupKey: makeDedupKey('DEMAND_MONITORING'),
      sourceDecisionState: operationalStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE K — MULTI-FACTOR DETERIORATION
  // ──────────────────────────────────────────────────────────────────────────
  if (factorDeltas) {
    const changedDimensions: Array<{ name: string; delta: number }> = [];
    if (factorDeltas.emergencyPoints > 0)
      changedDimensions.push({ name: 'Emergency Alerts', delta: factorDeltas.emergencyPoints });
    if (factorDeltas.deviationPoints > 0)
      changedDimensions.push({ name: 'Route Deviations', delta: factorDeltas.deviationPoints });
    if (factorDeltas.speedPoints > 0)
      changedDimensions.push({ name: 'Speed Anomalies', delta: factorDeltas.speedPoints });
    if (factorDeltas.stopGpsPoints > 0)
      changedDimensions.push({ name: 'Stationary/GPS Stops', delta: factorDeltas.stopGpsPoints });
    if (factorDeltas.compliancePoints > 0)
      changedDimensions.push({ name: 'Compliance Discrepancies', delta: factorDeltas.compliancePoints });
    if (factorDeltas.complexityPoints > 0)
      changedDimensions.push({ name: 'Complexity Risk', delta: factorDeltas.complexityPoints });

    if (changedDimensions.length >= 3) {
      recommendations.push({
        routeId,
        routeCode,
        routeName,
        type: 'MULTI_FACTOR_REVIEW',
        priority: 'HIGH',
        title: 'Multi-Factor Safety Deterioration Review',
        recommendation: `Conduct a multi-factor corridor audit for ${routeCode} due to deteriorating safety indicators.`,
        rationale: `At least 3 distinct safety factor categories increased simultaneously in the latest evaluation: ${changedDimensions.map((d) => `${d.name} (+${d.delta} pts)`).join(', ')}.`,
        evidence: {
          changedDimensions,
          totalDeterioratingDimensions: changedDimensions.length,
          scoreDelta: risk.scoreDelta,
        },
        dedupKey: makeDedupKey('MULTI_FACTOR_REVIEW'),
        sourceDecisionState: operationalStatus,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE L — UNRESOLVED INCIDENT REVIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (incidents.unresolvedCount > 0) {
    const hasCriticalIncidents = incidents.criticalCount > 0;
    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'INCIDENT_REVIEW',
      priority: hasCriticalIncidents ? 'HIGH' : 'MEDIUM',
      title: 'Unresolved Incident Case Review',
      recommendation: `Review ${incidents.unresolvedCount} open operational incident case(s) on ${routeCode}.`,
      rationale: `Operational incident tickets remain open in case management without final resolution or closure.`,
      evidence: {
        unresolvedCount: incidents.unresolvedCount,
        criticalCount: incidents.criticalCount,
        routeCode,
      },
      dedupKey: makeDedupKey('INCIDENT_REVIEW'),
      sourceDecisionState: operationalStatus,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE M — RISING TREND MONITORING
  // ──────────────────────────────────────────────────────────────────────────
  if (
    risk.trend === 'RISING' &&
    risk.scoreDelta !== null &&
    risk.scoreDelta > 0 &&
    risk.scoreDelta < 15
  ) {
    const isHighPriority = risk.scoreDelta >= 10;
    recommendations.push({
      routeId,
      routeCode,
      routeName,
      type: 'RISING_RISK_MONITORING',
      priority: isHighPriority ? 'HIGH' : 'MEDIUM',
      title: 'Rising Risk Trend Monitoring',
      recommendation: `Monitor safety telemetry trends for ${routeCode} as risk score is trending upward (+${risk.scoreDelta} pts).`,
      rationale: `Consecutive risk score evaluations show an upward trajectory from ${risk.previousScore ?? 0} to ${risk.score}.`,
      evidence: {
        previousScore: risk.previousScore,
        currentScore: risk.score,
        scoreDelta: risk.scoreDelta,
        trend: risk.trend,
      },
      dedupKey: makeDedupKey('RISING_RISK_MONITORING'),
      sourceDecisionState: operationalStatus,
    });
  }

  return recommendations;
}

/**
 * Retrieves recommendations from SQLite/Prisma with in-memory fallback.
 */
export async function getOperationalRecommendations(
  filters: RecommendationQueryFilters = {}
): Promise<{
  recommendations: OperationalRecommendationRecord[];
  summary: OperationalRecommendationsSummary;
}> {
  const where: any = {};
  if (filters.routeId) {
    const trimmed = filters.routeId.trim();
    where.OR = [{ routeId: trimmed }, { routeCode: { equals: trimmed } }];
  }
  if (filters.priority) {
    where.priority = filters.priority;
  }
  if (filters.status) {
    where.status = filters.status;
  }

  let dbRecords: any[] = [];
  try {
    dbRecords = await prisma.operationalRecommendation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit && filters.limit > 0 ? filters.limit : 100,
    });
  } catch (err) {
    console.warn('[RecommendationEngine] Prisma query notice:', err);
  }

  // Merge with in-memory store
  const mergedMap = new Map<string, OperationalRecommendationRecord>();
  for (const r of inMemoryRecommendations.values()) {
    let match = true;
    if (filters.routeId) {
      const tr = filters.routeId.trim().toLowerCase();
      if (r.routeId.toLowerCase() !== tr && r.routeCode.toLowerCase() !== tr) match = false;
    }
    if (filters.priority && r.priority !== filters.priority) match = false;
    if (filters.status && r.status !== filters.status) match = false;
    if (match) mergedMap.set(r.id, r);
  }

  for (const r of dbRecords) {
    let evidence = {};
    try {
      if (r.evidenceJson) evidence = JSON.parse(r.evidenceJson);
    } catch {
      evidence = {};
    }

    mergedMap.set(r.id, {
      id: r.id,
      routeId: r.routeId,
      routeCode: r.routeCode,
      routeName: r.routeName,
      type: r.type as RecommendationType,
      priority: r.priority as RecommendationPriority,
      title: r.title,
      recommendation: r.recommendation,
      rationale: r.rationale,
      evidence,
      status: r.status as RecommendationStatus,
      dedupKey: r.dedupKey || '',
      sourceSnapshotId: r.sourceSnapshotId,
      sourceDecisionState: r.sourceDecisionState,
      approvedAt: r.approvedAt ? (r.approvedAt.toISOString ? r.approvedAt.toISOString() : String(r.approvedAt)) : null,
      approvedBy: r.approvedBy,
      dismissedAt: r.dismissedAt ? (r.dismissedAt.toISOString ? r.dismissedAt.toISOString() : String(r.dismissedAt)) : null,
      dismissedBy: r.dismissedBy,
      completedAt: r.completedAt ? (r.completedAt.toISOString ? r.completedAt.toISOString() : String(r.completedAt)) : null,
      createdAt: r.createdAt.toISOString ? r.createdAt.toISOString() : String(r.createdAt),
      updatedAt: r.updatedAt.toISOString ? r.updatedAt.toISOString() : String(r.updatedAt),
    });
  }

  const allRecords = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Compute summary metrics
  const summary: OperationalRecommendationsSummary = {
    total: allRecords.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    pending: 0,
    approved: 0,
    dismissed: 0,
    completed: 0,
  };

  for (const rec of allRecords) {
    if (rec.priority === 'CRITICAL') summary.critical++;
    else if (rec.priority === 'HIGH') summary.high++;
    else if (rec.priority === 'MEDIUM') summary.medium++;
    else if (rec.priority === 'LOW') summary.low++;

    if (rec.status === 'PENDING') summary.pending++;
    else if (rec.status === 'APPROVED') summary.approved++;
    else if (rec.status === 'DISMISSED') summary.dismissed++;
    else if (rec.status === 'COMPLETED') summary.completed++;
  }

  const finalRecords =
    filters.limit && filters.limit > 0 ? allRecords.slice(0, filters.limit) : allRecords;

  return { recommendations: finalRecords, summary };
}

/**
 * Retrieves a single recommendation by unique ID.
 */
export async function getOperationalRecommendationById(
  id: string
): Promise<OperationalRecommendationRecord | null> {
  const trimmed = id.trim();
  let dbRecord: any = null;

  try {
    dbRecord = await prisma.operationalRecommendation.findUnique({
      where: { id: trimmed },
    });
  } catch (err) {
    console.warn(`[RecommendationEngine] Prisma findUnique notice for ${trimmed}:`, err);
  }

  if (dbRecord) {
    let evidence = {};
    try {
      if (dbRecord.evidenceJson) evidence = JSON.parse(dbRecord.evidenceJson);
    } catch {
      evidence = {};
    }
    return {
      id: dbRecord.id,
      routeId: dbRecord.routeId,
      routeCode: dbRecord.routeCode,
      routeName: dbRecord.routeName,
      type: dbRecord.type as RecommendationType,
      priority: dbRecord.priority as RecommendationPriority,
      title: dbRecord.title,
      recommendation: dbRecord.recommendation,
      rationale: dbRecord.rationale,
      evidence,
      status: dbRecord.status as RecommendationStatus,
      dedupKey: dbRecord.dedupKey || '',
      sourceSnapshotId: dbRecord.sourceSnapshotId,
      sourceDecisionState: dbRecord.sourceDecisionState,
      approvedAt: dbRecord.approvedAt ? (dbRecord.approvedAt.toISOString ? dbRecord.approvedAt.toISOString() : String(dbRecord.approvedAt)) : null,
      approvedBy: dbRecord.approvedBy,
      dismissedAt: dbRecord.dismissedAt ? (dbRecord.dismissedAt.toISOString ? dbRecord.dismissedAt.toISOString() : String(dbRecord.dismissedAt)) : null,
      dismissedBy: dbRecord.dismissedBy,
      completedAt: dbRecord.completedAt ? (dbRecord.completedAt.toISOString ? dbRecord.completedAt.toISOString() : String(dbRecord.completedAt)) : null,
      createdAt: dbRecord.createdAt.toISOString ? dbRecord.createdAt.toISOString() : String(dbRecord.createdAt),
      updatedAt: dbRecord.updatedAt.toISOString ? dbRecord.updatedAt.toISOString() : String(dbRecord.updatedAt),
    };
  }

  return inMemoryRecommendations.get(trimmed) || null;
}

/**
 * Evaluates verified Step 1–6 intelligence for a corridor, generates deterministic
 * recommendations, deduplicates against pending records, and persists new ones.
 */
export async function evaluateAndSaveRouteRecommendations(
  routeIdentifier: string,
  actorAdmin?: { id: string; role?: string; name?: string; email?: string }
): Promise<OperationalRecommendationRecord[]> {
  const decisionResult = await buildOperationalDecisionSupport(routeIdentifier);
  if (!decisionResult) {
    throw new Error(`Route not found with identifier '${routeIdentifier}'`);
  }

  const decisionSupport = decisionResult as RouteOperationalDecisionSupport;
  const routeId = decisionSupport.routeId;
  const routeCode = decisionSupport.routeCode;

  // Retrieve historical snapshots for factor deltas
  const snapshots = await getRouteRiskHistory(routeCode || routeId, 10);
  const trendResult = calculateRouteRiskTrend(snapshots);
  const factorDeltas = trendResult.factorDeltas;

  // Generate deterministic draft recommendations
  const drafts = generateOperationalRecommendations(decisionSupport, factorDeltas);

  // Retrieve existing pending recommendations to prevent duplicate pending items
  const { recommendations: existingRecs } = await getOperationalRecommendations({
    routeId,
    status: 'PENDING',
  });

  const createdRecords: OperationalRecommendationRecord[] = [];
  const now = new Date();

  for (const draft of drafts) {
    // Check if an existing pending recommendation with the exact dedupKey or routeCode+type exists
    let duplicatePending = existingRecs.find(
      (e) =>
        (e.dedupKey === draft.dedupKey ||
          (e.routeCode === draft.routeCode && e.type === draft.type)) &&
        e.status === 'PENDING'
    );

    if (!duplicatePending) {
      try {
        const dbExisting = await prisma.operationalRecommendation.findFirst({
          where: {
            routeCode: draft.routeCode,
            type: draft.type,
            status: 'PENDING',
          },
        });
        if (dbExisting) {
          duplicatePending = dbExisting as any;
        }
      } catch (err) {
        // Fallback
      }
    }

    if (duplicatePending) {
      createdRecords.push(duplicatePending as any);
      continue;
    }

    const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRecord: OperationalRecommendationRecord = {
      id,
      routeId: draft.routeId,
      routeCode: draft.routeCode,
      routeName: draft.routeName,
      type: draft.type,
      priority: draft.priority,
      title: draft.title,
      recommendation: draft.recommendation,
      rationale: draft.rationale,
      evidence: draft.evidence,
      status: 'PENDING',
      dedupKey: draft.dedupKey,
      sourceSnapshotId: snapshots.length > 0 ? snapshots[snapshots.length - 1].id : null,
      sourceDecisionState: draft.sourceDecisionState || null,
      approvedAt: null,
      approvedBy: null,
      dismissedAt: null,
      dismissedBy: null,
      completedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Persist to Prisma SQLite
    try {
      await prisma.operationalRecommendation.create({
        data: {
          id: newRecord.id,
          routeId: newRecord.routeId,
          routeCode: newRecord.routeCode,
          routeName: newRecord.routeName,
          type: newRecord.type,
          priority: newRecord.priority,
          title: newRecord.title,
          recommendation: newRecord.recommendation,
          rationale: newRecord.rationale,
          evidenceJson: JSON.stringify(newRecord.evidence),
          status: 'PENDING',
          dedupKey: newRecord.dedupKey,
          sourceSnapshotId: newRecord.sourceSnapshotId,
          sourceDecisionState: newRecord.sourceDecisionState,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (dbErr) {
      console.warn('[RecommendationEngine] Prisma create notice:', dbErr);
    }

    // Persist to in-memory store
    inMemoryRecommendations.set(newRecord.id, newRecord);
    createdRecords.push(newRecord);
  }

  // Record audit event if evaluation was requested by an administrator
  if (actorAdmin) {
    try {
      await recordOperationalAuditEvent({
        eventType: 'RECOMMENDATION_EVALUATED',
        actor: {
          id: actorAdmin.id,
          role: actorAdmin.role || 'ADMIN',
          name: actorAdmin.name,
          email: actorAdmin.email,
        },
        resourceType: 'RECOMMENDATION',
        resourceId: routeId,
        routeId,
        routeCode,
        routeName: decisionSupport.routeName,
        action: 'EVALUATE_ROUTE_RECOMMENDATIONS',
        description: `Evaluated operational recommendations for route ${routeCode}: ${createdRecords.length} recommendation(s) generated/active`,
        resultingState: {
          evaluatedCount: drafts.length,
          createdOrActiveCount: createdRecords.length,
        },
        evidence: {
          riskScore: decisionSupport.risk.score,
          riskLevel: decisionSupport.risk.level,
          operationalStatus: decisionSupport.operationalStatus,
        },
        sourceModule: 'RECOMMENDATIONS',
        correlationId: routeId,
      });
    } catch (auditErr) {
      console.warn('[RecommendationEngine] Failed to record audit event for evaluation:', auditErr);
    }
  }

  return createdRecords;
}

/**
 * Human-in-the-Loop: Approves a pending recommendation.
 * Does NOT execute operational changes automatically.
 */
export async function approveOperationalRecommendation(
  id: string,
  adminUser: { id: string; name?: string; email?: string }
): Promise<OperationalRecommendationRecord> {
  const existing = await getOperationalRecommendationById(id);
  if (!existing) {
    throw new Error(`Operational recommendation not found with ID '${id}'`);
  }

  if (existing.status !== 'PENDING') {
    throw new Error(
      `Cannot approve recommendation in status '${existing.status}'. Only PENDING recommendations can be approved.`
    );
  }

  const now = new Date();
  const approvedBy = adminUser.email
    ? `${adminUser.name || 'Admin'} (${adminUser.email})`
    : adminUser.name || 'Operations Admin';

  const previousState = {
    status: existing.status,
    approvedAt: existing.approvedAt,
    approvedBy: existing.approvedBy,
  };

  existing.status = 'APPROVED';
  existing.approvedAt = now.toISOString();
  existing.approvedBy = approvedBy;
  existing.updatedAt = now.toISOString();

  try {
    await prisma.operationalRecommendation.update({
      where: { id: existing.id },
      data: {
        status: 'APPROVED',
        approvedAt: now,
        approvedBy,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[RecommendationEngine] Prisma update notice on approve:', err);
  }

  inMemoryRecommendations.set(existing.id, existing);

  // Record audit event
  try {
    await recordOperationalAuditEvent({
      eventType: 'RECOMMENDATION_APPROVED',
      actor: {
        id: adminUser.id,
        role: 'ADMIN',
        name: adminUser.name,
        email: adminUser.email,
      },
      resourceType: 'RECOMMENDATION',
      resourceId: existing.id,
      routeId: existing.routeId,
      routeCode: existing.routeCode,
      routeName: existing.routeName,
      action: 'APPROVE_RECOMMENDATION',
      description: `Approved operational recommendation '${existing.title}' for route ${existing.routeCode}`,
      previousState,
      resultingState: {
        status: 'APPROVED',
        approvedAt: existing.approvedAt,
        approvedBy: existing.approvedBy,
      },
      evidence: existing.evidence,
      sourceModule: 'RECOMMENDATIONS',
      correlationId: existing.dedupKey || existing.id,
    });
  } catch (auditErr) {
    console.warn('[RecommendationEngine] Failed to record audit event for approval:', auditErr);
  }

  return existing;
}

/**
 * Human-in-the-Loop: Dismisses a pending recommendation.
 */
export async function dismissOperationalRecommendation(
  id: string,
  adminUser: { id: string; name?: string; email?: string }
): Promise<OperationalRecommendationRecord> {
  const existing = await getOperationalRecommendationById(id);
  if (!existing) {
    throw new Error(`Operational recommendation not found with ID '${id}'`);
  }

  if (existing.status !== 'PENDING') {
    throw new Error(
      `Cannot dismiss recommendation in status '${existing.status}'. Only PENDING recommendations can be dismissed.`
    );
  }

  const now = new Date();
  const dismissedBy = adminUser.email
    ? `${adminUser.name || 'Admin'} (${adminUser.email})`
    : adminUser.name || 'Operations Admin';

  const previousState = {
    status: existing.status,
    dismissedAt: existing.dismissedAt,
    dismissedBy: existing.dismissedBy,
  };

  existing.status = 'DISMISSED';
  existing.dismissedAt = now.toISOString();
  existing.dismissedBy = dismissedBy;
  existing.updatedAt = now.toISOString();

  try {
    await prisma.operationalRecommendation.update({
      where: { id: existing.id },
      data: {
        status: 'DISMISSED',
        dismissedAt: now,
        dismissedBy,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[RecommendationEngine] Prisma update notice on dismiss:', err);
  }

  inMemoryRecommendations.set(existing.id, existing);

  // Record audit event
  try {
    await recordOperationalAuditEvent({
      eventType: 'RECOMMENDATION_DISMISSED',
      actor: {
        id: adminUser.id,
        role: 'ADMIN',
        name: adminUser.name,
        email: adminUser.email,
      },
      resourceType: 'RECOMMENDATION',
      resourceId: existing.id,
      routeId: existing.routeId,
      routeCode: existing.routeCode,
      routeName: existing.routeName,
      action: 'DISMISS_RECOMMENDATION',
      description: `Dismissed operational recommendation '${existing.title}' for route ${existing.routeCode}`,
      previousState,
      resultingState: {
        status: 'DISMISSED',
        dismissedAt: existing.dismissedAt,
        dismissedBy: existing.dismissedBy,
      },
      evidence: existing.evidence,
      sourceModule: 'RECOMMENDATIONS',
      correlationId: existing.dedupKey || existing.id,
    });
  } catch (auditErr) {
    console.warn('[RecommendationEngine] Failed to record audit event for dismissal:', auditErr);
  }

  return existing;
}

/**
 * Human-in-the-Loop: Marks an approved recommendation as COMPLETED.
 * Requires recommendation to be in APPROVED status.
 */
export async function completeOperationalRecommendation(
  id: string,
  adminUser: { id: string; name?: string; email?: string }
): Promise<OperationalRecommendationRecord> {
  const existing = await getOperationalRecommendationById(id);
  if (!existing) {
    throw new Error(`Operational recommendation not found with ID '${id}'`);
  }

  if (existing.status !== 'APPROVED') {
    throw new Error(
      `Cannot complete recommendation in status '${existing.status}'. Only APPROVED recommendations can be completed.`
    );
  }

  const now = new Date();
  const previousState = {
    status: existing.status,
    completedAt: existing.completedAt,
  };

  existing.status = 'COMPLETED';
  existing.completedAt = now.toISOString();
  existing.updatedAt = now.toISOString();

  try {
    await prisma.operationalRecommendation.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[RecommendationEngine] Prisma update notice on complete:', err);
  }

  inMemoryRecommendations.set(existing.id, existing);

  // Record audit event
  try {
    await recordOperationalAuditEvent({
      eventType: 'RECOMMENDATION_COMPLETED',
      actor: {
        id: adminUser.id,
        role: 'ADMIN',
        name: adminUser.name,
        email: adminUser.email,
      },
      resourceType: 'RECOMMENDATION',
      resourceId: existing.id,
      routeId: existing.routeId,
      routeCode: existing.routeCode,
      routeName: existing.routeName,
      action: 'COMPLETE_RECOMMENDATION',
      description: `Marked operational recommendation '${existing.title}' as completed for route ${existing.routeCode}`,
      previousState,
      resultingState: {
        status: 'COMPLETED',
        completedAt: existing.completedAt,
      },
      evidence: existing.evidence,
      sourceModule: 'RECOMMENDATIONS',
      correlationId: existing.dedupKey || existing.id,
    });
  } catch (auditErr) {
    console.warn('[RecommendationEngine] Failed to record audit event for completion:', auditErr);
  }

  return existing;
}
