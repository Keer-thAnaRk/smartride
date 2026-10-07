import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getUserById,
  getDriverProfileByUserId,
  getAllDriverProfiles,
  updateDriverProfile,
  getRouteById,
  getVehiclesByDriverId,
  getVehicleById,
  getTripByRouteDriverDateTripType,
  setTripRecord,
  updateTripRecord,
  updateAttendancesBulk,
  getAttendancesForRoute,
  FirestoreTripRecord,
  FirestoreDriverProfile,
} from '@/lib/firestore-db';
import { syncTripToFirestore, FirestoreTrip, getOrCreateDefaultTrip } from '@/lib/firebase';
import prisma from '@/lib/prisma';
import { logSecurityAudit } from '@/lib/security/audit-logger';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export async function POST(req: NextRequest) {
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
    const { routeId, tripType = 'MORNING_PICKUP', action, date } = body;

    if (!routeId || !action) {
      return NextResponse.json(
        { error: 'Route ID and action (START or COMPLETE) are required' },
        { status: 400 }
      );
    }

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

    const todayStr = date || new Date().toISOString().split('T')[0];

    let trip = await getTripByRouteDriverDateTripType(
      routeId,
      driverProfile.id,
      todayStr,
      tripType
    );

    const [route, driverUser, vehicles] = await Promise.all([
      getRouteById(routeId),
      getUserById(driverProfile.userId),
      getVehiclesByDriverId(driverProfile.id),
    ]);

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    if (session.role === 'DRIVER' && route.assignedDriverId !== driverProfile.id) {
      return NextResponse.json({ error: 'Forbidden: Route not assigned to this driver' }, { status: 403 });
    }

    const vehicle = route?.assignedVehicleId
      ? await getVehicleById(route.assignedVehicleId)
      : vehicles[0] || null;

    if (action === 'START') {
      if (trip && trip.status !== 'SCHEDULED') {
        return NextResponse.json({ error: `Cannot start trip. Current state is ${trip.status}` }, { status: 400 });
      }

      // Check if any passenger has been verified server-side or in active manifest
      const [attendances, defaultTrip] = await Promise.all([
        getAttendancesForRoute(routeId, todayStr, tripType),
        Promise.resolve(getOrCreateDefaultTrip()),
      ]);
      const hasVerifiedPassenger =
        attendances.some((a) => a.status === 'BOARDED') ||
        defaultTrip.passengers?.some((p) => p.boarded);

      if (!hasVerifiedPassenger) {
        try {
          await prisma.safetyEvent.create({
            data: {
              id: `anom-start-${Date.now()}`,
              tripId: trip ? trip.id : `trip_${routeId}_${todayStr}_${tripType}`,
              type: 'UNEXPECTED_TRIP_START',
              severity: 'HIGH',
              status: 'ACTIVE',
              title: 'Unexpected Trip Start Without Verification',
              description: 'Trip dispatch initiated before any commuter OTP verification completed on the manifest.',
              detectedAt: new Date(),
              metadata: JSON.stringify({
                routeId,
                driverId: driverProfile.id,
                driverName: driverUser?.name || 'Captain',
              }),
            },
          });

          await logSecurityAudit({
            action: 'UNAUTHORIZED_DISPATCH_ATTEMPT',
            tripId: trip ? trip.id : `trip_${routeId}_${todayStr}_${tripType}`,
            actorId: session.id,
            actorName: driverUser?.name || 'Assigned Driver',
            details: 'Driver initiated trip dispatch before verifying commuter security credentials.',
            metadata: { routeId, driverId: driverProfile.id },
          });
        } catch (e) {
          // Non-blocking
        }
      }

      if (trip) {
        await updateTripRecord(trip.id, {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        });
        trip = {
          ...trip,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        };
      } else {
        const newTrip: FirestoreTripRecord = {
          id: `trip_${routeId}_${todayStr}_${tripType}`,
          routeId,
          driverId: driverProfile.id,
          date: todayStr,
          tripType,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await setTripRecord(newTrip);
        trip = newTrip;
      }

      await updateDriverProfile(driverProfile.id, { status: 'ON_TRIP' });

      // Synchronize to Firestore live trips & sanitized public projection
      const liveTrip: FirestoreTrip = {
        tripId: trip.id,
        routeId,
        routeName: route?.name || 'Corridor Express Shuttle',
        routeCode: route?.code || 'SR-101',
        driverId: driverProfile.id,
        driverName: driverUser?.name || 'Captain',
        driverPhone: driverUser?.phone || '+91 98450 12345',
        vehiclePlate: vehicle?.licensePlate || 'KA-01-MJ-8822',
        vehicleModel: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Executive Shuttle',
        date: todayStr,
        tripType: tripType as any,
        status: 'in_transit',
        passengers: [],
        liveLocation: {
          lat: 12.9121,
          lng: 77.6446,
          heading: 68,
          speedKmH: 34,
          updatedAt: new Date().toISOString(),
        },
        shareToken: `share_${trip.id}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await syncTripToFirestore(liveTrip);
    } else if (action === 'COMPLETE') {
      if (!trip) {
        return NextResponse.json({ error: 'Cannot complete a trip that was never started' }, { status: 400 });
      }
      if (trip.status !== 'IN_PROGRESS') {
        return NextResponse.json({ error: `Cannot complete trip. Current state is ${trip.status}` }, { status: 400 });
      }

      if (trip) {
        await updateTripRecord(trip.id, {
          status: 'COMPLETED',
          completedAt: new Date(),
        });
        trip = {
          ...trip,
          status: 'COMPLETED',
          completedAt: new Date(),
        };
      } else {
        const newTrip: FirestoreTripRecord = {
          id: `trip_${routeId}_${todayStr}_${tripType}`,
          routeId,
          driverId: driverProfile.id,
          date: todayStr,
          tripType,
          status: 'COMPLETED',
          startedAt: new Date(Date.now() - 40 * 60000),
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await setTripRecord(newTrip);
        trip = newTrip;
      }

      // Mark all boarded commuters as COMPLETED
      await updateAttendancesBulk(
        {
          routeId,
          date: todayStr,
          tripType,
          status: 'BOARDED',
        },
        {
          status: 'COMPLETED',
        }
      );

      await updateDriverProfile(driverProfile.id, { status: 'AVAILABLE' });

      // Synchronize completion to Firestore live trips & sanitized public projection
      const liveTrip: FirestoreTrip = {
        tripId: trip.id,
        routeId,
        routeName: route?.name || 'Corridor Express Shuttle',
        routeCode: route?.code || 'SR-101',
        driverId: driverProfile.id,
        driverName: driverUser?.name || 'Captain',
        vehiclePlate: vehicle?.licensePlate || 'KA-01-MJ-8822',
        vehicleModel: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Executive Shuttle',
        date: todayStr,
        tripType: tripType as any,
        status: 'completed',
        passengers: [],
        liveLocation: {
          lat: 12.9856,
          lng: 77.7312,
          heading: 90,
          speedKmH: 0,
          updatedAt: new Date().toISOString(),
        },
        shareToken: `share_${trip.id}`,
        updatedAt: new Date().toISOString(),
      };
      await syncTripToFirestore(liveTrip);
    }

    return NextResponse.json({ success: true, trip });
  } catch (error: any) {
    console.error('Trip operation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update trip status' },
      { status: 500 }
    );
  }
}

