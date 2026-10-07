import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  completeActionPlanExecution,
  MANDATORY_ACTION_NOTICES,
} from '@/lib/operations/action-workflow-engine';

export const dynamic = 'force-dynamic';

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
 * POST /api/operations/action-workflow/[id]/complete
 * Marks execution completed by an authorized administrator.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { errorResponse, session } = await requireAdminSession(request);
  if (errorResponse) return errorResponse;

  try {
    const id = params?.id;
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Action plan ID is required' },
        { status: 400 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { completionNote, executionNote, executionResult } = body || {};
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'SmartRide-Internal';

    const updatedPlan = await completeActionPlanExecution(id, {
      completionNote: completionNote || executionNote,
      executionResult,
      adminUser: {
        id: session!.id,
        name: session!.name,
        email: session!.email,
        role: session!.role,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: updatedPlan,
      message: 'Action plan execution marked COMPLETED.',
      notices: MANDATORY_ACTION_NOTICES,
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to complete action plan execution';
    const statusCode = error?.statusCode || (message.includes('not found') ? 404 : 400);
    return NextResponse.json({ success: false, error: message }, { status: statusCode });
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
