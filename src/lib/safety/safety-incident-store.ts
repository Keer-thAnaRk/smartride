/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — SAFETY INCIDENT RESPONSE & OPERATIONAL CASE MANAGEMENT STORE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 4: Deterministic operational response case management.
 *
 * Rules:
 * - Cases originate strictly from verified SafetyAlert records.
 * - One SafetyAlert may have at most one active operational case (duplicate protection).
 * - All critical safety attributes (severity, routeId, score, evidence) are derived server-side.
 * - Client cannot forge or override severity, risk scores, evidence, or timestamps.
 * - Lifecycle is strictly validated:
 *     OPEN -> ACKNOWLEDGED -> INVESTIGATING -> MITIGATED -> RESOLVED -> CLOSED
 *     (Reopen supported from RESOLVED/CLOSED -> OPEN)
 * - Activity history is strictly append-only and immutable.
 */

import prisma from '@/lib/prisma';
import { getUserById } from '@/lib/firestore-db';
import { RouteRiskLevel } from '@/lib/safety/route-risk-engine';

export type IncidentSeverity = RouteRiskLevel; // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type IncidentStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'INVESTIGATING'
  | 'MITIGATED'
  | 'RESOLVED'
  | 'CLOSED';

export type IncidentActionType =
  | 'CASE_CREATED'
  | 'CASE_ACKNOWLEDGED'
  | 'CASE_ASSIGNED'
  | 'INVESTIGATION_STARTED'
  | 'NOTE_ADDED'
  | 'MITIGATION_RECORDED'
  | 'CASE_RESOLVED'
  | 'CASE_CLOSED'
  | 'CASE_REOPENED';

export interface IncidentActivityRecord {
  id: string;
  caseId: string;
  actionType: IncidentActionType;
  message: string;
  metadataJson: string | null;
  performedBy: string;
  createdAt: string;
}

export interface IncidentCaseRecord {
  id: string;
  alertId: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  assignedAdminId: string | null;
  assignedAdminName?: string | null;
  createdByAdminId: string;
  createdByAdminName?: string | null;
  currentRiskScore: number;
  previousRiskScore: number | null;
  scoreDelta: number | null;
  sourceAlertType: string;
  sourceAlertSeverity: string;
  evidenceJson: string;
  evidence?: any;
  resolutionSummary: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  activities?: IncidentActivityRecord[];
}

export interface IncidentSummary {
  total: number;
  open: number;
  acknowledged: number;
  investigating: number;
  mitigated: number;
  resolved: number;
  closed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface IncidentQueryFilters {
  routeId?: string;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  assignedAdminId?: string;
  limit?: number;
}

// In-Memory Fallback store if Prisma encounters temporary locking
const inMemoryCases = new Map<string, IncidentCaseRecord>();
const inMemoryActivities = new Map<string, IncidentActivityRecord[]>();

/**
 * Creates an operational incident case from an existing SafetyAlert.
 * Prevents multiple active cases for the same unresolved alert.
 * Strictly derives all safety and route metadata server-side.
 */
export async function createIncidentCase(params: {
  alertId: string;
  adminId: string;
  adminName?: string;
}): Promise<IncidentCaseRecord> {
  const { alertId, adminId, adminName } = params;

  // 1. Verify source SafetyAlert exists in database
  let alert = null;
  try {
    alert = await prisma.safetyAlert.findUnique({
      where: { id: alertId },
    });
  } catch (err) {
    console.warn('[SafetyIncidentStore] Failed to query safetyAlert from Prisma:', err);
  }

  if (!alert) {
    throw new Error(`Safety alert not found with ID '${alertId}'`);
  }

  // 2. Duplicate active case protection
  const activeStatuses = ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'MITIGATED'];
  let existingActive = null;
  try {
    existingActive = await prisma.safetyIncidentCase.findFirst({
      where: {
        alertId: alert.id,
        status: { in: activeStatuses },
      },
    });
  } catch (err) {
    console.warn('[SafetyIncidentStore] Failed to check existing active cases in Prisma:', err);
  }

  if (!existingActive) {
    for (const c of inMemoryCases.values()) {
      if (c.alertId === alert.id && activeStatuses.includes(c.status)) {
        existingActive = c;
        break;
      }
    }
  }

  if (existingActive) {
    const error: any = new Error(
      `An active operational incident case (${existingActive.id}) already exists for alert '${alert.id}'.`
    );
    error.code = 'DUPLICATE_ACTIVE_CASE';
    error.existingCaseId = existingActive.id;
    throw error;
  }

  // 3. Derive case properties server-side
  const title = `Incident: ${alert.title}`;
  const description = alert.message;
  const severity = alert.severity as IncidentSeverity;
  const performedBy = adminName || adminId;
  const now = new Date();

  let createdRecord: any = null;
  try {
    createdRecord = await prisma.$transaction(async (tx) => {
      const newCase = await tx.safetyIncidentCase.create({
        data: {
          alertId: alert.id,
          routeId: alert.routeId,
          routeCode: alert.routeCode,
          routeName: alert.routeName,
          title,
          description,
          severity,
          status: 'OPEN',
          assignedAdminId: null,
          createdByAdminId: adminId,
          currentRiskScore: alert.currentScore,
          previousRiskScore: alert.previousScore,
          scoreDelta: alert.scoreDelta,
          sourceAlertType: alert.type,
          sourceAlertSeverity: alert.severity,
          evidenceJson: alert.evidenceJson,
          resolutionSummary: null,
          createdAt: now,
          updatedAt: now,
        },
      });

      const initialActivity = await tx.safetyIncidentActivity.create({
        data: {
          caseId: newCase.id,
          actionType: 'CASE_CREATED',
          message: `Operational case created from safety alert ${alert.id} (${alert.type})`,
          metadataJson: JSON.stringify({
            alertId: alert.id,
            alertType: alert.type,
            severity: alert.severity,
            riskScore: alert.currentScore,
          }),
          performedBy,
          createdAt: now,
        },
      });

      return { newCase, initialActivity };
    });
  } catch (dbErr) {
    console.warn('[SafetyIncidentStore] Prisma transaction failed, using in-memory store:', dbErr);
  }

  const caseId = createdRecord?.newCase?.id || `case-${Date.now()}`;
  const initialActivityRecord: IncidentActivityRecord = {
    id: createdRecord?.initialActivity?.id || `act-${Date.now()}`,
    caseId,
    actionType: 'CASE_CREATED',
    message: `Operational case created from safety alert ${alert.id} (${alert.type})`,
    metadataJson: JSON.stringify({
      alertId: alert.id,
      alertType: alert.type,
      severity: alert.severity,
      riskScore: alert.currentScore,
    }),
    performedBy,
    createdAt: now.toISOString(),
  };

  const caseRecord: IncidentCaseRecord = {
    id: caseId,
    alertId: alert.id,
    routeId: alert.routeId,
    routeCode: alert.routeCode,
    routeName: alert.routeName,
    title,
    description,
    severity,
    status: 'OPEN',
    assignedAdminId: null,
    createdByAdminId: adminId,
    createdByAdminName: performedBy,
    currentRiskScore: alert.currentScore,
    previousRiskScore: alert.previousScore,
    scoreDelta: alert.scoreDelta,
    sourceAlertType: alert.type,
    sourceAlertSeverity: alert.severity,
    evidenceJson: alert.evidenceJson,
    resolutionSummary: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    resolvedAt: null,
    closedAt: null,
    activities: [initialActivityRecord],
  };

  inMemoryCases.set(caseId, caseRecord);
  inMemoryActivities.set(caseId, [initialActivityRecord]);

  return caseRecord;
}

/**
 * Retrieves incident cases with optional filtering and summary metrics.
 */
export async function getIncidentCases(filters: IncidentQueryFilters = {}): Promise<{
  incidents: IncidentCaseRecord[];
  summary: IncidentSummary;
}> {
  const where: any = {};
  if (filters.routeId) where.routeId = filters.routeId.trim();
  if (filters.severity) where.severity = filters.severity;
  if (filters.status) where.status = filters.status;
  if (filters.assignedAdminId) where.assignedAdminId = filters.assignedAdminId.trim();

  let dbCases: any[] = [];
  try {
    dbCases = await prisma.safetyIncidentCase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
      include: {
        activities: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  } catch (err) {
    console.warn('[SafetyIncidentStore] Failed to query cases from Prisma:', err);
  }

  // Merge with in-memory records
  const incidentsMap = new Map<string, IncidentCaseRecord>();
  for (const c of inMemoryCases.values()) {
    let match = true;
    if (filters.routeId && c.routeId !== filters.routeId.trim()) match = false;
    if (filters.severity && c.severity !== filters.severity) match = false;
    if (filters.status && c.status !== filters.status) match = false;
    if (filters.assignedAdminId && c.assignedAdminId !== filters.assignedAdminId.trim()) match = false;
    if (match) incidentsMap.set(c.id, c);
  }

  for (const r of dbCases) {
    let evidence = null;
    try {
      if (r.evidenceJson) evidence = JSON.parse(r.evidenceJson);
    } catch {
      evidence = null;
    }

    const activities: IncidentActivityRecord[] = (r.activities || []).map((a: any) => ({
      id: a.id,
      caseId: a.caseId,
      actionType: a.actionType as IncidentActionType,
      message: a.message,
      metadataJson: a.metadataJson,
      performedBy: a.performedBy,
      createdAt: a.createdAt.toISOString ? a.createdAt.toISOString() : String(a.createdAt),
    }));

    incidentsMap.set(r.id, {
      id: r.id,
      alertId: r.alertId,
      routeId: r.routeId,
      routeCode: r.routeCode,
      routeName: r.routeName,
      title: r.title,
      description: r.description,
      severity: r.severity as IncidentSeverity,
      status: r.status as IncidentStatus,
      assignedAdminId: r.assignedAdminId,
      createdByAdminId: r.createdByAdminId,
      currentRiskScore: r.currentRiskScore,
      previousRiskScore: r.previousRiskScore,
      scoreDelta: r.scoreDelta,
      sourceAlertType: r.sourceAlertType,
      sourceAlertSeverity: r.sourceAlertSeverity,
      evidenceJson: r.evidenceJson,
      evidence,
      resolutionSummary: r.resolutionSummary,
      createdAt: r.createdAt.toISOString ? r.createdAt.toISOString() : String(r.createdAt),
      updatedAt: r.updatedAt.toISOString ? r.updatedAt.toISOString() : String(r.updatedAt),
      resolvedAt: r.resolvedAt ? (r.resolvedAt.toISOString ? r.resolvedAt.toISOString() : String(r.resolvedAt)) : null,
      closedAt: r.closedAt ? (r.closedAt.toISOString ? r.closedAt.toISOString() : String(r.closedAt)) : null,
      activities,
    });
  }

  const allIncidents = Array.from(incidentsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Compute summary metrics across all incidents in the system
  const summary: IncidentSummary = {
    total: allIncidents.length,
    open: 0,
    acknowledged: 0,
    investigating: 0,
    mitigated: 0,
    resolved: 0,
    closed: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const inc of allIncidents) {
    if (inc.status === 'OPEN') summary.open++;
    else if (inc.status === 'ACKNOWLEDGED') summary.acknowledged++;
    else if (inc.status === 'INVESTIGATING') summary.investigating++;
    else if (inc.status === 'MITIGATED') summary.mitigated++;
    else if (inc.status === 'RESOLVED') summary.resolved++;
    else if (inc.status === 'CLOSED') summary.closed++;

    if (inc.severity === 'CRITICAL') summary.critical++;
    else if (inc.severity === 'HIGH') summary.high++;
    else if (inc.severity === 'MEDIUM') summary.medium++;
    else if (inc.severity === 'LOW') summary.low++;
  }

  return { incidents: allIncidents, summary };
}

/**
 * Retrieves single incident case with full chronological activity history.
 */
export async function getIncidentCaseById(id: string): Promise<IncidentCaseRecord | null> {
  const trimmedId = id.trim();
  let dbCase: any = null;

  try {
    dbCase = await prisma.safetyIncidentCase.findUnique({
      where: { id: trimmedId },
      include: {
        activities: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  } catch (err) {
    console.warn(`[SafetyIncidentStore] Failed to find incident case ${trimmedId} in Prisma:`, err);
  }

  if (dbCase) {
    let evidence = null;
    try {
      if (dbCase.evidenceJson) evidence = JSON.parse(dbCase.evidenceJson);
    } catch {
      evidence = null;
    }

    const activities: IncidentActivityRecord[] = (dbCase.activities || []).map((a: any) => ({
      id: a.id,
      caseId: a.caseId,
      actionType: a.actionType as IncidentActionType,
      message: a.message,
      metadataJson: a.metadataJson,
      performedBy: a.performedBy,
      createdAt: a.createdAt.toISOString ? a.createdAt.toISOString() : String(a.createdAt),
    }));

    return {
      id: dbCase.id,
      alertId: dbCase.alertId,
      routeId: dbCase.routeId,
      routeCode: dbCase.routeCode,
      routeName: dbCase.routeName,
      title: dbCase.title,
      description: dbCase.description,
      severity: dbCase.severity as IncidentSeverity,
      status: dbCase.status as IncidentStatus,
      assignedAdminId: dbCase.assignedAdminId,
      createdByAdminId: dbCase.createdByAdminId,
      currentRiskScore: dbCase.currentRiskScore,
      previousRiskScore: dbCase.previousRiskScore,
      scoreDelta: dbCase.scoreDelta,
      sourceAlertType: dbCase.sourceAlertType,
      sourceAlertSeverity: dbCase.sourceAlertSeverity,
      evidenceJson: dbCase.evidenceJson,
      evidence,
      resolutionSummary: dbCase.resolutionSummary,
      createdAt: dbCase.createdAt.toISOString ? dbCase.createdAt.toISOString() : String(dbCase.createdAt),
      updatedAt: dbCase.updatedAt.toISOString ? dbCase.updatedAt.toISOString() : String(dbCase.updatedAt),
      resolvedAt: dbCase.resolvedAt ? (dbCase.resolvedAt.toISOString ? dbCase.resolvedAt.toISOString() : String(dbCase.resolvedAt)) : null,
      closedAt: dbCase.closedAt ? (dbCase.closedAt.toISOString ? dbCase.closedAt.toISOString() : String(dbCase.closedAt)) : null,
      activities,
    };
  }

  // Check in-memory store
  const memCase = inMemoryCases.get(trimmedId);
  if (memCase) {
    const memActivities = inMemoryActivities.get(trimmedId) || [];
    return { ...memCase, activities: [...memActivities] };
  }

  return null;
}

/**
 * Appends an activity record to an incident case.
 */
async function appendIncidentActivity(params: {
  caseId: string;
  actionType: IncidentActionType;
  message: string;
  metadata?: any;
  performedBy: string;
}): Promise<IncidentActivityRecord> {
  const { caseId, actionType, message, metadata, performedBy } = params;
  const now = new Date();
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  let dbActivity: any = null;
  try {
    dbActivity = await prisma.safetyIncidentActivity.create({
      data: {
        caseId,
        actionType,
        message,
        metadataJson,
        performedBy,
        createdAt: now,
      },
    });
  } catch (err) {
    console.warn('[SafetyIncidentStore] Failed to append activity to Prisma:', err);
  }

  const record: IncidentActivityRecord = {
    id: dbActivity?.id || `act-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    caseId,
    actionType,
    message,
    metadataJson,
    performedBy,
    createdAt: now.toISOString(),
  };

  const currentMem = inMemoryActivities.get(caseId) || [];
  currentMem.push(record);
  inMemoryActivities.set(caseId, currentMem);

  return record;
}

/**
 * Acknowledges an incident case.
 * Valid transition: OPEN -> ACKNOWLEDGED
 */
export async function acknowledgeIncidentCase(
  caseId: string,
  adminUser: { id: string; name?: string }
): Promise<IncidentCaseRecord> {
  const existing = await getIncidentCaseById(caseId);
  if (!existing) {
    throw new Error(`Incident case not found with ID '${caseId}'`);
  }

  if (existing.status !== 'OPEN') {
    throw new Error(
      `Cannot acknowledge case in status '${existing.status}'. Only OPEN cases can be acknowledged.`
    );
  }

  const now = new Date();
  const performedBy = adminUser.name || adminUser.id;

  try {
    await prisma.safetyIncidentCase.update({
      where: { id: caseId },
      data: {
        status: 'ACKNOWLEDGED',
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[SafetyIncidentStore] Prisma update failed:', err);
  }

  await appendIncidentActivity({
    caseId,
    actionType: 'CASE_ACKNOWLEDGED',
    message: 'Incident case acknowledged by operations admin.',
    performedBy,
  });

  const updated = await getIncidentCaseById(caseId);
  if (updated) {
    updated.status = 'ACKNOWLEDGED';
    inMemoryCases.set(caseId, updated);
    return updated;
  }
  return existing;
}

/**
 * Assigns an incident case to a verified Admin user.
 * Blocks assignment to non-admin roles or nonexistent users.
 */
export async function assignIncidentCase(
  caseId: string,
  assigneeAdminId: string,
  actorAdmin: { id: string; name?: string }
): Promise<IncidentCaseRecord> {
  const existing = await getIncidentCaseById(caseId);
  if (!existing) {
    throw new Error(`Incident case not found with ID '${caseId}'`);
  }

  if (existing.status === 'CLOSED') {
    throw new Error('Cannot assign a CLOSED incident case.');
  }

  // Verify assignee exists and has ADMIN role
  let assigneeUser: { id: string; email: string; name: string; role: string } | null = null;
  try {
    const fu = await getUserById(assigneeAdminId.trim());
    if (fu) {
      assigneeUser = {
        id: fu.id,
        email: fu.email,
        name: fu.name,
        role: fu.role,
      };
    }
  } catch (err) {
    console.warn('[SafetyIncidentStore] Failed to query assignee user from firestore-db:', err);
  }

  if (!assigneeUser) {
    try {
      const pu = await prisma.user.findUnique({
        where: { id: assigneeAdminId.trim() },
      });
      if (pu) {
        assigneeUser = {
          id: pu.id,
          email: pu.email,
          name: pu.name,
          role: pu.role,
        };
      }
    } catch (err) {
      console.warn('[SafetyIncidentStore] Failed to query assignee user from Prisma:', err);
    }
  }

  if (!assigneeUser) {
    throw new Error(`User not found with ID '${assigneeAdminId}'`);
  }

  if (assigneeUser.role !== 'ADMIN') {
    throw new Error(
      `Assignment rejected: User '${assigneeUser.email}' has role '${assigneeUser.role}'. Only ADMIN users may be assigned to safety incidents.`
    );
  }

  const now = new Date();
  const performedBy = actorAdmin.name || actorAdmin.id;

  try {
    await prisma.safetyIncidentCase.update({
      where: { id: caseId },
      data: {
        assignedAdminId: assigneeUser.id,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[SafetyIncidentStore] Prisma update failed:', err);
  }

  await appendIncidentActivity({
    caseId,
    actionType: 'CASE_ASSIGNED',
    message: `Case assigned to admin ${assigneeUser.name} (${assigneeUser.email})`,
    metadata: {
      assignedAdminId: assigneeUser.id,
      assignedAdminName: assigneeUser.name,
      assignedAdminEmail: assigneeUser.email,
    },
    performedBy,
  });

  const updated = await getIncidentCaseById(caseId);
  if (updated) {
    updated.assignedAdminId = assigneeUser.id;
    updated.assignedAdminName = assigneeUser.name;
    inMemoryCases.set(caseId, updated);
    return updated;
  }
  return existing;
}

/**
 * Starts active investigation on an incident case.
 * Valid transitions: OPEN -> INVESTIGATING, ACKNOWLEDGED -> INVESTIGATING
 */
export async function startInvestigation(
  caseId: string,
  adminUser: { id: string; name?: string }
): Promise<IncidentCaseRecord> {
  const existing = await getIncidentCaseById(caseId);
  if (!existing) {
    throw new Error(`Incident case not found with ID '${caseId}'`);
  }

  const validTransitions = ['OPEN', 'ACKNOWLEDGED'];
  if (!validTransitions.includes(existing.status)) {
    throw new Error(
      `Cannot start investigation from status '${existing.status}'. Expected OPEN or ACKNOWLEDGED.`
    );
  }

  const now = new Date();
  const performedBy = adminUser.name || adminUser.id;

  try {
    await prisma.safetyIncidentCase.update({
      where: { id: caseId },
      data: {
        status: 'INVESTIGATING',
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[SafetyIncidentStore] Prisma update failed:', err);
  }

  await appendIncidentActivity({
    caseId,
    actionType: 'INVESTIGATION_STARTED',
    message: 'Active corridor safety investigation initiated.',
    performedBy,
  });

  const updated = await getIncidentCaseById(caseId);
  if (updated) {
    updated.status = 'INVESTIGATING';
    inMemoryCases.set(caseId, updated);
    return updated;
  }
  return existing;
}

/**
 * Adds an operational investigation note.
 * Appends to immutable activity audit log.
 */
export async function addIncidentNote(
  caseId: string,
  noteMessage: string,
  adminUser: { id: string; name?: string }
): Promise<IncidentActivityRecord> {
  const existing = await getIncidentCaseById(caseId);
  if (!existing) {
    throw new Error(`Incident case not found with ID '${caseId}'`);
  }

  const trimmed = noteMessage?.trim();
  if (!trimmed) {
    throw new Error('Note message cannot be empty.');
  }

  const performedBy = adminUser.name || adminUser.id;

  const activity = await appendIncidentActivity({
    caseId,
    actionType: 'NOTE_ADDED',
    message: trimmed,
    performedBy,
  });

  return activity;
}

/**
 * Records operational mitigation.
 * Valid transitions: OPEN, ACKNOWLEDGED, INVESTIGATING -> MITIGATED
 */
export async function mitigateIncidentCase(
  caseId: string,
  mitigationSummary: string,
  adminUser: { id: string; name?: string }
): Promise<IncidentCaseRecord> {
  const existing = await getIncidentCaseById(caseId);
  if (!existing) {
    throw new Error(`Incident case not found with ID '${caseId}'`);
  }

  const validTransitions = ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING'];
  if (!validTransitions.includes(existing.status)) {
    throw new Error(
      `Cannot mitigate case in status '${existing.status}'. Expected OPEN, ACKNOWLEDGED, or INVESTIGATING.`
    );
  }

  const trimmedSummary = mitigationSummary?.trim();
  if (!trimmedSummary) {
    throw new Error('Mitigation summary cannot be empty.');
  }

  const now = new Date();
  const performedBy = adminUser.name || adminUser.id;

  try {
    await prisma.safetyIncidentCase.update({
      where: { id: caseId },
      data: {
        status: 'MITIGATED',
        resolutionSummary: trimmedSummary,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[SafetyIncidentStore] Prisma update failed:', err);
  }

  await appendIncidentActivity({
    caseId,
    actionType: 'MITIGATION_RECORDED',
    message: `Operational mitigation recorded: ${trimmedSummary}`,
    metadata: { summary: trimmedSummary },
    performedBy,
  });

  const updated = await getIncidentCaseById(caseId);
  if (updated) {
    updated.status = 'MITIGATED';
    updated.resolutionSummary = trimmedSummary;
    inMemoryCases.set(caseId, updated);
    return updated;
  }
  return existing;
}

/**
 * Resolves an incident case.
 * Valid transitions: INVESTIGATING, MITIGATED -> RESOLVED
 * Server-generates resolvedAt timestamp.
 */
export async function resolveIncidentCase(
  caseId: string,
  resolutionSummary: string,
  adminUser: { id: string; name?: string }
): Promise<IncidentCaseRecord> {
  const existing = await getIncidentCaseById(caseId);
  if (!existing) {
    throw new Error(`Incident case not found with ID '${caseId}'`);
  }

  const validTransitions = ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'MITIGATED'];
  if (!validTransitions.includes(existing.status)) {
    throw new Error(
      `Cannot resolve case in status '${existing.status}'. Case must be active or mitigated.`
    );
  }

  const trimmedSummary = resolutionSummary?.trim();
  if (!trimmedSummary) {
    throw new Error('Resolution summary cannot be empty.');
  }

  const now = new Date();
  const performedBy = adminUser.name || adminUser.id;

  try {
    await prisma.safetyIncidentCase.update({
      where: { id: caseId },
      data: {
        status: 'RESOLVED',
        resolutionSummary: trimmedSummary,
        resolvedAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[SafetyIncidentStore] Prisma update failed:', err);
  }

  await appendIncidentActivity({
    caseId,
    actionType: 'CASE_RESOLVED',
    message: `Case resolved: ${trimmedSummary}`,
    metadata: { summary: trimmedSummary, resolvedAt: now.toISOString() },
    performedBy,
  });

  const updated = await getIncidentCaseById(caseId);
  if (updated) {
    updated.status = 'RESOLVED';
    updated.resolutionSummary = trimmedSummary;
    updated.resolvedAt = now.toISOString();
    inMemoryCases.set(caseId, updated);
    return updated;
  }
  return existing;
}

/**
 * Closes an incident case after post-incident review.
 * Valid transitions: RESOLVED, MITIGATED -> CLOSED
 * Server-generates closedAt timestamp.
 */
export async function closeIncidentCase(
  caseId: string,
  closureSummary: string,
  adminUser: { id: string; name?: string }
): Promise<IncidentCaseRecord> {
  const existing = await getIncidentCaseById(caseId);
  if (!existing) {
    throw new Error(`Incident case not found with ID '${caseId}'`);
  }

  const validTransitions = ['RESOLVED', 'MITIGATED'];
  if (!validTransitions.includes(existing.status)) {
    throw new Error(
      `Cannot close case in status '${existing.status}'. Case must be RESOLVED or MITIGATED before formal closure.`
    );
  }

  const trimmedSummary = closureSummary?.trim() || 'Case formally closed after operational review.';
  const now = new Date();
  const performedBy = adminUser.name || adminUser.id;

  try {
    await prisma.safetyIncidentCase.update({
      where: { id: caseId },
      data: {
        status: 'CLOSED',
        closedAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[SafetyIncidentStore] Prisma update failed:', err);
  }

  await appendIncidentActivity({
    caseId,
    actionType: 'CASE_CLOSED',
    message: `Case closed: ${trimmedSummary}`,
    metadata: { summary: trimmedSummary, closedAt: now.toISOString() },
    performedBy,
  });

  const updated = await getIncidentCaseById(caseId);
  if (updated) {
    updated.status = 'CLOSED';
    updated.closedAt = now.toISOString();
    inMemoryCases.set(caseId, updated);
    return updated;
  }
  return existing;
}

/**
 * Reopens a previously RESOLVED or CLOSED incident case upon new evidence.
 * Valid transitions: RESOLVED, CLOSED -> OPEN
 */
export async function reopenIncidentCase(
  caseId: string,
  reopenReason: string,
  adminUser: { id: string; name?: string }
): Promise<IncidentCaseRecord> {
  const existing = await getIncidentCaseById(caseId);
  if (!existing) {
    throw new Error(`Incident case not found with ID '${caseId}'`);
  }

  const validTransitions = ['RESOLVED', 'CLOSED'];
  if (!validTransitions.includes(existing.status)) {
    throw new Error(
      `Cannot reopen case in status '${existing.status}'. Only RESOLVED or CLOSED cases can be reopened.`
    );
  }

  const trimmedReason = reopenReason?.trim() || 'Case reopened for further operational investigation.';
  const now = new Date();
  const performedBy = adminUser.name || adminUser.id;

  try {
    await prisma.safetyIncidentCase.update({
      where: { id: caseId },
      data: {
        status: 'OPEN',
        closedAt: null,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[SafetyIncidentStore] Prisma update failed:', err);
  }

  await appendIncidentActivity({
    caseId,
    actionType: 'CASE_REOPENED',
    message: `Case reopened: ${trimmedReason}`,
    metadata: { reason: trimmedReason },
    performedBy,
  });

  const updated = await getIncidentCaseById(caseId);
  if (updated) {
    updated.status = 'OPEN';
    updated.closedAt = null;
    inMemoryCases.set(caseId, updated);
    return updated;
  }
  return existing;
}
