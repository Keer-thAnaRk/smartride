import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  evaluateCheckInStatus,
  computeCheckInDeadline,
} from '@/lib/operations/driver-coverage-engine';
import { DRIVER_MONITOR_CONFIG } from '@/lib/operations/driver-monitor-config';
import { logSecurityAudit } from '@/lib/security/audit-logger';

import { getDriverProfileByUserId } from '@/lib/firestore-db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    if (session.role !== 'DRIVER' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Driver access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      tripId = DRIVER_MONITOR_CONFIG.DEFAULT_DEMO_TRIP_ID,
      routeId,
      date = new Date().toISOString().split('T')[0],
      tripType = 'MORNING_PICKUP',
      notes,
    } = body;

    // Resolve driver profile
    let driverProfile: any = await prisma.driverProfile.findUnique({
      where: { userId: session.id },
      include: { user: true },
    });

    if (!driverProfile) {
      driverProfile = await getDriverProfileByUserId(session.id);
    }

    if (!driverProfile && session.role === 'ADMIN') {
      driverProfile = await prisma.driverProfile.findFirst({
        include: { user: true },
      });
    }

    if (!driverProfile) {
      return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 });
    }

    if (session.role === 'DRIVER' && driverProfile.isVerified !== true) {
      return NextResponse.json({ error: 'Driver account pending approval' }, { status: 403 });
    }

    // Resolve route
    let route = routeId
      ? await prisma.route.findUnique({ where: { id: routeId } })
      : await prisma.route.findFirst({
          where: { assignedDriverId: driverProfile.id },
        });

    if (!route) {
      route = await prisma.route.findFirst();
    }

    const scheduledDispatch =
      tripType === 'MORNING_PICKUP'
        ? route?.morningStartTime || '08:00 AM'
        : route?.eveningStartTime || '06:00 PM';

    const checkInDeadline = computeCheckInDeadline(scheduledDispatch);

    // Check if an existing coverage event or replacement has already occurred
    const existingCoverageEvent = await prisma.driverCoverageEvent.findFirst({
      where: {
        tripId,
        status: 'REPLACED',
      },
      orderBy: { createdAt: 'desc' },
    });

    const isReplaced = Boolean(existingCoverageEvent && existingCoverageEvent.replacementDriverId);

    // Evaluate check-in timeline
    const now = new Date();
    const evalResult = evaluateCheckInStatus({
      scheduledDispatch,
      checkInDeadline,
      checkedInAt: now,
      referenceTime: now,
      isReplaced,
    });

    // Check if check-in record exists
    let checkInRecord = await prisma.driverCheckIn.findFirst({
      where: {
        tripId,
        driverId: driverProfile.id,
        date,
        tripType,
      },
    });

    if (checkInRecord) {
      checkInRecord = await prisma.driverCheckIn.update({
        where: { id: checkInRecord.id },
        data: {
          status: evalResult.status,
          checkedInAt: now,
          notes: notes || checkInRecord.notes,
        },
      });
    } else {
      checkInRecord = await prisma.driverCheckIn.create({
        data: {
          tripId,
          routeId: route?.id || 'default-route',
          driverId: driverProfile.id,
          driverName: driverProfile.user?.name || 'Captain',
          scheduledDispatch,
          checkInDeadline,
          status: evalResult.status,
          checkedInAt: now,
          date,
          tripType,
          notes,
        },
      });
    }

    // If driver checked in late after a replacement was already assigned, trigger race condition audit
    if (evalResult.status === 'PRIMARY_RETURNED') {
      await prisma.coverageAuditLog.create({
        data: {
          coverageEventId: existingCoverageEvent?.id,
          tripId,
          routeId: route?.id || 'default-route',
          action: 'PRIMARY_CHECKED_IN_LATE',
          actorId: session.id,
          actorName: driverProfile.user?.name || 'Primary Driver',
          primaryDriverId: driverProfile.id,
          replacementDriverId: existingCoverageEvent?.replacementDriverId,
          justification: `Primary driver checked in at ${now.toLocaleTimeString()} after standby replacement was already assigned. Preserving replacement assignment pending Admin arbitration.`,
        },
      });

      await logSecurityAudit({
        action: 'PRIMARY_DRIVER_LATE_CHECKIN',
        tripId,
        actorId: session.id,
        actorName: driverProfile.user?.name || 'Primary Driver',
        details: `Primary driver ${driverProfile.user?.name} checked in late after replacement captain was dispatched.`,
      });

      return NextResponse.json({
        success: true,
        status: evalResult.status,
        checkIn: checkInRecord,
        warning:
          '⚠️ Standby replacement captain was already assigned. Your check-in has been recorded and submitted for Admin review.',
      });
    }

    return NextResponse.json({
      success: true,
      status: evalResult.status,
      checkIn: checkInRecord,
      message:
        evalResult.status === 'LATE'
          ? 'Check-in recorded (Late during grace period). Shuttles ready for boarding.'
          : 'Check-in confirmed on time. Ready for departure.',
    });
  } catch (error: any) {
    console.error('Driver check-in error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit driver check-in' },
      { status: 500 }
    );
  }
}
