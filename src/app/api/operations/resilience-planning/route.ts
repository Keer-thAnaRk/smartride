import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  runOperationalResiliencePlanning,
  MANDATORY_RESILIENCE_PLANNING_NOTICE,
} from '@/lib/operations/resilience-planning-engine';

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

    // 3. Execute Operational Resilience Planning Analysis
    const result = await runOperationalResiliencePlanning(body);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    const message = err?.message || 'Operational resilience planning failed';

    // 404 Route Not Found
    if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('route not found')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 404 }
      );
    }

    // 400 Input Validation Errors
    if (
      message.includes('required') ||
      message.includes('must be') ||
      message.includes('Invalid') ||
      message.includes('finite') ||
      message.includes('between')
    ) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    console.error('[ResiliencePlanningAPI] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal operational resilience planning error' },
      { status: 500 }
    );
  }
}

/**
 * Mutation and unsupported method guards:
 * Operational Resilience Planning is strictly non-mutative, advisory, and read-only.
 * Any other HTTP methods return 405 Method Not Allowed.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational resilience planning requires a POST request with contingency scenario specifications',
      notice: MANDATORY_RESILIENCE_PLANNING_NOTICE,
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational resilience planning is strictly read-only and non-mutative',
      notice: MANDATORY_RESILIENCE_PLANNING_NOTICE,
    },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational resilience planning is strictly read-only and non-mutative',
      notice: MANDATORY_RESILIENCE_PLANNING_NOTICE,
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Operational resilience planning is strictly read-only and non-mutative',
      notice: MANDATORY_RESILIENCE_PLANNING_NOTICE,
    },
    { status: 405 }
  );
}
