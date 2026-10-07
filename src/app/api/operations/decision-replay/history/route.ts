import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getHistoricalObservations,
  MANDATORY_DECISION_REPLAY_NOTICE_1,
  MANDATORY_DECISION_REPLAY_NOTICE_2,
} from '@/lib/operations/decision-replay-engine';
import {
  buildOperationalDecisionSupport,
  RouteOperationalDecisionSupport,
} from '@/lib/operations/decision-support-engine';

export const dynamic = 'force-dynamic';

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

    // 2. Query Parameter Validation
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('routeId');

    if (!routeId || routeId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: routeId' },
        { status: 400 }
      );
    }

    // 3. Verify Route Exists
    const support = (await buildOperationalDecisionSupport(
      routeId.trim()
    )) as RouteOperationalDecisionSupport | null;

    if (!support || !('routeId' in support)) {
      return NextResponse.json(
        { success: false, error: `Route not found: ${routeId.trim()}` },
        { status: 404 }
      );
    }

    // 4. Retrieve Persisted Historical Observations
    const observations = await getHistoricalObservations(routeId.trim());

    return NextResponse.json(
      {
        success: true,
        notices: [
          MANDATORY_DECISION_REPLAY_NOTICE_1,
          MANDATORY_DECISION_REPLAY_NOTICE_2,
        ],
        route: {
          id: support.routeId,
          code: support.routeCode,
          name: support.routeName,
        },
        observations,
        retrievedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    const message = err?.message || 'Failed to retrieve historical observations';
    console.error('[DecisionReplayHistoryAPI] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * Mutation and unsupported method guards:
 * The Operational Decision Replay Center is strictly read-only and non-mutative.
 * Any mutation HTTP methods return 405 Method Not Allowed.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Historical observation listing requires GET request',
      notices: [
        MANDATORY_DECISION_REPLAY_NOTICE_1,
        MANDATORY_DECISION_REPLAY_NOTICE_2,
      ],
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Decision replay history is strictly read-only and non-mutative',
      notices: [
        MANDATORY_DECISION_REPLAY_NOTICE_1,
        MANDATORY_DECISION_REPLAY_NOTICE_2,
      ],
    },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Decision replay history is strictly read-only and non-mutative',
      notices: [
        MANDATORY_DECISION_REPLAY_NOTICE_1,
        MANDATORY_DECISION_REPLAY_NOTICE_2,
      ],
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Decision replay history is strictly read-only and non-mutative',
      notices: [
        MANDATORY_DECISION_REPLAY_NOTICE_1,
        MANDATORY_DECISION_REPLAY_NOTICE_2,
      ],
    },
    { status: 405 }
  );
}
