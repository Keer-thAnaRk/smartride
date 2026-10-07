/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — SAFETY ALERT PERSISTENCE & DEDUPLICATION STORE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 3: Persistence, retrieval, deduplication, and resolution lifecycle
 * for operational safety alerts.
 *
 * Rules:
 * - Dual-layer persistence: SQLite via Prisma + in-memory store fallback.
 * - Strict deterministic deduplication to avoid alert storms.
 * - Anti-forgery: all alert fields are strictly generated server-side.
 * - Admin-only resolution lifecycle.
 */

import prisma from '@/lib/prisma';
import {
  getRouteById,
  getRouteByCode,
  DEFAULT_CORRIDOR_ROUTES,
} from '@/lib/firestore-db';
import {
  recordRouteRiskSnapshot,
  getRouteRiskHistory,
  RouteRiskSnapshot,
} from '@/lib/safety/route-risk-history-store';
import {
  evaluateRouteSafetyAlerts,
  EvaluatedAlert,
  SafetyAlertSeverity,
  SafetyAlertType,
} from '@/lib/safety/safety-alert-engine';

export interface SafetyAlertRecord {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  type: SafetyAlertType;
  severity: SafetyAlertSeverity;
  title: string;
  message: string;
  currentScore: number;
  previousScore: number | null;
  scoreDelta: number | null;
  evidence: Record<string, any>;
  status: 'ACTIVE' | 'RESOLVED';
  dedupKey: string;
  triggeredAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyAlertsSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  active: number;
  resolved: number;
}

export interface SafetyAlertFilter {
  routeId?: string;
  severity?: string;
  status?: string;
  limit?: number;
}

// In-memory fallback alert store for zero-downtime database resilience
const inMemoryAlertStore: Map<string, SafetyAlertRecord> = new Map();

/**
 * Creates and persists a safety alert to SQLite and in-memory store.
 */
export async function createSafetyAlert(evaluated: EvaluatedAlert): Promise<SafetyAlertRecord> {
  const now = new Date();
  const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const record: SafetyAlertRecord = {
    id,
    routeId: evaluated.routeId,
    routeCode: evaluated.routeCode,
    routeName: evaluated.routeName,
    type: evaluated.type,
    severity: evaluated.severity,
    title: evaluated.title,
    message: evaluated.message,
    currentScore: evaluated.currentScore,
    previousScore: evaluated.previousScore ?? null,
    scoreDelta: evaluated.scoreDelta ?? null,
    evidence: evaluated.evidence,
    status: 'ACTIVE',
    dedupKey: evaluated.dedupKey,
    triggeredAt: evaluated.triggeredAt || now.toISOString(),
    resolvedAt: null,
    resolvedBy: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // 1. Persist to SQLite
  try {
    const created = await prisma.safetyAlert.create({
      data: {
        id: record.id,
        routeId: record.routeId,
        routeCode: record.routeCode,
        routeName: record.routeName,
        type: record.type,
        severity: record.severity,
        title: record.title,
        message: record.message,
        currentScore: record.currentScore,
        previousScore: record.previousScore,
        scoreDelta: record.scoreDelta,
        evidenceJson: JSON.stringify(record.evidence),
        status: record.status,
        dedupKey: record.dedupKey,
        triggeredAt: new Date(record.triggeredAt),
        createdAt: now,
        updatedAt: now,
      },
    });
    record.id = created.id;
  } catch (err) {
    console.warn('[SafetyAlertStore] Prisma create failed, falling back to in-memory store:', err);
  }

  // 2. Persist to in-memory cache
  inMemoryAlertStore.set(record.id, record);

  return record;
}

/**
 * Retrieves safety alerts matching optional filters (routeId, severity, status, limit).
 */
export async function getSafetyAlerts(filter: SafetyAlertFilter = {}): Promise<SafetyAlertRecord[]> {
  const dbRecords: SafetyAlertRecord[] = [];

  try {
    const where: any = {};
    if (filter.routeId) {
      const trimmed = filter.routeId.trim();
      where.OR = [
        { routeId: trimmed },
        { routeCode: { equals: trimmed } },
      ];
    }
    if (filter.severity) {
      where.severity = filter.severity.toUpperCase().trim();
    }
    if (filter.status) {
      where.status = filter.status.toUpperCase().trim();
    }

    const takeLimit = filter.limit && filter.limit > 0 ? Math.min(filter.limit, 200) : 100;

    const rows = await prisma.safetyAlert.findMany({
      where,
      orderBy: { triggeredAt: 'desc' },
      take: takeLimit,
    });

    for (const r of rows) {
      let evidence = {};
      try {
        if (r.evidenceJson) evidence = JSON.parse(r.evidenceJson);
      } catch {
        evidence = {};
      }

      dbRecords.push({
        id: r.id,
        routeId: r.routeId,
        routeCode: r.routeCode,
        routeName: r.routeName,
        type: r.type as SafetyAlertType,
        severity: r.severity as SafetyAlertSeverity,
        title: r.title,
        message: r.message,
        currentScore: r.currentScore,
        previousScore: r.previousScore,
        scoreDelta: r.scoreDelta,
        evidence,
        status: r.status as 'ACTIVE' | 'RESOLVED',
        dedupKey: r.dedupKey || '',
        triggeredAt: r.triggeredAt.toISOString(),
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
        resolvedBy: r.resolvedBy,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      });
    }
  } catch (err) {
    // In-memory fallback
  }

  // Merge with in-memory records
  const merged: SafetyAlertRecord[] = [...dbRecords];
  for (const [, mem] of inMemoryAlertStore) {
    if (!merged.some((a) => a.id === mem.id)) {
      let matches = true;
      if (filter.routeId) {
        const tr = filter.routeId.trim().toLowerCase();
        if (mem.routeId.toLowerCase() !== tr && mem.routeCode.toLowerCase() !== tr) {
          matches = false;
        }
      }
      if (filter.severity && mem.severity.toUpperCase() !== filter.severity.toUpperCase().trim()) {
        matches = false;
      }
      if (filter.status && mem.status.toUpperCase() !== filter.status.toUpperCase().trim()) {
        matches = false;
      }

      if (matches) {
        merged.push(mem);
      }
    }
  }

  // Sort descending by triggeredAt
  merged.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());

  if (filter.limit && filter.limit > 0) {
    return merged.slice(0, filter.limit);
  }

  return merged;
}

/**
 * Retrieves a single safety alert by its unique ID.
 */
export async function getSafetyAlertById(id: string): Promise<SafetyAlertRecord | null> {
  const trimmed = id.trim();

  // Try DB
  try {
    const r = await prisma.safetyAlert.findUnique({
      where: { id: trimmed },
    });
    if (r) {
      let evidence = {};
      try {
        if (r.evidenceJson) evidence = JSON.parse(r.evidenceJson);
      } catch {
        evidence = {};
      }
      return {
        id: r.id,
        routeId: r.routeId,
        routeCode: r.routeCode,
        routeName: r.routeName,
        type: r.type as SafetyAlertType,
        severity: r.severity as SafetyAlertSeverity,
        title: r.title,
        message: r.message,
        currentScore: r.currentScore,
        previousScore: r.previousScore,
        scoreDelta: r.scoreDelta,
        evidence,
        status: r.status as 'ACTIVE' | 'RESOLVED',
        dedupKey: r.dedupKey || '',
        triggeredAt: r.triggeredAt.toISOString(),
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
        resolvedBy: r.resolvedBy,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    }
  } catch (err) {
    // In-memory fallback
  }

  return inMemoryAlertStore.get(trimmed) || null;
}

/**
 * Resolves an active safety alert.
 */
export async function resolveSafetyAlert(
  id: string,
  resolvedBy: string = 'System Admin'
): Promise<SafetyAlertRecord | null> {
  const alert = await getSafetyAlertById(id);
  if (!alert) {
    return null;
  }

  const now = new Date();
  alert.status = 'RESOLVED';
  alert.resolvedAt = now.toISOString();
  alert.resolvedBy = resolvedBy;
  alert.updatedAt = now.toISOString();

  // Update DB
  try {
    await prisma.safetyAlert.update({
      where: { id: alert.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: now,
        resolvedBy,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.warn('[SafetyAlertStore] Prisma update failed on resolve, using in-memory store:', err);
  }

  // Update in-memory store
  inMemoryAlertStore.set(alert.id, alert);

  return alert;
}

/**
 * Computes platform-wide or corridor-filtered KPI summary of safety alerts.
 */
export async function getSafetyAlertsSummary(routeId?: string): Promise<SafetyAlertsSummary> {
  const allAlerts = await getSafetyAlerts({ routeId, limit: 1000 });

  const summary: SafetyAlertsSummary = {
    total: allAlerts.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    active: 0,
    resolved: 0,
  };

  for (const a of allAlerts) {
    if (a.severity === 'CRITICAL') summary.critical++;
    else if (a.severity === 'HIGH') summary.high++;
    else if (a.severity === 'MEDIUM') summary.medium++;
    else if (a.severity === 'LOW') summary.low++;

    if (a.status === 'ACTIVE') summary.active++;
    else if (a.status === 'RESOLVED') summary.resolved++;
  }

  return summary;
}

/**
 * Checks whether an alert condition is already active or recorded.
 * Deduplicates by:
 * 1. Exact dedupKey match.
 * 2. Already ACTIVE alert of same routeId + type (avoids duplicate open tickets).
 */
export async function isDuplicateAlert(evaluated: EvaluatedAlert): Promise<boolean> {
  // 1. Check exact dedupKey in DB
  try {
    const existing = await prisma.safetyAlert.findFirst({
      where: { dedupKey: evaluated.dedupKey },
    });
    if (existing) {
      return true;
    }
  } catch (err) {
    // In-memory fallback check
  }

  for (const [, mem] of inMemoryAlertStore) {
    if (mem.dedupKey === evaluated.dedupKey) {
      return true;
    }
  }

  // 2. Check if an ACTIVE alert for this routeId and alertType already exists
  try {
    const activeSameType = await prisma.safetyAlert.findFirst({
      where: {
        routeId: evaluated.routeId,
        type: evaluated.type,
        status: 'ACTIVE',
      },
    });
    if (activeSameType) {
      return true;
    }
  } catch (err) {
    // In-memory fallback
  }

  for (const [, mem] of inMemoryAlertStore) {
    if (mem.routeId === evaluated.routeId && mem.type === evaluated.type && mem.status === 'ACTIVE') {
      return true;
    }
  }

  return false;
}

/**
 * High-level orchestration function:
 * 1. Validates and finds route.
 * 2. Fetches historical snapshots. If none exist, records an initial baseline.
 * 3. Identifies current and previous snapshot.
 * 4. Runs deterministic alert evaluation.
 * 5. Deduplicates and persists new alerts.
 * 6. Returns generated alerts, all route alerts, and summary.
 */
export async function evaluateAndRecordRouteAlerts(routeIdentifier: string): Promise<{
  route: { id: string; code: string; name: string };
  generatedAlerts: SafetyAlertRecord[];
  allAlerts: SafetyAlertRecord[];
  summary: SafetyAlertsSummary;
}> {
  const routeIdTrimmed = routeIdentifier.trim();
  if (!routeIdTrimmed) {
    throw new Error('Route identifier is required');
  }

  let route = (await getRouteById(routeIdTrimmed)) || (await getRouteByCode(routeIdTrimmed));
  if (!route) {
    for (const def of DEFAULT_CORRIDOR_ROUTES) {
      if (def.id === routeIdTrimmed || def.code.toLowerCase() === routeIdTrimmed.toLowerCase()) {
        route = def;
        break;
      }
    }
  }

  if (!route) {
    throw new Error(`Route not found with identifier '${routeIdTrimmed}'`);
  }

  // Retrieve historical snapshots for this corridor
  let snapshots = await getRouteRiskHistory(route.id, 50);

  // If no snapshots exist yet, record an initial snapshot
  if (snapshots.length === 0) {
    const initialSnap = await recordRouteRiskSnapshot(route.id);
    snapshots = [initialSnap];
  }

  const currentSnapshot = snapshots[snapshots.length - 1];
  const previousSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  // Run deterministic alert evaluation
  const evaluatedAlerts = evaluateRouteSafetyAlerts(currentSnapshot, previousSnapshot);

  const generatedAlerts: SafetyAlertRecord[] = [];

  for (const ev of evaluatedAlerts) {
    const isDup = await isDuplicateAlert(ev);
    if (!isDup) {
      const saved = await createSafetyAlert(ev);
      generatedAlerts.push(saved);
    }
  }

  const allAlerts = await getSafetyAlerts({ routeId: route.id });
  const summary = await getSafetyAlertsSummary(route.id);

  return {
    route: {
      id: route.id,
      code: route.code,
      name: route.name,
    },
    generatedAlerts,
    allAlerts,
    summary,
  };
}
