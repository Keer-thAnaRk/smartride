import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  computeOperationalAnalytics,
  AnalyticsTimeWindow,
} from '@/lib/operations/operational-analytics-engine';
import { recordOperationalAuditEvent } from '@/lib/operations/operational-audit-store';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operations/analytics
 * Admin-only: Historical operational intelligence analytics and executive reporting.
 *
 * Query Parameters:
 * - window: 'LAST_24_HOURS' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'CUSTOM' (Default: 'LAST_7_DAYS')
 * - from: ISO string / YYYY-MM-DD (Required if window is 'CUSTOM')
 * - to: ISO string / YYYY-MM-DD (Required if window is 'CUSTOM')
 * - routeId: Optional. Filter analytics to a specific corridor (returns 404 if not found).
 * - report: Optional ('true'). Generates full executive report data payload.
 * - audit: Optional ('true'). Records an authoritative audit event in the immutable ledger.
 *
 * RBAC:
 * - Guest: 401 Unauthorized
 * - Commuter / Driver: 403 Forbidden
 * - Admin: 200 OK
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

    const rateLimitError = enforceRateLimit(req, RATE_LIMIT_CONFIG.EXPENSIVE_OPERATIONS, undefined, session);
    if (rateLimitError) return rateLimitError;

    // 2. Query Parameter Parsing (Anti-forgery: only safe query parameters are respected)
    const { searchParams } = new URL(req.url);
    const windowParam = (searchParams.get('window')?.toUpperCase() as AnalyticsTimeWindow) || 'LAST_7_DAYS';
    const fromParam = searchParams.get('from') || undefined;
    const toParam = searchParams.get('to') || undefined;
    const routeId = searchParams.get('routeId') || undefined;
    const generateReport = searchParams.get('report') === 'true' || searchParams.get('action') === 'report';
    const shouldAudit = searchParams.get('audit') === 'true';

    // 3. Compute Analytics
    let result;
    try {
      result = await computeOperationalAnalytics({
        window: windowParam,
        from: fromParam,
        to: toParam,
        routeId,
        generateReport,
      });
    } catch (computeErr: any) {
      if (computeErr.message && computeErr.message.includes('not found')) {
        return NextResponse.json({ error: computeErr.message }, { status: 404 });
      }
      if (
        computeErr.message &&
        (computeErr.message.includes('Invalid date') || computeErr.message.includes('Custom time window'))
      ) {
        return NextResponse.json({ error: computeErr.message }, { status: 400 });
      }
      throw computeErr;
    }

    // 4. Audit Trail Integration (Only when explicitly requested by administrator)
    if (shouldAudit) {
      try {
        const isReport = generateReport;
        await recordOperationalAuditEvent({
          eventType: isReport ? 'EXECUTIVE_REPORT_GENERATED' : 'OPERATIONAL_ANALYTICS_VIEWED',
          actor: {
            id: session.id,
            role: session.role || 'ADMIN',
            email: session.email || null,
            name: session.name || null,
          },
          resourceType: isReport ? 'EXECUTIVE_REPORT' : 'OPERATIONAL_ANALYTICS',
          resourceId: routeId || 'FLEET',
          routeId: routeId || undefined,
          action: isReport ? 'GENERATE_EXECUTIVE_REPORT' : 'VIEW_OPERATIONAL_ANALYTICS',
          description: isReport
            ? `Administrator generated executive operational intelligence report for ${routeId || 'FLEET'} (${result.timeWindow.window})`
            : `Administrator viewed operational intelligence analytics for ${routeId || 'FLEET'} (${result.timeWindow.window})`,
          evidence: {
            window: result.timeWindow.window,
            from: result.timeWindow.from,
            to: result.timeWindow.to,
            routesAnalyzed: result.executiveSummary.routesAnalyzed,
            averageFleetRisk: result.executiveSummary.averageFleetRisk,
            safetyAlerts: result.executiveSummary.safetyAlerts,
            openIncidents: result.executiveSummary.openIncidents,
            governanceExceptions: result.executiveSummary.governanceExceptions,
          },
          sourceModule: 'ANALYTICS',
          correlationId: routeId || 'FLEET_ANALYTICS',
        });
      } catch (auditErr) {
        console.warn('[AnalyticsAPI] Notice recording audit event:', auditErr);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[AnalyticsAPI] Error computing operational analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compute operational intelligence analytics' },
      { status: 500 }
    );
  }
}

/**
 * Analytics endpoints are strictly read-only and analytical.
 * Any mutation attempts return 405 Method Not Allowed.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Analytics is strictly read-only and analytical' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Analytics is strictly read-only' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Analytics is strictly read-only' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method Not Allowed: Operational Analytics records cannot be deleted' },
    { status: 405 }
  );
}
