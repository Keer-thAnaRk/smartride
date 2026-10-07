import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getUserById,
  getDriverProfileByUserId,
  getAllDriverProfiles,
  getDriverProfileById,
  getVehiclesByDriverId,
  getAllRoutes,
  getRouteById,
  getLeaveRequestsByDriver,
  setLeaveRequest,
  FirestoreLeaveRecord,
  FirestoreDriverProfile,
} from '@/lib/firestore-db';

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

    const [user, leaves] = await Promise.all([
      getUserById(driverProfile.userId),
      getLeaveRequestsByDriver(driverProfile.id),
    ]);

    const formattedLeaves = await Promise.all(
      leaves.map(async (l) => {
        const assignedRoute = l.assignedRouteId ? await getRouteById(l.assignedRouteId) : null;
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
          driverName: l.driverName || user?.name || 'Captain',
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
          replacementDriverRating: replacementDriver?.rating || null,
          replacementVehicleModel: repVehicle
            ? `${repVehicle.make} ${repVehicle.model}`
            : null,
          replacementLicensePlate: repVehicle?.licensePlate || null,
          appliedAt: appliedAtStr,
          reviewedAt: reviewedAtStr,
        };
      })
    );

    return NextResponse.json({ success: true, leaves: formattedLeaves });
  } catch (error: any) {
    console.error('Error fetching driver leave requests:', error);
    return NextResponse.json({ error: 'Failed to fetch leave history' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'DRIVER') {
      return NextResponse.json({ error: 'Forbidden: Driver access required' }, { status: 403 });
    }

    const body = await req.json();
    const { startDate, endDate, reason } = body;

    if (!startDate || !endDate || !reason?.trim()) {
      return NextResponse.json(
        { error: 'Start date, end date, and reason are required' },
        { status: 400 }
      );
    }

    // Date validations
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (startDate < todayStr) {
      return NextResponse.json({ error: 'Start date cannot be in the past' }, { status: 400 });
    }

    if (endDate < startDate) {
      return NextResponse.json(
        { error: 'End date must be on or after start date' },
        { status: 400 }
      );
    }

    // Find driver profile and their route
    const driverProfile = await getDriverProfileByUserId(session.id);
    if (!driverProfile) {
      return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 });
    }

    if (session.role === 'DRIVER' && driverProfile.isVerified !== true) {
      return NextResponse.json({ error: 'Driver account pending approval' }, { status: 403 });
    }

    const [user, allRoutes] = await Promise.all([
      getUserById(driverProfile.userId),
      getAllRoutes(),
    ]);

    const driverRoutes = allRoutes.filter((r) => r.assignedDriverId === driverProfile.id);
    const assignedRoute = driverRoutes[0] || null;

    const leaveId = `leave_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const leave: FirestoreLeaveRecord = {
      id: leaveId,
      requestId: leaveId,
      driverId: driverProfile.id,
      driverName: user?.name || 'Captain',
      assignedRouteId: assignedRoute ? assignedRoute.id : null,
      startDate,
      endDate,
      reason: reason.trim(),
      status: 'pending',
      replacementDriverId: null,
      replacementDriverName: null,
      appliedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setLeaveRequest(leave);

    const responsePayload = {
      id: leave.id,
      requestId: leave.requestId,
      driverId: driverProfile.id,
      driverName: leave.driverName,
      assignedRouteId: assignedRoute ? assignedRoute.id : '',
      assignedRouteCode: assignedRoute ? assignedRoute.code : 'N/A',
      assignedRouteName: assignedRoute ? assignedRoute.name : 'Unassigned',
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason,
      status: leave.status,
      appliedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      leaveRequest: responsePayload,
      message: 'Leave request submitted. Awaiting Operations Admin approval.',
    });
  } catch (error: any) {
    console.error('Error submitting driver leave request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit leave request' },
      { status: 500 }
    );
  }
}

