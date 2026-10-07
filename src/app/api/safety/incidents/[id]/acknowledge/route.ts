import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { acknowledgeIncidentCase } from '@/lib/safety/safety-incident-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/safety/incidents/[id]/acknowledge
 * Admin-only: Acknowledges an active OPEN incident case.
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

    try {
      const incident = await acknowledgeIncidentCase(incidentId, {
        id: session.id,
        name: session.name || session.email,
      });

      return NextResponse.json({
        success: true,
        incident,
      });
    } catch (actErr: any) {
      if (actErr.message?.includes('not found')) {
        return NextResponse.json({ error: actErr.message }, { status: 404 });
      }
      return NextResponse.json({ error: actErr.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in POST /api/safety/incidents/[id]/acknowledge:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error acknowledging incident' },
      { status: 500 }
    );
  }
}
