import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { mitigateIncidentCase } from '@/lib/safety/safety-incident-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/safety/incidents/[id]/mitigate
 * Admin-only: Records operational mitigation for an incident case.
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
        { error: 'Mitigation summary cannot be empty' },
        { status: 400 }
      );
    }

    try {
      const incident = await mitigateIncidentCase(
        incidentId,
        rawSummary.trim(),
        {
          id: session.id,
          name: session.name || session.email,
        }
      );

      return NextResponse.json({
        success: true,
        incident,
      });
    } catch (mitErr: any) {
      if (mitErr.message?.includes('not found')) {
        return NextResponse.json({ error: mitErr.message }, { status: 404 });
      }
      return NextResponse.json({ error: mitErr.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in POST /api/safety/incidents/[id]/mitigate:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error recording mitigation' },
      { status: 500 }
    );
  }
}
