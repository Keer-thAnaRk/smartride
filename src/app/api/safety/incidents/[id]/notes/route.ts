import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { addIncidentNote } from '@/lib/safety/safety-incident-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/safety/incidents/[id]/notes
 * Admin-only: Appends an operational investigation note.
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
    const rawMessage = body.message;

    if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
      return NextResponse.json(
        { error: 'Note message cannot be empty' },
        { status: 400 }
      );
    }

    try {
      const activity = await addIncidentNote(
        incidentId,
        rawMessage.trim(),
        {
          id: session.id,
          name: session.name || session.email,
        }
      );

      return NextResponse.json({
        success: true,
        activity,
      });
    } catch (noteErr: any) {
      if (noteErr.message?.includes('not found')) {
        return NextResponse.json({ error: noteErr.message }, { status: 404 });
      }
      return NextResponse.json({ error: noteErr.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in POST /api/safety/incidents/[id]/notes:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error adding note' },
      { status: 500 }
    );
  }
}
