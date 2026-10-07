import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  runOperationalSystemHealthValidation,
  MANDATORY_SYSTEM_HEALTH_NOTICE,
} from '@/lib/operations/system-health-engine';
import { recordOperationalAuditEvent } from '@/lib/operations/operational-audit-store';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication & RBAC Authorization
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required for operational system health validation' },
        { status: 403 }
      );
    }

    const rateLimitError = enforceRateLimit(request, RATE_LIMIT_CONFIG.EXPENSIVE_OPERATIONS, undefined, session);
    if (rateLimitError) return rateLimitError;

    // 2. Query Parameters
    const { searchParams } = new URL(request.url);
    const routeIdParam = searchParams.get('routeId');
    const shouldAudit = searchParams.get('audit') === 'true';

    // 3. Run Deterministic System Health Validation Pipeline
    const report = await runOperationalSystemHealthValidation(routeIdParam || undefined);

    // 4. Optional High-Level Audit Logging (Only when explicitly requested, zero pollution on standard GET)
    if (shouldAudit) {
      try {
        await recordOperationalAuditEvent({
          eventType: 'SYSTEM_HEALTH_VALIDATION_VIEWED',
          actor: {
            id: session.id,
            role: session.role,
            email: session.email,
            name: session.name,
          },
          resourceType: 'SYSTEM_HEALTH',
          resourceId: routeIdParam || 'FLEET_WIDE',
          routeId: routeIdParam || null,
          action: 'VIEW_SYSTEM_HEALTH',
          description: `Administrator reviewed operational system health (${report.summary.overallStatus})`,
          resultingState: {
            overallStatus: report.summary.overallStatus,
            totalChecks: report.summary.totalChecks,
            healthyChecks: report.summary.healthyChecks,
            issueCount:
              report.summary.warningChecks +
              report.summary.degradedChecks +
              report.summary.criticalChecks,
          },
          sourceModule: 'SYSTEM_HEALTH',
          correlationId: routeIdParam || 'FLEET',
        });
      } catch (auditErr) {
        console.warn('[SystemHealthAPI] Audit logging notice:', auditErr);
      }
    }

    return NextResponse.json(report, { status: 200 });
  } catch (error: any) {
    if (error.status === 404 || error.message?.includes('not found')) {
      return NextResponse.json(
        { error: error.message || 'Corridor not found' },
        { status: 404 }
      );
    }

    console.error('[SystemHealthAPI] Error running system health validation:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error running operational system health validation',
        mandatoryNotice: MANDATORY_SYSTEM_HEALTH_NOTICE,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method Not Allowed. System Health Validation is read-only.' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method Not Allowed. System Health Validation is read-only.' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method Not Allowed. System Health Validation is read-only.' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method Not Allowed. System Health Validation is read-only.' },
    { status: 405, headers: { Allow: 'GET' } }
  );
}
