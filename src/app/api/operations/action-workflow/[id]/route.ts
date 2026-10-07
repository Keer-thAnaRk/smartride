import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getActionPlanDetail,
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
 * GET /api/operations/action-workflow/[id]
 * Returns full action plan detail spanning Sections A through J.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { errorResponse } = await requireAdminSession(request);
  if (errorResponse) return errorResponse;

  try {
    const id = params?.id;
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Action plan ID is required' },
        { status: 400 }
      );
    }

    const detail = await getActionPlanDetail(id);
    return NextResponse.json({
      success: true,
      data: detail,
      notices: MANDATORY_ACTION_NOTICES,
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to retrieve action plan details';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}
