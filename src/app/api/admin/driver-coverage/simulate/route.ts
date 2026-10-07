import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { DRIVER_MONITOR_CONFIG } from '@/lib/operations/driver-monitor-config';
import { logSecurityAudit } from '@/lib/security/audit-logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const {
      action,
      tripId = DRIVER_MONITOR_CONFIG.DEFAULT_DEMO_TRIP_ID,
      routeCode = DRIVER_MONITOR_CONFIG.DEFAULT_DEMO_ROUTE_CODE,
    } = body;

    const route = await prisma.route.findFirst({
      where: { code: routeCode },
      include: {
        assignedDriver: { include: { user: true } },
      },
    });

    if (!route) {
      return NextResponse.json({ error: 'Demo route not found' }, { status: 404 });
    }

    const primaryDriverId = route.assignedDriverId || 'demo-primary';
    const primaryDriverName = route.assignedDriver?.user?.name || 'Rajesh Kumar';
    const date = new Date().toISOString().split('T')[0];

    if (action === 'SIMULATE_DRIVER_CHECK_IN') {
      await prisma.driverCheckIn.upsert({
        where: {
          tripId_driverId_date_tripType: {
            tripId,
            driverId: primaryDriverId,
            date,
            tripType: 'MORNING_PICKUP',
          },
        },
        create: {
          tripId,
          routeId: route.id,
          driverId: primaryDriverId,
          driverName: primaryDriverName,
          scheduledDispatch: '08:00 AM',
          checkInDeadline: '07:45 AM',
          status: 'CHECKED_IN',
          checkedInAt: new Date(),
          date,
          tripType: 'MORNING_PICKUP',
        },
        update: {
          status: 'CHECKED_IN',
          checkedInAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Simulated: Primary Driver ${primaryDriverName} checked in on time at ${new Date().toLocaleTimeString()}.`,
      });
    }

    if (action === 'SIMULATE_DRIVER_LATE') {
      await prisma.driverCheckIn.upsert({
        where: {
          tripId_driverId_date_tripType: {
            tripId,
            driverId: primaryDriverId,
            date,
            tripType: 'MORNING_PICKUP',
          },
        },
        create: {
          tripId,
          routeId: route.id,
          driverId: primaryDriverId,
          driverName: primaryDriverName,
          scheduledDispatch: '08:00 AM',
          checkInDeadline: '07:45 AM',
          status: 'LATE',
          checkedInAt: null,
          date,
          tripType: 'MORNING_PICKUP',
          notes: 'Driver is late (within 5 min grace period).',
        },
        update: {
          status: 'LATE',
          checkedInAt: null,
          notes: 'Driver is late (within 5 min grace period).',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Simulated: Primary Driver ${primaryDriverName} marked LATE (within grace period).`,
      });
    }

    if (action === 'SIMULATE_DRIVER_NO_SHOW') {
      // Upsert Check-in as NO_SHOW_CONFIRMED
      await prisma.driverCheckIn.upsert({
        where: {
          tripId_driverId_date_tripType: {
            tripId,
            driverId: primaryDriverId,
            date,
            tripType: 'MORNING_PICKUP',
          },
        },
        create: {
          tripId,
          routeId: route.id,
          driverId: primaryDriverId,
          driverName: primaryDriverName,
          scheduledDispatch: '08:00 AM',
          checkInDeadline: '07:45 AM',
          status: 'NO_SHOW_CONFIRMED',
          checkedInAt: null,
          date,
          tripType: 'MORNING_PICKUP',
          notes: 'Grace period expired without check-in. Potential driver no-show.',
        },
        update: {
          status: 'NO_SHOW_CONFIRMED',
          checkedInAt: null,
          notes: 'Grace period expired without check-in. Potential driver no-show.',
        },
      });

      // Create a Safety Event for Anomaly Tracking
      await prisma.safetyEvent.create({
        data: {
          id: `no-show-${Date.now()}`,
          tripId,
          type: 'DRIVER_VERIFICATION_ISSUE',
          severity: 'HIGH',
          status: 'ACTIVE',
          title: `Driver No-Show Risk: ${route.code}`,
          description: `Primary Driver ${primaryDriverName} failed to check in for scheduled 08:00 AM dispatch on corridor ${route.name}. Standby replacement search initiated.`,
          detectedAt: new Date(),
          metadata: JSON.stringify({
            routeId: route.id,
            routeCode: route.code,
            primaryDriverId,
            primaryDriverName,
          }),
        },
      });

      // Create DriverCoverageEvent
      const covEvent = await prisma.driverCoverageEvent.create({
        data: {
          tripId,
          routeId: route.id,
          primaryDriverId,
          primaryDriverName,
          status: 'NO_SHOW_CONFIRMED',
          noShowReason: 'Primary driver failed to check in past the grace period.',
          detectedAt: new Date(),
        },
      });

      // Log Coverage Audit
      await prisma.coverageAuditLog.create({
        data: {
          coverageEventId: covEvent.id,
          tripId,
          routeId: route.id,
          action: 'NO_SHOW_DETECTED',
          actorId: session.id,
          actorName: session.name || 'System Monitor',
          primaryDriverId,
          justification: 'Automated monitor confirmed primary driver no-show. Standby recommendation engine triggered.',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Simulated: Primary Driver ${primaryDriverName} declared NO-SHOW. Standby replacement ready.`,
      });
    }

    if (action === 'RESET') {
      await prisma.driverCheckIn.deleteMany({
        where: { tripId },
      });

      await prisma.driverCoverageEvent.deleteMany({
        where: { tripId },
      });

      await prisma.coverageAuditLog.deleteMany({
        where: { tripId },
      });

      return NextResponse.json({
        success: true,
        message: 'Driver coverage simulation state reset successfully.',
      });
    }

    return NextResponse.json({ error: 'Unknown simulation action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in driver coverage simulation:', error);
    return NextResponse.json(
      { error: error.message || 'Simulation action failed' },
      { status: 500 }
    );
  }
}
