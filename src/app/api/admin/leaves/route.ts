import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getUserById,
  getAllDrivers,
  getDriverProfileById,
  getVehiclesByDriverId,
  getAllRoutes,
  getRouteById,
  getAllLeaveRequests,
  getLeaveRequestById,
  updateLeaveRequest,
  createNotification,
  getSubscriptionsByRouteId,
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

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status'); // 'pending' or 'all'

    // Fetch leave requests from Firestore
    const leaves = await getAllLeaveRequests(
      statusFilter === 'pending' ? 'pending' : undefined
    );

    // Fetch all routes and verified standby drivers
    const [allRoutes, allVerifiedDrivers] = await Promise.all([
      getAllRoutes(),
      getAllDrivers(true),
    ]);

    const formattedLeaves = await Promise.all(
      leaves.map(async (l) => {
        const [driver, assignedRoute] = await Promise.all([
          getDriverProfileById(l.driverId),
          l.assignedRouteId ? getRouteById(l.assignedRouteId) : null,
        ]);

        const driverUser = driver ? await getUserById(driver.userId) : null;

        let replacementDriver: any = null;
        let replacementUser: any = null;
        let replacementVehicles: any[] = [];

        if (l.replacementDriverId) {
          replacementDriver = await getDriverProfileById(l.replacementDriverId);
          if (replacementDriver) {
            [replacementUser, replacementVehicles] = await Promise.all([
              getUserById(replacementDriver.userId),
              getVehiclesByDriverId(replacementDriver.id),
            ]);
          }
        }

        const repVehicle = replacementVehicles[0] || null;

        const appliedAtStr =
          typeof l.appliedAt === 'string'
            ? l.appliedAt
            : l.appliedAt?.toDate
            ? l.appliedAt.toDate().toISOString()
            : l.appliedAt instanceof Date
            ? l.appliedAt.toISOString()
            : new Date().toISOString();

        const reviewedAtStr = l.reviewedAt
          ? typeof l.reviewedAt === 'string'
            ? l.reviewedAt
            : l.reviewedAt?.toDate
            ? l.reviewedAt.toDate().toISOString()
            : l.reviewedAt instanceof Date
            ? l.reviewedAt.toISOString()
            : new Date().toISOString()
          : null;

        return {
          id: l.id,
          requestId: l.requestId || l.id,
          driverId: l.driverId,
          driverName: l.driverName || driverUser?.name || 'Driver',
          driverEmail: driverUser?.email,
          driverPhone: driverUser?.phone,
          driverAvatar: driverUser?.avatar,
          assignedRouteId: l.assignedRouteId,
          assignedRouteCode: assignedRoute?.code || 'N/A',
          assignedRouteName: assignedRoute?.name || 'Assigned Corridor',
          startDate: l.startDate,
          endDate: l.endDate,
          reason: l.reason,
          status: l.status,
          replacementDriverId: l.replacementDriverId || null,
          replacementDriverName:
            l.replacementDriverName || replacementUser?.name || null,
          replacementDriverAvatar: replacementUser?.avatar || null,
          replacementDriverRating: replacementDriver?.rating || null,
          replacementDriverPhone: replacementUser?.phone || null,
          replacementVehicleModel: repVehicle
            ? `${repVehicle.make} ${repVehicle.model}`
            : null,
          replacementLicensePlate: repVehicle?.licensePlate || null,
          appliedAt: appliedAtStr,
          reviewedAt: reviewedAtStr,
        };
      })
    );

    const formattedStandbyDrivers = await Promise.all(
      allVerifiedDrivers.map(async (d) => {
        const [user, vehicles] = await Promise.all([
          getUserById(d.userId),
          getVehiclesByDriverId(d.id),
        ]);

        const assignedRoutes = allRoutes.filter((r) => r.assignedDriverId === d.id);

        return {
          id: d.id,
          name: user?.name || 'Driver',
          avatar: user?.avatar || null,
          phone: user?.phone || null,
          rating: d.rating,
          isVerified: d.isVerified,
          status: d.status,
          hasPermanentRoute: assignedRoutes.length > 0,
          assignedRouteCode: assignedRoutes[0]?.code || null,
          vehicle: vehicles[0]
            ? {
                id: vehicles[0].id,
                make: vehicles[0].make,
                model: vehicles[0].model,
                licensePlate: vehicles[0].licensePlate,
                capacity: vehicles[0].capacity,
                type: vehicles[0].type,
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      leaves: formattedLeaves,
      standbyDrivers: formattedStandbyDrivers,
    });
  } catch (error: any) {
    console.error('Error fetching admin leave requests:', error);
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 });
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
    const { requestId, action, replacementDriverId } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { error: 'requestId and action are required' },
        { status: 400 }
      );
    }

    const existingLeave = await getLeaveRequestById(requestId);
    if (!existingLeave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    const [originalDriver, assignedRoute] = await Promise.all([
      getDriverProfileById(existingLeave.driverId),
      existingLeave.assignedRouteId ? getRouteById(existingLeave.assignedRouteId) : null,
    ]);

    if (action === 'approve') {
      if (!replacementDriverId) {
        return NextResponse.json(
          { error: 'Standby replacement driver must be selected for approval' },
          { status: 400 }
        );
      }

      const replacementDriver = await getDriverProfileById(replacementDriverId);
      if (!replacementDriver) {
        return NextResponse.json(
          { error: 'Replacement driver profile not found' },
          { status: 404 }
        );
      }

      const [replacementUser, repVehicles] = await Promise.all([
        getUserById(replacementDriver.userId),
        getVehiclesByDriverId(replacementDriver.id),
      ]);

      const repName = replacementUser?.name || 'Substitute Captain';

      await updateLeaveRequest(requestId, {
        status: 'approved',
        replacementDriverId: replacementDriver.id,
        replacementDriverName: repName,
        reviewedAt: new Date(),
      });

      const updatedLeave = await getLeaveRequestById(requestId);

      // Notify Original Driver
      if (originalDriver) {
        await createNotification({
          userId: originalDriver.userId,
          title: 'Leave Request Approved',
          message: `Your leave request for ${existingLeave.startDate} to ${existingLeave.endDate} has been approved. Standby Captain ${repName} will operate your corridor route.`,
          type: 'SUCCESS',
        });
      }

      // Notify Replacement Driver
      await createNotification({
        userId: replacementDriver.userId,
        title: 'Route Standby Assignment',
        message: `You have been assigned as Standby Captain for Route ${
          assignedRoute?.code || 'Corridor'
        } from ${existingLeave.startDate} to ${existingLeave.endDate}.`,
        type: 'INFO',
      });

      // Notify all Commuters assigned to this route
      if (existingLeave.assignedRouteId) {
        const subscriptions = await getSubscriptionsByRouteId(
          existingLeave.assignedRouteId,
          true
        );

        for (const sub of subscriptions) {
          await createNotification({
            userId: sub.commuterId,
            title: 'Standby Route Captain Notice',
            message: `Notice: Your regular Route Captain is on approved leave from ${existingLeave.startDate} to ${existingLeave.endDate}. Today's route is operated by standby Captain ${repName}.`,
            type: 'INFO',
          });
        }
      }

      return NextResponse.json({
        success: true,
        leave: updatedLeave,
        replacementDriver: {
          id: replacementDriver.id,
          name: repName,
          rating: replacementDriver.rating,
          phone: replacementUser?.phone || null,
          avatar: replacementUser?.avatar || null,
          vehicle: repVehicles[0] || null,
        },
        message: `Leave request approved. Standby Captain ${repName} assigned!`,
      });
    } else if (action === 'reject') {
      await updateLeaveRequest(requestId, {
        status: 'rejected',
        reviewedAt: new Date(),
      });

      const updatedLeave = await getLeaveRequestById(requestId);

      if (originalDriver) {
        await createNotification({
          userId: originalDriver.userId,
          title: 'Leave Request Declined',
          message: `Your leave request for ${existingLeave.startDate} to ${existingLeave.endDate} has been declined by Operations Admin.`,
          type: 'WARNING',
        });
      }

      return NextResponse.json({
        success: true,
        leave: updatedLeave,
        message: 'Leave request has been rejected.',
      });
    } else {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error updating leave request status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update leave request' },
      { status: 500 }
    );
  }
}

