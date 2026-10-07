import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getUserById,
  getAllDrivers,
  updateDriverProfile,
  getVehiclesByDriverId,
  updateVehicle,
  getAllRoutes,
  getTripsByDriver,
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

    const [rawDrivers, allRoutes] = await Promise.all([
      getAllDrivers(),
      getAllRoutes(),
    ]);

    const drivers = await Promise.all(
      rawDrivers.map(async (driver) => {
        const [user, vehicles, trips] = await Promise.all([
          getUserById(driver.userId),
          getVehiclesByDriverId(driver.id),
          getTripsByDriver(driver.id, 5),
        ]);

        const routes = allRoutes.filter((r) => r.assignedDriverId === driver.id);

        return {
          ...driver,
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                createdAt: user.createdAt,
              }
            : null,
          vehicles,
          routes,
          trips,
        };
      })
    );

    return NextResponse.json({ success: true, drivers });
  } catch (error: any) {
    console.error('Admin drivers fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { driverId, vehicleId, isVerified, isApproved, status } = body;

    if (driverId !== undefined && isVerified !== undefined) {
      await updateDriverProfile(driverId, {
        isVerified: Boolean(isVerified),
        status: status || (isVerified ? 'AVAILABLE' : 'OFFLINE'),
      });
    }

    if (vehicleId !== undefined && isApproved !== undefined) {
      await updateVehicle(vehicleId, {
        isApproved: Boolean(isApproved),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Driver and vehicle status updated successfully',
    });
  } catch (error: any) {
    console.error('Admin driver status update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update driver status' },
      { status: 500 }
    );
  }
}

