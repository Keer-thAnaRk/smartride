import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getRouteById,
  getRouteByCode,
  DEFAULT_CORRIDOR_ROUTES,
} from '@/lib/firestore-db';
import { getRouteRiskHistory } from '@/lib/safety/route-risk-history-store';
import { calculateSafetyRiskProjection } from '@/lib/safety/predictive-safety-engine';

export const dynamic = 'force-dynamic';

/**
 * Helper to resolve corridor route by ID or Code.
 */
async function resolveRoute(rawRouteId?: string | null) {
  let routeId = rawRouteId?.trim();
  if (!routeId) {
    routeId = DEFAULT_CORRIDOR_ROUTES[0].id;
  }

  let route = (await getRouteById(routeId)) || (await getRouteByCode(routeId));
  if (!route) {
    for (const def of DEFAULT_CORRIDOR_ROUTES) {
      if (def.id === routeId || def.code.toLowerCase() === routeId.toLowerCase()) {
        route = def;
        break;
      }
    }
  }

  return route;
}

/**
 * GET /api/safety/prediction
 * Admin-only predictive safety intelligence endpoint.
 * Query: ?routeId=<id>
 * Strictly derived server-side from real historical RouteRiskSnapshot records.
 */
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

    const route = await resolveRoute(rawRouteId);
    if (!route) {
      return NextResponse.json(
        { error: `Route not found with identifier '${rawRouteId}'` },
        { status: 404 }
      );
    }

    // Retrieve real chronological historical snapshots from store
    const snapshots = await getRouteRiskHistory(route.id, 50);

    // Run deterministic statistical forecasting engine
    const result = calculateSafetyRiskProjection(snapshots, {
      id: route.id,
      code: route.code,
      name: route.name,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/safety/prediction:', error);
    return NextResponse.json(
      { error: 'Internal server error while evaluating predictive safety analytics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/safety/prediction
 * Admin-only endpoint for evaluating risk trajectory.
 * Strictly derives all metrics server-side, ignoring any client-sent tamper fields.
 */
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
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawRouteId = body.routeId;

    if (!rawRouteId || typeof rawRouteId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid routeId parameter in request body' },
        { status: 400 }
      );
    }

    const route = await resolveRoute(rawRouteId);
    if (!route) {
      return NextResponse.json(
        { error: `Route not found with identifier '${rawRouteId}'` },
        { status: 404 }
      );
    }

    // Strictly fetch server snapshots (client-supplied scores/trends are completely ignored)
    const snapshots = await getRouteRiskHistory(route.id, 50);

    const result = calculateSafetyRiskProjection(snapshots, {
      id: route.id,
      code: route.code,
      name: route.name,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/safety/prediction:', error);
    return NextResponse.json(
      { error: 'Internal server error while evaluating predictive safety analytics' },
      { status: 500 }
    );
  }
}
