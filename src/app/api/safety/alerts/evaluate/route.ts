import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { evaluateAndRecordRouteAlerts } from '@/lib/safety/safety-alert-store';
import { recordOperationalAuditEvent } from '@/lib/operations/operational-audit-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/safety/alerts/evaluate
 * Admin-only evaluation of corridor safety alert rules.
 * Strictly derives all safety metrics, scores, and alerts server-side.
 * Client-supplied scores, levels, or alert properties are strictly ignored.
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const rawRouteId = body.routeId;

    if (!rawRouteId || typeof rawRouteId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid routeId parameter in request body' },
        { status: 400 }
      );
    }

    const routeId = rawRouteId.trim();
    if (!routeId) {
      return NextResponse.json(
        { error: 'routeId cannot be empty' },
        { status: 400 }
      );
    }

    try {
      const result = await evaluateAndRecordRouteAlerts(routeId);

      // Record operational audit event
      try {
        await recordOperationalAuditEvent({
          eventType: 'SAFETY_ALERT_EVALUATED',
          actor: {
            id: session.id,
            role: session.role || 'ADMIN',
            email: session.email,
            name: session.name,
          },
          resourceType: 'SAFETY_ALERT',
          resourceId: result.route?.id || routeId,
          routeId: result.route?.id || routeId,
          routeCode: result.route?.code || routeId,
          routeName: result.route?.name,
          action: 'EVALUATE_SAFETY_ALERTS',
          description: `Evaluated safety alert rules for route ${result.route?.code || routeId}: ${result.generatedAlerts.length} alert(s) generated`,
          resultingState: {
            generatedCount: result.generatedAlerts.length,
            activeCount: result.summary.active,
            criticalCount: result.summary.critical,
          },
          evidence: {
            routeRiskScore: result.allAlerts?.[0]?.currentScore ?? null,
            generatedTypes: result.generatedAlerts.map((a: any) => a.type),
          },
          sourceModule: 'SAFETY_ALERTS',
          correlationId: result.route?.id || routeId,
        });
      } catch (auditErr) {
        console.warn('[SafetyAlertEvaluate] Failed to record audit event:', auditErr);
      }

      return NextResponse.json({
        success: true,
        message: 'Route safety alerts evaluated successfully',
        route: result.route,
        generatedCount: result.generatedAlerts.length,
        generatedAlerts: result.generatedAlerts,
        alerts: result.allAlerts,
        summary: result.summary,
      });
    } catch (evalError: any) {
      if (evalError.message && evalError.message.includes('not found')) {
        return NextResponse.json(
          { error: evalError.message },
          { status: 404 }
        );
      }
      throw evalError;
    }
  } catch (error: any) {
    console.error('Error in POST /api/safety/alerts/evaluate:', error);
    return NextResponse.json(
      { error: 'Internal server error while evaluating safety alerts' },
      { status: 500 }
    );
  }
}
