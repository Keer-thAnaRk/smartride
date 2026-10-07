import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getUserById,
  getAllRoutes,
  getRouteById,
  updateRoute,
  getAllSubscriptions,
  getSubscriptionsByRouteId,
  getSubscriptionById,
  updateSubscription,
  getPlanById,
  getAllDrivers,
  getDriverProfileById,
  getVehiclesByDriverId,
  getVehicleById,
} from '@/lib/firestore-db';

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

    // 1. Fetch all routes with assigned driver, vehicle, and active subscriptions
    const rawRoutes = await getAllRoutes();
    const routes = await Promise.all(
      rawRoutes.map(async (route) => {
        let assignedDriver: any = null;
        if (route.assignedDriverId) {
          const driverProfile = await getDriverProfileById(route.assignedDriverId);
          if (driverProfile) {
            const driverUser = await getUserById(driverProfile.userId);
            assignedDriver = {
              ...driverProfile,
              user: driverUser
                ? {
                    name: driverUser.name,
                    phone: driverUser.phone,
                  }
                : null,
            };
          }
        }

        const assignedVehicle = route.assignedVehicleId
          ? await getVehicleById(route.assignedVehicleId)
          : null;

        const rawRouteSubs = await getSubscriptionsByRouteId(route.id, true);
        const subscriptions = await Promise.all(
          rawRouteSubs.map(async (sub) => {
            const commuterUser = await getUserById(sub.commuterId);
            return {
              ...sub,
              commuter: commuterUser
                ? {
                    id: commuterUser.id,
                    name: commuterUser.name,
                    email: commuterUser.email,
                    phone: commuterUser.phone,
                  }
                : null,
            };
          })
        );

        return {
          ...route,
          assignedDriver,
          assignedVehicle,
          subscriptions,
        };
      })
    );

    // 2. Fetch all subscriptions with commuter user, plan, and route
    const rawSubs = await getAllSubscriptions();
    const subscriptions = await Promise.all(
      rawSubs.map(async (sub) => {
        const [commuterUser, plan, route] = await Promise.all([
          getUserById(sub.commuterId),
          sub.planId ? getPlanById(sub.planId) : null,
          sub.routeId ? getRouteById(sub.routeId) : null,
        ]);

        return {
          ...sub,
          commuter: commuterUser
            ? {
                id: commuterUser.id,
                name: commuterUser.name,
                email: commuterUser.email,
                phone: commuterUser.phone,
                avatar: commuterUser.avatar,
              }
            : null,
          plan,
          route,
        };
      })
    );

    // 3. Fetch all verified drivers with approved vehicles and routes
    const rawDrivers = await getAllDrivers(true);
    const drivers = await Promise.all(
      rawDrivers.map(async (driver) => {
        const [driverUser, vehicles] = await Promise.all([
          getUserById(driver.userId),
          getVehiclesByDriverId(driver.id),
        ]);

        const approvedVehicles = vehicles.filter((v) => v.isApproved);
        const driverAssignedRoutes = rawRoutes.filter(
          (r) => r.assignedDriverId === driver.id
        );

        return {
          ...driver,
          user: driverUser
            ? {
                name: driverUser.name,
                email: driverUser.email,
                phone: driverUser.phone,
              }
            : null,
          vehicles: approvedVehicles,
          routes: driverAssignedRoutes,
        };
      })
    );

    return NextResponse.json({
      success: true,
      routes,
      subscriptions,
      drivers,
    });
  } catch (error: any) {
    console.error('Admin allocations fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch allocations' }, { status: 500 });
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

    const body = await req.json();
    const { subscriptionId, routeId, seatNumber, assignedDriverId, assignedVehicleId } = body;

    // Route-to-Driver / Vehicle assignment
    if (routeId && (assignedDriverId !== undefined || assignedVehicleId !== undefined)) {
      await updateRoute(routeId, {
        ...(assignedDriverId !== undefined
          ? { assignedDriverId: assignedDriverId || null }
          : {}),
        ...(assignedVehicleId !== undefined
          ? { assignedVehicleId: assignedVehicleId || null }
          : {}),
      });
      return NextResponse.json({
        success: true,
        message: 'Route driver/vehicle assignment updated',
      });
    }

    // Commuter subscription to route/seat assignment
    if (subscriptionId && routeId) {
      const targetRoute = await getRouteById(routeId);
      if (!targetRoute) {
        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
      }

      const assignedVeh = targetRoute.assignedVehicleId
        ? await getVehicleById(targetRoute.assignedVehicleId)
        : null;
      const capacity = assignedVeh?.capacity || 4;

      const activeSubs = await getSubscriptionsByRouteId(routeId, true);
      if (activeSubs.length >= capacity) {
        return NextResponse.json(
          { error: `Selected route is full (${capacity}/${capacity} seats allocated)` },
          { status: 400 }
        );
      }

      const nextSeat = seatNumber ? parseInt(seatNumber) : activeSubs.length + 1;
      await updateSubscription(subscriptionId, {
        routeId,
        seatNumber: nextSeat,
      });

      const updatedSub = await getSubscriptionById(subscriptionId);

      return NextResponse.json({
        success: true,
        subscription: updatedSub,
        message: 'Commuter reassigned successfully',
      });
    }

    return NextResponse.json({ error: 'Invalid assignment parameters' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin allocation update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update allocation' },
      { status: 500 }
    );
  }
}

