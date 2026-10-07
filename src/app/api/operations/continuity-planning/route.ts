import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  buildOperationalContinuityPlan,
  MANDATORY_CONTINUITY_PLANNING_NOTICE,
  MANDATORY_CONTINUITY_SAFETY_STATEMENT,
} from '@/lib/operations/continuity-planning-engine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operations/continuity-planning
 *
 * Retrieves fleet-wide or corridor-specific operational continuity and recovery plans.
 * Strictly read-only, non-mutative, server-authoritative, deterministic, and advisory.
 * Zero-audit pollution: Read operations do not emit audit ledger events.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authentication & RBAC Authorization
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // 2. Query Parameters
    const { searchParams } = new URL(request.url);
    const routeIdentifier = searchParams.get('routeId') || searchParams.get('routeCode');

    // 3. Build Continuity Plan (server-authoritative; client query params cannot forge metrics)
    const result = await buildOperationalContinuityPlan(routeIdentifier || undefined);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    const message = error?.message || 'Operational continuity planning evaluation failed';

    // 404 Route Not Found
    if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('route not found')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 404 }
      );
    }

    console.error('[ContinuityPlanningAPI] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal operational continuity planning error' },
      { status: 500 }
    );
  }
}

/**
 * Mutation & unsupported method guards:
 * Operational Continuity Planning is strictly read-only and advisory.
 * Any mutation attempts return 405 Method Not Allowed.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational continuity planning is strictly read-only and advisory',
      notice: MANDATORY_CONTINUITY_PLANNING_NOTICE,
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational continuity planning is strictly read-only and advisory',
      notice: MANDATORY_CONTINUITY_PLANNING_NOTICE,
    },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational continuity planning is strictly read-only and advisory',
      notice: MANDATORY_CONTINUITY_PLANNING_NOTICE,
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational continuity planning is strictly read-only and advisory',
      notice: MANDATORY_CONTINUITY_PLANNING_NOTICE,
    },
    { status: 405 }
  );
}
