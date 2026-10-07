import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getAllRoutes,
  getRouteByCode,
  setRoute,
  getDriverProfileById,
  getUserById,
  getVehicleById,
  getSubscriptionsByRouteId,
  FirestoreRoute,
  DEFAULT_CORRIDOR_ROUTES,
} from '@/lib/firestore-db';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export async function GET(req: NextRequest) {
  try {
    let routes = await getAllRoutes();

    if (!routes || routes.length === 0) {
      for (const r of DEFAULT_CORRIDOR_ROUTES) {
        await setRoute(r);
      }
      routes = await getAllRoutes();
    }

    const formattedRoutes = await Promise.all(
      routes.map(async (r) => {
        let assignedDriver: any = null;
        let assignedVehicle: any = null;

        if (r.assignedDriverId) {
          const dp = await getDriverProfileById(r.assignedDriverId);
          if (dp) {
            const u = await getUserById(dp.userId);
            assignedDriver = {
              id: dp.id,
              name: u?.name || 'Driver',
              rating: dp.rating,
              phone: u?.phone || null,
              avatar: u?.avatar || null,
              isVerified: dp.isVerified,
            };
          }
        }

        if (r.assignedVehicleId) {
          const v = await getVehicleById(r.assignedVehicleId);
          if (v) {
            assignedVehicle = {
              id: v.id,
              make: v.make,
              model: v.model,
              year: v.year,
              licensePlate: v.licensePlate,
              capacity: v.capacity,
              type: v.type,
              isApproved: v.isApproved,
            };
          }
        }

        const activeSubs = await getSubscriptionsByRouteId(r.id, true);

        return {
          id: r.id,
          name: r.name,
          code: r.code,
          origin: r.origin,
          destination: r.destination,
          morningStartTime: r.morningStartTime,
          eveningStartTime: r.eveningStartTime,
          distanceKm: r.distanceKm,
          estimatedMinutes: r.estimatedMinutes,
          status: r.status,
          waypoints: r.waypoints || [],
          activeSubscriptionsCount: activeSubs.length,
          assignedDriver,
          assignedVehicle,
        };
      })
    );

    formattedRoutes.sort((a, b) => a.code.localeCompare(b.code));

    return NextResponse.json({ success: true, routes: formattedRoutes });
  } catch (error: any) {
    console.error('Error fetching routes:', error);
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const rateLimitError = enforceRateLimit(req, RATE_LIMIT_CONFIG.MUTATIONS, undefined, session);
    if (rateLimitError) return rateLimitError;

    const body = await req.json();
    const {
      name,
      code,
      origin,
      destination,
      waypoints,
      morningStartTime,
      eveningStartTime,
      distanceKm,
      estimatedMinutes,
      assignedDriverId,
      assignedVehicleId,
    } = body;

    if (!name || !code || !origin || !destination) {
      return NextResponse.json({ error: 'Route name, code, origin, and destination are required' }, { status: 400 });
    }

    const existing = await getRouteByCode(code);
    if (existing) {
      return NextResponse.json({ error: 'Route code already exists' }, { status: 409 });
    }

    let parsedWaypoints = [];
    if (Array.isArray(waypoints)) {
      parsedWaypoints = waypoints;
    } else if (typeof waypoints === 'string') {
      try {
        parsedWaypoints = JSON.parse(waypoints);
      } catch (e) {
        parsedWaypoints = [];
      }
    }

    const routeId = `route-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const newRoute: FirestoreRoute = {
      id: routeId,
      name,
      code,
      origin,
      destination,
      waypoints: parsedWaypoints,
      morningStartTime: morningStartTime || '08:00 AM',
      eveningStartTime: eveningStartTime || '06:00 PM',
      distanceKm: parseFloat(distanceKm) || 15.0,
      estimatedMinutes: parseInt(estimatedMinutes) || 45,
      status: 'ACTIVE',
      assignedDriverId: assignedDriverId || null,
      assignedVehicleId: assignedVehicleId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setRoute(newRoute);

    return NextResponse.json({ success: true, route: newRoute });
  } catch (error: any) {
    console.error('Error creating route:', error);
    return NextResponse.json({ error: error.message || 'Failed to create route' }, { status: 500 });
  }
}
