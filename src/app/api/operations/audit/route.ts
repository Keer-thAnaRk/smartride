import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getOperationalAuditEvents,
  OperationalAuditEventType,
  OperationalAuditResourceType,
} from '@/lib/operations/operational-audit-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operations/audit
 * Admin-only: Retrieves immutable operational audit log events and KPI summary.
 * Strictly protected against unauthorized roles (401 Guest, 403 Commuter/Driver).
 */
export async function GET(req: NextRequest) {
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

    // 2. Query Parameter Parsing & Validation
    const { searchParams } = new URL(req.url);
    const routeId = searchParams.get('routeId') || undefined;
    const eventType = (searchParams.get('eventType')?.toUpperCase() as OperationalAuditEventType) || undefined;
    const actorUserId = searchParams.get('actorUserId') || undefined;
    const resourceType = (searchParams.get('resourceType')?.toUpperCase() as OperationalAuditResourceType) || undefined;
    const resourceId = searchParams.get('resourceId') || undefined;
    const correlationId = searchParams.get('correlationId') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    // 3. Retrieve Events & Summary
    const { events, summary } = await getOperationalAuditEvents({
      routeId,
      eventType,
      actorUserId,
      resourceType,
      resourceId,
      correlationId,
      limit,
      from,
      to,
    });

    return NextResponse.json({
      success: true,
      events,
      summary,
    });
  } catch (error: any) {
    console.error('[OperationalAuditAPI] Error retrieving audit logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve operational audit logs' },
      { status: 500 }
    );
  }
}

/**
 * Audit logs are strictly immutable and append-only.
 * Any attempt to mutate or delete records via API returns 405 Method Not Allowed.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Audit logs are append-only and cannot be manually inserted via API' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Audit logs are strictly immutable' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Audit logs are strictly immutable' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Audit logs cannot be deleted' },
    { status: 405 }
  );
}
