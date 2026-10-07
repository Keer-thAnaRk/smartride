import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getUserById,
  getDriverProfileByUserId,
  getAllDriverProfiles,
  getVehiclesByDriverId,
  getVehicleById,
  getRouteById,
  getAllRoutes,
  getSubscriptionsByRouteId,
  getCommuterProfile,
  getAttendancesForRoute,
  upsertAttendance,
  getTripByRouteDriverDateTripType,
  FirestoreDriverProfile,
} from '@/lib/firestore-db';
import { isCommuterOtpVerified } from '@/lib/security/ride-otp';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'DRIVER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Driver access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const tripType = searchParams.get('tripType') || 'MORNING_PICKUP';
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Find driver profile
    let driverProfile: FirestoreDriverProfile | null = null;
    if (session.role === 'DRIVER') {
      driverProfile = await getDriverProfileByUserId(session.id);
    } else {
      const allDrivers = await getAllDriverProfiles();
      driverProfile = allDrivers[0] || null;
    }

    if (!driverProfile) {
      return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 });
    }

    if (session.role === 'DRIVER' && driverProfile.isVerified !== true) {
      return NextResponse.json({ error: 'Driver account pending approval' }, { status: 403 });
    }

    const [user, vehicles, allRoutes] = await Promise.all([
      getUserById(driverProfile.userId),
      getVehiclesByDriverId(driverProfile.id),
      getAllRoutes(),
    ]);

    const driverRoutes = allRoutes.filter((r) => r.assignedDriverId === driverProfile!.id);
    const activeRoute = driverRoutes[0] || null;

    if (!activeRoute) {
      return NextResponse.json({
        success: true,
        driver: {
          id: driverProfile.id,
          name: user?.name || 'Captain',
          isVerified: driverProfile.isVerified,
          status: driverProfile.status,
          rating: driverProfile.rating,
        },
        route: null,
        vehicle: vehicles[0] || null,
        roster: [],
        currentTrip: null,
      });
    }

    // Fetch active subscriptions and attendances for route
    const [rawSubs, attendances] = await Promise.all([
      getSubscriptionsByRouteId(activeRoute.id, true),
      getAttendancesForRoute(activeRoute.id, dateStr, tripType),
    ]);

    // Sort subscriptions by seatNumber
    rawSubs.sort((a, b) => a.seatNumber - b.seatNumber);

    const attendanceMap = new Map(attendances.map((a) => [a.commuterId, a]));

    const roster = await Promise.all(
      rawSubs.map(async (sub, index) => {
        const commuterUser = await getUserById(sub.commuterId);
        const commuterProfile = await getCommuterProfile(sub.commuterId);
        const existingAttendance = attendanceMap.get(sub.commuterId);

        return {
          id: existingAttendance?.id || `temp-${sub.commuterId}`,
          commuterId: sub.commuterId,
          subscriptionId: sub.id,
          name: commuterUser?.name || 'Commuter',
          email: commuterUser?.email || '',
          phone:
            commuterUser?.phone ||
            commuterProfile?.emergencyContact ||
            '+91 98765 43210',
          pickupAddress: sub.pickupAddress,
          dropAddress: sub.dropAddress,
          pickupTime:
            tripType === 'MORNING_PICKUP' ? sub.morningPickupTime : sub.eveningPickupTime,
          dropTime:
            tripType === 'MORNING_PICKUP'
              ? activeRoute.morningStartTime
              : activeRoute.eveningStartTime,
          seatNumber: sub.seatNumber || index + 1,
          status: existingAttendance?.status || 'SCHEDULED',
          notes: existingAttendance?.notes || null,
          avatar: commuterUser?.avatar || null,
        };
      })
    );

    // Check active trip
    const currentTrip = await getTripByRouteDriverDateTripType(
      activeRoute.id,
      driverProfile.id,
      dateStr,
      tripType
    );

    let waypoints = activeRoute.waypoints;
    if (typeof waypoints === 'string') {
      try {
        waypoints = JSON.parse(waypoints);
      } catch (e) {
        waypoints = [];
      }
    }

    const assignedVehicle = activeRoute.assignedVehicleId
      ? await getVehicleById(activeRoute.assignedVehicleId)
      : vehicles[0] || null;

    return NextResponse.json({
      success: true,
      driver: {
        id: driverProfile.id,
        name: user?.name || 'Captain',
        isVerified: driverProfile.isVerified,
        status: driverProfile.status,
        rating: driverProfile.rating,
      },
      route: {
        id: activeRoute.id,
        name: activeRoute.name,
        code: activeRoute.code,
        origin: activeRoute.origin,
        destination: activeRoute.destination,
        distanceKm: activeRoute.distanceKm,
        estimatedMinutes: activeRoute.estimatedMinutes,
        morningStartTime: activeRoute.morningStartTime,
        eveningStartTime: activeRoute.eveningStartTime,
        waypoints,
      },
      vehicle: assignedVehicle,
      roster,
      currentTrip,
    });
  } catch (error: any) {
    console.error('Error fetching driver roster:', error);
    return NextResponse.json({ error: 'Failed to fetch driver roster' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'DRIVER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Driver access required' }, { status: 403 });
    }

    const rateLimitResponse = enforceRateLimit(req, RATE_LIMIT_CONFIG.MUTATIONS, undefined, session);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { commuterId, routeId, tripType = 'MORNING_PICKUP', date, status, notes } = body;

    if (!commuterId || !routeId || !status) {
      return NextResponse.json(
        { error: 'Commuter ID, Route ID, and status are required' },
        { status: 400 }
      );
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Security Gate: Setting status to BOARDED strictly requires prior server-side OTP verification
    if (status === 'BOARDED') {
      const verified = isCommuterOtpVerified(commuterId, targetDate, tripType as any);
      if (!verified) {
        return NextResponse.json(
          { error: 'Cannot mark commuter as BOARDED without verified Ride OTP. Use /api/driver/otp/verify.' },
          { status: 400 }
        );
      }
    }

    // Find driver profile
    let driverProfile: FirestoreDriverProfile | null = null;
    if (session.role === 'DRIVER') {
      driverProfile = await getDriverProfileByUserId(session.id);
      if (!driverProfile) {
        return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 });
      }
      if (driverProfile.isVerified !== true) {
        return NextResponse.json({ error: 'Driver account pending approval' }, { status: 403 });
      }
    } else {
      const allDrivers = await getAllDriverProfiles();
      driverProfile = allDrivers[0] || null;
    }

    // Route ownership check: Drivers may only update attendance on their assigned route
    const route = await getRouteById(routeId);
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }
    if (session.role === 'DRIVER' && route.assignedDriverId !== driverProfile?.id) {
      return NextResponse.json(
        { error: 'Forbidden: Driver is not assigned to this route corridor' },
        { status: 403 }
      );
    }

    const attendance = await upsertAttendance({
      id: `${commuterId}_${targetDate}_${tripType}`,
      commuterId,
      driverId: driverProfile?.id || null,
      routeId,
      date: targetDate,
      tripType,
      status,
      notes: notes || null,
      markedAt: new Date(),
    });

    return NextResponse.json({ success: true, attendance });
  } catch (error: any) {
    console.error('Error updating attendance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update attendance' },
      { status: 500 }
    );
  }
}

