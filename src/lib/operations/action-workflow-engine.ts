/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — CONTROLLED OPERATIONAL ACTION WORKFLOW & HUMAN-IN-THE-LOOP EXECUTION ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 17: Controlled workflow turning verified operational recommendations
 * into governed, audited, human-in-the-loop action plans.
 *
 * Core Governance Invariants:
 * - Purely ADVISORY & HUMAN-IN-THE-LOOP: NEVER automatically dispatches vehicles,
 *   changes routes, modifies schedules, reassigns drivers, or mutates bookings.
 * - Strict Separation:
 *     1. Intelligence -> 2. Recommendation -> 3. Proposed Action ->
 *     4. Approved Action -> 5. Execution Request -> 6. Execution Result -> 7. Audit
 * - Stale Intelligence Protection: Compares original intelligence snapshot with
 *   authoritative live data before approval.
 * - Append-Only Audit Logging: Every state transition emits an immutable audit event.
 * - Anti-Forgery: Server derives actor, timestamps, risk scores, priority, and evidence.
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma';
import {
  buildOperationalDecisionSupport,
  OperationalStatus,
  RouteOperationalDecisionSupport,
} from '@/lib/operations/decision-support-engine';
import {
  getOperationalRecommendationById,
  OperationalRecommendationRecord,
  RecommendationPriority,
  RecommendationStatus,
} from '@/lib/operations/recommendation-engine';
import {
  recordOperationalAuditEvent,
  getOperationalAuditEvents,
  OperationalAuditEventRecord,
} from '@/lib/operations/operational-audit-store';
import { evaluateFleetGovernance } from '@/lib/operations/governance-engine';

export type ActionType =
  | 'REVIEW_ROUTE'
  | 'REVIEW_CAPACITY'
  | 'REVIEW_DRIVER'
  | 'REVIEW_SAFETY_ALERT'
  | 'REVIEW_INCIDENT'
  | 'REVIEW_SCHEDULE'
  | 'REVIEW_DEMAND'
  | 'CONDUCT_SUPERVISOR_REVIEW'
  | 'PREPARE_CONTINGENCY_PLAN'
  | 'ESCALATE_TO_OPERATIONS';

export type ActionPlanStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTION_REQUESTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REJECTED';

export type ActionPlanPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const VALID_ACTION_TYPES: ActionType[] = [
  'REVIEW_ROUTE',
  'REVIEW_CAPACITY',
  'REVIEW_DRIVER',
  'REVIEW_SAFETY_ALERT',
  'REVIEW_INCIDENT',
  'REVIEW_SCHEDULE',
  'REVIEW_DEMAND',
  'CONDUCT_SUPERVISOR_REVIEW',
  'PREPARE_CONTINGENCY_PLAN',
  'ESCALATE_TO_OPERATIONS',
];

export const VALID_ACTION_STATUSES: ActionPlanStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTION_REQUESTED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REJECTED',
];

export const MANDATORY_ACTION_NOTICES = [
  'Operational actions require explicit administrator authorization. This system never automatically changes routes, schedules, vehicles, drivers, subscriptions, bookings, seat allocations, or dispatch assignments.',
  'Recommendations and action plans are advisory until explicitly approved by an authorized administrator.',
  'Execution request recorded. No operational resource was automatically modified.',
];

/**
 * Valid lifecycle transitions mapping.
 */
export const ALLOWED_TRANSITIONS: Record<ActionPlanStatus, ActionPlanStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['EXECUTION_REQUESTED', 'CANCELLED'],
  EXECUTION_REQUESTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  REJECTED: [],
};

export interface OperationalActionPlanRecord {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  recommendationId: string;
  actionType: ActionType;
  title: string;
  description: string;
  priority: ActionPlanPriority;
  status: ActionPlanStatus;
  requestedByUserId: string;
  requestedByUserName?: string | null;
  approvedByUserId?: string | null;
  approvedByUserName?: string | null;
  executedByUserId?: string | null;
  executedByUserName?: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  executionStartedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  rejectedAt?: string | null;
  executionResult?: string | null;
  failureReason?: string | null;
  evidenceJson: string;
  evidence: Record<string, any>;
  approvalNote?: string | null;
  executionNote?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  correlationId?: string | null;
  sourceModule: string;
  createdFromRiskScore?: number | null;
  createdFromOperationalStatus?: string | null;
  dedupKey?: string | null;
  staleIntelligenceDetected?: boolean;
  staleReasons?: string[];
}

export interface ActionPlanEvidenceSnapshot {
  capturedAt: string;
  recommendation: {
    id: string;
    type: string;
    priority: string;
    title: string;
    rationale: string;
    status: string;
    dedupKey?: string;
  };
  corridor: {
    routeId: string;
    routeCode: string;
    routeName: string;
  };
  riskSnapshot: {
    score: number;
    level: string;
    factorsCount: number;
  };
  decisionSupport: {
    operationalStatus: OperationalStatus;
    summary: string;
    primaryDriver: string;
  };
  alerts: {
    active: number;
    critical: number;
  };
  incidents: {
    active: number;
    critical: number;
  };
  demand: {
    predictedDemand: number | null;
    vehicleCapacity: number | null;
    projectedOccupancy: number | null;
  };
  governance: {
    complianceStatus: string;
    complianceScore: number;
  };
}

export interface ActionWorkflowKPIs {
  total: number;
  pendingApproval: number;
  approved: number;
  executionRequested: number;
  inProgress: number;
  completed: number;
  failed: number;
  rejected: number;
  cancelled: number;
}

export interface ActionPlanQueryFilters {
  routeId?: string;
  status?: ActionPlanStatus;
  priority?: ActionPlanPriority;
  actionType?: ActionType;
  limit?: number;
}

export interface StaleIntelligenceReport {
  isStale: boolean;
  isFatal: boolean; // e.g. recommendation is dismissed or completed
  reasons: string[];
  snapshot: Partial<ActionPlanEvidenceSnapshot>;
  current: {
    recommendationStatus?: string;
    riskScore?: number;
    riskLevel?: string;
    operationalStatus?: OperationalStatus;
    criticalAlerts?: number;
  };
}

// In-memory fallback cache for zero-downtime and testing resilience
const inMemoryActionPlans: Map<string, OperationalActionPlanRecord> = new Map();

/**
 * Validates state transition according to the strict state machine.
 */
export function validateStateTransition(
  currentStatus: ActionPlanStatus,
  targetStatus: ActionPlanStatus
): void {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `Invalid lifecycle transition: Cannot transition action plan from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowed.join(', ')}]`
    );
  }
}

/**
 * Maps recommendation type to appropriate default ActionType.
 */
export function mapRecommendationToActionType(recType: string): ActionType {
  switch (recType) {
    case 'CAPACITY_REVIEW':
    case 'VEHICLE_COMPLIANCE_REVIEW':
      return 'REVIEW_CAPACITY';
    case 'DRIVER_COMPLIANCE_REVIEW':
      return 'REVIEW_DRIVER';
    case 'SPEED_ANOMALY_REVIEW':
    case 'ACTIVE_SPEED_ANOMALY':
      return 'REVIEW_SAFETY_ALERT';
    case 'INCIDENT_REVIEW':
      return 'REVIEW_INCIDENT';
    case 'DEMAND_MONITORING':
      return 'REVIEW_DEMAND';
    case 'EMERGENCY_RESPONSE_REVIEW':
      return 'PREPARE_CONTINGENCY_PLAN';
    case 'CRITICAL_SAFETY_REVIEW':
    case 'HIGH_RISK_REVIEW':
      return 'CONDUCT_SUPERVISOR_REVIEW';
    case 'RISK_DETERIORATION_REVIEW':
      return 'ESCALATE_TO_OPERATIONS';
    case 'ROUTE_DEVIATION_REVIEW':
    default:
      return 'REVIEW_ROUTE';
  }
}

/**
 * Captures a server-authoritative evidence snapshot from verified Step 1–15 engines.
 */
export async function captureEvidenceSnapshot(
  routeId: string,
  recommendation: OperationalRecommendationRecord
): Promise<ActionPlanEvidenceSnapshot> {
  const decisionResult = await buildOperationalDecisionSupport(routeId);
  const decision = decisionResult as RouteOperationalDecisionSupport;

  let governance = { complianceStatus: 'COMPLIANT', complianceScore: 100 };
  try {
    const govSummary = await evaluateFleetGovernance();
    const corrGov = govSummary.corridors?.find(
      (c: any) => c.routeId === routeId || c.routeCode === recommendation.routeCode
    );
    if (corrGov) {
      governance = {
        complianceStatus: String(corrGov.governanceStatus || 'COMPLIANT'),
        complianceScore: corrGov.governanceScore ?? 100,
      };
    }
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Governance snapshot fallback:', err);
  }

  return {
    capturedAt: new Date().toISOString(),
    recommendation: {
      id: recommendation.id,
      type: recommendation.type,
      priority: recommendation.priority,
      title: recommendation.title,
      rationale: recommendation.rationale,
      status: recommendation.status,
      dedupKey: recommendation.dedupKey,
    },
    corridor: {
      routeId: recommendation.routeId,
      routeCode: recommendation.routeCode,
      routeName: recommendation.routeName,
    },
    riskSnapshot: {
      score: decision?.risk?.score ?? 0,
      level: decision?.risk?.level ?? 'LOW',
      factorsCount: (decision?.risk?.activeEmergencies ?? 0) + (decision?.risk?.activeDeviations ?? 0) + (decision?.risk?.activeSpeedAnomalies ?? 0),
    },
    decisionSupport: {
      operationalStatus: decision?.operationalStatus ?? 'NORMAL',
      summary: decision?.briefing ?? 'Operational nominal',
      primaryDriver: decision?.operationalStatus ?? 'CORRIDOR_BASELINE',
    },
    alerts: {
      active: decision?.alerts?.activeCount ?? 0,
      critical: decision?.alerts?.criticalCount ?? 0,
    },
    incidents: {
      active: decision?.incidents?.activeCount ?? 0,
      critical: decision?.incidents?.criticalCount ?? 0,
    },
    demand: {
      predictedDemand: decision?.demand?.predictedDemand ?? null,
      vehicleCapacity: decision?.capacity?.vehicleCapacity ?? null,
      projectedOccupancy: decision?.demand?.predictedOccupancy ?? null,
    },
    governance,
  };
}

/**
 * Checks for stale source intelligence by comparing original snapshot to live state.
 */
export async function checkStaleIntelligence(
  actionPlan: OperationalActionPlanRecord
): Promise<StaleIntelligenceReport> {
  const reasons: string[] = [];
  let isFatal = false;

  // 1. Current recommendation check
  const currentRec = await getOperationalRecommendationById(actionPlan.recommendationId);
  const currentRecStatus = currentRec?.status;

  if (!currentRec) {
    reasons.push('Source recommendation no longer exists in the system.');
    isFatal = true;
  } else if (currentRec.status === 'DISMISSED' || currentRec.status === 'COMPLETED') {
    reasons.push(
      `Source recommendation is no longer actionable (current status: ${currentRec.status}).`
    );
    isFatal = true;
  } else if (currentRec.priority !== actionPlan.priority) {
    reasons.push(
      `Recommendation priority changed from ${actionPlan.priority} to ${currentRec.priority}.`
    );
  }

  // 2. Current corridor intelligence check
  let currentDecision: RouteOperationalDecisionSupport | null = null;
  try {
    const decRes = await buildOperationalDecisionSupport(actionPlan.routeId);
    currentDecision = decRes as RouteOperationalDecisionSupport;
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Stale check corridor lookup notice:', err);
  }

  const snapshot = actionPlan.evidence as ActionPlanEvidenceSnapshot;

  if (currentDecision && snapshot) {
    if (snapshot.riskSnapshot?.level && currentDecision.risk?.level !== snapshot.riskSnapshot.level) {
      reasons.push(
        `Corridor risk level changed from ${snapshot.riskSnapshot.level} to ${currentDecision.risk.level}.`
      );
    }
    if (
      snapshot.decisionSupport?.operationalStatus &&
      currentDecision.operationalStatus !== snapshot.decisionSupport.operationalStatus
    ) {
      reasons.push(
        `Corridor operational status changed from ${snapshot.decisionSupport.operationalStatus} to ${currentDecision.operationalStatus}.`
      );
    }
    const snapCritAlerts = snapshot.alerts?.critical ?? 0;
    const curCritAlerts = currentDecision.alerts?.criticalCount ?? 0;
    if (snapCritAlerts !== curCritAlerts) {
      reasons.push(
        `Critical alerts count changed from ${snapCritAlerts} to ${curCritAlerts}.`
      );
    }
  }

  return {
    isStale: reasons.length > 0,
    isFatal,
    reasons,
    snapshot: snapshot || {},
    current: {
      recommendationStatus: currentRecStatus,
      riskScore: currentDecision?.risk?.score,
      riskLevel: currentDecision?.risk?.level,
      operationalStatus: currentDecision?.operationalStatus,
      criticalAlerts: currentDecision?.alerts?.criticalCount,
    },
  };
}

/**
 * Creates an authoritative Operational Action Plan from a verified recommendation.
 */
export async function createOperationalActionPlan(params: {
  recommendationId: string;
  actionType?: ActionType;
  title?: string;
  description?: string;
  adminUser: { id: string; name?: string | null; email?: string | null; role?: string };
  ipAddress?: string;
  userAgent?: string;
}): Promise<OperationalActionPlanRecord> {
  const { recommendationId, adminUser, ipAddress, userAgent } = params;

  if (!recommendationId || typeof recommendationId !== 'string' || recommendationId.trim() === '') {
    throw new Error('Recommendation ID is required to create an action plan.');
  }

  // 1. Look up source recommendation
  const recommendation = await getOperationalRecommendationById(recommendationId.trim());
  if (!recommendation) {
    const err: any = new Error(`Source recommendation not found with ID '${recommendationId}'.`);
    err.statusCode = 404;
    throw err;
  }

  if (recommendation.status === 'DISMISSED' || recommendation.status === 'COMPLETED') {
    const err: any = new Error(
      `Cannot create action plan: Source recommendation is already ${recommendation.status}.`
    );
    err.statusCode = 400;
    throw err;
  }

  // 2. Resolve Action Type & Validation
  const resolvedActionType = params.actionType
    ? params.actionType
    : mapRecommendationToActionType(recommendation.type);

  if (!VALID_ACTION_TYPES.includes(resolvedActionType)) {
    const err: any = new Error(
      `Invalid action type '${resolvedActionType}'. Must be one of: [${VALID_ACTION_TYPES.join(', ')}]`
    );
    err.statusCode = 400;
    throw err;
  }

  // 3. Deduplication Check
  // Check for active workflows for this recommendation & actionType
  const activeStatuses: ActionPlanStatus[] = [
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'EXECUTION_REQUESTED',
    'IN_PROGRESS',
  ];

  const dedupKey = `${recommendation.routeId}:${recommendation.id}:${resolvedActionType}`;

  // Check DB & Memory
  let existingActive: any = null;
  try {
    existingActive = await prisma.operationalActionPlan.findFirst({
      where: {
        recommendationId: recommendation.id,
        actionType: resolvedActionType,
        status: { in: activeStatuses },
      },
    });
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Prisma dedup lookup notice:', err);
  }

  if (!existingActive) {
    for (const plan of inMemoryActionPlans.values()) {
      if (
        plan.recommendationId === recommendation.id &&
        plan.actionType === resolvedActionType &&
        activeStatuses.includes(plan.status)
      ) {
        existingActive = plan;
        break;
      }
    }
  }

  if (existingActive) {
    const err: any = new Error(
      `Duplicate action plan prevented: An active action plan already exists for recommendation '${recommendation.id}' with action type '${resolvedActionType}' (Status: ${existingActive.status}).`
    );
    err.statusCode = 409;
    throw err;
  }

  // 4. Capture Server-Authoritative Evidence Snapshot
  const evidence = await captureEvidenceSnapshot(recommendation.routeId, recommendation);
  const evidenceJson = JSON.stringify(evidence);

  const correlationId = `act-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date();
  const id = `act_plan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const title =
    params.title?.trim() ||
    `Action Plan: ${resolvedActionType.replace(/_/g, ' ')} (${recommendation.routeCode})`;
  const description =
    params.description?.trim() ||
    `Governed administrative action generated from recommendation '${recommendation.title}'. ${recommendation.rationale}`;

  const planRecord: OperationalActionPlanRecord = {
    id,
    routeId: recommendation.routeId,
    routeCode: recommendation.routeCode,
    routeName: recommendation.routeName,
    recommendationId: recommendation.id,
    actionType: resolvedActionType,
    title,
    description,
    priority: recommendation.priority as ActionPlanPriority,
    status: 'PENDING_APPROVAL',
    requestedByUserId: adminUser.id,
    requestedByUserName: adminUser.name || adminUser.email || 'Admin',
    approvedByUserId: null,
    approvedByUserName: null,
    executedByUserId: null,
    executedByUserName: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    approvedAt: null,
    executionStartedAt: null,
    completedAt: null,
    cancelledAt: null,
    rejectedAt: null,
    executionResult: null,
    failureReason: null,
    evidenceJson,
    evidence,
    approvalNote: null,
    executionNote: null,
    rejectionReason: null,
    cancellationReason: null,
    correlationId,
    sourceModule: 'ACTION_WORKFLOW',
    createdFromRiskScore: evidence.riskSnapshot.score,
    createdFromOperationalStatus: evidence.decisionSupport.operationalStatus,
    dedupKey,
  };

  // 5. Persist to DB with fallback to memory
  try {
    await prisma.operationalActionPlan.create({
      data: {
        id: planRecord.id,
        routeId: planRecord.routeId,
        routeCode: planRecord.routeCode,
        routeName: planRecord.routeName,
        recommendationId: planRecord.recommendationId,
        actionType: planRecord.actionType,
        title: planRecord.title,
        description: planRecord.description,
        priority: planRecord.priority,
        status: planRecord.status,
        requestedByUserId: planRecord.requestedByUserId,
        requestedByUserName: planRecord.requestedByUserName,
        createdAt: now,
        updatedAt: now,
        evidenceJson: planRecord.evidenceJson,
        correlationId: planRecord.correlationId,
        sourceModule: planRecord.sourceModule,
        createdFromRiskScore: planRecord.createdFromRiskScore,
        createdFromOperationalStatus: planRecord.createdFromOperationalStatus,
        dedupKey: planRecord.dedupKey,
      },
    });
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Prisma create notice, using memory store:', err);
  }

  inMemoryActionPlans.set(planRecord.id, planRecord);

  // 6. Record Audit Event
  try {
    await recordOperationalAuditEvent({
      eventType: 'ACTION_PLAN_CREATED',
      actor: {
        id: adminUser.id,
        role: adminUser.role || 'ADMIN',
        email: adminUser.email,
        name: adminUser.name,
      },
      resourceType: 'ACTION_PLAN',
      resourceId: planRecord.id,
      routeId: planRecord.routeId,
      routeCode: planRecord.routeCode,
      routeName: planRecord.routeName,
      action: 'ACTION_PLAN_CREATED',
      description: `Operational action plan '${planRecord.title}' created in PENDING_APPROVAL state.`,
      resultingState: {
        id: planRecord.id,
        status: planRecord.status,
        actionType: planRecord.actionType,
        priority: planRecord.priority,
        recommendationId: planRecord.recommendationId,
      },
      evidence,
      sourceModule: 'ACTION_WORKFLOW',
      correlationId: planRecord.correlationId,
      ipAddress,
      userAgent,
    });
  } catch (auditErr) {
    console.warn('[ActionWorkflowEngine] Audit recording notice:', auditErr);
  }

  return planRecord;
}

/**
 * Retrieves a single action plan by ID with parsed evidence.
 */
export async function getOperationalActionPlanById(
  id: string
): Promise<OperationalActionPlanRecord | null> {
  const trimmed = id.trim();
  let dbRecord: any = null;

  try {
    dbRecord = await prisma.operationalActionPlan.findUnique({
      where: { id: trimmed },
    });
  } catch (err) {
    console.warn(`[ActionWorkflowEngine] Prisma findUnique notice for ${trimmed}:`, err);
  }

  if (dbRecord) {
    let evidence: Record<string, any> = {};
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
      recommendationId: dbRecord.recommendationId,
      actionType: dbRecord.actionType as ActionType,
      title: dbRecord.title,
      description: dbRecord.description,
      priority: dbRecord.priority as ActionPlanPriority,
      status: dbRecord.status as ActionPlanStatus,
      requestedByUserId: dbRecord.requestedByUserId,
      requestedByUserName: dbRecord.requestedByUserName,
      approvedByUserId: dbRecord.approvedByUserId,
      approvedByUserName: dbRecord.approvedByUserName,
      executedByUserId: dbRecord.executedByUserId,
      executedByUserName: dbRecord.executedByUserName,
      createdAt: dbRecord.createdAt?.toISOString ? dbRecord.createdAt.toISOString() : String(dbRecord.createdAt),
      updatedAt: dbRecord.updatedAt?.toISOString ? dbRecord.updatedAt.toISOString() : String(dbRecord.updatedAt),
      approvedAt: dbRecord.approvedAt ? (dbRecord.approvedAt.toISOString ? dbRecord.approvedAt.toISOString() : String(dbRecord.approvedAt)) : null,
      executionStartedAt: dbRecord.executionStartedAt ? (dbRecord.executionStartedAt.toISOString ? dbRecord.executionStartedAt.toISOString() : String(dbRecord.executionStartedAt)) : null,
      completedAt: dbRecord.completedAt ? (dbRecord.completedAt.toISOString ? dbRecord.completedAt.toISOString() : String(dbRecord.completedAt)) : null,
      cancelledAt: dbRecord.cancelledAt ? (dbRecord.cancelledAt.toISOString ? dbRecord.cancelledAt.toISOString() : String(dbRecord.cancelledAt)) : null,
      rejectedAt: dbRecord.rejectedAt ? (dbRecord.rejectedAt.toISOString ? dbRecord.rejectedAt.toISOString() : String(dbRecord.rejectedAt)) : null,
      executionResult: dbRecord.executionResult,
      failureReason: dbRecord.failureReason,
      evidenceJson: dbRecord.evidenceJson,
      evidence,
      approvalNote: dbRecord.approvalNote,
      executionNote: dbRecord.executionNote,
      rejectionReason: dbRecord.rejectionReason,
      cancellationReason: dbRecord.cancellationReason,
      correlationId: dbRecord.correlationId,
      sourceModule: dbRecord.sourceModule,
      createdFromRiskScore: dbRecord.createdFromRiskScore,
      createdFromOperationalStatus: dbRecord.createdFromOperationalStatus,
      dedupKey: dbRecord.dedupKey,
    };
  }

  return inMemoryActionPlans.get(trimmed) || null;
}

/**
 * Retrieves action plans with filters, deterministic ordering, and KPI summary.
 */
export async function getOperationalActionPlans(filters: ActionPlanQueryFilters = {}): Promise<{
  actionPlans: OperationalActionPlanRecord[];
  kpis: ActionWorkflowKPIs;
  notices: string[];
}> {
  const where: any = {};
  if (filters.routeId) {
    const trimmed = filters.routeId.trim();
    where.OR = [{ routeId: trimmed }, { routeCode: trimmed }];
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.priority) {
    where.priority = filters.priority;
  }
  if (filters.actionType) {
    where.actionType = filters.actionType;
  }

  let dbRecords: any[] = [];
  try {
    dbRecords = await prisma.operationalActionPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit && filters.limit > 0 ? filters.limit : 100,
    });
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Prisma findMany notice:', err);
  }

  const mergedMap = new Map<string, OperationalActionPlanRecord>();

  // In-memory records
  for (const plan of inMemoryActionPlans.values()) {
    let match = true;
    if (filters.routeId) {
      const tr = filters.routeId.trim().toLowerCase();
      if (plan.routeId.toLowerCase() !== tr && plan.routeCode.toLowerCase() !== tr) match = false;
    }
    if (filters.status && plan.status !== filters.status) match = false;
    if (filters.priority && plan.priority !== filters.priority) match = false;
    if (filters.actionType && plan.actionType !== filters.actionType) match = false;
    if (match) mergedMap.set(plan.id, plan);
  }

  // Database records
  for (const db of dbRecords) {
    let evidence: Record<string, any> = {};
    try {
      if (db.evidenceJson) evidence = JSON.parse(db.evidenceJson);
    } catch {
      evidence = {};
    }

    mergedMap.set(db.id, {
      id: db.id,
      routeId: db.routeId,
      routeCode: db.routeCode,
      routeName: db.routeName,
      recommendationId: db.recommendationId,
      actionType: db.actionType as ActionType,
      title: db.title,
      description: db.description,
      priority: db.priority as ActionPlanPriority,
      status: db.status as ActionPlanStatus,
      requestedByUserId: db.requestedByUserId,
      requestedByUserName: db.requestedByUserName,
      approvedByUserId: db.approvedByUserId,
      approvedByUserName: db.approvedByUserName,
      executedByUserId: db.executedByUserId,
      executedByUserName: db.executedByUserName,
      createdAt: db.createdAt?.toISOString ? db.createdAt.toISOString() : String(db.createdAt),
      updatedAt: db.updatedAt?.toISOString ? db.updatedAt.toISOString() : String(db.updatedAt),
      approvedAt: db.approvedAt ? (db.approvedAt.toISOString ? db.approvedAt.toISOString() : String(db.approvedAt)) : null,
      executionStartedAt: db.executionStartedAt ? (db.executionStartedAt.toISOString ? db.executionStartedAt.toISOString() : String(db.executionStartedAt)) : null,
      completedAt: db.completedAt ? (db.completedAt.toISOString ? db.completedAt.toISOString() : String(db.completedAt)) : null,
      cancelledAt: db.cancelledAt ? (db.cancelledAt.toISOString ? db.cancelledAt.toISOString() : String(db.cancelledAt)) : null,
      rejectedAt: db.rejectedAt ? (db.rejectedAt.toISOString ? db.rejectedAt.toISOString() : String(db.rejectedAt)) : null,
      executionResult: db.executionResult,
      failureReason: db.failureReason,
      evidenceJson: db.evidenceJson,
      evidence,
      approvalNote: db.approvalNote,
      executionNote: db.executionNote,
      rejectionReason: db.rejectionReason,
      cancellationReason: db.cancellationReason,
      correlationId: db.correlationId,
      sourceModule: db.sourceModule,
      createdFromRiskScore: db.createdFromRiskScore,
      createdFromOperationalStatus: db.createdFromOperationalStatus,
      dedupKey: db.dedupKey,
    });
  }

  const allPlans = Array.from(mergedMap.values());

  // Deterministic sorting cascade:
  // 1. Status severity: PENDING_APPROVAL > EXECUTION_REQUESTED > IN_PROGRESS > APPROVED > DRAFT > FAILED > COMPLETED > REJECTED > CANCELLED
  // 2. Priority: CRITICAL > HIGH > MEDIUM > LOW
  // 3. CreatedAt descending
  const statusWeight: Record<ActionPlanStatus, number> = {
    PENDING_APPROVAL: 9,
    EXECUTION_REQUESTED: 8,
    IN_PROGRESS: 7,
    APPROVED: 6,
    DRAFT: 5,
    FAILED: 4,
    COMPLETED: 3,
    REJECTED: 2,
    CANCELLED: 1,
  };

  const priorityWeight: Record<ActionPlanPriority, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  allPlans.sort((a, b) => {
    const sDiff = (statusWeight[b.status] || 0) - (statusWeight[a.status] || 0);
    if (sDiff !== 0) return sDiff;
    const pDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    if (pDiff !== 0) return pDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Calculate KPIs across all recorded action plans
  const kpis: ActionWorkflowKPIs = {
    total: allPlans.length,
    pendingApproval: 0,
    approved: 0,
    executionRequested: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    rejected: 0,
    cancelled: 0,
  };

  for (const plan of allPlans) {
    switch (plan.status) {
      case 'PENDING_APPROVAL':
        kpis.pendingApproval++;
        break;
      case 'APPROVED':
        kpis.approved++;
        break;
      case 'EXECUTION_REQUESTED':
        kpis.executionRequested++;
        break;
      case 'IN_PROGRESS':
        kpis.inProgress++;
        break;
      case 'COMPLETED':
        kpis.completed++;
        break;
      case 'FAILED':
        kpis.failed++;
        break;
      case 'REJECTED':
        kpis.rejected++;
        break;
      case 'CANCELLED':
        kpis.cancelled++;
        break;
      default:
        break;
    }
  }

  const finalPlans =
    filters.limit && filters.limit > 0 ? allPlans.slice(0, filters.limit) : allPlans;

  return {
    actionPlans: finalPlans,
    kpis,
    notices: MANDATORY_ACTION_NOTICES,
  };
}

/**
 * Approves an operational action plan.
 * Enforces stale intelligence checks and recommendation lifecycle protection.
 */
export async function approveOperationalActionPlan(
  id: string,
  params: {
    approvalNote?: string;
    acknowledgeStale?: boolean;
    adminUser: { id: string; name?: string | null; email?: string | null; role?: string };
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<OperationalActionPlanRecord> {
  const plan = await getOperationalActionPlanById(id);
  if (!plan) {
    const err: any = new Error(`Action plan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  validateStateTransition(plan.status, 'APPROVED');

  // Stale intelligence check
  const staleReport = await checkStaleIntelligence(plan);

  if (staleReport.isFatal) {
    const err: any = new Error(`Cannot approve action plan: ${staleReport.reasons.join(' ')}`);
    err.statusCode = 400;
    throw err;
  }

  if (staleReport.isStale && !params.acknowledgeStale) {
    const error: any = new Error(
      `Source intelligence has changed since this action plan was created: ${staleReport.reasons.join(' ')}`
    );
    error.statusCode = 409;
    error.staleIntelligenceDetected = true;
    error.staleReasons = staleReport.reasons;
    throw error;
  }

  const now = new Date();
  const previousState = { status: plan.status };

  plan.status = 'APPROVED';
  plan.approvedByUserId = params.adminUser.id;
  plan.approvedByUserName = params.adminUser.name || params.adminUser.email || 'Admin';
  plan.approvedAt = now.toISOString();
  plan.approvalNote = params.approvalNote?.trim() || null;
  plan.updatedAt = now.toISOString();

  // Persist DB
  try {
    await prisma.operationalActionPlan.update({
      where: { id: plan.id },
      data: {
        status: plan.status,
        approvedByUserId: plan.approvedByUserId,
        approvedByUserName: plan.approvedByUserName,
        approvedAt: now,
        approvalNote: plan.approvalNote,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Prisma update notice:', err);
  }

  inMemoryActionPlans.set(plan.id, plan);

  // Audit
  try {
    await recordOperationalAuditEvent({
      eventType: 'ACTION_PLAN_APPROVED',
      actor: {
        id: params.adminUser.id,
        role: params.adminUser.role || 'ADMIN',
        email: params.adminUser.email,
        name: params.adminUser.name,
      },
      resourceType: 'ACTION_PLAN',
      resourceId: plan.id,
      routeId: plan.routeId,
      routeCode: plan.routeCode,
      routeName: plan.routeName,
      action: 'ACTION_PLAN_APPROVED',
      description: `Action plan '${plan.title}' approved by ${plan.approvedByUserName}.${plan.approvalNote ? ' Note: ' + plan.approvalNote : ''}`,
      previousState,
      resultingState: {
        id: plan.id,
        status: plan.status,
        approvedAt: plan.approvedAt,
        approvedBy: plan.approvedByUserName,
      },
      evidence: plan.evidence,
      sourceModule: 'ACTION_WORKFLOW',
      correlationId: plan.correlationId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (auditErr) {
    console.warn('[ActionWorkflowEngine] Audit recording notice:', auditErr);
  }

  return plan;
}

/**
 * Rejects an operational action plan.
 * Requires an explicit administrative rejection reason.
 */
export async function rejectOperationalActionPlan(
  id: string,
  params: {
    rejectionReason: string;
    adminUser: { id: string; name?: string | null; email?: string | null; role?: string };
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<OperationalActionPlanRecord> {
  const plan = await getOperationalActionPlanById(id);
  if (!plan) {
    const err: any = new Error(`Action plan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  validateStateTransition(plan.status, 'REJECTED');

  const reason = params.rejectionReason?.trim();
  if (!reason || reason.length < 3) {
    const err: any = new Error('A rejection reason of at least 3 characters is required.');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const previousState = { status: plan.status };

  plan.status = 'REJECTED';
  plan.rejectedAt = now.toISOString();
  plan.rejectionReason = reason;
  plan.updatedAt = now.toISOString();

  try {
    await prisma.operationalActionPlan.update({
      where: { id: plan.id },
      data: {
        status: plan.status,
        rejectedAt: now,
        rejectionReason: plan.rejectionReason,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Prisma update notice:', err);
  }

  inMemoryActionPlans.set(plan.id, plan);

  try {
    await recordOperationalAuditEvent({
      eventType: 'ACTION_PLAN_REJECTED',
      actor: {
        id: params.adminUser.id,
        role: params.adminUser.role || 'ADMIN',
        email: params.adminUser.email,
        name: params.adminUser.name,
      },
      resourceType: 'ACTION_PLAN',
      resourceId: plan.id,
      routeId: plan.routeId,
      routeCode: plan.routeCode,
      routeName: plan.routeName,
      action: 'ACTION_PLAN_REJECTED',
      description: `Action plan '${plan.title}' rejected. Reason: ${reason}`,
      previousState,
      resultingState: {
        id: plan.id,
        status: plan.status,
        rejectedAt: plan.rejectedAt,
        rejectionReason: plan.rejectionReason,
      },
      evidence: plan.evidence,
      sourceModule: 'ACTION_WORKFLOW',
      correlationId: plan.correlationId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (auditErr) {
    console.warn('[ActionWorkflowEngine] Audit recording notice:', auditErr);
  }

  return plan;
}

/**
 * Requests execution for an approved action plan.
 * Strictly non-mutative: records the request without altering operational resources.
 */
export async function requestActionPlanExecution(
  id: string,
  params: {
    executionNote?: string;
    adminUser: { id: string; name?: string | null; email?: string | null; role?: string };
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<OperationalActionPlanRecord> {
  const plan = await getOperationalActionPlanById(id);
  if (!plan) {
    const err: any = new Error(`Action plan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  validateStateTransition(plan.status, 'EXECUTION_REQUESTED');

  const now = new Date();
  const previousState = { status: plan.status };

  plan.status = 'EXECUTION_REQUESTED';
  plan.executionNote = params.executionNote?.trim() || null;
  plan.updatedAt = now.toISOString();

  try {
    await prisma.operationalActionPlan.update({
      where: { id: plan.id },
      data: {
        status: plan.status,
        executionNote: plan.executionNote,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Prisma update notice:', err);
  }

  inMemoryActionPlans.set(plan.id, plan);

  try {
    await recordOperationalAuditEvent({
      eventType: 'ACTION_EXECUTION_REQUESTED',
      actor: {
        id: params.adminUser.id,
        role: params.adminUser.role || 'ADMIN',
        email: params.adminUser.email,
        name: params.adminUser.name,
      },
      resourceType: 'ACTION_PLAN',
      resourceId: plan.id,
      routeId: plan.routeId,
      routeCode: plan.routeCode,
      routeName: plan.routeName,
      action: 'ACTION_EXECUTION_REQUESTED',
      description: `Execution requested for action plan '${plan.title}'. Zero automated mutations executed.`,
      previousState,
      resultingState: {
        id: plan.id,
        status: plan.status,
      },
      evidence: plan.evidence,
      sourceModule: 'ACTION_WORKFLOW',
      correlationId: plan.correlationId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (auditErr) {
    console.warn('[ActionWorkflowEngine] Audit recording notice:', auditErr);
  }

  return plan;
}

/**
 * Marks execution started by an authorized administrator.
 */
export async function startActionPlanExecution(
  id: string,
  params: {
    executionNote?: string;
    adminUser: { id: string; name?: string | null; email?: string | null; role?: string };
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<OperationalActionPlanRecord> {
  const plan = await getOperationalActionPlanById(id);
  if (!plan) {
    const err: any = new Error(`Action plan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  validateStateTransition(plan.status, 'IN_PROGRESS');

  const now = new Date();
  const previousState = { status: plan.status };

  plan.status = 'IN_PROGRESS';
  plan.executionStartedAt = now.toISOString();
  plan.executedByUserId = params.adminUser.id;
  plan.executedByUserName = params.adminUser.name || params.adminUser.email || 'Admin';
  if (params.executionNote) {
    plan.executionNote = params.executionNote.trim();
  }
  plan.updatedAt = now.toISOString();

  try {
    await prisma.operationalActionPlan.update({
      where: { id: plan.id },
      data: {
        status: plan.status,
        executionStartedAt: now,
        executedByUserId: plan.executedByUserId,
        executedByUserName: plan.executedByUserName,
        executionNote: plan.executionNote,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Prisma update notice:', err);
  }

  inMemoryActionPlans.set(plan.id, plan);

  try {
    await recordOperationalAuditEvent({
      eventType: 'ACTION_EXECUTION_STARTED',
      actor: {
        id: params.adminUser.id,
        role: params.adminUser.role || 'ADMIN',
        email: params.adminUser.email,
        name: params.adminUser.name,
      },
      resourceType: 'ACTION_PLAN',
      resourceId: plan.id,
      routeId: plan.routeId,
      routeCode: plan.routeCode,
      routeName: plan.routeName,
      action: 'ACTION_EXECUTION_STARTED',
      description: `Execution started for action plan '${plan.title}' by ${plan.executedByUserName}.`,
      previousState,
      resultingState: {
        id: plan.id,
        status: plan.status,
        executionStartedAt: plan.executionStartedAt,
      },
      evidence: plan.evidence,
      sourceModule: 'ACTION_WORKFLOW',
      correlationId: plan.correlationId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (auditErr) {
    console.warn('[ActionWorkflowEngine] Audit recording notice:', auditErr);
  }

  return plan;
}

/**
 * Marks execution completed by an administrator with completion notes and result evidence.
 */
export async function completeActionPlanExecution(
  id: string,
  params: {
    completionNote?: string;
    executionNote?: string;
    executionResult?: string;
    adminUser: { id: string; name?: string | null; email?: string | null; role?: string };
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<OperationalActionPlanRecord> {
  const plan = await getOperationalActionPlanById(id);
  if (!plan) {
    const err: any = new Error(`Action plan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  validateStateTransition(plan.status, 'COMPLETED');

  const now = new Date();
  const previousState = { status: plan.status };

  plan.status = 'COMPLETED';
  plan.completedAt = now.toISOString();
  plan.executedByUserId = params.adminUser.id;
  plan.executedByUserName = params.adminUser.name || params.adminUser.email || 'Admin';
  plan.executionResult = params.executionResult?.trim() || 'SUCCESS_ACKNOWLEDGED';
  plan.executionNote = params.completionNote?.trim() || params.executionNote?.trim() || plan.executionNote || 'Action execution completed.';
  plan.updatedAt = now.toISOString();

  try {
    await prisma.operationalActionPlan.update({
      where: { id: plan.id },
      data: {
        status: plan.status,
        completedAt: now,
        executedByUserId: plan.executedByUserId,
        executedByUserName: plan.executedByUserName,
        executionResult: plan.executionResult,
        executionNote: plan.executionNote,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Prisma update notice:', err);
  }

  inMemoryActionPlans.set(plan.id, plan);

  try {
    await recordOperationalAuditEvent({
      eventType: 'ACTION_EXECUTION_COMPLETED',
      actor: {
        id: params.adminUser.id,
        role: params.adminUser.role || 'ADMIN',
        email: params.adminUser.email,
        name: params.adminUser.name,
      },
      resourceType: 'ACTION_PLAN',
      resourceId: plan.id,
      routeId: plan.routeId,
      routeCode: plan.routeCode,
      routeName: plan.routeName,
      action: 'ACTION_EXECUTION_COMPLETED',
      description: `Action plan '${plan.title}' marked COMPLETED by ${plan.executedByUserName}. Result: ${plan.executionResult}`,
      previousState,
      resultingState: {
        id: plan.id,
        status: plan.status,
        completedAt: plan.completedAt,
        executionResult: plan.executionResult,
      },
      evidence: plan.evidence,
      sourceModule: 'ACTION_WORKFLOW',
      correlationId: plan.correlationId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (auditErr) {
    console.warn('[ActionWorkflowEngine] Audit recording notice:', auditErr);
  }

  return plan;
}

/**
 * Marks execution failed with failure reason.
 */
export async function failActionPlanExecution(
  id: string,
  params: {
    failureReason: string;
    adminUser: { id: string; name?: string | null; email?: string | null; role?: string };
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<OperationalActionPlanRecord> {
  const plan = await getOperationalActionPlanById(id);
  if (!plan) {
    const err: any = new Error(`Action plan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  validateStateTransition(plan.status, 'FAILED');

  const reason = params.failureReason?.trim();
  if (!reason) {
    const err: any = new Error('A failure reason is required to mark an action plan failed.');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const previousState = { status: plan.status };

  plan.status = 'FAILED';
  plan.completedAt = now.toISOString();
  plan.executedByUserId = params.adminUser.id;
  plan.executedByUserName = params.adminUser.name || params.adminUser.email || 'Admin';
  plan.executionResult = 'FAILED';
  plan.failureReason = reason;
  plan.updatedAt = now.toISOString();

  try {
    await prisma.operationalActionPlan.update({
      where: { id: plan.id },
      data: {
        status: plan.status,
        completedAt: now,
        executedByUserId: plan.executedByUserId,
        executedByUserName: plan.executedByUserName,
        executionResult: plan.executionResult,
        failureReason: plan.failureReason,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Prisma update notice:', err);
  }

  inMemoryActionPlans.set(plan.id, plan);

  try {
    await recordOperationalAuditEvent({
      eventType: 'ACTION_EXECUTION_FAILED',
      actor: {
        id: params.adminUser.id,
        role: params.adminUser.role || 'ADMIN',
        email: params.adminUser.email,
        name: params.adminUser.name,
      },
      resourceType: 'ACTION_PLAN',
      resourceId: plan.id,
      routeId: plan.routeId,
      routeCode: plan.routeCode,
      routeName: plan.routeName,
      action: 'ACTION_EXECUTION_FAILED',
      description: `Action plan '${plan.title}' marked FAILED by ${plan.executedByUserName}. Reason: ${reason}`,
      previousState,
      resultingState: {
        id: plan.id,
        status: plan.status,
        failureReason: plan.failureReason,
      },
      evidence: plan.evidence,
      sourceModule: 'ACTION_WORKFLOW',
      correlationId: plan.correlationId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (auditErr) {
    console.warn('[ActionWorkflowEngine] Audit recording notice:', auditErr);
  }

  return plan;
}

/**
 * Cancels an action plan where lifecycle permits (DRAFT, PENDING_APPROVAL, APPROVED, EXECUTION_REQUESTED).
 */
export async function cancelOperationalActionPlan(
  id: string,
  params: {
    cancellationReason?: string;
    adminUser: { id: string; name?: string | null; email?: string | null; role?: string };
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<OperationalActionPlanRecord> {
  const plan = await getOperationalActionPlanById(id);
  if (!plan) {
    const err: any = new Error(`Action plan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  validateStateTransition(plan.status, 'CANCELLED');

  const now = new Date();
  const previousState = { status: plan.status };

  plan.status = 'CANCELLED';
  plan.cancelledAt = now.toISOString();
  plan.cancellationReason = params.cancellationReason?.trim() || 'Cancelled by administrator.';
  plan.updatedAt = now.toISOString();

  try {
    await prisma.operationalActionPlan.update({
      where: { id: plan.id },
      data: {
        status: plan.status,
        cancelledAt: now,
        cancellationReason: plan.cancellationReason,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Prisma update notice:', err);
  }

  inMemoryActionPlans.set(plan.id, plan);

  try {
    await recordOperationalAuditEvent({
      eventType: 'ACTION_PLAN_CANCELLED',
      actor: {
        id: params.adminUser.id,
        role: params.adminUser.role || 'ADMIN',
        email: params.adminUser.email,
        name: params.adminUser.name,
      },
      resourceType: 'ACTION_PLAN',
      resourceId: plan.id,
      routeId: plan.routeId,
      routeCode: plan.routeCode,
      routeName: plan.routeName,
      action: 'ACTION_PLAN_CANCELLED',
      description: `Action plan '${plan.title}' cancelled. Reason: ${plan.cancellationReason}`,
      previousState,
      resultingState: {
        id: plan.id,
        status: plan.status,
        cancelledAt: plan.cancelledAt,
      },
      evidence: plan.evidence,
      sourceModule: 'ACTION_WORKFLOW',
      correlationId: plan.correlationId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  } catch (auditErr) {
    console.warn('[ActionWorkflowEngine] Audit recording notice:', auditErr);
  }

  return plan;
}

/**
 * Returns comprehensive action plan detail spanning Sections A through J.
 */
export async function getActionPlanDetail(id: string): Promise<{
  actionPlan: OperationalActionPlanRecord;
  staleIntelligence: StaleIntelligenceReport;
  auditEvents: OperationalAuditEventRecord[];
  notices: string[];
}> {
  const plan = await getOperationalActionPlanById(id);
  if (!plan) {
    const err: any = new Error(`Action plan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  const staleIntelligence = await checkStaleIntelligence(plan);

  // Fetch associated audit events
  let auditEvents: OperationalAuditEventRecord[] = [];
  try {
    const { events } = await getOperationalAuditEvents({
      resourceType: 'ACTION_PLAN',
      resourceId: plan.id,
      limit: 20,
    });
    auditEvents = events;
  } catch (err) {
    console.warn('[ActionWorkflowEngine] Audit events query notice:', err);
  }

  return {
    actionPlan: {
      ...plan,
      staleIntelligenceDetected: staleIntelligence.isStale,
      staleReasons: staleIntelligence.reasons,
    },
    staleIntelligence,
    auditEvents,
    notices: MANDATORY_ACTION_NOTICES,
  };
}
