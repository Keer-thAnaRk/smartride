/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — OPERATIONAL ACTION AUDIT & GOVERNANCE STORE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 8: Immutable, server-authoritative audit trail for operational
 * intelligence and human administrative decisions across Phase 3 Steps 1–7.
 *
 * Core Governance Invariants:
 * - Append-only immutability: Records cannot be updated, patched, or deleted.
 * - Server-authoritative: Actor, role, timestamps, evidence, and state transitions
 *   are strictly derived server-side. Client-supplied overrides are rejected.
 * - Cryptographic integrity: Every event has a SHA-256 integrity hash and is
 *   chronologically chained via previousEventHash.
 * - Human-in-the-Loop: Documents administrative actions without executing automated
 *   mutations to routes, vehicles, schedules, subscriptions, or bookings.
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma';

export type OperationalAuditEventType =
  | 'RECOMMENDATION_EVALUATED'
  | 'RECOMMENDATION_APPROVED'
  | 'RECOMMENDATION_DISMISSED'
  | 'RECOMMENDATION_COMPLETED'
  | 'SAFETY_ALERT_EVALUATED'
  | 'SAFETY_ALERT_RESOLVED'
  | 'INCIDENT_VIEWED'
  | 'INCIDENT_UPDATED'
  | 'INCIDENT_RESOLVED'
  | 'DECISION_SUPPORT_VIEWED'
  | 'ROUTE_RISK_HISTORY_VIEWED'
  | 'ROUTE_RISK_VIEWED'
  | 'AUDIT_LOG_VIEWED'
  | 'GOVERNANCE_REVIEWED'
  | 'OPERATIONAL_ANALYTICS_VIEWED'
  | 'EXECUTIVE_REPORT_GENERATED'
  | 'EXECUTIVE_DASHBOARD_VIEWED'
  | 'ACTION_PLAN_CREATED'
  | 'ACTION_PLAN_APPROVED'
  | 'ACTION_PLAN_REJECTED'
  | 'ACTION_EXECUTION_REQUESTED'
  | 'ACTION_EXECUTION_STARTED'
  | 'ACTION_EXECUTION_COMPLETED'
  | 'ACTION_EXECUTION_FAILED'
  | 'ACTION_PLAN_CANCELLED'
  | 'SYSTEM_HEALTH_VALIDATION_VIEWED';

export type OperationalAuditSourceModule =
  | 'RECOMMENDATIONS'
  | 'SAFETY_ALERTS'
  | 'INCIDENTS'
  | 'DECISION_SUPPORT'
  | 'ROUTE_RISK'
  | 'AUDIT'
  | 'GOVERNANCE'
  | 'ANALYTICS'
  | 'EXECUTIVE_DASHBOARD'
  | 'ACTION_WORKFLOW'
  | 'SYSTEM_HEALTH';

export type OperationalAuditResourceType =
  | 'RECOMMENDATION'
  | 'SAFETY_ALERT'
  | 'INCIDENT_CASE'
  | 'DECISION_SUPPORT'
  | 'ROUTE_RISK'
  | 'AUDIT_LOG'
  | 'GOVERNANCE_REVIEW'
  | 'OPERATIONAL_ANALYTICS'
  | 'EXECUTIVE_REPORT'
  | 'EXECUTIVE_DASHBOARD'
  | 'ACTION_PLAN'
  | 'SYSTEM_HEALTH';

export interface OperationalAuditEventRecord {
  id: string;
  eventType: OperationalAuditEventType;
  actorUserId: string;
  actorRole: string;
  actorEmail?: string | null;
  actorName?: string | null;
  routeId?: string | null;
  routeCode?: string | null;
  routeName?: string | null;
  resourceType: OperationalAuditResourceType;
  resourceId?: string | null;
  action: string;
  description: string;
  previousStateJson?: string | null;
  resultingStateJson?: string | null;
  evidenceJson?: string | null;
  evidence?: Record<string, any>;
  previousState?: Record<string, any> | null;
  resultingState?: Record<string, any> | null;
  sourceModule: OperationalAuditSourceModule;
  correlationId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  integrityHash: string;
  previousEventHash?: string | null;
  createdAt: string;
}

export interface OperationalAuditSummary {
  total: number;
  recommendations: number;
  alerts: number;
  incidents: number;
  decisionSupport: number;
  riskAnalysis: number;
}

export interface AuditQueryFilters {
  routeId?: string;
  eventType?: OperationalAuditEventType;
  actorUserId?: string;
  resourceType?: OperationalAuditResourceType;
  resourceId?: string;
  correlationId?: string;
  limit?: number;
  from?: string;
  to?: string;
}

export interface RecordAuditEventInput {
  eventType: OperationalAuditEventType;
  actor: {
    id: string;
    role: string;
    email?: string | null;
    name?: string | null;
  };
  resourceType: OperationalAuditResourceType;
  resourceId?: string | null;
  routeId?: string | null;
  routeCode?: string | null;
  routeName?: string | null;
  action: string;
  description: string;
  previousState?: Record<string, any> | null;
  resultingState?: Record<string, any> | null;
  evidence?: Record<string, any> | null;
  sourceModule: OperationalAuditSourceModule;
  correlationId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// In-memory fallback audit store for zero-downtime database resilience
const inMemoryAuditStore: Map<string, OperationalAuditEventRecord> = new Map();
let inMemoryLastHash: string = 'GENESIS';

/**
 * Sanitizes state or evidence objects to strip any accidental sensitive credentials
 * (passwords, tokens, JWTs, cookies, secrets).
 */
export function sanitizeAuditData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item));
  }

  const forbiddenKeys = [
    'password',
    'passwordhash',
    'token',
    'jwt',
    'cookie',
    'secret',
    'authorization',
    'smartride_token',
    'apikey',
    'creditcard',
    'cvv',
  ];

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (forbiddenKeys.some((f) => lowerKey.includes(f))) {
      sanitized[key] = '[REDACTED_SENSITIVE_SECRET]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Computes a deterministic SHA-256 integrity hash from immutable audit record attributes.
 */
export function computeEventIntegrityHash(params: {
  eventType: string;
  actorUserId: string;
  resourceType: string;
  resourceId?: string | null;
  routeId?: string | null;
  createdAt: string;
  previousStateJson?: string | null;
  resultingStateJson?: string | null;
  evidenceJson?: string | null;
  correlationId?: string | null;
  previousEventHash?: string | null;
}): string {
  const payload = [
    params.eventType,
    params.actorUserId,
    params.resourceType,
    params.resourceId || '',
    params.routeId || '',
    params.createdAt,
    params.previousStateJson || '',
    params.resultingStateJson || '',
    params.evidenceJson || '',
    params.correlationId || '',
    params.previousEventHash || 'GENESIS',
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Verifies the cryptographic integrity of an audit event.
 */
export function verifyAuditEventIntegrity(event: OperationalAuditEventRecord): boolean {
  const recalculated = computeEventIntegrityHash({
    eventType: event.eventType,
    actorUserId: event.actorUserId,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    routeId: event.routeId,
    createdAt: event.createdAt,
    previousStateJson: event.previousStateJson,
    resultingStateJson: event.resultingStateJson,
    evidenceJson: event.evidenceJson,
    correlationId: event.correlationId,
    previousEventHash: event.previousEventHash,
  });

  return recalculated === event.integrityHash;
}

/**
 * Persists an immutable operational audit event.
 * Derives timestamp, integrity hash, and chained previousEventHash server-side.
 */
export async function recordOperationalAuditEvent(
  input: RecordAuditEventInput
): Promise<OperationalAuditEventRecord> {
  const now = new Date();
  const createdAtIso = now.toISOString();
  const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // 1. Sanitize payloads
  const sanitizedPrev = input.previousState ? sanitizeAuditData(input.previousState) : null;
  const sanitizedResult = input.resultingState ? sanitizeAuditData(input.resultingState) : null;
  const sanitizedEv = input.evidence ? sanitizeAuditData(input.evidence) : null;

  const previousStateJson = sanitizedPrev ? JSON.stringify(sanitizedPrev) : null;
  const resultingStateJson = sanitizedResult ? JSON.stringify(sanitizedResult) : null;
  const evidenceJson = sanitizedEv ? JSON.stringify(sanitizedEv) : null;

  // 2. Determine previous event hash for audit chaining
  let previousEventHash = inMemoryLastHash;
  try {
    const lastDbEvent = await prisma.operationalAuditEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { integrityHash: true },
    });
    if (lastDbEvent?.integrityHash) {
      previousEventHash = lastDbEvent.integrityHash;
    }
  } catch (err) {
    // Fall back to inMemoryLastHash
  }

  // 3. Compute immutable cryptographic integrity hash
  const integrityHash = computeEventIntegrityHash({
    eventType: input.eventType,
    actorUserId: input.actor.id,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    routeId: input.routeId,
    createdAt: createdAtIso,
    previousStateJson,
    resultingStateJson,
    evidenceJson,
    correlationId: input.correlationId,
    previousEventHash,
  });

  // 4. Construct authoritative record
  const record: OperationalAuditEventRecord = {
    id,
    eventType: input.eventType,
    actorUserId: input.actor.id,
    actorRole: input.actor.role || 'ADMIN',
    actorEmail: input.actor.email || null,
    actorName: input.actor.name || null,
    routeId: input.routeId || null,
    routeCode: input.routeCode || null,
    routeName: input.routeName || null,
    resourceType: input.resourceType,
    resourceId: input.resourceId || null,
    action: input.action,
    description: input.description,
    previousStateJson,
    resultingStateJson,
    evidenceJson,
    evidence: sanitizedEv || {},
    previousState: sanitizedPrev,
    resultingState: sanitizedResult,
    sourceModule: input.sourceModule,
    correlationId: input.correlationId || null,
    requestId: input.requestId || null,
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
    integrityHash,
    previousEventHash,
    createdAt: createdAtIso,
  };

  // 5. Persist to SQLite Prisma
  try {
    await prisma.operationalAuditEvent.create({
      data: {
        id: record.id,
        eventType: record.eventType,
        actorUserId: record.actorUserId,
        actorRole: record.actorRole,
        actorEmail: record.actorEmail,
        actorName: record.actorName,
        routeId: record.routeId,
        routeCode: record.routeCode,
        routeName: record.routeName,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        action: record.action,
        description: record.description,
        previousStateJson: record.previousStateJson,
        resultingStateJson: record.resultingStateJson,
        evidenceJson: record.evidenceJson,
        sourceModule: record.sourceModule,
        correlationId: record.correlationId,
        requestId: record.requestId,
        ipAddress: record.ipAddress,
        userAgent: record.userAgent,
        integrityHash: record.integrityHash,
        previousEventHash: record.previousEventHash,
        createdAt: now,
      },
    });
  } catch (err) {
    console.warn('[OperationalAuditStore] Prisma create notice:', err);
  }

  // 6. Update in-memory store and chain head
  inMemoryAuditStore.set(record.id, record);
  inMemoryLastHash = integrityHash;

  return record;
}

/**
 * Retrieves audit events based on query filters and safe limits.
 * Default limit = 50, maximum limit = 200.
 */
export async function getOperationalAuditEvents(
  filters: AuditQueryFilters = {}
): Promise<{
  events: OperationalAuditEventRecord[];
  summary: OperationalAuditSummary;
}> {
  const safeLimit = Math.min(Math.max(filters.limit || 50, 1), 200);

  const where: any = {};
  if (filters.routeId) {
    const trimmed = filters.routeId.trim();
    where.OR = [{ routeId: trimmed }, { routeCode: trimmed }];
  }
  if (filters.eventType) {
    where.eventType = filters.eventType;
  }
  if (filters.actorUserId) {
    where.actorUserId = filters.actorUserId.trim();
  }
  if (filters.resourceType) {
    where.resourceType = filters.resourceType;
  }
  if (filters.resourceId) {
    where.resourceId = filters.resourceId.trim();
  }
  if (filters.correlationId) {
    where.correlationId = filters.correlationId.trim();
  }
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) where.createdAt.lte = new Date(filters.to);
  }

  let dbRecords: any[] = [];
  try {
    dbRecords = await prisma.operationalAuditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
  } catch (err) {
    console.warn('[OperationalAuditStore] Prisma query notice:', err);
  }

  // Merge with in-memory store
  const mergedMap = new Map<string, OperationalAuditEventRecord>();

  // Filter in-memory items
  for (const item of inMemoryAuditStore.values()) {
    let match = true;
    if (filters.routeId) {
      const r = filters.routeId.trim().toLowerCase();
      if (item.routeId?.toLowerCase() !== r && item.routeCode?.toLowerCase() !== r) match = false;
    }
    if (filters.eventType && item.eventType !== filters.eventType) match = false;
    if (filters.actorUserId && item.actorUserId !== filters.actorUserId.trim()) match = false;
    if (filters.resourceType && item.resourceType !== filters.resourceType) match = false;
    if (filters.resourceId && item.resourceId !== filters.resourceId.trim()) match = false;
    if (filters.correlationId && item.correlationId !== filters.correlationId.trim()) match = false;
    if (filters.from && new Date(item.createdAt).getTime() < new Date(filters.from).getTime()) match = false;
    if (filters.to && new Date(item.createdAt).getTime() > new Date(filters.to).getTime()) match = false;

    if (match) mergedMap.set(item.id, item);
  }

  for (const r of dbRecords) {
    let evidence = {};
    let previousState = null;
    let resultingState = null;

    try {
      if (r.evidenceJson) evidence = JSON.parse(r.evidenceJson);
    } catch {
      evidence = {};
    }
    try {
      if (r.previousStateJson) previousState = JSON.parse(r.previousStateJson);
    } catch {
      previousState = null;
    }
    try {
      if (r.resultingStateJson) resultingState = JSON.parse(r.resultingStateJson);
    } catch {
      resultingState = null;
    }

    mergedMap.set(r.id, {
      id: r.id,
      eventType: r.eventType as OperationalAuditEventType,
      actorUserId: r.actorUserId,
      actorRole: r.actorRole,
      actorEmail: r.actorEmail,
      actorName: r.actorName,
      routeId: r.routeId,
      routeCode: r.routeCode,
      routeName: r.routeName,
      resourceType: r.resourceType as OperationalAuditResourceType,
      resourceId: r.resourceId,
      action: r.action,
      description: r.description,
      previousStateJson: r.previousStateJson,
      resultingStateJson: r.resultingStateJson,
      evidenceJson: r.evidenceJson,
      evidence,
      previousState,
      resultingState,
      sourceModule: r.sourceModule as OperationalAuditSourceModule,
      correlationId: r.correlationId,
      requestId: r.requestId,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      integrityHash: r.integrityHash,
      previousEventHash: r.previousEventHash,
      createdAt: r.createdAt.toISOString ? r.createdAt.toISOString() : String(r.createdAt),
    });
  }

  // Sort descending by createdAt
  const allEvents = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Compute summary metrics (mutually exclusive categorisation guarantees sum === total)
  const summary: OperationalAuditSummary = {
    total: allEvents.length,
    recommendations: 0,
    alerts: 0,
    incidents: 0,
    decisionSupport: 0,
    riskAnalysis: 0,
  };

  for (const ev of allEvents) {
    if (ev.sourceModule === 'RECOMMENDATIONS' || ev.eventType.startsWith('RECOMMENDATION_')) {
      summary.recommendations++;
    } else if (ev.sourceModule === 'SAFETY_ALERTS' || ev.eventType.startsWith('SAFETY_ALERT_')) {
      summary.alerts++;
    } else if (ev.sourceModule === 'INCIDENTS' || ev.eventType.startsWith('INCIDENT_')) {
      summary.incidents++;
    } else if (
      ev.sourceModule === 'DECISION_SUPPORT' ||
      ev.eventType.startsWith('DECISION_SUPPORT_') ||
      ev.eventType === 'AUDIT_LOG_VIEWED'
    ) {
      summary.decisionSupport++;
    } else if (ev.sourceModule === 'ROUTE_RISK' || ev.eventType.startsWith('ROUTE_RISK_')) {
      summary.riskAnalysis++;
    } else {
      summary.decisionSupport++;
    }
  }

  const paginatedEvents = allEvents.slice(0, safeLimit);
  return { events: paginatedEvents, summary };
}

/**
 * Retrieves a single audit event by unique ID.
 */
export async function getOperationalAuditEventById(
  id: string
): Promise<OperationalAuditEventRecord | null> {
  const trimmed = id.trim();
  let r: any = null;

  try {
    r = await prisma.operationalAuditEvent.findUnique({
      where: { id: trimmed },
    });
  } catch (err) {
    console.warn(`[OperationalAuditStore] Prisma findUnique notice for ${trimmed}:`, err);
  }

  if (r) {
    let evidence = {};
    let previousState = null;
    let resultingState = null;

    try {
      if (r.evidenceJson) evidence = JSON.parse(r.evidenceJson);
    } catch {
      evidence = {};
    }
    try {
      if (r.previousStateJson) previousState = JSON.parse(r.previousStateJson);
    } catch {
      previousState = null;
    }
    try {
      if (r.resultingStateJson) resultingState = JSON.parse(r.resultingStateJson);
    } catch {
      resultingState = null;
    }

    return {
      id: r.id,
      eventType: r.eventType as OperationalAuditEventType,
      actorUserId: r.actorUserId,
      actorRole: r.actorRole,
      actorEmail: r.actorEmail,
      actorName: r.actorName,
      routeId: r.routeId,
      routeCode: r.routeCode,
      routeName: r.routeName,
      resourceType: r.resourceType as OperationalAuditResourceType,
      resourceId: r.resourceId,
      action: r.action,
      description: r.description,
      previousStateJson: r.previousStateJson,
      resultingStateJson: r.resultingStateJson,
      evidenceJson: r.evidenceJson,
      evidence,
      previousState,
      resultingState,
      sourceModule: r.sourceModule as OperationalAuditSourceModule,
      correlationId: r.correlationId,
      requestId: r.requestId,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      integrityHash: r.integrityHash,
      previousEventHash: r.previousEventHash,
      createdAt: r.createdAt.toISOString ? r.createdAt.toISOString() : String(r.createdAt),
    };
  }

  return inMemoryAuditStore.get(trimmed) || null;
}
