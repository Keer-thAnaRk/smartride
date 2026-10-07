import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logSecurityAudit } from '@/lib/security/audit-logger';
import { DRIVER_MONITOR_CONFIG } from '@/lib/operations/driver-monitor-config';

export const dynamic = 'force-dynamic';

export async function POST(
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
    const body = await req.json();
    const {
      replacementDriverId,
      reason = 'Primary driver unavailable / No-show confirmed',
      suitabilityScore,
      candidateBreakdown,
    } = body;

    if (!replacementDriverId) {
      return NextResponse.json(
        { error: 'Replacement driver ID is required' },
        { status: 400 }
      );
    }

    // 1. Revalidation: Fetch candidate driver
    const replacementDriver = await prisma.driverProfile.findUnique({
      where: { id: replacementDriverId },
      include: {
        user: true,
        vehicles: true,
        leaveRequests: {
          where: {
            status: 'approved',
            startDate: { lte: new Date().toISOString().split('T')[0] },
            endDate: { gte: new Date().toISOString().split('T')[0] },
          },
        },
        trips: {
          where: {
            date: new Date().toISOString().split('T')[0],
            status: { in: ['IN_PROGRESS'] },
          },
        },
      },
    });

    if (!replacementDriver) {
      return NextResponse.json(
        { error: 'Selected standby driver not found' },
        { status: 404 }
      );
    }

    // Guard 1: Must be verified
    if (!replacementDriver.isVerified) {
      return NextResponse.json(
        { error: 'Selected driver lacks mandatory verified KYC credentials' },
        { status: 400 }
      );
    }

    // Guard 2: Must not be on leave
    if (replacementDriver.leaveRequests.length > 0) {
      return NextResponse.json(
        {
          error:
            '⚠️ Assignment conflict: Selected driver has an active approved leave today. Please choose another candidate.',
        },
        { status: 409 }
      );
    }

    // Guard 3: Must not be on another active trip right now
    if (replacementDriver.trips.length > 0) {
      return NextResponse.json(
        {
          error:
            '⚠️ Assignment conflict: Selected driver is currently executing another active trip. Please choose another candidate.',
        },
        { status: 409 }
      );
    }

    // 2. Fetch Check-In and Route
    let checkIn = await prisma.driverCheckIn.findFirst({
      where: { tripId },
    });

    let route = checkIn?.routeId
      ? await prisma.route.findUnique({
          where: { id: checkIn.routeId },
          include: {
            assignedDriver: { include: { user: true } },
            subscriptions: { where: { status: 'ACTIVE' } },
          },
        })
      : await prisma.route.findFirst({
          include: {
            assignedDriver: { include: { user: true } },
            subscriptions: { where: { status: 'ACTIVE' } },
          },
        });

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    const primaryDriverId = route.assignedDriverId || checkIn?.driverId || 'unassigned';
    const primaryDriverName = route.assignedDriver?.user?.name || checkIn?.driverName || 'Captain';
    const repName = replacementDriver.user.name;

    // 3. Transactional Database Updates
    const [coverageEvent] = await prisma.$transaction([
      // Create or update coverage event
      prisma.driverCoverageEvent.create({
        data: {
          tripId,
          routeId: route.id,
          checkInId: checkIn?.id || null,
          primaryDriverId,
          primaryDriverName,
          replacementDriverId: replacementDriver.id,
          replacementDriverName: repName,
          status: 'REPLACED',
          suitabilityScore: suitabilityScore || 90.0,
          noShowReason: reason,
          dispatchDelayMinutes: DRIVER_MONITOR_CONFIG.DEFAULT_SUBSTITUTION_DELAY_MINS,
          resolvedAt: new Date(),
          resolvedBy: session.name || 'Operations Admin',
        },
      }),

      // Update check-in record status to REPLACED
      prisma.driverCheckIn.upsert({
        where: {
          tripId_driverId_date_tripType: {
            tripId,
            driverId: primaryDriverId,
            date: new Date().toISOString().split('T')[0],
            tripType: 'MORNING_PICKUP',
          },
        },
        create: {
          tripId,
          routeId: route.id,
          driverId: primaryDriverId,
          driverName: primaryDriverName,
          scheduledDispatch: route.morningStartTime || '08:00 AM',
          checkInDeadline: '07:45 AM',
          status: 'REPLACED',
          date: new Date().toISOString().split('T')[0],
          tripType: 'MORNING_PICKUP',
          notes: `Replaced by standby captain ${repName}`,
        },
        update: {
          status: 'REPLACED',
          notes: `Replaced by standby captain ${repName}`,
        },
      }),

      // Update Route's assigned driver to the replacement driver
      prisma.route.update({
        where: { id: route.id },
        data: {
          assignedDriverId: replacementDriver.id,
        },
      }),

      // Log Coverage Audit Entry
      prisma.coverageAuditLog.create({
        data: {
          tripId,
          routeId: route.id,
          action: 'REPLACEMENT_ASSIGNED',
          actorId: session.id,
          actorName: session.name || 'Operations Admin',
          primaryDriverId,
          replacementDriverId: replacementDriver.id,
          suitabilityScore: suitabilityScore || 90.0,
          candidatesEvaluated: candidateBreakdown ? JSON.stringify(candidateBreakdown) : null,
          justification: `Assigned standby captain ${repName} (Suitability: ${suitabilityScore || 90}/100) due to primary driver no-show.`,
        },
      }),
    ]);

    // 4. Send Neutral Reassuring Commuter Notifications
    const commuters = route.subscriptions || [];
    for (const sub of commuters) {
      await prisma.notification.create({
        data: {
          userId: sub.commuterId,
          title: '🔄 Shuttle Captain Update',
          message: `Your SmartRide captain has been updated for today's ${route.code} trip. Captain ${repName} is operating your shuttle. Your reserved seat remains Seat #${sub.seatNumber || 1}.`,
          type: 'INFO',
        },
      });
    }

    // 5. Notify Replacement Driver
    await prisma.notification.create({
      data: {
        userId: replacementDriver.userId,
        title: '🔄 Standby Assignment Dispatched',
        message: `You have been assigned as standby captain for Route ${route.code} (${route.name}) departing at ${route.morningStartTime || '08:00 AM'}. Please proceed to origin.`,
        type: 'WARNING',
      },
    });

    // 6. Security Audit Log
    await logSecurityAudit({
      action: 'STANDBY_DRIVER_ASSIGNED',
      tripId,
      actorId: session.id,
      actorName: session.name || 'Operations Admin',
      details: `Replaced primary driver ${primaryDriverName} with standby captain ${repName} on corridor ${route.code}.`,
    });

    return NextResponse.json({
      success: true,
      message: `Standby Captain ${repName} assigned successfully. Commuters notified.`,
      coverageEvent,
      replacementDriver: {
        id: replacementDriver.id,
        name: repName,
        phone: replacementDriver.user.phone,
        rating: replacementDriver.rating,
        vehicle: replacementDriver.vehicles[0] || null,
      },
    });
  } catch (error: any) {
    console.error('Error assigning standby driver replacement:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to assign standby driver' },
      { status: 500 }
    );
  }
}
