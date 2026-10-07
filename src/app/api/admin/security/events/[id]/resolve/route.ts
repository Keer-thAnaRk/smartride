import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { recordSecurityEvent } from '@/lib/security/security-events';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { status = 'RESOLVED', resolutionNote } = body;

    const validStatuses = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid incident status' }, { status: 400 });
    }

    const updated = await prisma.securityEvent.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === 'RESOLVED' || status === 'DISMISSED' ? new Date() : undefined,
        resolvedBy: session.name || session.email || 'Admin',
        resolutionNote: resolutionNote || undefined,
      },
    });

    // Record audit action
    await recordSecurityEvent({
      eventType: 'ADMIN_ACTION',
      severity: 'LOW',
      actorUserId: session.id,
      actorRole: 'ADMIN',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'Admin Console',
      resourceType: 'SECURITY_EVENT',
      resourceId: id,
      action: `EVENT_STATUS_UPDATED_${status}`,
      result: 'SUCCESS',
      metadata: { targetEventId: id, newStatus: status, note: resolutionNote },
    });

    return NextResponse.json({
      success: true,
      message: `Security event updated to ${status}`,
      event: updated,
    });
  } catch (error: any) {
    console.error('Event resolve error:', error);
    return NextResponse.json({ error: 'Failed to update security event' }, { status: 500 });
  }
}
