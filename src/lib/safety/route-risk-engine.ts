/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — ROUTE RISK SCORING ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 1: Deterministic, explainable Route Risk Score calculation.
 * 
 * Rules:
 * - Scale: 0 to 100 (Higher score = higher risk).
 * - Thresholds:
 *   -  0–24:  LOW (Optimal operational safety baseline)
 *   - 25–49:  MEDIUM (Moderate risk, minor deviations or unverified compliance)
 *   - 50–74:  HIGH (Significant risk, active speed/corridor anomalies)
 *   - 75–100: CRITICAL (Severe risk, active SOS alert or multiple critical events)
 * - Clamping: Strictly clamped to [0, 100], never NaN or negative.
 * - Factor breakdown: Every contributing factor is explainable with raw value and points.
 */

import { FirestoreRoute, FirestoreDriverProfile, FirestoreVehicle } from '@/lib/firestore-db';

export type RouteRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RouteRiskBadgeColor = 'emerald' | 'amber' | 'orange' | 'rose';

export interface RouteRiskFactor {
  name: string;
  description: string;
  value: number | string;
  contribution: number;
  severity: RouteRiskLevel;
}

export interface RouteRiskMetrics {
  totalIncidents: number;
  activeIncidents: number;
  routeDeviations: number;
  speedAnomalies: number;
  stationaryLongStops: number;
  gpsSignalLosses: number;
  sosAlerts: number;
  driverComplianceScore: number;
  vehicleComplianceScore: number;
}

export interface RouteRiskResult {
  route: {
    id: string;
    code: string;
    name: string;
    origin: string;
    destination: string;
    distanceKm: number;
    estimatedMinutes: number;
    assignedDriver: {
      id: string;
      name: string;
      isVerified: boolean;
    } | null;
    assignedVehicle: {
      id: string;
      model: string;
      licensePlate: string;
      isApproved: boolean;
    } | null;
  };
  risk: {
    score: number;
    level: RouteRiskLevel;
    badgeColor: RouteRiskBadgeColor;
    summary: string;
  };
  factors: RouteRiskFactor[];
  metrics: RouteRiskMetrics;
  calculatedAt: string;
}

export interface RouteRiskCalculationInput {
  route: FirestoreRoute;
  events?: any[];
  driver?: FirestoreDriverProfile | null;
  driverUserName?: string;
  vehicle?: FirestoreVehicle | null;
  activeTrip?: any | null;
  referenceDate?: Date;
}

/**
 * Calculates a deterministic Route Risk Score for a corridor route.
 */
export function calculateRouteRiskScore(input: RouteRiskCalculationInput): RouteRiskResult {
  const { route, events = [], driver, driverUserName = 'Captain', vehicle, activeTrip, referenceDate = new Date() } = input;

  const factors: RouteRiskFactor[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // 1. FILTER RELEVANT SAFETY EVENTS FOR THIS ROUTE
  // ──────────────────────────────────────────────────────────────────────────
  const routeCodeUpper = (route.code || '').toUpperCase().trim();
  const routeCodeSanitized = routeCodeUpper.replace(/[^A-Z0-9]/g, '');
  const routeIdLower = (route.id || '').toLowerCase().trim();

  const relevantEvents = events.filter((e) => {
    // Check tripId
    const tripId = (e.tripId || '').toLowerCase();
    if (tripId.includes(routeIdLower) || tripId.includes(routeCodeSanitized.toLowerCase())) {
      return true;
    }

    // Check metadata
    if (e.metadata) {
      const metaStr = typeof e.metadata === 'string' ? e.metadata : JSON.stringify(e.metadata);
      if (metaStr.includes(route.id) || metaStr.includes(route.code)) {
        return true;
      }
    }

    // Check assigned driver / vehicle match
    if (route.assignedDriverId && e.driverId && e.driverId === route.assignedDriverId) {
      return true;
    }
    if (route.assignedVehicleId && e.vehicleId && e.vehicleId === route.assignedVehicleId) {
      return true;
    }

    return false;
  });

  // Event category counts
  const isEventActive = (e: any) => e.status === 'ACTIVE' || e.status === 'INVESTIGATING' || e.status === 'ACKNOWLEDGED';
  const isEventResolved = (e: any) => e.status === 'RESOLVED' || e.status === 'DISMISSED';

  const routeDeviations = relevantEvents.filter((e) => e.type === 'ROUTE_DEVIATION');
  const activeDeviations = routeDeviations.filter(isEventActive).length;
  const resolvedDeviations = routeDeviations.filter(isEventResolved).length;

  const speedAnomalies = relevantEvents.filter((e) => e.type === 'SPEED_ANOMALY');
  const activeSpeed = speedAnomalies.filter(isEventActive).length;
  const resolvedSpeed = speedAnomalies.filter(isEventResolved).length;

  const longStops = relevantEvents.filter((e) => e.type === 'LONG_STOP' || e.type === 'LONG_STATIONARY_STOP');
  const activeLongStops = longStops.filter(isEventActive).length;

  const gpsLosses = relevantEvents.filter((e) => e.type === 'GPS_SIGNAL_LOSS' || e.type === 'GPS_LOSS' || e.type === 'GPS_SIGNAL_DROP');
  const activeGpsLosses = gpsLosses.filter(isEventActive).length;

  const sosEvents = relevantEvents.filter((e) => e.type === 'SOS_INCIDENT' || e.severity === 'CRITICAL');
  const hasLiveSos = activeTrip?.status === 'sos_alert' || (activeTrip?.sosDetails && !activeTrip.sosDetails.resolved);
  const activeSosCount = sosEvents.filter(isEventActive).length + (hasLiveSos ? 1 : 0);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. FACTOR CALCULATIONS
  // ──────────────────────────────────────────────────────────────────────────

  // Factor 1: Emergency & Critical Safety Incidents (Max 50 pts)
  if (activeSosCount > 0) {
    const pts = Math.min(50, activeSosCount * 35);
    factors.push({
      name: 'Emergency & SOS Alerts',
      description: `${activeSosCount} active panic/SOS security incident(s) flagged on this corridor.`,
      value: activeSosCount,
      contribution: pts,
      severity: 'CRITICAL',
    });
  }

  // Factor 2: Route Deviations (Max 35 pts)
  const activeDevPts = Math.min(30, activeDeviations * 15);
  const resolvedDevPts = Math.min(5, resolvedDeviations * 2);
  const totalDevPts = activeDevPts + resolvedDevPts;
  if (totalDevPts > 0) {
    factors.push({
      name: 'Route Deviations',
      description: `${activeDeviations} active off-corridor deviation(s) and ${resolvedDeviations} historical incident(s).`,
      value: activeDeviations > 0 ? `${activeDeviations} active` : `${resolvedDeviations} resolved`,
      contribution: totalDevPts,
      severity: activeDeviations > 1 ? 'HIGH' : activeDeviations === 1 ? 'MEDIUM' : 'LOW',
    });
  }

  // Factor 3: Speed Anomalies (Max 24 pts)
  const activeSpeedPts = Math.min(20, activeSpeed * 10);
  const resolvedSpeedPts = Math.min(4, resolvedSpeed * 2);
  const totalSpeedPts = activeSpeedPts + resolvedSpeedPts;
  if (totalSpeedPts > 0) {
    factors.push({
      name: 'Speed Anomalies',
      description: `${activeSpeed} active corridor speeding violation(s) and ${resolvedSpeed} historical incident(s).`,
      value: activeSpeed > 0 ? `${activeSpeed} active` : `${resolvedSpeed} resolved`,
      contribution: totalSpeedPts,
      severity: activeSpeed > 1 ? 'HIGH' : activeSpeed === 1 ? 'MEDIUM' : 'LOW',
    });
  }

  // Factor 4: Stationary Long Stops & Telemetry Drops (Max 16 pts)
  const stationaryTotal = activeLongStops + activeGpsLosses;
  if (stationaryTotal > 0) {
    const pts = Math.min(16, stationaryTotal * 8);
    factors.push({
      name: 'Stationary Stops & Telemetry Drops',
      description: `${activeLongStops} unauthorized stationary stop(s) and ${activeGpsLosses} GPS signal drop(s).`,
      value: stationaryTotal,
      contribution: pts,
      severity: stationaryTotal > 1 ? 'MEDIUM' : 'LOW',
    });
  }

  // Factor 5: Driver KYC & Verification Compliance (15 pts if unverified)
  let driverComplianceScore = 100;
  if (!route.assignedDriverId) {
    factors.push({
      name: 'Driver Assignment Missing',
      description: 'Corridor route has no primary assigned driver assigned.',
      value: 'UNASSIGNED',
      contribution: 15,
      severity: 'MEDIUM',
    });
    driverComplianceScore = 0;
  } else if (!driver || driver.isVerified !== true) {
    factors.push({
      name: 'Driver Verification Pending',
      description: 'Assigned corridor driver KYC and commercial license verification is pending approval.',
      value: 'PENDING_APPROVAL',
      contribution: 15,
      severity: 'MEDIUM',
    });
    driverComplianceScore = 30;
  }

  // Factor 6: Vehicle Inspection & Compliance (10 pts if unapproved)
  let vehicleComplianceScore = 100;
  if (!route.assignedVehicleId) {
    factors.push({
      name: 'Vehicle Assignment Missing',
      description: 'Corridor route has no commercial vehicle assigned.',
      value: 'UNASSIGNED',
      contribution: 10,
      severity: 'LOW',
    });
    vehicleComplianceScore = 0;
  } else if (!vehicle || !vehicle.isApproved) {
    factors.push({
      name: 'Vehicle Inspection Pending',
      description: 'Assigned shuttle has pending RC book or insurance compliance documentation.',
      value: 'PENDING_INSPECTION',
      contribution: 10,
      severity: 'LOW',
    });
    vehicleComplianceScore = 40;
  }

  // Factor 7: Corridor Transit Complexity (Optional 5 pts baseline)
  if (route.distanceKm > 25 && (route.waypoints || []).length >= 5) {
    factors.push({
      name: 'Corridor Transit Complexity',
      description: `Extended corridor (${route.distanceKm} km with ${route.waypoints.length} passenger hubs).`,
      value: `${route.distanceKm} km`,
      contribution: 5,
      severity: 'LOW',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. AGGREGATE DETERMINISTIC SCORE
  // ──────────────────────────────────────────────────────────────────────────
  const rawSum = factors.reduce((sum, f) => sum + f.contribution, 0);
  const safeSum = isNaN(rawSum) ? 0 : rawSum;
  // Strictly clamp between [0, 100]
  const score = Math.max(0, Math.min(100, Math.round(safeSum)));

  // Determine Level and Theme
  let level: RouteRiskLevel = 'LOW';
  let badgeColor: RouteRiskBadgeColor = 'emerald';
  let summary = 'Optimal corridor operations. Route compliant with zero active security anomalies.';

  if (score >= 75) {
    level = 'CRITICAL';
    badgeColor = 'rose';
    summary = 'Critical operational risk detected. Immediate dispatcher attention or safety intervention required.';
  } else if (score >= 50) {
    level = 'HIGH';
    badgeColor = 'orange';
    summary = 'Elevated operational risk on corridor. Active deviations or speed violations require oversight.';
  } else if (score >= 25) {
    level = 'MEDIUM';
    badgeColor = 'amber';
    summary = 'Moderate corridor risk. Driver or vehicle compliance pending or historical anomalies recorded.';
  }

  // If score is 0 and no factors, add informational zero-risk factor for clarity
  if (factors.length === 0) {
    factors.push({
      name: 'Standard Operational Baseline',
      description: 'Corridor operating within normal parameters with verified driver and vehicle compliance.',
      value: 'NORMAL',
      contribution: 0,
      severity: 'LOW',
    });
  }

  const assignedDriverObj = route.assignedDriverId
    ? {
        id: route.assignedDriverId,
        name: driverUserName,
        isVerified: driver?.isVerified === true,
      }
    : null;

  const assignedVehicleObj = route.assignedVehicleId
    ? {
        id: route.assignedVehicleId,
        model: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Standard Shuttle',
        licensePlate: vehicle?.licensePlate || 'N/A',
        isApproved: vehicle?.isApproved === true,
      }
    : null;

  return {
    route: {
      id: route.id,
      code: route.code,
      name: route.name,
      origin: route.origin,
      destination: route.destination,
      distanceKm: route.distanceKm,
      estimatedMinutes: route.estimatedMinutes,
      assignedDriver: assignedDriverObj,
      assignedVehicle: assignedVehicleObj,
    },
    risk: {
      score,
      level,
      badgeColor,
      summary,
    },
    factors,
    metrics: {
      totalIncidents: relevantEvents.length,
      activeIncidents: relevantEvents.filter(isEventActive).length,
      routeDeviations: activeDeviations + resolvedDeviations,
      speedAnomalies: activeSpeed + resolvedSpeed,
      stationaryLongStops: activeLongStops,
      gpsSignalLosses: activeGpsLosses,
      sosAlerts: activeSosCount,
      driverComplianceScore,
      vehicleComplianceScore,
    },
    calculatedAt: referenceDate.toISOString(),
  };
}
