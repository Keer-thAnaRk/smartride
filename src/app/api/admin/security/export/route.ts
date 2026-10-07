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
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = (searchParams.get('format') || 'json').toLowerCase();

    const events = await prisma.securityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Record audit event for data export
    await recordSecurityEvent({
      eventType: 'ADMIN_ACTION',
      severity: 'LOW',
      actorUserId: session.id,
      actorRole: 'ADMIN',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'Admin Console',
      resourceType: 'SECURITY_AUDIT',
      resourceId: 'EXPORT',
      action: `SECURITY_LOGS_EXPORTED_${format.toUpperCase()}`,
      result: 'SUCCESS',
      metadata: { recordCount: events.length, format },
    });

    if (format === 'csv') {
      // Generate sanitized CSV string
      const headers = [
        'ID',
        'Timestamp',
        'EventType',
        'Severity',
        'ActorRole',
        'Action',
        'Result',
        'ResourceType',
        'Status',
        'IPAddress',
      ];
      const rows = events.map((e) => [
        e.id,
        e.createdAt.toISOString(),
        e.eventType,
        e.severity,
        e.actorRole || 'GUEST',
        `"${e.action.replace(/"/g, '""')}"`,
        e.result,
        e.resourceType || 'SYSTEM',
        e.status,
        e.ipAddress || '127.0.0.1',
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="smartride-security-audit-${Date.now()}.csv"`,
        },
      });
    }

    // Default JSON export
    const sanitizedJson = events.map((e) => ({
      id: e.id,
      timestamp: e.createdAt.toISOString(),
      eventType: e.eventType,
      severity: e.severity,
      actorRole: e.actorRole,
      action: e.action,
      result: e.result,
      resourceType: e.resourceType,
      status: e.status,
      ipAddress: e.ipAddress,
      metadata: e.metadata ? JSON.parse(e.metadata) : {},
    }));

    return NextResponse.json({
      success: true,
      exportedAt: new Date().toISOString(),
      totalRecords: sanitizedJson.length,
      events: sanitizedJson,
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export security logs' }, { status: 500 });
  }
}
