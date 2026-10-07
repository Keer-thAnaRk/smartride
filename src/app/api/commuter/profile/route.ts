import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getUserById,
  updateUser,
  getCommuterProfile,
  upsertCommuterProfile,
  getSubscriptionsByCommuterId,
  getRouteById,
  getPlanById,
  getDriverProfileById,
  getVehicleById,
  getVehiclesByDriverId,
  getActiveLeaveForRoute,
} from '@/lib/firestore-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized role' }, { status: 403 });
    }

    const user = await getUserById(session.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const commuterProfile = await getCommuterProfile(session.id);
    const rawSubs = await getSubscriptionsByCommuterId(session.id);

    // Enrich subscriptions with plans, routes, assigned drivers, and vehicles
    const enrichedSubscriptions = await Promise.all(
      rawSubs.map(async (sub) => {
        const plan = sub.planId ? await getPlanById(sub.planId) : null;
        let route: any = null;
        if (sub.routeId) {
          const rawRoute = await getRouteById(sub.routeId);
          if (rawRoute) {
            let assignedDriver: any = null;
            if (rawRoute.assignedDriverId) {
              const driverProfile = await getDriverProfileById(rawRoute.assignedDriverId);
              if (driverProfile) {
                const driverUser = await getUserById(driverProfile.userId);
                assignedDriver = {
                  ...driverProfile,
                  user: driverUser
                    ? {
                        name: driverUser.name,
                        phone: driverUser.phone,
                        avatar: driverUser.avatar,
                      }
                    : null,
                };
              }
            }

            let assignedVehicle: any = null;
            if (rawRoute.assignedVehicleId) {
              assignedVehicle = await getVehicleById(rawRoute.assignedVehicleId);
            }

            route = {
              ...rawRoute,
              assignedDriver,
              assignedVehicle,
            };
          }
        }

        return {
          ...sub,
          plan,
          route,
        };
      })
    );

    // Check if the assigned route has an active approved leave request for today
    const activeSub =
      enrichedSubscriptions.find((s) => s.status === 'ACTIVE') ||
      enrichedSubscriptions[0];
    let activeSubstitute: any = null;

    if (activeSub?.routeId) {
      const todayStr = new Date().toISOString().split('T')[0];
      const activeLeave = await getActiveLeaveForRoute(activeSub.routeId, todayStr);

      if (activeLeave && activeLeave.replacementDriverId) {
        const rep = await getDriverProfileById(activeLeave.replacementDriverId);
        if (rep) {
          const repUser = await getUserById(rep.userId);
          const repVehicles = await getVehiclesByDriverId(rep.id);
          const veh = repVehicles[0] || null;

          const origDriver = await getDriverProfileById(activeLeave.driverId);
          const origUser = origDriver ? await getUserById(origDriver.userId) : null;

          activeSubstitute = {
            leaveId: activeLeave.id,
            originalDriverName:
              activeLeave.driverName || origUser?.name || 'Assigned Driver',
            startDate: activeLeave.startDate,
            endDate: activeLeave.endDate,
            driver: {
              id: rep.id,
              name: repUser?.name || 'Substitute Captain',
              phone: repUser?.phone || null,
              avatar: repUser?.avatar || null,
              rating: rep.rating || 4.9,
            },
            vehicle: veh
              ? {
                  id: veh.id,
                  make: veh.make,
                  model: veh.model,
                  licensePlate: veh.licensePlate,
                  capacity: veh.capacity,
                  type: veh.type,
                }
              : null,
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      subscriptions: enrichedSubscriptions,
      user: {
        ...user,
        commuterProfile,
        subscriptions: enrichedSubscriptions,
      },
      activeSubstitute,
    });
  } catch (error: any) {
    console.error('Commuter profile fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized role' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      phone,
      defaultPickupAddress,
      defaultDropAddress,
      morningPickupTime,
      eveningDropTime,
      emergencyContact,
    } = body;

    if (name || phone) {
      await updateUser(session.id, {
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
      });
    }

    const profile = await upsertCommuterProfile(session.id, {
      defaultPickupAddress:
        defaultPickupAddress !== undefined ? defaultPickupAddress : null,
      defaultDropAddress:
        defaultDropAddress !== undefined ? defaultDropAddress : null,
      morningPickupTime: morningPickupTime || '08:30 AM',
      eveningDropTime: eveningDropTime || '06:00 PM',
      emergencyContact: emergencyContact !== undefined ? emergencyContact : null,
    });

    return NextResponse.json({
      success: true,
      profile,
      message: 'Profile updated successfully',
    });
  } catch (error: any) {
    console.error('Commuter profile update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}

