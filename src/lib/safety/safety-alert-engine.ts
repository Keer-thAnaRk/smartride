/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — OPERATIONAL SAFETY ALERT ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 3: Deterministic Operational Safety Alert Generation.
 *
 * Rules:
 * - Purely deterministic, explainable safety alerts.
 * - Zero machine-learning or probabilistic guesswork.
 * - Zero LLM-generated text or hallucinated incidents.
 * - Derived strictly from real route risk evaluations and historical snapshots.
 *
 * Rules:
 *   Rule A: CRITICAL_RISK (riskScore >= 75) -> CRITICAL
 *   Rule B: HIGH_RISK (riskScore >= 50 and < 75) -> HIGH
 *   Rule C: RAPID_RISK_INCREASE (delta >= 15) -> HIGH (delta >= 25 -> CRITICAL)
 *   Rule D: RISK_LEVEL_ESCALATION (level escalated) -> corresponding severity
 *   Rule E: ACTIVE_EMERGENCY (activeEmergencies > 0) -> CRITICAL
 *   Rule F: ACTIVE_ROUTE_DEVIATION (activeDeviations > 0) -> HIGH
 *   Rule G: ACTIVE_SPEED_ANOMALY (activeSpeedAnomalies > 0) -> HIGH
 *   Rule H: COMPLIANCE_FAILURE (driverVerified === false || vehicleApproved === false) -> HIGH
 *   Rule I: MULTI_FACTOR_DETERIORATION (>= 3 factor points increased) -> HIGH
 */

import { RouteRiskSnapshot } from '@/lib/safety/route-risk-history-store';
import { RouteRiskLevel } from '@/lib/safety/route-risk-engine';

export type SafetyAlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type SafetyAlertType =
  | 'CRITICAL_RISK'
  | 'HIGH_RISK'
  | 'RAPID_RISK_INCREASE'
  | 'RISK_LEVEL_ESCALATION'
  | 'ACTIVE_EMERGENCY'
  | 'ACTIVE_ROUTE_DEVIATION'
  | 'ACTIVE_SPEED_ANOMALY'
  | 'COMPLIANCE_FAILURE'
  | 'MULTI_FACTOR_DETERIORATION';

export interface EvaluatedAlert {
  routeId: string;
  routeCode: string;
  routeName: string;
  type: SafetyAlertType;
  severity: SafetyAlertSeverity;
  title: string;
  message: string;
  currentScore: number;
  previousScore?: number;
  scoreDelta?: number;
  evidence: Record<string, any>;
  dedupKey: string;
  triggeredAt: string;
}

export interface FactorIncreaseDetail {
  name: string;
  dimension: string;
  previousPoints: number;
  currentPoints: number;
  delta: number;
}

/**
 * Numeric ordering of safety risk levels.
 */
export function getRiskLevelRank(level: RouteRiskLevel | string): number {
  switch (level?.toUpperCase()) {
    case 'LOW':
      return 0;
    case 'MEDIUM':
      return 1;
    case 'HIGH':
      return 2;
    case 'CRITICAL':
      return 3;
    default:
      return 0;
  }
}

/**
 * Deterministically evaluates operational safety alert rules for a corridor route.
 * Accepts the current snapshot and optional previous snapshot.
 */
export function evaluateRouteSafetyAlerts(
  currentSnapshot: RouteRiskSnapshot,
  previousSnapshot: RouteRiskSnapshot | null = null
): EvaluatedAlert[] {
  if (!currentSnapshot) {
    return [];
  }

  const alerts: EvaluatedAlert[] = [];
  const nowIso = new Date().toISOString();
  const routeId = currentSnapshot.routeId;
  const routeCode = currentSnapshot.routeCode || 'UNKNOWN';
  const routeName = currentSnapshot.routeName || routeCode;
  const currentScore = currentSnapshot.riskScore;
  const currentLevel = currentSnapshot.riskLevel;

  // ──────────────────────────────────────────────────────────────────────────
  // RULE A: CRITICAL RISK
  // Trigger when: current riskScore >= 75
  // Severity: CRITICAL
  // ──────────────────────────────────────────────────────────────────────────
  if (currentScore >= 75) {
    alerts.push({
      routeId,
      routeCode,
      routeName,
      type: 'CRITICAL_RISK',
      severity: 'CRITICAL',
      title: `Critical Route Risk: ${routeCode}`,
      message: `Route ${routeCode} (${routeName}) is currently classified as CRITICAL risk (${currentScore}/100). Immediate central dispatcher intervention required.`,
      currentScore,
      evidence: {
        currentScore,
        riskLevel: currentLevel,
        threshold: 75,
        evaluatedAt: currentSnapshot.evaluatedAt,
      },
      dedupKey: `${routeId}:CRITICAL_RISK:${currentSnapshot.id || 'curr'}`,
      triggeredAt: nowIso,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE B: HIGH RISK
  // Trigger when: current riskScore >= 50 AND current riskScore < 75
  // Severity: HIGH
  // ──────────────────────────────────────────────────────────────────────────
  if (currentScore >= 50 && currentScore < 75) {
    alerts.push({
      routeId,
      routeCode,
      routeName,
      type: 'HIGH_RISK',
      severity: 'HIGH',
      title: `Elevated Route Risk: ${routeCode}`,
      message: `Route ${routeCode} (${routeName}) is operating at HIGH risk (${currentScore}/100). Operational monitoring and corridor audit advised.`,
      currentScore,
      evidence: {
        currentScore,
        riskLevel: currentLevel,
        thresholdRange: '50-74',
        evaluatedAt: currentSnapshot.evaluatedAt,
      },
      dedupKey: `${routeId}:HIGH_RISK:${currentSnapshot.id || 'curr'}`,
      triggeredAt: nowIso,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE E: ACTIVE EMERGENCY
  // Trigger when: activeEmergencies > 0
  // Severity: CRITICAL
  // ──────────────────────────────────────────────────────────────────────────
  if (currentSnapshot.activeEmergencies > 0) {
    alerts.push({
      routeId,
      routeCode,
      routeName,
      type: 'ACTIVE_EMERGENCY',
      severity: 'CRITICAL',
      title: `Active Emergency Alert: ${routeCode}`,
      message: `Route ${routeCode} has ${currentSnapshot.activeEmergencies} active passenger SOS/emergency incident(s). Platform emergency protocol active.`,
      currentScore,
      evidence: {
        activeEmergencies: currentSnapshot.activeEmergencies,
        emergencyPoints: currentSnapshot.emergencyPoints,
        evaluatedAt: currentSnapshot.evaluatedAt,
      },
      dedupKey: `${routeId}:ACTIVE_EMERGENCY:${currentSnapshot.id || 'curr'}`,
      triggeredAt: nowIso,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE F: ACTIVE ROUTE DEVIATION
  // Trigger when: activeDeviations > 0
  // Severity: HIGH
  // ──────────────────────────────────────────────────────────────────────────
  if (currentSnapshot.activeDeviations > 0) {
    alerts.push({
      routeId,
      routeCode,
      routeName,
      type: 'ACTIVE_ROUTE_DEVIATION',
      severity: 'HIGH',
      title: `Active Route Deviation: ${routeCode}`,
      message: `Route ${routeCode} has ${currentSnapshot.activeDeviations} active off-corridor deviation incident(s) requiring navigation verification.`,
      currentScore,
      evidence: {
        activeDeviations: currentSnapshot.activeDeviations,
        deviationPoints: currentSnapshot.deviationPoints,
        evaluatedAt: currentSnapshot.evaluatedAt,
      },
      dedupKey: `${routeId}:ACTIVE_ROUTE_DEVIATION:${currentSnapshot.id || 'curr'}`,
      triggeredAt: nowIso,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE G: ACTIVE SPEED ANOMALY
  // Trigger when: activeSpeedAnomalies > 0
  // Severity: HIGH
  // ──────────────────────────────────────────────────────────────────────────
  if (currentSnapshot.activeSpeedAnomalies > 0) {
    alerts.push({
      routeId,
      routeCode,
      routeName,
      type: 'ACTIVE_SPEED_ANOMALY',
      severity: 'HIGH',
      title: `Active Speed Anomaly: ${routeCode}`,
      message: `Route ${routeCode} has ${currentSnapshot.activeSpeedAnomalies} active corridor speed surge violation(s) exceeding safety thresholds.`,
      currentScore,
      evidence: {
        activeSpeedAnomalies: currentSnapshot.activeSpeedAnomalies,
        speedPoints: currentSnapshot.speedPoints,
        evaluatedAt: currentSnapshot.evaluatedAt,
      },
      dedupKey: `${routeId}:ACTIVE_SPEED_ANOMALY:${currentSnapshot.id || 'curr'}`,
      triggeredAt: nowIso,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE H: COMPLIANCE FAILURE
  // Trigger when: driverVerified === false OR vehicleApproved === false
  // Severity: HIGH
  // ──────────────────────────────────────────────────────────────────────────
  if (currentSnapshot.driverVerified === false || currentSnapshot.vehicleApproved === false) {
    const failedParts: string[] = [];
    if (!currentSnapshot.driverVerified) {
      failedParts.push('assigned driver verification is incomplete/unverified');
    }
    if (!currentSnapshot.vehicleApproved) {
      failedParts.push('assigned vehicle inspection/approval is unapproved');
    }
    const failedConditionText = failedParts.join(' and ');

    alerts.push({
      routeId,
      routeCode,
      routeName,
      type: 'COMPLIANCE_FAILURE',
      severity: 'HIGH',
      title: `Operational Compliance Failure: ${routeCode}`,
      message: `Route ${routeCode} compliance verification failed: ${failedConditionText}.`,
      currentScore,
      evidence: {
        driverVerified: currentSnapshot.driverVerified,
        vehicleApproved: currentSnapshot.vehicleApproved,
        compliancePoints: currentSnapshot.compliancePoints,
        failedConditions: failedParts,
        evaluatedAt: currentSnapshot.evaluatedAt,
      },
      dedupKey: `${routeId}:COMPLIANCE_FAILURE:${currentSnapshot.id || 'curr'}`,
      triggeredAt: nowIso,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HISTORICAL COMPARISON RULES (Require previousSnapshot)
  // ──────────────────────────────────────────────────────────────────────────
  if (previousSnapshot) {
    const previousScore = previousSnapshot.riskScore;
    const scoreDelta = currentScore - previousScore;
    const prevId = previousSnapshot.id || 'prev';
    const currId = currentSnapshot.id || 'curr';

    // ────────────────────────────────────────────────────────────────────────
    // RULE C: RAPID RISK INCREASE
    // Trigger when: currentScore - previousScore >= 15
    // Severity: CRITICAL if delta >= 25 else HIGH
    // ────────────────────────────────────────────────────────────────────────
    if (scoreDelta >= 15) {
      const severity: SafetyAlertSeverity = scoreDelta >= 25 ? 'CRITICAL' : 'HIGH';
      alerts.push({
        routeId,
        routeCode,
        routeName,
        type: 'RAPID_RISK_INCREASE',
        severity,
        title: `Rapid Risk Escalation (+${scoreDelta} pts): ${routeCode}`,
        message: `Route ${routeCode} experienced a sharp risk surge from ${previousScore} to ${currentScore} (+${scoreDelta} pts) between consecutive evaluations.`,
        currentScore,
        previousScore,
        scoreDelta,
        evidence: {
          previousScore,
          currentScore,
          delta: scoreDelta,
          previousEvaluatedAt: previousSnapshot.evaluatedAt,
          currentEvaluatedAt: currentSnapshot.evaluatedAt,
        },
        dedupKey: `${routeId}:RAPID_RISK_INCREASE:${prevId}:${currId}`,
        triggeredAt: nowIso,
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // RULE D: RISK LEVEL ESCALATION
    // Trigger when: current risk level is higher than previous snapshot
    // Severity: corresponding to resulting level (CRITICAL -> CRITICAL, HIGH -> HIGH, MEDIUM -> MEDIUM)
    // ────────────────────────────────────────────────────────────────────────
    const prevRank = getRiskLevelRank(previousSnapshot.riskLevel);
    const currRank = getRiskLevelRank(currentSnapshot.riskLevel);

    if (currRank > prevRank) {
      let severity: SafetyAlertSeverity = 'MEDIUM';
      if (currentLevel === 'CRITICAL') {
        severity = 'CRITICAL';
      } else if (currentLevel === 'HIGH') {
        severity = 'HIGH';
      }

      alerts.push({
        routeId,
        routeCode,
        routeName,
        type: 'RISK_LEVEL_ESCALATION',
        severity,
        title: `Risk Level Escalated: ${previousSnapshot.riskLevel} → ${currentLevel}`,
        message: `Corridor ${routeCode} safety tier transitioned upward from ${previousSnapshot.riskLevel} to ${currentLevel} (score: ${previousScore} → ${currentScore}, Δ ${scoreDelta > 0 ? '+' : ''}${scoreDelta}).`,
        currentScore,
        previousScore,
        scoreDelta,
        evidence: {
          previousLevel: previousSnapshot.riskLevel,
          currentLevel,
          previousScore,
          currentScore,
          scoreDelta,
          previousEvaluatedAt: previousSnapshot.evaluatedAt,
          currentEvaluatedAt: currentSnapshot.evaluatedAt,
        },
        dedupKey: `${routeId}:RISK_LEVEL_ESCALATION:${prevId}:${currId}`,
        triggeredAt: nowIso,
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // RULE I: MULTI-FACTOR DETERIORATION
    // Compare current snapshot against previous snapshot across 6 factor points.
    // Trigger when: at least 3 factors increased.
    // Severity: HIGH
    // ────────────────────────────────────────────────────────────────────────
    const factorDeltas: FactorIncreaseDetail[] = [];

    if (currentSnapshot.emergencyPoints > previousSnapshot.emergencyPoints) {
      factorDeltas.push({
        name: 'Emergency / SOS Points',
        dimension: 'emergencyPoints',
        previousPoints: previousSnapshot.emergencyPoints,
        currentPoints: currentSnapshot.emergencyPoints,
        delta: currentSnapshot.emergencyPoints - previousSnapshot.emergencyPoints,
      });
    }
    if (currentSnapshot.deviationPoints > previousSnapshot.deviationPoints) {
      factorDeltas.push({
        name: 'Route Deviation Points',
        dimension: 'deviationPoints',
        previousPoints: previousSnapshot.deviationPoints,
        currentPoints: currentSnapshot.deviationPoints,
        delta: currentSnapshot.deviationPoints - previousSnapshot.deviationPoints,
      });
    }
    if (currentSnapshot.speedPoints > previousSnapshot.speedPoints) {
      factorDeltas.push({
        name: 'Speed Anomaly Points',
        dimension: 'speedPoints',
        previousPoints: previousSnapshot.speedPoints,
        currentPoints: currentSnapshot.speedPoints,
        delta: currentSnapshot.speedPoints - previousSnapshot.speedPoints,
      });
    }
    if (currentSnapshot.stopGpsPoints > previousSnapshot.stopGpsPoints) {
      factorDeltas.push({
        name: 'Stop & Telemetry Points',
        dimension: 'stopGpsPoints',
        previousPoints: previousSnapshot.stopGpsPoints,
        currentPoints: currentSnapshot.stopGpsPoints,
        delta: currentSnapshot.stopGpsPoints - previousSnapshot.stopGpsPoints,
      });
    }
    if (currentSnapshot.compliancePoints > previousSnapshot.compliancePoints) {
      factorDeltas.push({
        name: 'Driver & Vehicle Compliance Points',
        dimension: 'compliancePoints',
        previousPoints: previousSnapshot.compliancePoints,
        currentPoints: currentSnapshot.compliancePoints,
        delta: currentSnapshot.compliancePoints - previousSnapshot.compliancePoints,
      });
    }
    if (currentSnapshot.complexityPoints > previousSnapshot.complexityPoints) {
      factorDeltas.push({
        name: 'Corridor Complexity Points',
        dimension: 'complexityPoints',
        previousPoints: previousSnapshot.complexityPoints,
        currentPoints: currentSnapshot.complexityPoints,
        delta: currentSnapshot.complexityPoints - previousSnapshot.complexityPoints,
      });
    }

    if (factorDeltas.length >= 3) {
      const namesList = factorDeltas.map((f) => `${f.name} (+${f.delta})`).join(', ');
      alerts.push({
        routeId,
        routeCode,
        routeName,
        type: 'MULTI_FACTOR_DETERIORATION',
        severity: 'HIGH',
        title: `Multi-Factor Safety Deterioration: ${routeCode}`,
        message: `Route ${routeCode} deteriorated across ${factorDeltas.length} safety dimensions simultaneously: ${namesList}.`,
        currentScore,
        previousScore,
        scoreDelta,
        evidence: {
          increasedCount: factorDeltas.length,
          factorChanges: factorDeltas,
          previousScore,
          currentScore,
          scoreDelta,
          previousEvaluatedAt: previousSnapshot.evaluatedAt,
          currentEvaluatedAt: currentSnapshot.evaluatedAt,
        },
        dedupKey: `${routeId}:MULTI_FACTOR_DETERIORATION:${prevId}:${currId}`,
        triggeredAt: nowIso,
      });
    }
  }

  return alerts;
}
