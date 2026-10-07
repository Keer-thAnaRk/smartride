import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { recordSecurityEvent } from '@/lib/security/security-events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      try {
        await recordSecurityEvent({
          eventType: 'RBAC_ACCESS_DENIED',
          severity: 'HIGH',
          actorUserId: session.id,
          actorRole: session.role,
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Next.js Client',
          resourceType: 'API',
          resourceId: '/api/admin/security/events',
          action: 'ACCESS_ATTEMPT',
          result: 'DENIED',
          metadata: { path: '/api/admin/security/events' },
        });
      } catch (e) {}

      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const eventType = searchParams.get('eventType');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const actorRole = searchParams.get('actorRole');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const whereClause: any = {};
    if (eventType && eventType !== 'ALL') whereClause.eventType = eventType;
    if (severity && severity !== 'ALL') whereClause.severity = severity;
    if (status && status !== 'ALL') whereClause.status = status;
    if (actorRole && actorRole !== 'ALL') whereClause.actorRole = actorRole;

    if (search) {
      whereClause.OR = [
        { action: { contains: search } },
        { resourceType: { contains: search } },
        { actorUserId: { contains: search } },
        { metadata: { contains: search } },
      ];
    }

    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.securityEvent.count({ where: whereClause }),
    ]);

    const formattedEvents = events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      severity: e.severity,
      actorUserId: e.actorUserId,
      actorRole: e.actorRole,
      ipAddress: e.ipAddress,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      action: e.action,
      result: e.result,
      status: e.status,
      resolvedAt: e.resolvedAt?.toISOString() || null,
      resolvedBy: e.resolvedBy,
      resolutionNote: e.resolutionNote,
      createdAt: e.createdAt.toISOString(),
      metadata: e.metadata ? JSON.parse(e.metadata) : {},
    }));

    return NextResponse.json({
      success: true,
      events: formattedEvents,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('Security events fetch error:', error);
    return NextResponse.json({ error: 'Failed to retrieve security events' }, { status: 500 });
  }
}
