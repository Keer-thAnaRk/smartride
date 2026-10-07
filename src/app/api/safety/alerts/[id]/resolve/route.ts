import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { resolveSafetyAlert, getSafetyAlertById } from '@/lib/safety/safety-alert-store';
import { recordOperationalAuditEvent } from '@/lib/operations/operational-audit-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/safety/alerts/[id]/resolve
 * Admin-only resolution of an active safety alert.
 * Sets status to RESOLVED and records server timestamp.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const alertId = params.id?.trim();
    if (!alertId) {
      return NextResponse.json(
        { error: 'Alert ID parameter is required' },
        { status: 400 }
      );
    }

    // Verify alert exists
    const existing = await getSafetyAlertById(alertId);
    if (!existing) {
      return NextResponse.json(
        { error: `Safety alert not found with ID '${alertId}'` },
        { status: 404 }
      );
    }

    const resolvedBy = session.email || session.name || session.id || 'Admin';
    const resolved = await resolveSafetyAlert(alertId, resolvedBy);

    // Record audit event
    try {
      await recordOperationalAuditEvent({
        eventType: 'SAFETY_ALERT_RESOLVED',
        actor: {
          id: session.id,
          role: session.role || 'ADMIN',
          email: session.email,
          name: session.name,
        },
        resourceType: 'SAFETY_ALERT',
        resourceId: resolved?.id || alertId,
        routeId: resolved?.routeId,
        routeCode: resolved?.routeCode,
        routeName: resolved?.routeName,
        action: 'RESOLVE_SAFETY_ALERT',
        description: `Resolved safety alert '${resolved?.title || alertId}' for route ${resolved?.routeCode}`,
        previousState: {
          status: 'ACTIVE',
          resolvedAt: null,
          resolvedBy: null,
        },
        resultingState: {
          status: 'RESOLVED',
          resolvedAt: resolved?.resolvedAt,
          resolvedBy,
        },
        evidence: resolved?.evidence || {},
        sourceModule: 'SAFETY_ALERTS',
        correlationId: resolved?.dedupKey || alertId,
      });
    } catch (auditErr) {
      console.warn('[SafetyAlertResolve] Failed to record audit event:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Safety alert resolved successfully',
      alert: resolved,
    });
  } catch (error: any) {
    console.error('Error resolving safety alert:', error);
    return NextResponse.json(
      { error: 'Internal server error while resolving safety alert' },
      { status: 500 }
    );
  }
}
