import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { reopenIncidentCase } from '@/lib/safety/safety-incident-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/safety/incidents/[id]/reopen
 * Admin-only: Reopens a previously RESOLVED or CLOSED incident case.
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
    const rawReason = body.reason || body.summary || 'Case reopened for further operational investigation.';

    try {
      const incident = await reopenIncidentCase(
        incidentId,
        String(rawReason).trim(),
        {
          id: session.id,
          name: session.name || session.email,
        }
      );

      return NextResponse.json({
        success: true,
        incident,
      });
    } catch (reopenErr: any) {
      if (reopenErr.message?.includes('not found')) {
        return NextResponse.json({ error: reopenErr.message }, { status: 404 });
      }
      return NextResponse.json({ error: reopenErr.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in POST /api/safety/incidents/[id]/reopen:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error reopening incident' },
      { status: 500 }
    );
  }
}
