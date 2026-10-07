import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  evaluateCheckInStatus,
  computeCheckInDeadline,
} from '@/lib/operations/driver-coverage-engine';
import { DRIVER_MONITOR_CONFIG } from '@/lib/operations/driver-monitor-config';
import { DriverCheckInInfo } from '@/lib/operations/driver-coverage-types';

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
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const tripType = searchParams.get('tripType') || 'MORNING_PICKUP';

    // Fetch all active routes and assigned drivers
    const routes = await prisma.route.findMany({
      where: { status: 'ACTIVE' },
      include: {
        assignedDriver: {
          include: { user: true },
        },
      },
    });

    // Fetch existing check-in records for today
    const checkIns = await prisma.driverCheckIn.findMany({
      where: { date, tripType },
    });
    const checkInMap = new Map(checkIns.map((c) => [c.routeId, c]));

    // Fetch existing replacements/coverage events
    const coverageEvents = await prisma.driverCoverageEvent.findMany({
      where: {
        status: { in: ['REPLACED', 'NO_SHOW_CONFIRMED', 'NO_SHOW_RISK'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    const coverageMap = new Map(coverageEvents.map((e) => [e.routeId, e]));

    let checkedInCount = 0;
    let expectedCount = 0;
    let lateCount = 0;
    let noShowRiskCount = 0;
    let replacementsCount = 0;

    const activeAlerts: DriverCheckInInfo[] = [];

    const now = new Date();

    for (const route of routes) {
      const scheduledDispatch =
        tripType === 'MORNING_PICKUP'
          ? route.morningStartTime || '08:00 AM'
          : route.eveningStartTime || '06:00 PM';

      const checkInDeadline = computeCheckInDeadline(scheduledDispatch);
      const existingCheckIn = checkInMap.get(route.id);
      const coverageEvent = coverageMap.get(route.id);
      const isReplaced = coverageEvent?.status === 'REPLACED';

      const evalResult = evaluateCheckInStatus({
        scheduledDispatch,
        checkInDeadline,
        checkedInAt: existingCheckIn?.checkedInAt,
        referenceTime: now,
        isReplaced,
      });

      // Aggregate KPI counts
      if (evalResult.status === 'CHECKED_IN') checkedInCount++;
      else if (evalResult.status === 'EXPECTED') expectedCount++;
      else if (evalResult.status === 'LATE') lateCount++;
      else if (evalResult.status === 'NO_SHOW_RISK') noShowRiskCount++;
      else if (evalResult.status === 'NO_SHOW_CONFIRMED') noShowRiskCount++;
      else if (evalResult.status === 'REPLACED') replacementsCount++;
      else if (evalResult.status === 'PRIMARY_RETURNED') replacementsCount++;

      const info: DriverCheckInInfo = {
        tripId: existingCheckIn?.tripId || `trip_${route.id}_${date}_${tripType}`,
        routeId: route.id,
        routeCode: route.code,
        routeName: route.name,
        driverId: route.assignedDriverId || 'unassigned',
        driverName: route.assignedDriver?.user?.name || 'Unassigned Captain',
        driverPhone: route.assignedDriver?.user?.phone || undefined,
        scheduledDispatch,
        checkInDeadline,
        status: existingCheckIn?.status ? (existingCheckIn.status as any) : evalResult.status,
        checkedInAt: existingCheckIn?.checkedInAt ? existingCheckIn.checkedInAt.toISOString() : null,
        minutesUntilDeadline: evalResult.minutesUntilDeadline,
        minutesPastDeadline: evalResult.minutesPastDeadline,
        isPotentialNoShow: evalResult.isPotentialNoShow,
        notes: existingCheckIn?.notes || null,
      };

      // Only add to active alerts if requires attention (LATE, NO_SHOW_RISK, NO_SHOW_CONFIRMED, or PRIMARY_RETURNED)
      if (
        info.status === 'LATE' ||
        info.status === 'NO_SHOW_RISK' ||
        info.status === 'NO_SHOW_CONFIRMED' ||
        info.status === 'PRIMARY_RETURNED' ||
        isReplaced
      ) {
        activeAlerts.push(info);
      }
    }

    const summary = {
      tripsToday: routes.length,
      checkedInCount,
      expectedCount,
      lateCount,
      noShowRiskCount,
      replacementsCount,
      activeAlerts,
    };

    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error('Error fetching admin driver coverage summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch driver coverage summary' },
      { status: 500 }
    );
  }
}
