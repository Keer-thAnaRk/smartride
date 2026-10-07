import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateAllocationChecksum } from '@/lib/optimization/seat-optimization-engine';
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
    const { runId, routeId, tripId, checksum, changes } = body;

    if (!routeId || !Array.isArray(changes)) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    // 1. Concurrency & Pre-departure Verification
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { commuter: true },
        },
      },
    });

    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    // Check if active trip is currently in progress
    if (tripId) {
      const trip = await prisma.trip.findUnique({ where: { id: tripId } });
      if (trip && trip.status === 'IN_PROGRESS') {
        return NextResponse.json(
          { error: 'Cannot reassign seats while shuttle trip is actively IN_PROGRESS' },
          { status: 400 }
        );
      }
    }

    // Parse waypoints for checksum validation
    let waypoints: any[] = [];
    try {
      waypoints = JSON.parse(route.waypoints || '[]');
    } catch (e) {
      waypoints = [];
    }
    const stopNames = waypoints.map((w) => (w.stopName || '').toLowerCase().trim());
    const findStopIndex = (addr: string, isDrop: boolean): number => {
      const clean = (addr || '').toLowerCase().trim();
      const idx = stopNames.findIndex((s) => clean.includes(s) || s.includes(clean));
      if (idx !== -1) return idx;
      return isDrop ? stopNames.length - 1 : 0;
    };

    const currentSegments: PassengerSegment[] = route.subscriptions.map((sub, index) => {
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

    if (checksum) {
      const currentChecksum = generateAllocationChecksum(currentSegments, routeId);
      if (currentChecksum !== checksum) {
        return NextResponse.json(
          {
            error:
              '⚠️ Allocation changed: The underlying bookings changed since this optimization was calculated. Please run optimization again.',
          },
          { status: 409 }
        );
      }
    }

    // 2. Transactional Update: Apply seat changes
    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        if (change.subscriptionId && change.newSeat) {
          await tx.subscription.update({
            where: { id: change.subscriptionId },
            data: { seatNumber: parseInt(change.newSeat, 10) },
          });
        }
      }

      if (runId) {
        await tx.seatOptimizationRun.update({
          where: { id: runId },
          data: {
            status: 'APPLIED',
            appliedAt: new Date(),
            appliedBy: session.name || 'Admin User',
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Seat optimization successfully applied: ${changes.length} passengers consolidated.`,
      appliedChangesCount: changes.length,
      routeId,
    });
  } catch (error: any) {
    console.error('Error applying seat optimization:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to apply seat optimization' },
      { status: 500 }
    );
  }
}
