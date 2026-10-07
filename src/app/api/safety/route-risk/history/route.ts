import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getRouteById,
  getRouteByCode,
  DEFAULT_CORRIDOR_ROUTES,
} from '@/lib/firestore-db';
import {
  recordRouteRiskSnapshot,
  getRouteRiskHistory,
  calculateRouteRiskTrend,
} from '@/lib/safety/route-risk-history-store';
import { recordOperationalAuditEvent } from '@/lib/operations/operational-audit-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
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

    const { searchParams } = new URL(req.url);
    const rawRouteId = searchParams.get('routeId');
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
    const limit = isNaN(limitParam) || limitParam <= 0 ? 50 : Math.min(limitParam, 200);

    if (rawRouteId) {
      const routeId = rawRouteId.trim();
      if (!routeId) {
        return NextResponse.json(
          { error: 'Route ID parameter cannot be empty' },
          { status: 400 }
        );
      }

      // Validate route exists
      let route = (await getRouteById(routeId)) || (await getRouteByCode(routeId));
      if (!route) {
        for (const defRoute of DEFAULT_CORRIDOR_ROUTES) {
          if (defRoute.id === routeId || defRoute.code.toLowerCase() === routeId.toLowerCase()) {
            route = defRoute;
            break;
          }
        }
      }

      if (!route) {
        return NextResponse.json(
          { error: `Route not found with identifier '${routeId}'` },
          { status: 404 }
        );
      }

      const snapshots = await getRouteRiskHistory(route.id, limit);
      const trendResult = calculateRouteRiskTrend(snapshots);

      if (searchParams.get('audit') === 'true') {
        try {
          await recordOperationalAuditEvent({
            eventType: 'ROUTE_RISK_HISTORY_VIEWED',
            actor: {
              id: session.id,
              role: session.role || 'ADMIN',
              email: session.email,
              name: session.name,
            },
            resourceType: 'ROUTE_RISK',
            resourceId: route.id,
            routeId: route.id,
            routeCode: route.code,
            routeName: route.name,
            action: 'VIEW_ROUTE_RISK_HISTORY',
            description: `Admin viewed route risk history and trend analysis for ${route.code} (${trendResult.trend})`,
            resultingState: {
              trend: trendResult.trend,
              totalSnapshots: snapshots.length,
            },
            evidence: {
              trend: trendResult.trend,
              factorDeltas: trendResult.factorDeltas,
            },
            sourceModule: 'ROUTE_RISK',
            correlationId: route.id,
          });
        } catch (auditErr) {
          console.warn('[RouteRiskHistoryAPI] Failed to record audit event:', auditErr);
        }
      }

      return NextResponse.json({
        success: true,
        routeId: route.id,
        routeCode: route.code,
        routeName: route.name,
        snapshots,
        trend: trendResult.trend,
        trendAnalysis: trendResult,
        totalSnapshots: snapshots.length,
      });
    }

    // Fleet-wide historical overview
    const fleetSnapshots = await getRouteRiskHistory(undefined, limit);
    return NextResponse.json({
      success: true,
      snapshots: fleetSnapshots,
      totalSnapshots: fleetSnapshots.length,
    });
  } catch (error: any) {
    console.error('Route risk history GET API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to retrieve route risk history' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin command center privileges required' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawRouteId = body.routeId;

    if (!rawRouteId || typeof rawRouteId !== 'string' || !rawRouteId.trim()) {
      return NextResponse.json(
        { error: 'Route ID parameter is required in request body' },
        { status: 400 }
      );
    }

    const routeId = rawRouteId.trim();

    // Verify route exists
    let route = (await getRouteById(routeId)) || (await getRouteByCode(routeId));
    if (!route) {
      for (const defRoute of DEFAULT_CORRIDOR_ROUTES) {
        if (defRoute.id === routeId || defRoute.code.toLowerCase() === routeId.toLowerCase()) {
          route = defRoute;
          break;
        }
      }
    }

    if (!route) {
      return NextResponse.json(
        { error: `Route not found with identifier '${routeId}'` },
        { status: 404 }
      );
    }

    // Security invariant: Client cannot supply forged risk scores or levels.
    // recordRouteRiskSnapshot() strictly calculates everything server-side.
    const snapshot = await recordRouteRiskSnapshot(route.id);
    const history = await getRouteRiskHistory(route.id, 50);
    const trendResult = calculateRouteRiskTrend(history);

    return NextResponse.json({
      success: true,
      message: `Risk snapshot recorded for route ${route.code}`,
      snapshot,
      trend: trendResult.trend,
      trendAnalysis: trendResult,
      totalSnapshots: history.length,
    });
  } catch (error: any) {
    console.error('Route risk snapshot POST API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to record route risk snapshot' },
      { status: 500 }
    );
  }
}
