/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — ROUTE RISK HISTORY & TREND ANALYSIS STORE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 2: Historical Route Risk Snapshot management and deterministic
 * descriptive trend analysis.
 *
 * Rules:
 * - Snapshots are immutable server-calculated points in time.
 * - Client cannot forge or override scores, levels, or metrics.
 * - Trend is strictly descriptive:
 *   - RISING: currentScore > previousScore
 *   - FALLING: currentScore < previousScore
 *   - STABLE: currentScore === previousScore
 *   - NO_HISTORY: < 2 snapshots available (never synthesize mock trends)
 * - Factor deltas explain the exact mathematical drivers behind trend changes.
 */

import prisma from '@/lib/prisma';
import {
  getRouteById,
  getRouteByCode,
  getDriverProfileById,
  getUserById,
  getVehicleById,
  FirestoreRoute,
  DEFAULT_CORRIDOR_ROUTES,
  setRoute,
} from '@/lib/firestore-db';
import { getOrCreateDefaultTrip } from '@/lib/firebase';
import {
  calculateRouteRiskScore,
  RouteRiskResult,
  RouteRiskLevel,
  RouteRiskFactor,
} from '@/lib/safety/route-risk-engine';

export interface RouteRiskSnapshot {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  riskScore: number;
  riskLevel: RouteRiskLevel;
  emergencyPoints: number;
  deviationPoints: number;
  speedPoints: number;
  stopGpsPoints: number;
  compliancePoints: number;
  complexityPoints: number;
  totalEvents: number;
  activeEmergencies: number;
  activeDeviations: number;
  activeSpeedAnomalies: number;
  stopGpsEvents: number;
  driverVerified: boolean;
  vehicleApproved: boolean;
  factors: RouteRiskFactor[];
  evaluatedAt: string; // ISO string
}

export type RouteRiskTrendDirection = 'RISING' | 'FALLING' | 'STABLE' | 'NO_HISTORY';

export interface FactorDeltas {
  emergencyPoints: number;
  deviationPoints: number;
  speedPoints: number;
  stopGpsPoints: number;
  compliancePoints: number;
  complexityPoints: number;
}

export interface RouteRiskTrendResult {
  trend: RouteRiskTrendDirection;
  currentScore: number | null;
  previousScore: number | null;
  scoreDelta: number | null;
  currentLevel: RouteRiskLevel | null;
  previousLevel: RouteRiskLevel | null;
  factorDeltas: FactorDeltas | null;
  summary: string;
}

// In-memory fallback snapshot store for zero-downtime resilience
const inMemorySnapshotStore: Map<string, RouteRiskSnapshot[]> = new Map();

/**
 * Extracts factor point components from RouteRiskResult factors array.
 */
function extractFactorPoints(factors: RouteRiskFactor[]): {
  emergencyPoints: number;
  deviationPoints: number;
  speedPoints: number;
  stopGpsPoints: number;
  compliancePoints: number;
  complexityPoints: number;
} {
  let emergencyPoints = 0;
  let deviationPoints = 0;
  let speedPoints = 0;
  let stopGpsPoints = 0;
  let compliancePoints = 0;
  let complexityPoints = 0;

  for (const f of factors) {
    const nameLower = f.name.toLowerCase();
    if (nameLower.includes('emergency') || nameLower.includes('sos')) {
      emergencyPoints += f.contribution;
    } else if (nameLower.includes('deviation')) {
      deviationPoints += f.contribution;
    } else if (nameLower.includes('speed')) {
      speedPoints += f.contribution;
    } else if (nameLower.includes('stationary') || nameLower.includes('gps') || nameLower.includes('telemetry') || nameLower.includes('stop')) {
      stopGpsPoints += f.contribution;
    } else if (nameLower.includes('driver') || nameLower.includes('vehicle') || nameLower.includes('compliance')) {
      compliancePoints += f.contribution;
    } else if (nameLower.includes('complexity')) {
      complexityPoints += f.contribution;
    }
  }

  return {
    emergencyPoints,
    deviationPoints,
    speedPoints,
    stopGpsPoints,
    compliancePoints,
    complexityPoints,
  };
}

/**
 * Server-side creation of a Route Risk Snapshot for a given route.
 * Strictly derives all risk scores and levels using calculateRouteRiskScore().
 */
export async function recordRouteRiskSnapshot(routeIdentifier: string): Promise<RouteRiskSnapshot> {
  const routeIdTrimmed = routeIdentifier.trim();
  if (!routeIdTrimmed) {
    throw new Error('Route identifier is required');
  }

  // 1. Resolve route entity
  let route: FirestoreRoute | null = (await getRouteById(routeIdTrimmed)) || (await getRouteByCode(routeIdTrimmed));

  if (!route) {
    // Check default corridor cache
    for (const defRoute of DEFAULT_CORRIDOR_ROUTES) {
      if (defRoute.id === routeIdTrimmed || defRoute.code.toLowerCase() === routeIdTrimmed.toLowerCase()) {
        await setRoute(defRoute);
        route = defRoute;
        break;
      }
    }
  }

  if (!route) {
    throw new Error(`Route not found with identifier '${routeIdentifier}'`);
  }

  // 2. Fetch safety events
  let allSafetyEvents: any[] = [];
  try {
    allSafetyEvents = await prisma.safetyEvent.findMany({
      orderBy: { detectedAt: 'desc' },
      take: 100,
    });
  } catch (e) {
    allSafetyEvents = [];
  }

  // 3. Retrieve driver & vehicle compliance state
  let driver = null;
  let driverUserName = 'Captain';
  if (route.assignedDriverId) {
    driver = await getDriverProfileById(route.assignedDriverId);
    if (driver) {
      const user = await getUserById(driver.userId);
      driverUserName = user?.name || 'Captain';
    }
  }

  const vehicle = route.assignedVehicleId
    ? await getVehicleById(route.assignedVehicleId)
    : null;

  const activeTrip = getOrCreateDefaultTrip();

  // 4. Calculate authoritative Route Risk Score (Step 1 engine)
  const riskResult: RouteRiskResult = calculateRouteRiskScore({
    route,
    events: allSafetyEvents,
    driver,
    driverUserName,
    vehicle,
    activeTrip: activeTrip?.routeCode === route.code || activeTrip?.routeId === route.id ? activeTrip : null,
  });

  const factorPoints = extractFactorPoints(riskResult.factors);
  const now = new Date();
  const snapshotId = `rrs_${route.id}_${now.getTime()}_${Math.random().toString(36).substring(7)}`;

  const snapshot: RouteRiskSnapshot = {
    id: snapshotId,
    routeId: route.id,
    routeCode: route.code,
    routeName: route.name,
    riskScore: riskResult.risk.score,
    riskLevel: riskResult.risk.level,
    emergencyPoints: factorPoints.emergencyPoints,
    deviationPoints: factorPoints.deviationPoints,
    speedPoints: factorPoints.speedPoints,
    stopGpsPoints: factorPoints.stopGpsPoints,
    compliancePoints: factorPoints.compliancePoints,
    complexityPoints: factorPoints.complexityPoints,
    totalEvents: riskResult.metrics.totalIncidents,
    activeEmergencies: riskResult.metrics.sosAlerts,
    activeDeviations: riskResult.metrics.routeDeviations,
    activeSpeedAnomalies: riskResult.metrics.speedAnomalies,
    stopGpsEvents: riskResult.metrics.stationaryLongStops + riskResult.metrics.gpsSignalLosses,
    driverVerified: Boolean(riskResult.route.assignedDriver?.isVerified),
    vehicleApproved: Boolean(riskResult.route.assignedVehicle?.isApproved),
    factors: riskResult.factors,
    evaluatedAt: now.toISOString(),
  };

  // 5. Persist to SQLite via Prisma
  try {
    await prisma.routeRiskSnapshot.create({
      data: {
        id: snapshot.id,
        routeId: snapshot.routeId,
        routeCode: snapshot.routeCode,
        routeName: snapshot.routeName,
        riskScore: snapshot.riskScore,
        riskLevel: snapshot.riskLevel,
        emergencyPoints: snapshot.emergencyPoints,
        deviationPoints: snapshot.deviationPoints,
        speedPoints: snapshot.speedPoints,
        stopGpsPoints: snapshot.stopGpsPoints,
        compliancePoints: snapshot.compliancePoints,
        complexityPoints: snapshot.complexityPoints,
        totalEvents: snapshot.totalEvents,
        activeEmergencies: snapshot.activeEmergencies,
        activeDeviations: snapshot.activeDeviations,
        activeSpeedAnomalies: snapshot.activeSpeedAnomalies,
        stopGpsEvents: snapshot.stopGpsEvents,
        driverVerified: snapshot.driverVerified,
        vehicleApproved: snapshot.vehicleApproved,
        factorsJson: JSON.stringify(snapshot.factors),
        metricsJson: JSON.stringify(riskResult.metrics),
        evaluatedAt: now,
      },
    });
  } catch (dbErr) {
    console.warn('[RouteRiskHistoryStore] Prisma create failed, falling back to in-memory store:', dbErr);
  }

  // 6. Persist to in-memory fallback store
  const existingList = inMemorySnapshotStore.get(route.id) || [];
  existingList.push(snapshot);
  inMemorySnapshotStore.set(route.id, existingList);

  return snapshot;
}

/**
 * Retrieves chronological historical snapshots for a specific route or fleet-wide.
 */
export async function getRouteRiskHistory(routeIdentifier?: string, limitCount = 50): Promise<RouteRiskSnapshot[]> {
  const dbSnapshots: RouteRiskSnapshot[] = [];

  // Query SQLite
  try {
    const whereClause: any = {};
    if (routeIdentifier) {
      const trimmed = routeIdentifier.trim();
      whereClause.OR = [
        { routeId: trimmed },
        { routeCode: { equals: trimmed } },
      ];
    }

    const records = await prisma.routeRiskSnapshot.findMany({
      where: whereClause,
      orderBy: { evaluatedAt: 'asc' },
      take: limitCount,
    });

    for (const r of records) {
      let factors: RouteRiskFactor[] = [];
      try {
        if (r.factorsJson) factors = JSON.parse(r.factorsJson);
      } catch {
        factors = [];
      }

      dbSnapshots.push({
        id: r.id,
        routeId: r.routeId,
        routeCode: r.routeCode,
        routeName: r.routeName,
        riskScore: r.riskScore,
        riskLevel: r.riskLevel as RouteRiskLevel,
        emergencyPoints: r.emergencyPoints,
        deviationPoints: r.deviationPoints,
        speedPoints: r.speedPoints,
        stopGpsPoints: r.stopGpsPoints,
        compliancePoints: r.compliancePoints,
        complexityPoints: r.complexityPoints,
        totalEvents: r.totalEvents,
        activeEmergencies: r.activeEmergencies,
        activeDeviations: r.activeDeviations,
        activeSpeedAnomalies: r.activeSpeedAnomalies,
        stopGpsEvents: r.stopGpsEvents,
        driverVerified: r.driverVerified,
        vehicleApproved: r.vehicleApproved,
        factors,
        evaluatedAt: r.evaluatedAt.toISOString(),
      });
    }
  } catch (err) {
    // In-memory fallback
  }

  // Merge with in-memory store if needed
  let merged: RouteRiskSnapshot[] = [...dbSnapshots];
  if (routeIdentifier) {
    const inMem = inMemorySnapshotStore.get(routeIdentifier.trim()) || [];
    for (const m of inMem) {
      if (!merged.some((s) => s.id === m.id)) {
        merged.push(m);
      }
    }
  } else {
    for (const [, list] of inMemorySnapshotStore) {
      for (const m of list) {
        if (!merged.some((s) => s.id === m.id)) {
          merged.push(m);
        }
      }
    }
  }

  // Sort strictly chronological ascending by evaluatedAt
  merged.sort((a, b) => new Date(a.evaluatedAt).getTime() - new Date(b.evaluatedAt).getTime());

  if (merged.length > limitCount) {
    merged = merged.slice(merged.length - limitCount);
  }

  return merged;
}

/**
 * Deterministic descriptive trend analysis from chronological snapshots.
 * Zero probabilistic or synthetic predictions.
 */
export function calculateRouteRiskTrend(snapshots: RouteRiskSnapshot[]): RouteRiskTrendResult {
  if (!snapshots || snapshots.length === 0) {
    return {
      trend: 'NO_HISTORY',
      currentScore: null,
      previousScore: null,
      scoreDelta: null,
      currentLevel: null,
      previousLevel: null,
      factorDeltas: null,
      summary: 'No historical risk snapshots recorded for this route corridor.',
    };
  }

  // Sort chronological ascending
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.evaluatedAt).getTime() - new Date(b.evaluatedAt).getTime()
  );

  if (sorted.length === 1) {
    const single = sorted[0];
    return {
      trend: 'NO_HISTORY',
      currentScore: single.riskScore,
      previousScore: null,
      scoreDelta: null,
      currentLevel: single.riskLevel,
      previousLevel: null,
      factorDeltas: null,
      summary: 'Insufficient history: A single baseline snapshot is recorded. At least 2 snapshots are required to evaluate safety trends.',
    };
  }

  const current = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const scoreDelta = current.riskScore - previous.riskScore;

  let trend: RouteRiskTrendDirection = 'STABLE';
  if (scoreDelta > 0) {
    trend = 'RISING';
  } else if (scoreDelta < 0) {
    trend = 'FALLING';
  }

  const factorDeltas: FactorDeltas = {
    emergencyPoints: current.emergencyPoints - previous.emergencyPoints,
    deviationPoints: current.deviationPoints - previous.deviationPoints,
    speedPoints: current.speedPoints - previous.speedPoints,
    stopGpsPoints: current.stopGpsPoints - previous.stopGpsPoints,
    compliancePoints: current.compliancePoints - previous.compliancePoints,
    complexityPoints: current.complexityPoints - previous.complexityPoints,
  };

  // Build descriptive summary
  const driverChanges: string[] = [];
  if (factorDeltas.deviationPoints > 0) driverChanges.push(`route deviations (+${factorDeltas.deviationPoints} pts)`);
  if (factorDeltas.deviationPoints < 0) driverChanges.push(`resolved deviations (${factorDeltas.deviationPoints} pts)`);
  if (factorDeltas.speedPoints > 0) driverChanges.push(`velocity violations (+${factorDeltas.speedPoints} pts)`);
  if (factorDeltas.speedPoints < 0) driverChanges.push(`normalized speeds (${factorDeltas.speedPoints} pts)`);
  if (factorDeltas.emergencyPoints > 0) driverChanges.push(`emergency alerts (+${factorDeltas.emergencyPoints} pts)`);
  if (factorDeltas.emergencyPoints < 0) driverChanges.push(`resolved emergencies (${factorDeltas.emergencyPoints} pts)`);
  if (factorDeltas.compliancePoints > 0) driverChanges.push(`compliance discrepancies (+${factorDeltas.compliancePoints} pts)`);
  if (factorDeltas.compliancePoints < 0) driverChanges.push(`compliance approvals (${factorDeltas.compliancePoints} pts)`);

  let summary = `Risk score remained stable at ${current.riskScore} (${current.riskLevel}).`;
  if (trend === 'RISING') {
    summary = `Risk score rose from ${previous.riskScore} to ${current.riskScore} (+${scoreDelta} pts, ${current.riskLevel}). Primary drivers: ${driverChanges.length > 0 ? driverChanges.join(', ') : 'operational metrics variance'}.`;
  } else if (trend === 'FALLING') {
    summary = `Risk score improved from ${previous.riskScore} to ${current.riskScore} (${scoreDelta} pts, ${current.riskLevel}). Primary factors: ${driverChanges.length > 0 ? driverChanges.join(', ') : 'corridor stabilization'}.`;
  }

  return {
    trend,
    currentScore: current.riskScore,
    previousScore: previous.riskScore,
    scoreDelta,
    currentLevel: current.riskLevel,
    previousLevel: previous.riskLevel,
    factorDeltas,
    summary,
  };
}
