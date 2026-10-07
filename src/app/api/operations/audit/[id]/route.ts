import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getOperationalAuditEventById,
  verifyAuditEventIntegrity,
} from '@/lib/operations/operational-audit-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operations/audit/[id]
 * Admin-only: Retrieves a single immutable audit event with full cryptographic integrity status.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: 'Audit event ID is required' },
        { status: 400 }
      );
    }

    // 2. Fetch authoritative audit record
    const event = await getOperationalAuditEventById(id);
    if (!event) {
      return NextResponse.json(
        { error: `Operational audit event not found with ID '${id}'` },
        { status: 404 }
      );
    }

    // 3. Verify cryptographic integrity
    const isIntegrityValid = verifyAuditEventIntegrity(event);

    return NextResponse.json({
      success: true,
      event,
      integrity: {
        isValid: isIntegrityValid,
        hash: event.integrityHash,
        previousEventHash: event.previousEventHash || 'GENESIS',
      },
    });
  } catch (error: any) {
    console.error('[OperationalAuditEventDetailAPI] Error retrieving event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve operational audit event' },
      { status: 500 }
    );
  }
}

/**
 * Audit records are immutable: modification or deletion via API is forbidden.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Audit events are append-only' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Audit events are strictly immutable' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Audit events are strictly immutable' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Audit events cannot be deleted' },
    { status: 405 }
  );
}
