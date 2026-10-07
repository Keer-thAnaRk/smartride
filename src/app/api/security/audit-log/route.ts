import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getSecurityAuditLogs } from '@/lib/security/audit-logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
        { error: 'Forbidden: Admin command center privileges required to view security audit logs' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const actionFilter = searchParams.get('action');

    let logs = await getSecurityAuditLogs(limit);

    if (actionFilter) {
      logs = logs.filter((l) => l.action.toLowerCase() === actionFilter.toLowerCase());
    }

    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error: any) {
    console.error('Security audit log API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to retrieve security audit logs' },
      { status: 500 }
    );
  }
}
