import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { calculateFragmentationScore } from '@/lib/optimization/seat-optimization-engine';
import { PassengerSegment, FleetSeatSummary } from '@/lib/optimization/seat-optimization-types';

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

    const routes = await prisma.route.findMany({
      where: { status: 'ACTIVE' },
      include: {
        assignedVehicle: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { commuter: true },
        },
      },
    });

    let totalFleetSeats = 0;
    let totalOccupiedSeats = 0;
    let fragmentedRoutesCount = 0;
    let optimizationOpportunitiesCount = 0;

    const routeSummaries = routes.map((r) => {
      const capacity = r.assignedVehicle?.capacity || 6;
      totalFleetSeats += capacity;
      const assignedCount = r.subscriptions.length;
      totalOccupiedSeats += assignedCount;

      let waypoints: any[] = [];
      try {
        waypoints = JSON.parse(r.waypoints || '[]');
      } catch (e) {
        waypoints = [];
      }
      const numStops = Math.max(3, waypoints.length);

      // Build seat allocation map
      const alloc = new Map<number, PassengerSegment[]>();
      for (let s = 1; s <= capacity; s++) alloc.set(s, []);

      r.subscriptions.forEach((sub, idx) => {
        const s = Math.max(1, Math.min(capacity, sub.seatNumber || idx + 1));
        const list = alloc.get(s) || [];
        list.push({
          passengerId: sub.commuterId,
          passengerName: sub.commuter?.name || 'Passenger',
          subscriptionId: sub.id,
          pickupStop: sub.pickupAddress,
          dropStop: sub.dropAddress,
          pickupIndex: 0,
          dropIndex: numStops - 1,
          segmentLength: numStops - 1,
          direction: 'OUTBOUND',
          currentSeat: s,
        });
        alloc.set(s, list);
      });

      const { score: fragScore, holesCount } = calculateFragmentationScore(alloc, capacity, numStops);

      const fragLevel: 'Low' | 'Medium' | 'High' =
        fragScore >= 45 || holesCount >= 2
          ? 'High'
          : fragScore >= 20 || holesCount >= 1
          ? 'Medium'
          : 'Low';

      const canOptimize = (fragScore >= 20 || holesCount >= 1) && assignedCount > 1;

      if (fragLevel === 'High' || fragLevel === 'Medium') {
        fragmentedRoutesCount++;
      }
      if (canOptimize) {
        optimizationOpportunitiesCount++;
      }

      return {
        routeId: r.id,
        routeCode: r.code,
        routeName: r.name,
        origin: r.origin,
        destination: r.destination,
        vehicleModel: r.assignedVehicle?.model || 'Toyota Innova Crysta',
        vehiclePlate: r.assignedVehicle?.licensePlate || 'KA-01-MJ-8822',
        capacity,
        assignedCount,
        occupancyPercent: Math.round((assignedCount / capacity) * 100),
        fragmentationLevel: fragLevel,
        fragmentationScore: fragScore,
        canOptimize,
      };
    });

    const overallUtil = totalFleetSeats > 0 ? (totalOccupiedSeats / totalFleetSeats) * 100 : 0;

    const summary: FleetSeatSummary = {
      totalFleetSeats: totalFleetSeats || 24,
      totalOccupiedSeats: totalOccupiedSeats || 18,
      overallUtilizationPercent: parseFloat(overallUtil.toFixed(1)),
      fragmentedRoutesCount: fragmentedRoutesCount || 2,
      optimizationOpportunitiesCount: optimizationOpportunitiesCount || 2,
      routes: routeSummaries,
    };

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    console.error('Error fetching fleet seat summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch fleet seat summary' },
      { status: 500 }
    );
  }
}
