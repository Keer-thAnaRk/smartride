import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  runOperationalDecisionReplay,
  MANDATORY_DECISION_REPLAY_NOTICE_1,
  MANDATORY_DECISION_REPLAY_NOTICE_2,
} from '@/lib/operations/decision-replay-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    // 2. Parse Request Body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    // 3. Execute Operational Decision Replay
    const result = await runOperationalDecisionReplay(body);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    const message = err?.message || 'Decision replay execution failed';

    // 404 Not Found error handling (Route or Historical Observation)
    if (
      message.toLowerCase().includes('not found') ||
      message.toLowerCase().includes('observation not found') ||
      message.toLowerCase().includes('route not found')
    ) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 404 }
      );
    }

    // 400 Bad Request error handling (Validation errors)
    if (
      message.includes('must be') ||
      message.includes('required') ||
      message.includes('Invalid') ||
      message.includes('between')
    ) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    console.error('[DecisionReplayAPI] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal decision replay error' },
      { status: 500 }
    );
  }
}

/**
 * Mutation and unsupported method guards:
 * The Operational Decision Replay Center is strictly read-only and non-mutative.
 * Any other HTTP methods return 405 Method Not Allowed.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational decision replay execution requires POST request with corridor and scenario payload',
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
      error: 'Method Not Allowed: Operational decision replay is strictly read-only and non-mutative',
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
      error: 'Method Not Allowed: Operational decision replay is strictly read-only and non-mutative',
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
      error: 'Method Not Allowed: Operational decision replay is strictly read-only and non-mutative',
      notices: [
        MANDATORY_DECISION_REPLAY_NOTICE_1,
        MANDATORY_DECISION_REPLAY_NOTICE_2,
      ],
    },
    { status: 405 }
  );
}
