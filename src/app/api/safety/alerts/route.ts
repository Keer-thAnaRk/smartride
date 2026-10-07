import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getSafetyAlerts,
  getSafetyAlertsSummary,
} from '@/lib/safety/safety-alert-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/safety/alerts
 * Admin-only retrieval of operational safety alerts and KPI summary.
 * Filters: ?routeId=..., ?severity=..., ?status=..., ?limit=...
 */
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const routeId = searchParams.get('routeId') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const status = searchParams.get('status') || undefined;
    const limitParam = parseInt(searchParams.get('limit') || '100', 10);
    const limit = isNaN(limitParam) || limitParam <= 0 ? 100 : Math.min(limitParam, 500);

    const alerts = await getSafetyAlerts({
      routeId,
      severity,
      status,
      limit,
    });

    const summary = await getSafetyAlertsSummary(routeId);

    return NextResponse.json({
      success: true,
      count: alerts.length,
      alerts,
      summary,
    });
  } catch (error: any) {
    console.error('Error fetching safety alerts:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching safety alerts' },
      { status: 500 }
    );
  }
}
