import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  evaluateCheckInStatus,
  computeCheckInDeadline,
} from '@/lib/operations/driver-coverage-engine';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { tripId } = params;

    // Fetch check-in, coverage event, and audit logs
    const [checkIn, coverageEvent, auditLogs] = await Promise.all([
      prisma.driverCheckIn.findFirst({
        where: { tripId },
      }),
      prisma.driverCoverageEvent.findFirst({
        where: { tripId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coverageAuditLog.findMany({
        where: { tripId },
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    // Resolve route
    const routeId = checkIn?.routeId || coverageEvent?.routeId;
    let route = routeId
      ? await prisma.route.findUnique({
          where: { id: routeId },
          include: {
            assignedDriver: { include: { user: true } },
            assignedVehicle: true,
          },
        })
      : await prisma.route.findFirst({
          include: {
            assignedDriver: { include: { user: true } },
            assignedVehicle: true,
          },
        });

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    const scheduledDispatch = route.morningStartTime || '08:00 AM';
    const checkInDeadline = computeCheckInDeadline(scheduledDispatch);

    const isReplaced = coverageEvent?.status === 'REPLACED';
    const evalResult = evaluateCheckInStatus({
      scheduledDispatch,
      checkInDeadline,
      checkedInAt: checkIn?.checkedInAt,
      isReplaced,
    });

    const status = checkIn?.status ? (checkIn.status as any) : evalResult.status;

    return NextResponse.json({
      success: true,
      coverage: {
        tripId,
        routeId: route.id,
        routeCode: route.code,
        routeName: route.name,
        primaryDriverId: route.assignedDriverId,
        primaryDriverName: route.assignedDriver?.user?.name || 'Assigned Driver',
        primaryDriverPhone: route.assignedDriver?.user?.phone || null,
        scheduledDispatch,
        checkInDeadline,
        status,
        checkedInAt: checkIn?.checkedInAt?.toISOString() || null,
        isPotentialNoShow: evalResult.isPotentialNoShow,
        coverageEvent,
        auditLogs,
      },
    });
  } catch (error: any) {
    console.error('Error fetching trip driver coverage detail:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch trip coverage detail' },
      { status: 500 }
    );
  }
}
