import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  buildOperationalDecisionSupport,
  RouteOperationalDecisionSupport,
  FleetDecisionSupportResult,
} from '@/lib/operations/decision-support-engine';
import { recordOperationalAuditEvent } from '@/lib/operations/operational-audit-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. RBAC Authentication Enforcement
    const session = getSessionFromRequest(req);
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

    // 2. Query Parameter Handling
    const { searchParams } = new URL(req.url);
    const targetRouteParam = searchParams.get('routeId') || searchParams.get('routeCode');

    // 3. Build Decision Support Data Server-Side
    const result = await buildOperationalDecisionSupport(targetRouteParam || undefined);

    // Optional audit on explicit review (avoids automated polling spam)
    if (searchParams.get('audit') === 'true' && result) {
      try {
        const routeObj = targetRouteParam ? (result as RouteOperationalDecisionSupport) : null;
        await recordOperationalAuditEvent({
          eventType: 'DECISION_SUPPORT_VIEWED',
          actor: {
            id: session.id,
            role: session.role || 'ADMIN',
            email: session.email,
            name: session.name,
          },
          resourceType: 'DECISION_SUPPORT',
          resourceId: routeObj?.routeId || 'FLEET',
          routeId: routeObj?.routeId || null,
          routeCode: routeObj?.routeCode || null,
          routeName: routeObj?.routeName || null,
          action: 'VIEW_DECISION_SUPPORT',
          description: routeObj
            ? `Admin explicitly reviewed decision support intelligence for route ${routeObj.routeCode}`
            : `Admin explicitly reviewed fleet-wide operational decision support`,
          resultingState: routeObj
            ? { operationalStatus: routeObj.operationalStatus, riskScore: routeObj.risk.score }
            : { totalRoutes: (result as FleetDecisionSupportResult).summary?.totalRoutes },
          evidence: routeObj
            ? { briefing: routeObj.briefing, riskScore: routeObj.risk.score }
            : { criticalRoutes: (result as FleetDecisionSupportResult).summary?.criticalRiskRoutes },
          sourceModule: 'DECISION_SUPPORT',
          correlationId: routeObj?.routeId || 'FLEET',
        });
      } catch (auditErr) {
        console.warn('[DecisionSupportAPI] Failed to record audit event:', auditErr);
      }
    }

    if (targetRouteParam) {
      if (!result) {
        return NextResponse.json(
          { error: `Route not found with identifier '${targetRouteParam}'` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        route: result as RouteOperationalDecisionSupport,
      });
    }

    return NextResponse.json(result as FleetDecisionSupportResult);
  } catch (error: any) {
    console.error('[DecisionSupportAPI] Error generating operational decision support:', error);
    return NextResponse.json(
      { error: error.message || 'Operational decision support failed' },
      { status: 500 }
    );
  }
}
