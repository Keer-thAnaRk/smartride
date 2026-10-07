import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getRouteById,
  getRouteByCode,
  DEFAULT_CORRIDOR_ROUTES,
} from '@/lib/firestore-db';
import { getRouteRiskHistory } from '@/lib/safety/route-risk-history-store';
import { predictRouteSafety } from '@/lib/safety/predictive-safety-engine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/safety/predictive
 * Admin-only predictive safety analytics endpoint.
 * Query: ?routeId=<id>&limit=<n>
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
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
    const limit = isNaN(limitParam) || limitParam <= 0 ? 50 : Math.min(limitParam, 200);

    // Resolve route identifier (defaults to first corridor route if unspecified)
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

    if (!route) {
      return NextResponse.json(
        { error: `Route not found with identifier '${routeId}'` },
        { status: 404 }
      );
    }

    // Retrieve real chronological historical snapshots from store
    const snapshots = await getRouteRiskHistory(route.id, limit);

    // Run deterministic statistical forecasting engine
    const analysis = predictRouteSafety(snapshots, {
      id: route.id,
      code: route.code,
      name: route.name,
    });

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('Error in GET /api/safety/predictive:', error);
    return NextResponse.json(
      { error: 'Internal server error while evaluating predictive safety analytics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/safety/predictive/evaluate
 * Admin-only evaluate endpoint for predictive analytics.
 * Strictly derives all metrics server-side.
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

    const routeId = rawRouteId.trim();
    if (!routeId) {
      return NextResponse.json(
        { error: 'routeId cannot be empty' },
        { status: 400 }
      );
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

    if (!route) {
      return NextResponse.json(
        { error: `Route not found with identifier '${routeId}'` },
        { status: 404 }
      );
    }

    const snapshots = await getRouteRiskHistory(route.id, 50);

    const analysis = predictRouteSafety(snapshots, {
      id: route.id,
      code: route.code,
      name: route.name,
    });

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('Error in POST /api/safety/predictive/evaluate:', error);
    return NextResponse.json(
      { error: 'Internal server error while evaluating predictive safety' },
      { status: 500 }
    );
  }
}
