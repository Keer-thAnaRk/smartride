import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { closeIncidentCase } from '@/lib/safety/safety-incident-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/safety/incidents/[id]/close
 * Admin-only: Formally closes a RESOLVED or MITIGATED incident case.
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
    const rawSummary = body.summary || 'Case formally closed after operational review.';

    try {
      const incident = await closeIncidentCase(
        incidentId,
        String(rawSummary).trim(),
        {
          id: session.id,
          name: session.name || session.email,
        }
      );

      return NextResponse.json({
        success: true,
        incident,
      });
    } catch (closeErr: any) {
      if (closeErr.message?.includes('not found')) {
        return NextResponse.json({ error: closeErr.message }, { status: 404 });
      }
      return NextResponse.json({ error: closeErr.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in POST /api/safety/incidents/[id]/close:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error closing incident' },
      { status: 500 }
    );
  }
}
