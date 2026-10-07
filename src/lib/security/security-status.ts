/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔐 SMARTRIDE (COMMUTESYNC) — SECURITY STATUS & POSTURE ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Deterministic mathematical calculation of the platform security posture score
 * (0-100) and operational status tier (SECURE, MONITOR, ELEVATED, CRITICAL).
 */

import {
  SECURITY_RULES_CONFIG,
  SecuritySeverity,
  SecurityStatusLevel,
  SecurityEventStatus,
} from './security-rules';

export interface SecurityPostureResult {
  score: number;
  statusLevel: SecurityStatusLevel;
  badgeLabel: string;
  themeColor: 'emerald' | 'amber' | 'orange' | 'rose';
  unresolvedCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  factorBreakdown: {
    authenticationPenalties: number;
    authorizationPenalties: number;
    incidentPenalties: number;
    anomalyPenalties: number;
  };
}

/**
 * Deterministically computes the SmartRide Security Posture score (0-100)
 * based strictly on actual unresolved application security events.
 */
export function calculateSecurityPosture(
  events: {
    eventType: string;
    severity: SecuritySeverity | string;
    status: SecurityEventStatus | string;
  }[] = []
): SecurityPostureResult {
  // Only evaluate unresolved active events (OPEN or INVESTIGATING)
  const activeEvents = events.filter(
    (e) => e.status === 'OPEN' || e.status === 'INVESTIGATING'
  );

  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;

  let authPenalties = 0;
  let authzPenalties = 0;
  let incidentPenalties = 0;
  let anomalyPenalties = 0;

  const { postureWeights } = SECURITY_RULES_CONFIG;

  for (const evt of activeEvents) {
    const sev = evt.severity.toUpperCase();
    let weight = 0;

    if (sev === 'CRITICAL') {
      critical++;
      weight = postureWeights.criticalPenalty;
    } else if (sev === 'HIGH') {
      high++;
      weight = postureWeights.highPenalty;
    } else if (sev === 'MEDIUM') {
      medium++;
      weight = postureWeights.mediumPenalty;
    } else {
      low++;
      weight = 0;
    }

    // Categorize factor breakdown
    if (evt.eventType.startsWith('AUTH_') || evt.eventType === 'POSSIBLE_BRUTE_FORCE') {
      authPenalties += weight;
    } else if (evt.eventType.startsWith('API_') || evt.eventType.startsWith('RBAC_') || evt.eventType === 'SUSPICIOUS_SESSION') {
      authzPenalties += weight;
    } else if (evt.eventType === 'SOS_TRIGGERED') {
      incidentPenalties += weight;
    } else {
      anomalyPenalties += weight;
    }
  }

  const totalPenalty = authPenalties + authzPenalties + incidentPenalties + anomalyPenalties;
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));

  // Status mapping
  let statusLevel: SecurityStatusLevel = 'SECURE';
  let badgeLabel = '🟢 SECURE';
  let themeColor: 'emerald' | 'amber' | 'orange' | 'rose' = 'emerald';

  if (critical > 0 || score < 50) {
    statusLevel = 'CRITICAL';
    badgeLabel = '🔴 CRITICAL';
    themeColor = 'rose';
  } else if (high >= 2 || score < 75) {
    statusLevel = 'ELEVATED';
    badgeLabel = '🟠 ELEVATED';
    themeColor = 'orange';
  } else if (medium > 0 || high === 1 || score < 90) {
    statusLevel = 'MONITOR';
    badgeLabel = '🟡 MONITOR';
    themeColor = 'amber';
  } else {
    statusLevel = 'SECURE';
    badgeLabel = '🟢 SECURE';
    themeColor = 'emerald';
  }

  return {
    score,
    statusLevel,
    badgeLabel,
    themeColor,
    unresolvedCounts: {
      critical,
      high,
      medium,
      low,
      total: activeEvents.length,
    },
    factorBreakdown: {
      authenticationPenalties: authPenalties,
      authorizationPenalties: authzPenalties,
      incidentPenalties,
      anomalyPenalties,
    },
  };
}
