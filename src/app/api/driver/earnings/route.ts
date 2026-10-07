import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getDriverProfileByUserId,
  getAllDriverProfiles,
  getPayoutsByDriver,
  getTripsByDriver,
  countTripsByDriver,
  getAllRoutes,
  getSubscriptionsByRouteId,
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

    const [payouts, recentTrips, totalTrips, allRoutes] = await Promise.all([
      getPayoutsByDriver(driverProfile.id),
      getTripsByDriver(driverProfile.id, 30),
      countTripsByDriver(driverProfile.id, 'COMPLETED'),
      getAllRoutes(),
    ]);

    const driverRoutes = allRoutes.filter((r) => r.assignedDriverId === driverProfile!.id);

    // Count active commuter riders across driver routes
    let activeRiders = 0;
    for (const r of driverRoutes) {
      const subs = await getSubscriptionsByRouteId(r.id, true);
      activeRiders += subs.length;
    }

    // Projected Monthly Earnings in INR ₹ (base stipend per subscriber + trip bonus)
    const baseRiderPayoutRate = 2400.0; // ₹2,400 per commuter subscription per month
    const tripBonusRate = 350.0; // ₹350 per completed shift
    const monthlyProjection =
      activeRiders * baseRiderPayoutRate + totalTrips * tripBonusRate;

    const totalPaidOut = payouts.reduce((sum, p) => sum + p.amount, 0);
    const pendingPayout = payouts.length > 0 ? 12500.0 : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalEarnings: totalPaidOut + pendingPayout,
        pendingPayout,
        completedTrips: totalTrips,
        activeRiders: activeRiders,
        rating: driverProfile.rating || 0,
        monthlyProjection,
      },
      payouts,
      recentTrips,
    });
  } catch (error: any) {
    console.error('Driver earnings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 500 });
  }
}

