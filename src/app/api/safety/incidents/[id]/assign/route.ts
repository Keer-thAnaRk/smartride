import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { assignIncidentCase } from '@/lib/safety/safety-incident-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/safety/incidents/[id]/assign
 * Admin-only: Assigns an incident case to a verified ADMIN user.
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
    const rawAdminId = body.adminId;

    if (!rawAdminId || typeof rawAdminId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid adminId in request body' },
        { status: 400 }
      );
    }

    try {
      const incident = await assignIncidentCase(
        incidentId,
        rawAdminId.trim(),
        {
          id: session.id,
          name: session.name || session.email,
        }
      );

      return NextResponse.json({
        success: true,
        incident,
      });
    } catch (assignErr: any) {
      if (assignErr.message?.includes('not found')) {
        return NextResponse.json({ error: assignErr.message }, { status: 404 });
      }
      return NextResponse.json({ error: assignErr.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in POST /api/safety/incidents/[id]/assign:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error assigning incident' },
      { status: 500 }
    );
  }
}
