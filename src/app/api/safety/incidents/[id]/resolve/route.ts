import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { resolveIncidentCase } from '@/lib/safety/safety-incident-store';
import { recordOperationalAuditEvent } from '@/lib/operations/operational-audit-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/safety/incidents/[id]/resolve
 * Admin-only: Resolves an operational incident case with audit note.
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

    const incidentId = params.id?.trim();
    if (!incidentId) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawSummary = body.summary;

    if (!rawSummary || typeof rawSummary !== 'string' || !rawSummary.trim()) {
      return NextResponse.json(
        { error: 'Resolution summary cannot be empty' },
        { status: 400 }
      );
    }

    try {
      const incident = await resolveIncidentCase(
        incidentId,
        rawSummary.trim(),
        {
          id: session.id,
          name: session.name || session.email,
        }
      );

      // Record operational audit event
      try {
        await recordOperationalAuditEvent({
          eventType: 'INCIDENT_RESOLVED',
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
          action: 'RESOLVE_INCIDENT_CASE',
          description: `Resolved incident case '${incident.title}' for route ${incident.routeCode}: ${rawSummary.trim()}`,
          previousState: { status: 'INVESTIGATING', resolvedAt: null },
          resultingState: {
            status: 'RESOLVED',
            resolvedAt: incident.resolvedAt,
            resolutionSummary: incident.resolutionSummary,
          },
          evidence: {
            severity: incident.severity,
            sourceAlertType: incident.sourceAlertType,
            currentRiskScore: incident.currentRiskScore,
          },
          sourceModule: 'INCIDENTS',
          correlationId: incident.id,
        });
      } catch (auditErr) {
        console.warn('[IncidentResolve] Failed to record audit event:', auditErr);
      }

      return NextResponse.json({
        success: true,
        incident,
      });
    } catch (resErr: any) {
      if (resErr.message?.includes('not found')) {
        return NextResponse.json({ error: resErr.message }, { status: 404 });
      }
      return NextResponse.json({ error: resErr.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in POST /api/safety/incidents/[id]/resolve:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error resolving incident' },
      { status: 500 }
    );
  }
}
