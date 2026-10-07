import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { calculateSecurityPosture } from '@/lib/security/security-status';
import { recordSecurityEvent } from '@/lib/security/security-events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);

    // Strict RBAC enforcement
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      // Record RBAC violation
      try {
        await recordSecurityEvent({
          eventType: 'RBAC_ACCESS_DENIED',
          severity: 'HIGH',
          actorUserId: session.id,
          actorRole: session.role,
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Next.js Client',
          resourceType: 'API',
          resourceId: '/api/admin/security',
          action: 'ACCESS_ATTEMPT',
          result: 'DENIED',
          metadata: { path: '/api/admin/security', attemptedRole: session.role },
        });
      } catch (err) {
        console.warn('Failed to record RBAC denial:', err);
      }

      return NextResponse.json(
        { error: 'Forbidden: Admin privileges required to access Security Center' },
        { status: 403 }
      );
    }

    // 1. Query all recorded security events
    const allEvents = await prisma.securityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // 2. Compute Security Posture & Status
    const posture = calculateSecurityPosture(allEvents);

    // 3. Compute 5 Dynamic KPI Cards (Strictly derived from actual database records)
    const failedLoginAttempts = allEvents.filter(
      (e) => e.eventType === 'AUTH_LOGIN_FAILURE'
    ).length;

    const failedOtpAttempts = allEvents.filter(
      (e) => e.eventType === 'OTP_VERIFICATION_FAILURE' || e.eventType === 'OTP_ANOMALY'
    ).length;

    const suspiciousSessions = allEvents.filter(
      (e) => e.eventType === 'SUSPICIOUS_SESSION' || e.eventType === 'POSSIBLE_BRUTE_FORCE'
    ).length;

    const routeAnomalies = allEvents.filter(
      (e) =>
        e.eventType === 'ROUTE_DEVIATION' ||
        e.eventType === 'SPEED_ANOMALY' ||
        e.eventType === 'GPS_SIGNAL_LOSS' ||
        e.eventType === 'UNEXPECTED_STOP'
    ).length;

    const unauthorizedApiAttempts = allEvents.filter(
      (e) =>
        e.eventType === 'RBAC_ACCESS_DENIED' ||
        e.eventType === 'API_FORBIDDEN' ||
        e.eventType === 'API_UNAUTHORIZED'
    ).length;

    // 4. Severity Distribution
    const severityDistribution = {
      low: allEvents.filter((e) => e.severity === 'LOW').length,
      medium: allEvents.filter((e) => e.severity === 'MEDIUM').length,
      high: allEvents.filter((e) => e.severity === 'HIGH').length,
      critical: allEvents.filter((e) => e.severity === 'CRITICAL').length,
    };

    // 5. Open Incidents count
    const openIncidentsCount = allEvents.filter(
      (e) => (e.severity === 'HIGH' || e.severity === 'CRITICAL') && e.status === 'OPEN'
    ).length;

    // 6. Recent Security Event Timeline (top 15)
    const recentTimeline = allEvents.slice(0, 15).map((e) => ({
      id: e.id,
      eventType: e.eventType,
      severity: e.severity,
      actorRole: e.actorRole,
      actorUserId: e.actorUserId,
      action: e.action,
      result: e.result,
      status: e.status,
      resourceType: e.resourceType,
      createdAt: e.createdAt.toISOString(),
      metadata: e.metadata ? JSON.parse(e.metadata) : {},
    }));

    return NextResponse.json({
      success: true,
      posture,
      kpis: {
        failedLoginAttempts,
        failedOtpAttempts,
        suspiciousSessions,
        routeAnomalies,
        unauthorizedApiAttempts,
        totalEventsRecorded: allEvents.length,
        openIncidentsCount,
      },
      severityDistribution,
      recentTimeline,
    });
  } catch (error: any) {
    console.error('Security Center API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve security center telemetry' },
      { status: 500 }
    );
  }
}
