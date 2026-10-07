import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  evaluateStandbyCandidate,
  detectSimilarScores,
  computeCheckInDeadline,
} from '@/lib/operations/driver-coverage-engine';
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
    const body = await req.json().catch(() => ({}));
    const date = body.date || new Date().toISOString().split('T')[0];
    const tripType = body.tripType || 'MORNING_PICKUP';

    // Find check-in or trip info
    const checkIn = await prisma.driverCheckIn.findFirst({
      where: { tripId },
    });

    let routeId = body.routeId || checkIn?.routeId;
    let route = routeId
      ? await prisma.route.findUnique({
          where: { id: routeId },
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

    const scheduledDispatch =
      tripType === 'MORNING_PICKUP'
        ? route.morningStartTime || '08:00 AM'
        : route.eveningStartTime || '06:00 PM';

    const checkInDeadline = computeCheckInDeadline(scheduledDispatch);
    const primaryDriverId = route.assignedDriverId || checkIn?.driverId || 'none';
    const primaryDriverName = route.assignedDriver?.user?.name || checkIn?.driverName || 'Primary Driver';

    // Fetch all drivers except primary driver
    const allDrivers = await prisma.driverProfile.findMany({
      where: {
        id: { not: primaryDriverId },
      },
      include: {
        user: true,
        vehicles: true,
        routes: true,
        leaveRequests: {
          where: {
            status: 'approved',
            startDate: { lte: date },
            endDate: { gte: date },
          },
        },
        trips: {
          where: {
            date,
            tripType,
            status: { in: ['PLANNED', 'IN_PROGRESS'] },
          },
        },
      },
    });

    // Parse origin coordinates if available from waypoints
    let originLat = DRIVER_MONITOR_CONFIG.DEFAULT_DEPOT_LAT;
    let originLng = DRIVER_MONITOR_CONFIG.DEFAULT_DEPOT_LNG;

    if (route.waypoints) {
      try {
        const wp = JSON.parse(route.waypoints);
        if (Array.isArray(wp) && wp.length > 0 && wp[0].lat && wp[0].lng) {
          originLat = wp[0].lat;
          originLng = wp[0].lng;
        }
      } catch (e) {
        // use default
      }
    }

    const activeSubscriptionCount = route.subscriptions?.length || 4;

    // Evaluate each candidate
    const evaluatedCandidates = allDrivers.map((d, index) => {
      const hasApprovedLeave = d.leaveRequests.length > 0;
      const hasConflictingTrip = d.trips.length > 0;
      const assignedRoute = d.routes[0] || null;
      const vehicle = d.vehicles[0] || null;

      // Simulated driver depot/standby locations around Bangalore tech corridors
      const simulatedOffsets = [
        { lat: 12.9141, lng: 77.6200 }, // Silk Board Depot (2.1 km)
        { lat: 12.9352, lng: 77.6245 }, // BTM Layout Hub (4.3 km)
        { lat: 12.9716, lng: 77.5946 }, // MG Road Transit (7.5 km)
        { lat: 13.0358, lng: 77.5970 }, // Hebbal Hub (11.2 km)
      ];
      const simLoc = simulatedOffsets[index % simulatedOffsets.length];

      return evaluateStandbyCandidate({
        driver: {
          id: d.id,
          name: d.user.name,
          phone: d.user.phone,
          avatar: d.user.avatar,
          rating: d.rating,
          experienceYears: d.experienceYears,
          isVerified: d.isVerified,
          status: d.status,
          hasApprovedLeave,
          hasConflictingTrip,
          assignedRouteId: assignedRoute?.id || null,
          assignedRouteCode: assignedRoute?.code || null,
          location: simLoc,
          vehicle: vehicle
            ? {
                make: vehicle.make,
                model: vehicle.model,
                licensePlate: vehicle.licensePlate,
                capacity: vehicle.capacity,
                isApproved: vehicle.isApproved,
              }
            : null,
        },
        route: {
          id: route.id,
          code: route.code,
          name: route.name,
          originLat,
          originLng,
          activeSubscriptionCount,
        },
      });
    });

    // Sort: Eligible drivers first by suitabilityScore descending, then ineligible
    evaluatedCandidates.sort((a, b) => {
      if (a.isEligible && !b.isEligible) return -1;
      if (!a.isEligible && b.isEligible) return 1;
      return b.suitabilityScore - a.suitabilityScore;
    });

    const eligibleCandidates = evaluatedCandidates.filter((c) => c.isEligible);
    const recommendedDriver = eligibleCandidates.length > 0 ? eligibleCandidates[0] : null;

    const { hasSimilarScores, similarCandidatesCount, advisoryNote } =
      detectSimilarScores(evaluatedCandidates);

    return NextResponse.json({
      success: true,
      evaluation: {
        tripId,
        routeId: route.id,
        routeCode: route.code,
        routeName: route.name,
        primaryDriverId,
        primaryDriverName,
        scheduledDispatch,
        checkInDeadline,
        currentCheckInStatus: checkIn?.status || 'NO_SHOW_RISK',
        recommendedDriver,
        allCandidates: evaluatedCandidates,
        hasSimilarScores,
        similarCandidatesCount,
        advisoryNote,
        evaluatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error generating standby recommendations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate standby recommendations' },
      { status: 500 }
    );
  }
}
