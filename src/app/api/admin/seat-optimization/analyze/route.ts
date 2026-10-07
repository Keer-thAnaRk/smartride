import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { optimizeSeatAllocations } from '@/lib/optimization/seat-optimization-engine';
import { PassengerSegment } from '@/lib/optimization/seat-optimization-types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { routeId, tripId } = body;

    if (!routeId) {
      return NextResponse.json({ error: 'routeId is required' }, { status: 400 });
    }

    // 1. Fetch Route with assigned Vehicle and active Subscriptions
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        assignedVehicle: true,
        assignedDriver: {
          include: { user: true },
        },
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { commuter: true },
        },
      },
    });

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    // Parse route waypoints
    let waypoints: Array<{ stopName: string; lat?: number; lng?: number }> = [];
    try {
      waypoints = JSON.parse(route.waypoints || '[]');
    } catch (e) {
      waypoints = [];
    }

    if (waypoints.length === 0) {
      waypoints = [
        { stopName: route.origin },
        { stopName: 'Intermediate Choke Point' },
        { stopName: route.destination },
      ];
    }

    const stopNames = waypoints.map((w) => w.stopName.toLowerCase().trim());

    // Helper to find stop index
    const findStopIndex = (addr: string, isDrop: boolean): number => {
      const clean = (addr || '').toLowerCase().trim();
      const idx = stopNames.findIndex((s) => clean.includes(s) || s.includes(clean));
      if (idx !== -1) return idx;
      return isDrop ? stopNames.length - 1 : 0;
    };

    // 2. Map subscriptions to PassengerSegment models
    const passengers: PassengerSegment[] = route.subscriptions.map((sub, index) => {
      let pIdx = findStopIndex(sub.pickupAddress, false);
      let dIdx = findStopIndex(sub.dropAddress, true);

      if (pIdx >= dIdx) {
        pIdx = 0;
        dIdx = Math.max(1, stopNames.length - 1);
      }

      return {
        passengerId: sub.commuterId,
        passengerName: sub.commuter?.name || `Passenger ${index + 1}`,
        subscriptionId: sub.id,
        pickupStop: sub.pickupAddress || route.origin,
        dropStop: sub.dropAddress || route.destination,
        pickupIndex: pIdx,
        dropIndex: dIdx,
        segmentLength: dIdx - pIdx,
        direction: 'OUTBOUND',
        currentSeat: sub.seatNumber || index + 1,
      };
    });

    const capacity = route.assignedVehicle?.capacity || 6;

    // 3. Run Optimization Engine
    const preview = optimizeSeatAllocations({
      routeId: route.id,
      routeName: route.name,
      routeCode: route.code,
      vehicleModel: route.assignedVehicle?.model || 'Toyota Innova Crysta AC',
      vehiclePlate: route.assignedVehicle?.licensePlate || 'KA-01-MJ-8822',
      vehicleCapacity: capacity,
      numStops: waypoints.length,
      passengers,
    });

    // 4. Save preview record in SQLite
    const runRecord = await prisma.seatOptimizationRun.create({
      data: {
        routeId: route.id,
        tripId: tripId || null,
        vehicleId: route.assignedVehicleId || null,
        status: 'PREVIEWED',
        beforeUtilization: preview.beforeMetrics.utilizationPercent,
        afterUtilization: preview.afterMetrics.utilizationPercent,
        beforeFragmentation: preview.beforeMetrics.fragmentationScore,
        afterFragmentation: preview.afterMetrics.fragmentationScore,
        improvementPercent: preview.improvementPercent,
        reassignmentsCount: preview.reassignments.length,
        objectiveCostBefore: preview.beforeMetrics.objectiveCost,
        objectiveCostAfter: preview.afterMetrics.objectiveCost,
        checksum: preview.checksum,
        changes: {
          create: preview.reassignments.map((r) => ({
            subscriptionId: r.subscriptionId,
            commuterId: r.passengerId,
            commuterName: r.passengerName,
            pickupStop: r.pickupStop,
            dropStop: r.dropStop,
            previousSeat: r.previousSeat,
            newSeat: r.newSeat,
            reason: r.reason,
          })),
        },
      },
    });

    preview.runId = runRecord.id;

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error: any) {
    console.error('Error analyzing seat optimization:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze seat allocation' },
      { status: 500 }
    );
  }
}
