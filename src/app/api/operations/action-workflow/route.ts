import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getOperationalActionPlans,
  createOperationalActionPlan,
  ActionType,
  ActionPlanStatus,
  ActionPlanPriority,
  MANDATORY_ACTION_NOTICES,
} from '@/lib/operations/action-workflow-engine';

export const dynamic = 'force-dynamic';

/**
 * Helper to authenticate admin users.
 */
async function requireAdminSession(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      ),
      session: null,
    };
  }

  if (session.role !== 'ADMIN') {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      ),
      session: null,
    };
  }

  return { errorResponse: null, session };
}

/**
 * GET /api/operations/action-workflow
 * Queries action plans with optional filters.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAdminSession(request);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('routeId') || searchParams.get('routeCode') || undefined;
    const status = (searchParams.get('status') as ActionPlanStatus) || undefined;
    const priority = (searchParams.get('priority') as ActionPlanPriority) || undefined;
    const actionType = (searchParams.get('actionType') as ActionType) || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const result = await getOperationalActionPlans({
      routeId,
      status,
      priority,
      actionType,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result,
      notices: MANDATORY_ACTION_NOTICES,
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to retrieve operational action plans';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/operations/action-workflow
 * Creates a new action plan from a verified recommendation.
 */
export async function POST(request: NextRequest) {
  const { errorResponse, session } = await requireAdminSession(request);
  if (errorResponse) return errorResponse;

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const { recommendationId, actionType, title, description } = body || {};

    if (!recommendationId || typeof recommendationId !== 'string' || recommendationId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Missing required field: recommendationId' },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'SmartRide-Internal';

    // Anti-forgery: actor identity, risk score, priority, evidence derived server-side
    const plan = await createOperationalActionPlan({
      recommendationId: recommendationId.trim(),
      actionType,
      title,
      description,
      adminUser: {
        id: session!.id,
        name: session!.name,
        email: session!.email,
        role: session!.role,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        data: plan,
        message: 'Action plan created successfully in PENDING_APPROVAL state.',
        notices: MANDATORY_ACTION_NOTICES,
      },
      { status: 200 }
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to create operational action plan';
    const statusCode = error?.statusCode || (message.includes('not found') ? 404 : 400);
    return NextResponse.json({ success: false, error: message }, { status: statusCode });
  }
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'GET, POST' } }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'GET, POST' } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'GET, POST' } }
  );
}
