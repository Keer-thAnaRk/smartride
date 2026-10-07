import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { evaluateAndSaveRouteRecommendations } from '@/lib/operations/recommendation-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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

    // 2. Safe Body Parsing (Only routeId is accepted from client)
    const body = await req.json().catch(() => ({}));
    const routeId = body.routeId?.trim();

    if (!routeId) {
      return NextResponse.json(
        { error: 'Route ID is required to evaluate operational recommendations' },
        { status: 400 }
      );
    }

    // 3. Evaluate & Persist Server-Side
    const recommendations = await evaluateAndSaveRouteRecommendations(routeId, session);

    return NextResponse.json({
      success: true,
      recommendations,
    });
  } catch (error: any) {
    if (error.message?.includes('Route not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    console.error('[RecommendationEvaluateAPI] Error evaluating route recommendations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to evaluate recommendations' },
      { status: 500 }
    );
  }
}
