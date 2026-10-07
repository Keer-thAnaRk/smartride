import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getIncidentCaseById } from '@/lib/safety/safety-incident-store';
import { recordOperationalAuditEvent } from '@/lib/operations/operational-audit-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/safety/incidents/[id]
 * Admin-only: Retrieves a detailed incident case with full chronological activity history.
 */
export async function GET(
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

    const incidentId = params.id?.trim();
    if (!incidentId) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    const incident = await getIncidentCaseById(incidentId);
    if (!incident) {
      return NextResponse.json(
        { error: `Incident case not found with ID '${incidentId}'` },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    if (searchParams.get('audit') === 'true') {
      try {
        await recordOperationalAuditEvent({
          eventType: 'INCIDENT_VIEWED',
          actor: {
            id: session.id,
            role: session.role || 'ADMIN',
            email: session.email,
            name: session.name,
          },
          resourceType: 'INCIDENT_CASE',
          resourceId: incident.id,
          routeId: incident.routeId,
          routeCode: incident.routeCode,
          routeName: incident.routeName,
          action: 'VIEW_INCIDENT_DETAILS',
          description: `Admin reviewed incident case '${incident.title}' for route ${incident.routeCode}`,
          resultingState: { status: incident.status, severity: incident.severity },
          evidence: { currentRiskScore: incident.currentRiskScore, sourceAlertType: incident.sourceAlertType },
          sourceModule: 'INCIDENTS',
          correlationId: incident.id,
        });
      } catch (auditErr) {
        console.warn('[IncidentView] Failed to record audit event:', auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      incident,
    });
  } catch (error: any) {
    console.error('Error in GET /api/safety/incidents/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error retrieving incident details' },
      { status: 500 }
    );
  }
}
