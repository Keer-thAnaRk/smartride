import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  buildMasterOperationalControlCenter,
  MANDATORY_MASTER_CONTROL_NOTICE,
} from '@/lib/operations/master-control-engine';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operations/master-control
 *
 * Retrieves consolidated fleet-wide or corridor-specific master operational intelligence.
 * Server-authoritative, deterministic, advisory, and read-only.
 * Supports:
 *   - ?routeId=<id_or_code> for single corridor
 *   - ?audit=true for explicit audit recording (regular requests do not pollute audit log)
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

    const rateLimitError = enforceRateLimit(request, RATE_LIMIT_CONFIG.EXPENSIVE_OPERATIONS, undefined, session);
    if (rateLimitError) return rateLimitError;

    // 2. Query Parameters
    const { searchParams } = new URL(request.url);
    const routeIdentifier = searchParams.get('routeId') || searchParams.get('routeCode');
    const shouldAudit = searchParams.get('audit') === 'true';

    // 3. Build Master Operational Control Center Data Server-Side
    const result = await buildMasterOperationalControlCenter(
      routeIdentifier || undefined,
      {
        audit: shouldAudit,
        actor: {
          id: session.id,
          email: session.email,
          name: session.name,
          role: session.role || 'ADMIN',
        },
      }
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    const message = error?.message || 'Failed to aggregate master operational control intelligence';

    // 404 Route Not Found
    if (
      message.toLowerCase().includes('not found') ||
      message.toLowerCase().includes('corridor not found')
    ) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 404 }
      );
    }

    console.error('[MasterControlAPI] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Master Operational Control error' },
      { status: 500 }
    );
  }
}

/**
 * Mutation & unsupported method guards:
 * Master Control Center is strictly read-only and advisory.
 * Any mutation attempts return 405 Method Not Allowed.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Master Control Center is strictly read-only and advisory',
      notice: MANDATORY_MASTER_CONTROL_NOTICE,
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Master Control Center is strictly read-only and advisory',
      notice: MANDATORY_MASTER_CONTROL_NOTICE,
    },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Master Control Center is strictly read-only and advisory',
      notice: MANDATORY_MASTER_CONTROL_NOTICE,
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method Not Allowed: Master Control Center is strictly read-only and advisory',
      notice: MANDATORY_MASTER_CONTROL_NOTICE,
    },
    { status: 405 }
  );
}
