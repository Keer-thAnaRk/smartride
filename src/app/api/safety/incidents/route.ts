import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  createIncidentCase,
  getIncidentCases,
  IncidentSeverity,
  IncidentStatus,
} from '@/lib/safety/safety-incident-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/safety/incidents
 * Admin-only: Lists operational safety incident cases with filtering and summary metrics.
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
    const severity = (searchParams.get('severity') as IncidentSeverity) || undefined;
    const status = (searchParams.get('status') as IncidentStatus) || undefined;
    const assignedAdminId = searchParams.get('assignedAdminId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const result = await getIncidentCases({
      routeId,
      severity,
      status,
      assignedAdminId,
      limit,
    });

    return NextResponse.json({
      success: true,
      incidents: result.incidents,
      summary: result.summary,
    });
  } catch (error: any) {
    console.error('Error in GET /api/safety/incidents:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error retrieving safety incidents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/safety/incidents
 * Admin-only: Creates an operational incident case from an existing SafetyAlert.
 * Strictly derives all safety attributes server-side.
 * Client-submitted routeId, severity, riskScore, evidence, or timestamps are ignored.
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
    const rawAlertId = body.alertId;

    if (!rawAlertId || typeof rawAlertId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid alertId in request body' },
        { status: 400 }
      );
    }

    const alertId = rawAlertId.trim();
    if (!alertId) {
      return NextResponse.json(
        { error: 'alertId cannot be empty' },
        { status: 400 }
      );
    }

    try {
      const incident = await createIncidentCase({
        alertId,
        adminId: session.id,
        adminName: session.name || session.email,
      });

      return NextResponse.json({
        success: true,
        incident,
      });
    } catch (createErr: any) {
      if (createErr.code === 'DUPLICATE_ACTIVE_CASE') {
        return NextResponse.json(
          {
            error: createErr.message,
            existingCaseId: createErr.existingCaseId,
          },
          { status: 409 }
        );
      }

      if (createErr.message?.includes('not found')) {
        return NextResponse.json(
          { error: createErr.message },
          { status: 404 }
        );
      }

      throw createErr;
    }
  } catch (error: any) {
    console.error('Error in POST /api/safety/incidents:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error creating incident case' },
      { status: 500 }
    );
  }
}
