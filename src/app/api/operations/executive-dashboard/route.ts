import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  buildOperationalDecisionSupport,
  RouteOperationalDecisionSupport,
  FleetDecisionSupportResult,
} from '@/lib/operations/decision-support-engine';
import {
  getOperationalRecommendations,
  OperationalRecommendationRecord,
  OperationalRecommendationsSummary,
} from '@/lib/operations/recommendation-engine';
import {
  getOperationalAuditEvents,
  verifyAuditEventIntegrity,
  recordOperationalAuditEvent,
  OperationalAuditEventRecord,
} from '@/lib/operations/operational-audit-store';

import {
  MANDATORY_GOVERNANCE_NOTICE,
  ExecutiveCorridorItem,
} from '@/lib/operations/executive-dashboard-types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication & RBAC Authorization
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // 2. Query Parameters
    const { searchParams } = new URL(request.url);
    const routeIdParam = searchParams.get('routeId');
    const shouldAudit = searchParams.get('audit') === 'true';

    // 3. Fetch verified operational decision support (Step 6)
    const decisionSupportResult = await buildOperationalDecisionSupport();
    if (!decisionSupportResult || !('routes' in decisionSupportResult)) {
      return NextResponse.json(
        { error: 'Failed to aggregate fleet operational decision support' },
        { status: 500 }
      );
    }

    const fleetDecision = decisionSupportResult as FleetDecisionSupportResult;
    let targetRoutes = fleetDecision.routes;

    // Route filter check
    if (routeIdParam) {
      const trimmed = routeIdParam.trim().toLowerCase();
      const matched = targetRoutes.filter(
        (r) =>
          r.routeId.toLowerCase() === trimmed ||
          r.routeCode.toLowerCase() === trimmed
      );
      if (matched.length === 0) {
        return NextResponse.json(
          { error: `Corridor not found: ${routeIdParam}` },
          { status: 404 }
        );
      }
      targetRoutes = matched;
    }

    // 4. Fetch verified recommendations (Step 7)
    const { recommendations: allRecs, summary: recSummary } =
      await getOperationalRecommendations({ limit: 100 });

    // 5. Fetch verified audit activity (Step 8)
    const { events: recentAuditEvents } = await getOperationalAuditEvents({
      limit: 50,
    });

    // Verify cryptographic integrity of recent audit records
    let totalVerifiedAudit = 0;
    let integrityFailures = 0;
    for (const evt of recentAuditEvents) {
      if (verifyAuditEventIntegrity(evt)) {
        totalVerifiedAudit++;
      } else {
        integrityFailures++;
      }
    }

    // 6. Map Corridors
    const corridorItems: ExecutiveCorridorItem[] = targetRoutes.map((route) => {
      const routePendingRecs = allRecs.filter(
        (rec) =>
          (rec.routeId === route.routeId || rec.routeCode === route.routeCode) &&
          rec.status === 'PENDING'
      );

      const routeAudits = recentAuditEvents.filter(
        (evt) =>
          evt.routeId === route.routeId || evt.routeCode === route.routeCode
      );

      return {
        routeId: route.routeId,
        routeCode: route.routeCode,
        routeName: route.routeName,
        operationalStatus: route.operationalStatus,
        riskScore: route.risk.score,
        riskLevel: route.risk.level,
        riskTrend: route.risk.trend,
        scoreDelta: route.risk.scoreDelta,
        activeAlertsCount: route.alerts.activeCount,
        activeCriticalAlerts: route.alerts.criticalCount,
        activeHighAlerts: route.alerts.highCount,
        activeMediumAlerts: route.alerts.mediumCount,
        activeLowAlerts: route.alerts.lowCount,
        unresolvedIncidentsCount: route.incidents.unresolvedCount,
        criticalIncidentsCount: route.incidents.criticalCount,
        predictedDemand: route.demand.predictedDemand,
        predictedOccupancy: route.demand.predictedOccupancy,
        demandLevel: route.demand.demandLevel,
        dataQuality: route.demand.dataQuality,
        capacityRecommendation: route.capacity.recommendation,
        vehicleCapacity: route.capacity.vehicleCapacity,
        pendingRecommendationsCount: routePendingRecs.length,
        pendingRecommendations: routePendingRecs,
        briefing: route.briefing,
        explanation: route.explanation,
        evidence: route.evidence,
        recentAuditEvents: routeAudits.slice(0, 5),
      };
    });

    // 7. Top Attention Corridors (URGENT_REVIEW and ATTENTION_REQUIRED only)
    const topAttentionCorridors = corridorItems.filter(
      (c) =>
        c.operationalStatus === 'URGENT_REVIEW' ||
        c.operationalStatus === 'ATTENTION_REQUIRED'
    );

    // 8. Safety Situation
    let totalActiveCritAlerts = 0;
    let totalActiveHighAlerts = 0;
    let totalActiveMedAlerts = 0;
    let totalActiveLowAlerts = 0;
    let totalUnresCritIncidents = 0;
    let totalUnresHighIncidents = 0;

    for (const c of corridorItems) {
      totalActiveCritAlerts += c.activeCriticalAlerts;
      totalActiveHighAlerts += c.activeHighAlerts;
      totalActiveMedAlerts += c.activeMediumAlerts;
      totalActiveLowAlerts += c.activeLowAlerts;
      totalUnresCritIncidents += c.criticalIncidentsCount;
    }

    const totalUnresolvedIncidents = corridorItems.reduce(
      (sum, c) => sum + c.unresolvedIncidentsCount,
      0
    );

    // Collect recent safety events
    const recentSafetyEvents = corridorItems.flatMap((c) => {
      const alertEvents = (c.evidence?.alertEvidence || []).map((a: any) => ({
        id: a.id,
        kind: 'ALERT',
        routeCode: c.routeCode,
        severity: a.severity,
        title: a.title,
        status: a.status,
        createdAt: a.createdAt,
      }));
      const incidentEvents = (c.evidence?.incidentEvidence || []).map((inc: any) => ({
        id: inc.id,
        kind: 'INCIDENT',
        routeCode: c.routeCode,
        severity: inc.severity,
        title: inc.title,
        status: inc.status,
        createdAt: inc.createdAt,
      }));
      return [...alertEvents, ...incidentEvents];
    });

    // 9. Demand & Capacity Situation
    const validOccupancies = corridorItems
      .map((c) => c.predictedOccupancy)
      .filter((occ): occ is number => typeof occ === 'number');

    const avgFleetOccupancy =
      validOccupancies.length > 0
        ? Math.round(
            validOccupancies.reduce((a, b) => a + b, 0) / validOccupancies.length
          )
        : null;

    const criticalDemandRoutes = corridorItems.filter(
      (c) =>
        (c.predictedOccupancy !== null && c.predictedOccupancy >= 90) ||
        c.demandLevel === 'CRITICAL'
    ).length;

    const highDemandRoutes = corridorItems.filter(
      (c) =>
        (c.predictedOccupancy !== null && c.predictedOccupancy >= 80) ||
        c.demandLevel === 'HIGH'
    ).length;

    const capacityPressureCorridors = corridorItems
      .filter(
        (c) =>
          (c.predictedOccupancy !== null && c.predictedOccupancy >= 80) ||
          c.demandLevel === 'HIGH' ||
          c.demandLevel === 'CRITICAL'
      )
      .map((c) => c.routeCode);

    const insufficientDataCorridors = corridorItems
      .filter((c) => c.dataQuality === 'INSUFFICIENT_DATA')
      .map((c) => c.routeCode);

    // 10. Audit event logging if explicitly requested
    if (shouldAudit) {
      try {
        await recordOperationalAuditEvent({
          eventType: 'EXECUTIVE_DASHBOARD_VIEWED',
          actor: {
            id: session.id,
            role: session.role || 'ADMIN',
            email: session.email || null,
            name: session.name || null,
          },
          resourceType: 'EXECUTIVE_DASHBOARD',
          resourceId: routeIdParam || 'FLEET',
          routeId: routeIdParam || undefined,
          action: 'VIEW_EXECUTIVE_DASHBOARD',
          description: `Administrator accessed Operational Intelligence Executive Dashboard for ${
            routeIdParam || 'FLEET'
          }`,
          evidence: {
            totalRoutes: corridorItems.length,
            urgentReview: fleetDecision.summary.urgentReview,
            attentionRequired: fleetDecision.summary.attentionRequired,
            activeCriticalAlerts: totalActiveCritAlerts,
            unresolvedIncidents: totalUnresolvedIncidents,
          },
          sourceModule: 'EXECUTIVE_DASHBOARD',
          correlationId: routeIdParam || 'FLEET_EXECUTIVE_DASHBOARD',
        });
      } catch (auditErr) {
        console.warn('[ExecutiveDashboardAPI] Notice recording audit event:', auditErr);
      }
    }

    // 11. Compose Comprehensive Dashboard Payload
    return NextResponse.json({
      success: true,
      governanceNotice: MANDATORY_GOVERNANCE_NOTICE,
      summary: {
        totalRoutes: corridorItems.length,
        urgentReview: corridorItems.filter((c) => c.operationalStatus === 'URGENT_REVIEW').length,
        attentionRequired: corridorItems.filter((c) => c.operationalStatus === 'ATTENTION_REQUIRED').length,
        monitor: corridorItems.filter((c) => c.operationalStatus === 'MONITOR').length,
        normal: corridorItems.filter((c) => c.operationalStatus === 'NORMAL').length,
        activeCriticalAlerts: totalActiveCritAlerts,
        unresolvedIncidents: totalUnresolvedIncidents,
        criticalDemandRoutes,
        pendingRecommendations: recSummary.pending,
        recentAuditEvents: recentAuditEvents.length,
      },
      corridors: corridorItems,
      topAttentionCorridors,
      safety: {
        activeCriticalAlerts: totalActiveCritAlerts,
        activeHighAlerts: totalActiveHighAlerts,
        activeMediumAlerts: totalActiveMedAlerts,
        activeLowAlerts: totalActiveLowAlerts,
        unresolvedCriticalIncidents: totalUnresCritIncidents,
        unresolvedHighIncidents: totalUnresHighIncidents,
        totalUnresolvedIncidents,
        recentSafetyEvents: recentSafetyEvents.slice(0, 10),
      },
      demand: {
        criticalDemandRoutes,
        highDemandRoutes,
        averageOccupancy: avgFleetOccupancy,
        capacityPressureCorridors,
        insufficientDataCorridors,
        insufficientDataNotice:
          insufficientDataCorridors.length > 0
            ? 'Demand intelligence unavailable due to insufficient historical data.'
            : null,
      },
      recommendations: {
        total: recSummary.total,
        pending: recSummary.pending,
        critical: recSummary.critical,
        high: recSummary.high,
        medium: recSummary.medium,
        low: recSummary.low,
        approved: recSummary.approved,
        completed: recSummary.completed,
        dismissed: recSummary.dismissed,
        items: allRecs.slice(0, 15),
      },
      recentActivity: recentAuditEvents.slice(0, 15),
      auditIntegrity: {
        status: integrityFailures === 0 ? 'VERIFIED' : 'REVIEW_REQUIRED',
        totalVerified: totalVerifiedAudit,
        integrityFailures,
        chainBreaks: 0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[ExecutiveDashboardAPI] Error retrieving dashboard data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve executive dashboard intelligence' },
      { status: 500 }
    );
  }
}

/**
 * Mutation guards: The dashboard is strictly read-only and advisory.
 * Any mutation attempts return 405 Method Not Allowed.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Executive Dashboard is strictly read-only' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Executive Dashboard is strictly read-only' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Executive Dashboard is strictly read-only' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Executive Dashboard is strictly read-only' },
    { status: 405 }
  );
}
