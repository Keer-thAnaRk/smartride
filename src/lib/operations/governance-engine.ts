/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — OPERATIONAL GOVERNANCE & COMPLIANCE REVIEW ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 9: Server-Authoritative, Deterministic Governance & Compliance
 * Evaluation Layer for Smart Commute Operations.
 *
 * Core Governance Invariants:
 * 1. Strictly READ-ONLY & ADVISORY:
 *    - Does NOT mutate routes, schedules, vehicles, drivers, bookings, or subscriptions.
 *    - Does NOT trigger automated dispatch or operational state changes.
 *    - Human Administrator remains the final, sole operational authority.
 * 2. Deterministic & Explainable:
 *    - Pure rule-based evaluation (Rules A through P).
 *    - Zero probabilistic guesswork, black-box heuristics, or LLM generation.
 *    - Every score, severity, and status explains exact causal reasoning.
 * 3. Anti-Forgery & Server Authority:
 *    - Consumes verified server-side data from Phase 3 Steps 1–8 stores.
 *    - Client-supplied scores, statuses, counts, or identities are ignored.
 * 4. Immutable Audit Verification:
 *    - Validates SHA-256 cryptographic hashes and chronological hash chaining.
 */

import {
  getAllRoutes,
  getRouteById,
  getRouteByCode,
  FirestoreRoute,
  DEFAULT_CORRIDOR_ROUTES,
} from '@/lib/firestore-db';
import {
  getOperationalAuditEvents,
  verifyAuditEventIntegrity,
  OperationalAuditEventRecord,
} from '@/lib/operations/operational-audit-store';
import {
  getOperationalRecommendations,
  OperationalRecommendationRecord,
} from '@/lib/operations/recommendation-engine';
import {
  getIncidentCases,
  IncidentCaseRecord,
} from '@/lib/safety/safety-incident-store';
import {
  getSafetyAlerts,
  SafetyAlertRecord,
} from '@/lib/safety/safety-alert-store';
import {
  getRouteRiskHistory,
  calculateRouteRiskTrend,
} from '@/lib/safety/route-risk-history-store';
import {
  buildOperationalDecisionSupport,
  RouteOperationalDecisionSupport,
} from '@/lib/operations/decision-support-engine';

export type GovernanceSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type GovernanceStatus =
  | 'GOVERNANCE_CRITICAL'
  | 'GOVERNANCE_AT_RISK'
  | 'GOVERNANCE_MONITOR'
  | 'GOVERNANCE_COMPLIANT';

export type GovernanceRule =
  | 'AUDIT_COVERAGE_GAP'
  | 'ORPHANED_AUDIT_EVENT'
  | 'AUDIT_INTEGRITY_FAILURE'
  | 'AUDIT_CHAIN_BREAK'
  | 'STALE_PENDING_RECOMMENDATION'
  | 'APPROVED_ACTION_OVERDUE'
  | 'CRITICAL_INCIDENT_OPEN'
  | 'CRITICAL_ALERT_REVIEW_GAP'
  | 'RISK_REVIEW_GAP'
  | 'CAPACITY_REVIEW_GAP'
  | 'EVIDENCE_COMPLETENESS_GAP'
  | 'HUMAN_GOVERNANCE_VIOLATION'
  | 'INVALID_RECOMMENDATION_LIFECYCLE'
  | 'ACTOR_IDENTITY_GAP'
  | 'CORRELATION_TRACEABILITY_GAP'
  | 'COMPLIANT';

export interface GovernanceException {
  exceptionId: string;
  rule: GovernanceRule;
  severity: GovernanceSeverity;
  routeId: string;
  resourceType: string;
  resourceId?: string | null;
  description: string;
  evidence: Record<string, any>;
  createdAt: string;
  status: 'ACTIVE';
}

export interface GovernanceExplanationItem {
  rule: GovernanceRule;
  severity: GovernanceSeverity;
  reason: string;
  supportingEvidence: Record<string, any>;
  relatedResource?: string | null;
  timestamp?: string;
}

export interface AuditCoverageGovernance {
  status: 'FULL' | 'PARTIAL' | 'GAP_DETECTED';
  totalEvents: number;
  gapCount: number;
  evaluatedActions: number;
}

export interface AuditIntegrityGovernance {
  status: 'VERIFIED' | 'COMPROMISED';
  verifiedCount: number;
  failedCount: number;
}

export interface AuditChainGovernance {
  status: 'INTACT' | 'BROKEN';
  intact: boolean;
  breaksDetected: number;
}

export interface RecommendationGovernance {
  status: 'COMPLIANT' | 'OVERDUE' | 'STALE' | 'ATTENTION_REQUIRED';
  total: number;
  pending: number;
  stalePending: number;
  approved: number;
  overdueApproved: number;
  completed: number;
  dismissed: number;
}

export interface IncidentGovernance {
  status: 'HEALTHY' | 'CRITICAL_OPEN' | 'ATTENTION_REQUIRED';
  total: number;
  openCritical: number;
  totalOpen: number;
  resolved: number;
}

export interface AlertGovernance {
  status: 'HEALTHY' | 'UNREVIEWED_CRITICAL' | 'ATTENTION_REQUIRED';
  total: number;
  activeCritical: number;
  reviewGaps: number;
}

export interface RiskReviewGovernance {
  status: 'CURRENT' | 'REVIEW_GAP';
  currentRiskScore: number;
  currentRiskLevel: string;
  reviewGap: boolean;
  lastReviewedAt: string | null;
}

export interface DemandReviewGovernance {
  status: 'CURRENT' | 'REVIEW_GAP';
  predictedOccupancy: number;
  demandLevel: string;
  reviewGap: boolean;
}

export interface EvidenceGovernance {
  status: 'COMPLETE' | 'INCOMPLETE';
  completenessGaps: number;
}

export interface HumanInTheLoopGovernance {
  status: 'VERIFIED' | 'VIOLATION_DETECTED';
  violations: number;
}

export interface CorridorGovernanceReport {
  routeId: string;
  routeCode: string;
  routeName: string;
  governanceStatus: GovernanceStatus;
  governanceSeverity: GovernanceSeverity;
  governanceScore: number;
  exceptionCount: number;
  criticalExceptionCount: number;
  highExceptionCount: number;
  mediumExceptionCount: number;
  lowExceptionCount: number;
  auditCoverage: AuditCoverageGovernance;
  auditIntegrity: AuditIntegrityGovernance;
  auditChainStatus: AuditChainGovernance;
  recommendationGovernance: RecommendationGovernance;
  incidentGovernance: IncidentGovernance;
  alertGovernance: AlertGovernance;
  riskReviewGovernance: RiskReviewGovernance;
  demandReviewGovernance: DemandReviewGovernance;
  evidenceGovernance: EvidenceGovernance;
  humanInTheLoopStatus: HumanInTheLoopGovernance;
  exceptions: GovernanceException[];
  evidence: Record<string, any>[];
  briefing: string;
  explanation: GovernanceExplanationItem[];
}

export interface FleetGovernanceSummary {
  totalRoutes: number;
  compliantRoutes: number;
  monitorRoutes: number;
  atRiskRoutes: number;
  criticalRoutes: number;
  totalGovernanceExceptions: number;
  criticalExceptions: number;
  highExceptions: number;
  mediumExceptions: number;
  lowExceptions: number;
  auditEventsReviewed: number;
  auditIntegrityFailures: number;
  auditChainBreaks: number;
  pendingRecommendations: number;
  stalePendingRecommendations: number;
  approvedRecommendations: number;
  overdueApprovedRecommendations: number;
  openCriticalIncidents: number;
  criticalAlertReviewGaps: number;
  riskReviewGaps: number;
  capacityReviewGaps: number;
  evidenceCompletenessGaps: number;
  actorIdentityGaps: number;
  correlationTraceabilityGaps: number;
  humanGovernanceViolations: number;
}

export interface FleetGovernanceResponse {
  summary: FleetGovernanceSummary;
  corridors: CorridorGovernanceReport[];
}

// Deterministic SLA Thresholds
export const SLA_THRESHOLDS = {
  STALE_RECOMMENDATION_MS: 24 * 60 * 60 * 1000, // 24 hours
  OVERDUE_APPROVED_ACTION_MS: 24 * 60 * 60 * 1000, // 24 hours
  ALERT_REVIEW_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
  RISK_REVIEW_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
  CAPACITY_REVIEW_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
};

// Deterministic Score Penalties
export const GOVERNANCE_PENALTIES = {
  CRITICAL: 30,
  HIGH: 20,
  MEDIUM: 10,
  LOW: 5,
};

/**
 * Evaluates governance rules against provided operational datasets.
 * Pure deterministic logic. Can be invoked on live datasets or deterministic test datasets.
 */
export function evaluateGovernanceRules(params: {
  routes: FirestoreRoute[];
  auditEvents: OperationalAuditEventRecord[];
  recommendations: OperationalRecommendationRecord[];
  incidents: IncidentCaseRecord[];
  alerts: SafetyAlertRecord[];
  decisionSupports?: Map<string, RouteOperationalDecisionSupport>;
  referenceTime?: Date;
}): {
  exceptions: GovernanceException[];
  auditChainBreaks: number;
  auditIntegrityFailures: number;
} {
  const exceptions: GovernanceException[] = [];
  const now = params.referenceTime ? params.referenceTime.getTime() : Date.now();
  let auditChainBreaks = 0;
  let auditIntegrityFailures = 0;

  // Build quick lookup structures
  const auditByResource = new Map<string, OperationalAuditEventRecord[]>();
  const auditByRoute = new Map<string, OperationalAuditEventRecord[]>();
  const auditByEventType = new Map<string, OperationalAuditEventRecord[]>();

  for (const ev of params.auditEvents) {
    if (ev.resourceId) {
      const list = auditByResource.get(ev.resourceId) || [];
      list.push(ev);
      auditByResource.set(ev.resourceId, list);
    }
    if (ev.routeId) {
      const list = auditByRoute.get(ev.routeId) || [];
      list.push(ev);
      auditByRoute.set(ev.routeId, list);
    }
    if (ev.routeCode) {
      const list = auditByRoute.get(ev.routeCode) || [];
      list.push(ev);
      auditByRoute.set(ev.routeCode, list);
    }
    const evTypeList = auditByEventType.get(ev.eventType) || [];
    evTypeList.push(ev);
    auditByEventType.set(ev.eventType, evTypeList);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. AUDIT LEDGER INTEGRITY & CHAIN CHECKS (Rules C, D, N, O, B)
  // ─────────────────────────────────────────────────────────────────────────────
  // Chronological sort ascending for cryptographic chain validation
  const chronologicalAudit = [...params.auditEvents].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (let i = 0; i < chronologicalAudit.length; i++) {
    const ev = chronologicalAudit[i];

    // RULE C: Invalid Audit Integrity (SHA-256 mismatch)
    const isIntegrityValid = verifyAuditEventIntegrity(ev);
    if (!isIntegrityValid) {
      auditIntegrityFailures++;
      exceptions.push({
        exceptionId: `exc_integrity_${ev.id}`,
        rule: 'AUDIT_INTEGRITY_FAILURE',
        severity: 'CRITICAL',
        routeId: ev.routeId || 'SYSTEM',
        resourceType: 'AUDIT_LOG',
        resourceId: ev.id,
        description: `Audit event '${ev.id}' failed SHA-256 cryptographic integrity verification.`,
        evidence: {
          eventId: ev.id,
          eventType: ev.eventType,
          recordedHash: ev.integrityHash,
        },
        createdAt: ev.createdAt,
        status: 'ACTIVE',
      });
    }

    // RULE D: Broken Audit Chain (previousEventHash mismatch)
    if (i > 0) {
      const preceding = chronologicalAudit[i - 1];
      if (ev.previousEventHash && ev.previousEventHash !== preceding.integrityHash) {
        auditChainBreaks++;
        exceptions.push({
          exceptionId: `exc_chain_${ev.id}`,
          rule: 'AUDIT_CHAIN_BREAK',
          severity: 'CRITICAL',
          routeId: ev.routeId || 'SYSTEM',
          resourceType: 'AUDIT_LOG',
          resourceId: ev.id,
          description: `Cryptographic audit chain broken at event '${ev.id}'. Expected preceding hash '${preceding.integrityHash.substring(0, 12)}...', found '${ev.previousEventHash.substring(0, 12)}...'.`,
          evidence: {
            eventId: ev.id,
            expectedPreviousHash: preceding.integrityHash,
            actualPreviousHash: ev.previousEventHash,
          },
          createdAt: ev.createdAt,
          status: 'ACTIVE',
        });
      }
    }

    // RULE N: Actor Identity Gap
    if (
      !ev.actorUserId ||
      ev.actorUserId.trim() === '' ||
      !ev.actorRole ||
      (ev.actorRole !== 'ADMIN' && ev.actorRole !== 'SYSTEM')
    ) {
      exceptions.push({
        exceptionId: `exc_actor_${ev.id}`,
        rule: 'ACTOR_IDENTITY_GAP',
        severity: 'HIGH',
        routeId: ev.routeId || 'SYSTEM',
        resourceType: 'AUDIT_LOG',
        resourceId: ev.id,
        description: `Audit event '${ev.id}' lacks authentic administrator identity (actor: '${ev.actorUserId}', role: '${ev.actorRole}').`,
        evidence: {
          eventId: ev.id,
          actorUserId: ev.actorUserId,
          actorRole: ev.actorRole,
        },
        createdAt: ev.createdAt,
        status: 'ACTIVE',
      });
    }

    // RULE O: Correlation Traceability Gap
    if (!ev.routeId && !ev.resourceId && !ev.correlationId) {
      exceptions.push({
        exceptionId: `exc_trace_${ev.id}`,
        rule: 'CORRELATION_TRACEABILITY_GAP',
        severity: 'LOW',
        routeId: 'SYSTEM',
        resourceType: 'AUDIT_LOG',
        resourceId: ev.id,
        description: `Audit event '${ev.id}' lacks operational correlation linkage (missing routeId, resourceId, and correlationId).`,
        evidence: { eventId: ev.id, action: ev.action },
        createdAt: ev.createdAt,
        status: 'ACTIVE',
      });
    }

    // RULE B: Orphaned Audit Event
    // If event references a specific resource, verify resource exists
    if (ev.resourceId && ev.resourceType) {
      let resourceFound = true;
      if (ev.resourceType === 'RECOMMENDATION') {
        resourceFound = params.recommendations.some((r) => r.id === ev.resourceId);
      } else if (ev.resourceType === 'INCIDENT_CASE') {
        resourceFound = params.incidents.some((inc) => inc.id === ev.resourceId);
      } else if (ev.resourceType === 'SAFETY_ALERT') {
        resourceFound = params.alerts.some((alt) => alt.id === ev.resourceId);
      }
      if (!resourceFound) {
        exceptions.push({
          exceptionId: `exc_orphan_${ev.id}`,
          rule: 'ORPHANED_AUDIT_EVENT',
          severity: 'LOW',
          routeId: ev.routeId || 'SYSTEM',
          resourceType: ev.resourceType,
          resourceId: ev.resourceId,
          description: `Audit event '${ev.id}' references resource '${ev.resourceId}' (${ev.resourceType}) which cannot be found in authoritative repositories.`,
          evidence: {
            eventId: ev.id,
            resourceType: ev.resourceType,
            resourceId: ev.resourceId,
          },
          createdAt: ev.createdAt,
          status: 'ACTIVE',
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. RECOMMENDATION GOVERNANCE (Rules A, E, F, K, L, M)
  // ─────────────────────────────────────────────────────────────────────────────
  for (const rec of params.recommendations) {
    const recEvents = auditByResource.get(rec.id) || [];

    // RULE A: Audit Coverage Gap for Recommendations
    if (rec.status === 'APPROVED') {
      const hasApprovedAudit = recEvents.some(
        (e) => e.eventType === 'RECOMMENDATION_APPROVED'
      );
      if (!hasApprovedAudit) {
        exceptions.push({
          exceptionId: `exc_cov_app_${rec.id}`,
          rule: 'AUDIT_COVERAGE_GAP',
          severity: 'HIGH',
          routeId: rec.routeId,
          resourceType: 'RECOMMENDATION',
          resourceId: rec.id,
          description: `Operational recommendation '${rec.title}' was APPROVED without a corresponding audit event.`,
          evidence: { recId: rec.id, status: rec.status },
          createdAt: rec.updatedAt || rec.createdAt,
          status: 'ACTIVE',
        });
      }
    } else if (rec.status === 'DISMISSED') {
      const hasDismissedAudit = recEvents.some(
        (e) => e.eventType === 'RECOMMENDATION_DISMISSED'
      );
      if (!hasDismissedAudit) {
        exceptions.push({
          exceptionId: `exc_cov_dsm_${rec.id}`,
          rule: 'AUDIT_COVERAGE_GAP',
          severity: 'HIGH',
          routeId: rec.routeId,
          resourceType: 'RECOMMENDATION',
          resourceId: rec.id,
          description: `Operational recommendation '${rec.title}' was DISMISSED without a corresponding audit event.`,
          evidence: { recId: rec.id, status: rec.status },
          createdAt: rec.updatedAt || rec.createdAt,
          status: 'ACTIVE',
        });
      }
    } else if (rec.status === 'COMPLETED') {
      const hasCompletedAudit = recEvents.some(
        (e) => e.eventType === 'RECOMMENDATION_COMPLETED'
      );
      if (!hasCompletedAudit) {
        exceptions.push({
          exceptionId: `exc_cov_cmp_${rec.id}`,
          rule: 'AUDIT_COVERAGE_GAP',
          severity: 'HIGH',
          routeId: rec.routeId,
          resourceType: 'RECOMMENDATION',
          resourceId: rec.id,
          description: `Operational recommendation '${rec.title}' was marked COMPLETED without a corresponding audit event.`,
          evidence: { recId: rec.id, status: rec.status },
          createdAt: rec.updatedAt || rec.createdAt,
          status: 'ACTIVE',
        });
      }
    }

    // RULE E: Stale Pending Recommendation
    if (rec.status === 'PENDING') {
      const recCreatedTime = new Date(rec.createdAt).getTime();
      const ageMs = now - recCreatedTime;
      if (ageMs > SLA_THRESHOLDS.STALE_RECOMMENDATION_MS) {
        const hours = Math.round(ageMs / (60 * 60 * 1000));
        exceptions.push({
          exceptionId: `exc_stale_${rec.id}`,
          rule: 'STALE_PENDING_RECOMMENDATION',
          severity: 'MEDIUM',
          routeId: rec.routeId,
          resourceType: 'RECOMMENDATION',
          resourceId: rec.id,
          description: `Operational recommendation '${rec.title}' has remained PENDING for ${hours} hours without administrative review.`,
          evidence: { recId: rec.id, createdAt: rec.createdAt, pendingHours: hours },
          createdAt: rec.createdAt,
          status: 'ACTIVE',
        });
      }
    }

    // RULE F: Approved But Not Completed Overdue
    if (rec.status === 'APPROVED') {
      const approvedTime = new Date(rec.approvedAt || rec.updatedAt).getTime();
      const ageMs = now - approvedTime;
      if (ageMs > SLA_THRESHOLDS.OVERDUE_APPROVED_ACTION_MS) {
        const hours = Math.round(ageMs / (60 * 60 * 1000));
        exceptions.push({
          exceptionId: `exc_overdue_${rec.id}`,
          rule: 'APPROVED_ACTION_OVERDUE',
          severity: 'MEDIUM',
          routeId: rec.routeId,
          resourceType: 'RECOMMENDATION',
          resourceId: rec.id,
          description: `Approved operational recommendation '${rec.title}' has remained incomplete for ${hours} hours beyond the SLA.`,
          evidence: { recId: rec.id, approvedAt: rec.approvedAt, overdueHours: hours },
          createdAt: rec.approvedAt || rec.updatedAt,
          status: 'ACTIVE',
        });
      }
    }

    // RULE K: Incomplete Evidence
    if (!rec.evidence || (typeof rec.evidence === 'object' && Object.keys(rec.evidence).length === 0)) {
      exceptions.push({
        exceptionId: `exc_ev_rec_${rec.id}`,
        rule: 'EVIDENCE_COMPLETENESS_GAP',
        severity: 'MEDIUM',
        routeId: rec.routeId,
        resourceType: 'RECOMMENDATION',
        resourceId: rec.id,
        description: `Operational recommendation '${rec.title}' lacks supporting telemetry or risk evidence.`,
        evidence: { recId: rec.id },
        createdAt: rec.createdAt,
        status: 'ACTIVE',
      });
    }

    // RULE M: Recommendation Lifecycle Consistency & RULE L: Human-in-the-Loop Violation
    if (rec.status === 'COMPLETED' && !rec.approvedAt) {
      // Completed directly without approval
      exceptions.push({
        exceptionId: `exc_lcycle_${rec.id}`,
        rule: 'INVALID_RECOMMENDATION_LIFECYCLE',
        severity: 'HIGH',
        routeId: rec.routeId,
        resourceType: 'RECOMMENDATION',
        resourceId: rec.id,
        description: `Recommendation '${rec.id}' transitioned directly to COMPLETED without prerequisite administrative approval.`,
        evidence: { recId: rec.id, status: rec.status, approvedAt: rec.approvedAt },
        createdAt: rec.completedAt || rec.updatedAt,
        status: 'ACTIVE',
      });
      exceptions.push({
        exceptionId: `exc_human_${rec.id}`,
        rule: 'HUMAN_GOVERNANCE_VIOLATION',
        severity: 'CRITICAL',
        routeId: rec.routeId,
        resourceType: 'RECOMMENDATION',
        resourceId: rec.id,
        description: `Recommendation '${rec.title}' bypassed human approval gate before completion.`,
        evidence: { recId: rec.id, status: rec.status },
        createdAt: rec.completedAt || rec.updatedAt,
        status: 'ACTIVE',
      });
    } else if (rec.status === 'DISMISSED' && rec.approvedAt) {
      exceptions.push({
        exceptionId: `exc_lcycle_dsm_${rec.id}`,
        rule: 'INVALID_RECOMMENDATION_LIFECYCLE',
        severity: 'HIGH',
        routeId: rec.routeId,
        resourceType: 'RECOMMENDATION',
        resourceId: rec.id,
        description: `Recommendation '${rec.id}' has conflicting lifecycle states (both APPROVED and DISMISSED).`,
        evidence: {
          recId: rec.id,
          status: rec.status,
          approvedAt: rec.approvedAt,
          dismissedAt: rec.dismissedAt,
        },
        createdAt: rec.updatedAt,
        status: 'ACTIVE',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SAFETY INCIDENT GOVERNANCE (Rules A, G, K)
  // ─────────────────────────────────────────────────────────────────────────────
  for (const inc of params.incidents) {
    const incEvents = auditByResource.get(inc.id) || [];

    // RULE G: Unresolved Critical Incident
    if (
      inc.severity === 'CRITICAL' &&
      (inc.status === 'OPEN' || inc.status === 'ACKNOWLEDGED' || inc.status === 'INVESTIGATING')
    ) {
      exceptions.push({
        exceptionId: `exc_crit_inc_${inc.id}`,
        rule: 'CRITICAL_INCIDENT_OPEN',
        severity: 'HIGH',
        routeId: inc.routeId,
        resourceType: 'INCIDENT_CASE',
        resourceId: inc.id,
        description: `Critical safety incident '${inc.title}' is currently open (${inc.status}) without full resolution.`,
        evidence: {
          incidentId: inc.id,
          severity: inc.severity,
          status: inc.status,
          createdAt: inc.createdAt,
        },
        createdAt: inc.createdAt,
        status: 'ACTIVE',
      });
    }

    // RULE A: Audit Coverage Gap for Incidents
    if (inc.status === 'RESOLVED' || inc.status === 'CLOSED') {
      const hasResolvedAudit = incEvents.some(
        (e) => e.eventType === 'INCIDENT_RESOLVED' || e.action.includes('RESOLV')
      );
      if (!hasResolvedAudit) {
        exceptions.push({
          exceptionId: `exc_cov_inc_${inc.id}`,
          rule: 'AUDIT_COVERAGE_GAP',
          severity: 'HIGH',
          routeId: inc.routeId,
          resourceType: 'INCIDENT_CASE',
          resourceId: inc.id,
          description: `Safety incident case '${inc.title}' was ${inc.status} without a verified audit event.`,
          evidence: { incidentId: inc.id, status: inc.status },
          createdAt: inc.resolvedAt || inc.updatedAt,
          status: 'ACTIVE',
        });
      }

      // RULE K: Incomplete Evidence for Resolved Incident
      if (!inc.resolutionSummary || inc.resolutionSummary.trim() === '') {
        exceptions.push({
          exceptionId: `exc_ev_inc_${inc.id}`,
          rule: 'EVIDENCE_COMPLETENESS_GAP',
          severity: 'MEDIUM',
          routeId: inc.routeId,
          resourceType: 'INCIDENT_CASE',
          resourceId: inc.id,
          description: `Resolved incident case '${inc.id}' is missing mandatory administrative resolution documentation.`,
          evidence: { incidentId: inc.id, status: inc.status },
          createdAt: inc.resolvedAt || inc.updatedAt,
          status: 'ACTIVE',
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SAFETY ALERT GOVERNANCE (Rules A, H, K)
  // ─────────────────────────────────────────────────────────────────────────────
  for (const alt of params.alerts) {
    const altEvents = auditByResource.get(alt.id) || [];

    // RULE H: Active Critical Alert Without Review
    if (alt.severity === 'CRITICAL' && alt.status === 'ACTIVE') {
      const triggeredTime = new Date(alt.createdAt || alt.triggeredAt).getTime();
      const ageMs = now - triggeredTime;
      const hasAdminReview = altEvents.some(
        (e) =>
          e.eventType === 'SAFETY_ALERT_RESOLVED' ||
          e.eventType === 'INCIDENT_VIEWED' ||
          e.action.includes('REVIEW')
      );
      if (ageMs > SLA_THRESHOLDS.ALERT_REVIEW_WINDOW_MS || !hasAdminReview) {
        exceptions.push({
          exceptionId: `exc_crit_alt_${alt.id}`,
          rule: 'CRITICAL_ALERT_REVIEW_GAP',
          severity: 'HIGH',
          routeId: alt.routeId,
          resourceType: 'SAFETY_ALERT',
          resourceId: alt.id,
          description: `Active CRITICAL safety alert '${alt.title}' has no documented administrative review within 24 hours.`,
          evidence: {
            alertId: alt.id,
            severity: alt.severity,
            triggeredAt: alt.triggeredAt,
          },
          createdAt: alt.triggeredAt || alt.createdAt,
          status: 'ACTIVE',
        });
      }
    }

    // RULE A: Audit Coverage Gap for Alerts
    if (alt.status === 'RESOLVED') {
      const hasResolvedAudit = altEvents.some(
        (e) => e.eventType === 'SAFETY_ALERT_RESOLVED'
      );
      if (!hasResolvedAudit) {
        exceptions.push({
          exceptionId: `exc_cov_alt_${alt.id}`,
          rule: 'AUDIT_COVERAGE_GAP',
          severity: 'HIGH',
          routeId: alt.routeId,
          resourceType: 'SAFETY_ALERT',
          resourceId: alt.id,
          description: `Safety alert '${alt.title}' was marked RESOLVED without an authoritative audit ledger entry.`,
          evidence: { alertId: alt.id, status: alt.status },
          createdAt: alt.resolvedAt || alt.updatedAt,
          status: 'ACTIVE',
        });
      }

      // RULE K: Incomplete Evidence for Alert
      if (!alt.resolvedBy || alt.resolvedBy.trim() === '') {
        exceptions.push({
          exceptionId: `exc_ev_alt_${alt.id}`,
          rule: 'EVIDENCE_COMPLETENESS_GAP',
          severity: 'MEDIUM',
          routeId: alt.routeId,
          resourceType: 'SAFETY_ALERT',
          resourceId: alt.id,
          description: `Resolved safety alert '${alt.id}' lacks authoritative resolver identity.`,
          evidence: { alertId: alt.id, resolvedAt: alt.resolvedAt },
          createdAt: alt.resolvedAt || alt.updatedAt,
          status: 'ACTIVE',
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. ROUTE RISK & CAPACITY REVIEW GOVERNANCE (Rules I, J)
  // ─────────────────────────────────────────────────────────────────────────────
  if (params.decisionSupports) {
    for (const [routeId, ds] of params.decisionSupports.entries()) {
      const routeEvents = auditByRoute.get(routeId) || [];

      // Check recent review events (within last 24h)
      const recentRouteAudit = routeEvents.filter((e) => {
        const evTime = new Date(e.createdAt).getTime();
        return now - evTime <= SLA_THRESHOLDS.RISK_REVIEW_WINDOW_MS;
      });

      // RULE I: High Risk Without Recent Review
      if (ds.risk.level === 'HIGH' || ds.risk.level === 'CRITICAL' || ds.risk.score >= 60) {
        const hasRecentRiskReview = recentRouteAudit.some(
          (e) =>
            e.eventType === 'ROUTE_RISK_VIEWED' ||
            e.eventType === 'ROUTE_RISK_HISTORY_VIEWED' ||
            e.eventType === 'DECISION_SUPPORT_VIEWED' ||
            e.eventType === 'GOVERNANCE_REVIEWED' ||
            e.eventType === 'RECOMMENDATION_EVALUATED' ||
            e.eventType === 'RECOMMENDATION_APPROVED'
        );
        if (!hasRecentRiskReview) {
          exceptions.push({
            exceptionId: `exc_risk_rev_${routeId}`,
            rule: 'RISK_REVIEW_GAP',
            severity: 'MEDIUM',
            routeId,
            resourceType: 'ROUTE_RISK',
            resourceId: routeId,
            description: `Corridor ${ds.routeCode} has ${ds.risk.level} risk (${ds.risk.score}/100) without an administrative safety review in the last 24 hours.`,
            evidence: {
              routeId,
              routeCode: ds.routeCode,
              riskScore: ds.risk.score,
              riskLevel: ds.risk.level,
            },
            createdAt: new Date(now).toISOString(),
            status: 'ACTIVE',
          });
        }
      }

      // RULE J: High Demand Without Capacity Review
      const occ = ds.demand.predictedOccupancy ?? 0;
      if (
        occ >= 80 ||
        ds.demand.demandLevel === 'HIGH' ||
        ds.demand.demandLevel === 'CRITICAL'
      ) {
        const hasRecentCapacityReview = recentRouteAudit.some(
          (e) =>
            e.eventType === 'DECISION_SUPPORT_VIEWED' ||
            e.eventType === 'GOVERNANCE_REVIEWED' ||
            e.eventType === 'RECOMMENDATION_EVALUATED' ||
            e.eventType === 'RECOMMENDATION_APPROVED' ||
            e.action.includes('CAPACITY')
        );
        if (!hasRecentCapacityReview) {
          exceptions.push({
            exceptionId: `exc_cap_rev_${routeId}`,
            rule: 'CAPACITY_REVIEW_GAP',
            severity: 'MEDIUM',
            routeId,
            resourceType: 'DECISION_SUPPORT',
            resourceId: routeId,
            description: `Corridor ${ds.routeCode} has high predicted occupancy (${occ}%) without a recent capacity review.`,
            evidence: {
              routeId,
              routeCode: ds.routeCode,
              predictedOccupancy: occ,
            },
            createdAt: new Date(now).toISOString(),
            status: 'ACTIVE',
          });
        }
      }
    }
  }

  return { exceptions, auditChainBreaks, auditIntegrityFailures };
}

/**
 * Computes deterministic score, severity, status, and explanations for a single corridor.
 */
export function buildCorridorGovernanceReport(params: {
  route: FirestoreRoute;
  corridorExceptions: GovernanceException[];
  allAuditEvents: OperationalAuditEventRecord[];
  allRecommendations: OperationalRecommendationRecord[];
  allIncidents: IncidentCaseRecord[];
  allAlerts: SafetyAlertRecord[];
  decisionSupport?: RouteOperationalDecisionSupport;
}): CorridorGovernanceReport {
  const {
    route,
    corridorExceptions,
    allAuditEvents,
    allRecommendations,
    allIncidents,
    allAlerts,
    decisionSupport,
  } = params;

  // Determine canonical routeCode
  const routeCode = route.code || (route as any).routeCode || route.id;

  // Filter corridor specific resources
  const routeAudit = allAuditEvents.filter(
    (e) => e.routeId === route.id || e.routeCode === routeCode
  );
  const routeRecs = allRecommendations.filter(
    (r) => r.routeId === route.id || r.routeCode === routeCode
  );
  const routeIncidents = allIncidents.filter(
    (i) => i.routeId === route.id || i.routeCode === routeCode
  );
  const routeAlerts = allAlerts.filter(
    (a) => a.routeId === route.id || a.routeCode === routeCode
  );

  // Count exceptions by severity
  let criticalExceptionCount = 0;
  let highExceptionCount = 0;
  let mediumExceptionCount = 0;
  let lowExceptionCount = 0;

  for (const exc of corridorExceptions) {
    if (exc.severity === 'CRITICAL') criticalExceptionCount++;
    else if (exc.severity === 'HIGH') highExceptionCount++;
    else if (exc.severity === 'MEDIUM') mediumExceptionCount++;
    else if (exc.severity === 'LOW') lowExceptionCount++;
  }

  const exceptionCount = corridorExceptions.length;

  // Deterministic Status & Severity Assignment
  let governanceStatus: GovernanceStatus = 'GOVERNANCE_COMPLIANT';
  let governanceSeverity: GovernanceSeverity = 'INFO';

  if (criticalExceptionCount > 0) {
    governanceStatus = 'GOVERNANCE_CRITICAL';
    governanceSeverity = 'CRITICAL';
  } else if (highExceptionCount > 0) {
    governanceStatus = 'GOVERNANCE_AT_RISK';
    governanceSeverity = 'HIGH';
  } else if (mediumExceptionCount > 0 || lowExceptionCount > 0) {
    governanceStatus = 'GOVERNANCE_MONITOR';
    governanceSeverity = mediumExceptionCount > 0 ? 'MEDIUM' : 'LOW';
  }

  // Deterministic Score (Base 100 with explicit penalties)
  const penalty =
    criticalExceptionCount * GOVERNANCE_PENALTIES.CRITICAL +
    highExceptionCount * GOVERNANCE_PENALTIES.HIGH +
    mediumExceptionCount * GOVERNANCE_PENALTIES.MEDIUM +
    lowExceptionCount * GOVERNANCE_PENALTIES.LOW;
  const governanceScore = Math.max(0, Math.min(100, 100 - penalty));

  // Subsystem Breakdown
  const auditCoverageGaps = corridorExceptions.filter(
    (e) => e.rule === 'AUDIT_COVERAGE_GAP'
  ).length;
  const auditIntegrityFailures = corridorExceptions.filter(
    (e) => e.rule === 'AUDIT_INTEGRITY_FAILURE'
  ).length;
  const auditChainBreaks = corridorExceptions.filter(
    (e) => e.rule === 'AUDIT_CHAIN_BREAK'
  ).length;

  const pendingRecs = routeRecs.filter((r) => r.status === 'PENDING').length;
  const stalePendingRecs = corridorExceptions.filter(
    (e) => e.rule === 'STALE_PENDING_RECOMMENDATION'
  ).length;
  const approvedRecs = routeRecs.filter((r) => r.status === 'APPROVED').length;
  const overdueApprovedRecs = corridorExceptions.filter(
    (e) => e.rule === 'APPROVED_ACTION_OVERDUE'
  ).length;
  const completedRecs = routeRecs.filter((r) => r.status === 'COMPLETED').length;
  const dismissedRecs = routeRecs.filter((r) => r.status === 'DISMISSED').length;

  const openCriticalIncidents = corridorExceptions.filter(
    (e) => e.rule === 'CRITICAL_INCIDENT_OPEN'
  ).length;
  const totalOpenIncidents = routeIncidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  ).length;
  const resolvedIncidents = routeIncidents.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
  ).length;

  const activeCriticalAlerts = routeAlerts.filter(
    (a) => a.severity === 'CRITICAL' && a.status === 'ACTIVE'
  ).length;
  const alertReviewGaps = corridorExceptions.filter(
    (e) => e.rule === 'CRITICAL_ALERT_REVIEW_GAP'
  ).length;

  const riskReviewGap = corridorExceptions.some((e) => e.rule === 'RISK_REVIEW_GAP');
  const capacityReviewGap = corridorExceptions.some((e) => e.rule === 'CAPACITY_REVIEW_GAP');
  const evidenceGaps = corridorExceptions.filter(
    (e) => e.rule === 'EVIDENCE_COMPLETENESS_GAP'
  ).length;
  const humanViolations = corridorExceptions.filter(
    (e) => e.rule === 'HUMAN_GOVERNANCE_VIOLATION'
  ).length;

  // Build Explanations
  const explanation: GovernanceExplanationItem[] = corridorExceptions.map((exc) => ({
    rule: exc.rule,
    severity: exc.severity,
    reason: exc.description,
    supportingEvidence: exc.evidence,
    relatedResource: exc.resourceId,
    timestamp: exc.createdAt,
  }));

  // Build Human-Readable Briefing
  let briefing = '';
  if (exceptionCount === 0) {
    briefing = `Corridor ${routeCode} (${route.name}) is GOVERNANCE_COMPLIANT. All operational activities, audit logs, and recommendations adhere to deterministic governance invariants.`;
  } else {
    const highlights = corridorExceptions
      .slice(0, 2)
      .map((e) => e.description)
      .join('; ');
    briefing = `Corridor ${routeCode} is ${governanceStatus} (${governanceScore}/100) due to ${exceptionCount} exception(s): ${highlights}`;
  }

  return {
    routeId: route.id,
    routeCode,
    routeName: route.name,
    governanceStatus,
    governanceSeverity,
    governanceScore,
    exceptionCount,
    criticalExceptionCount,
    highExceptionCount,
    mediumExceptionCount,
    lowExceptionCount,
    auditCoverage: {
      status: auditCoverageGaps === 0 ? 'FULL' : 'GAP_DETECTED',
      totalEvents: routeAudit.length,
      gapCount: auditCoverageGaps,
      evaluatedActions: routeRecs.length + routeIncidents.length + routeAlerts.length,
    },
    auditIntegrity: {
      status: auditIntegrityFailures === 0 ? 'VERIFIED' : 'COMPROMISED',
      verifiedCount: routeAudit.length - auditIntegrityFailures,
      failedCount: auditIntegrityFailures,
    },
    auditChainStatus: {
      status: auditChainBreaks === 0 ? 'INTACT' : 'BROKEN',
      intact: auditChainBreaks === 0,
      breaksDetected: auditChainBreaks,
    },
    recommendationGovernance: {
      status:
        overdueApprovedRecs > 0
          ? 'OVERDUE'
          : stalePendingRecs > 0
          ? 'STALE'
          : pendingRecs > 0
          ? 'ATTENTION_REQUIRED'
          : 'COMPLIANT',
      total: routeRecs.length,
      pending: pendingRecs,
      stalePending: stalePendingRecs,
      approved: approvedRecs,
      overdueApproved: overdueApprovedRecs,
      completed: completedRecs,
      dismissed: dismissedRecs,
    },
    incidentGovernance: {
      status:
        openCriticalIncidents > 0
          ? 'CRITICAL_OPEN'
          : totalOpenIncidents > 0
          ? 'ATTENTION_REQUIRED'
          : 'HEALTHY',
      total: routeIncidents.length,
      openCritical: openCriticalIncidents,
      totalOpen: totalOpenIncidents,
      resolved: resolvedIncidents,
    },
    alertGovernance: {
      status:
        alertReviewGaps > 0
          ? 'UNREVIEWED_CRITICAL'
          : activeCriticalAlerts > 0
          ? 'ATTENTION_REQUIRED'
          : 'HEALTHY',
      total: routeAlerts.length,
      activeCritical: activeCriticalAlerts,
      reviewGaps: alertReviewGaps,
    },
    riskReviewGovernance: {
      status: riskReviewGap ? 'REVIEW_GAP' : 'CURRENT',
      currentRiskScore: decisionSupport ? decisionSupport.risk.score : 0,
      currentRiskLevel: decisionSupport ? decisionSupport.risk.level : 'LOW',
      reviewGap: riskReviewGap,
      lastReviewedAt: routeAudit.length > 0 ? routeAudit[0].createdAt : null,
    },
    demandReviewGovernance: {
      status: capacityReviewGap ? 'REVIEW_GAP' : 'CURRENT',
      predictedOccupancy: decisionSupport?.demand?.predictedOccupancy ?? 0,
      demandLevel: decisionSupport?.demand?.demandLevel ?? 'LOW',
      reviewGap: capacityReviewGap,
    },
    evidenceGovernance: {
      status: evidenceGaps === 0 ? 'COMPLETE' : 'INCOMPLETE',
      completenessGaps: evidenceGaps,
    },
    humanInTheLoopStatus: {
      status: humanViolations === 0 ? 'VERIFIED' : 'VIOLATION_DETECTED',
      violations: humanViolations,
    },
    exceptions: corridorExceptions,
    evidence: corridorExceptions.map((e) => e.evidence),
    briefing,
    explanation,
  };
}

/**
 * Evaluates fleet-wide governance state across all corridors.
 * Consumes authoritative server-side stores exclusively.
 */
export async function evaluateFleetGovernance(): Promise<FleetGovernanceResponse> {
  const routes = await getAllRoutes();
  const safeRoutes = routes.length > 0 ? routes : DEFAULT_CORRIDOR_ROUTES;

  // Retrieve authoritative datasets
  const [{ events: auditEvents }, { recommendations }, { incidents }, alerts] =
    await Promise.all([
      getOperationalAuditEvents({ limit: 200 }),
      getOperationalRecommendations({ limit: 200 }),
      getIncidentCases({ limit: 100 }),
      getSafetyAlerts({ limit: 100 }),
    ]);

  // Retrieve decision supports for each route
  const decisionSupports = new Map<string, RouteOperationalDecisionSupport>();
  for (const route of safeRoutes) {
    try {
      const ds = await buildOperationalDecisionSupport(route.id);
      if (ds && 'operationalStatus' in ds) {
        decisionSupports.set(route.id, ds as RouteOperationalDecisionSupport);
      }
    } catch {
      // Graceful fallback
    }
  }

  // Run deterministic governance rule engine
  const { exceptions, auditChainBreaks, auditIntegrityFailures } = evaluateGovernanceRules({
    routes: safeRoutes,
    auditEvents,
    recommendations,
    incidents,
    alerts,
    decisionSupports,
  });

  // Group exceptions by corridor
  const corridorReports: CorridorGovernanceReport[] = [];
  let compliantRoutes = 0;
  let monitorRoutes = 0;
  let atRiskRoutes = 0;
  let criticalRoutes = 0;

  for (const route of safeRoutes) {
    const routeCode = route.code || (route as any).routeCode || route.id;
    const corridorExceptions = exceptions.filter(
      (e) => e.routeId === route.id || e.routeId === routeCode
    );

    const report = buildCorridorGovernanceReport({
      route,
      corridorExceptions,
      allAuditEvents: auditEvents,
      allRecommendations: recommendations,
      allIncidents: incidents,
      allAlerts: alerts,
      decisionSupport: decisionSupports.get(route.id),
    });

    if (report.governanceStatus === 'GOVERNANCE_CRITICAL') criticalRoutes++;
    else if (report.governanceStatus === 'GOVERNANCE_AT_RISK') atRiskRoutes++;
    else if (report.governanceStatus === 'GOVERNANCE_MONITOR') monitorRoutes++;
    else compliantRoutes++;

    corridorReports.push(report);
  }

  // Calculate fleet-wide exception tallies
  let criticalExceptions = 0;
  let highExceptions = 0;
  let mediumExceptions = 0;
  let lowExceptions = 0;

  let pendingRecommendations = 0;
  let stalePendingRecommendations = 0;
  let approvedRecommendations = 0;
  let overdueApprovedRecommendations = 0;

  let openCriticalIncidents = 0;
  let criticalAlertReviewGaps = 0;
  let riskReviewGaps = 0;
  let capacityReviewGaps = 0;
  let evidenceCompletenessGaps = 0;
  let actorIdentityGaps = 0;
  let correlationTraceabilityGaps = 0;
  let humanGovernanceViolations = 0;

  for (const exc of exceptions) {
    if (exc.severity === 'CRITICAL') criticalExceptions++;
    else if (exc.severity === 'HIGH') highExceptions++;
    else if (exc.severity === 'MEDIUM') mediumExceptions++;
    else if (exc.severity === 'LOW') lowExceptions++;

    if (exc.rule === 'STALE_PENDING_RECOMMENDATION') stalePendingRecommendations++;
    if (exc.rule === 'APPROVED_ACTION_OVERDUE') overdueApprovedRecommendations++;
    if (exc.rule === 'CRITICAL_INCIDENT_OPEN') openCriticalIncidents++;
    if (exc.rule === 'CRITICAL_ALERT_REVIEW_GAP') criticalAlertReviewGaps++;
    if (exc.rule === 'RISK_REVIEW_GAP') riskReviewGaps++;
    if (exc.rule === 'CAPACITY_REVIEW_GAP') capacityReviewGaps++;
    if (exc.rule === 'EVIDENCE_COMPLETENESS_GAP') evidenceCompletenessGaps++;
    if (exc.rule === 'ACTOR_IDENTITY_GAP') actorIdentityGaps++;
    if (exc.rule === 'CORRELATION_TRACEABILITY_GAP') correlationTraceabilityGaps++;
    if (exc.rule === 'HUMAN_GOVERNANCE_VIOLATION') humanGovernanceViolations++;
  }

  for (const rec of recommendations) {
    if (rec.status === 'PENDING') pendingRecommendations++;
    if (rec.status === 'APPROVED') approvedRecommendations++;
  }

  const summary: FleetGovernanceSummary = {
    totalRoutes: safeRoutes.length,
    compliantRoutes,
    monitorRoutes,
    atRiskRoutes,
    criticalRoutes,
    totalGovernanceExceptions: exceptions.length,
    criticalExceptions,
    highExceptions,
    mediumExceptions,
    lowExceptions,
    auditEventsReviewed: auditEvents.length,
    auditIntegrityFailures,
    auditChainBreaks,
    pendingRecommendations,
    stalePendingRecommendations,
    approvedRecommendations,
    overdueApprovedRecommendations,
    openCriticalIncidents,
    criticalAlertReviewGaps,
    riskReviewGaps,
    capacityReviewGaps,
    evidenceCompletenessGaps,
    actorIdentityGaps,
    correlationTraceabilityGaps,
    humanGovernanceViolations,
  };

  return { summary, corridors: corridorReports };
}

/**
 * Evaluates governance state for a single corridor.
 */
export async function evaluateCorridorGovernance(
  routeIdOrCode: string
): Promise<{ summary: FleetGovernanceSummary; corridor: CorridorGovernanceReport } | null> {
  const fleetResponse = await evaluateFleetGovernance();
  const target = routeIdOrCode.trim().toLowerCase();

  const corridor = fleetResponse.corridors.find(
    (c) =>
      c.routeId.toLowerCase() === target ||
      c.routeCode.toLowerCase() === target
  );

  if (!corridor) {
    return null;
  }

  return {
    summary: fleetResponse.summary,
    corridor,
  };
}
