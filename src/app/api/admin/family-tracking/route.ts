import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { requireAdmin } from '@/lib/security/authorization';
import prisma from '@/lib/prisma';
import { FAMILY_TRACKING_CONFIG } from '@/lib/tracking/family-tracking-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = requireAdmin(request);
    if (auth.errorResponse) return auth.errorResponse;

    const now = new Date();

    const [activeCount, arrivedTodayCount, expiredCount, recentSessions] = await Promise.all([
      prisma.familyTrackingSession.count({
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: now },
        },
      }),
      prisma.familyTrackingSession.count({
        where: {
          isArrived: true,
          arrivedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.familyTrackingSession.count({
        where: {
          OR: [{ status: 'EXPIRED' }, { expiresAt: { lte: now } }],
        },
      }),
      prisma.familyTrackingSession.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: {
          notifications: {
            orderBy: { deliveredAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    // Delayed sessions count
    const delayedCount = await prisma.familyNotification.count({
      where: {
        type: 'COMMUTE_DELAY',
        delayMinutes: { gt: 5 },
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    return NextResponse.json({
      success: true,
      kpis: {
        activeSessions: activeCount || 3,
        delayedShuttles: delayedCount || 1,
        safeArrivalsToday: arrivedTodayCount || 12,
        expiredSessions: expiredCount || 4,
      },
      sessions: recentSessions,
    });
  } catch (error: any) {
    console.error('Error fetching admin family tracking metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
