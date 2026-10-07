import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getOrCreateDefaultTrip, FirestoreTrip } from '@/lib/firebase';
import { calculateTripSafetyScore, createSanitizedPublicSafetyIndicator } from '@/lib/safety/scoring-engine';
import { getDriverProfileByUserId, getRouteById, getVehiclesByDriverId } from '@/lib/firestore-db';

export async function GET(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  try {
    const tripId = params.tripId;
    const session = getSessionFromRequest(req);

    // Fetch trip data: either default simulated trip or active trip
    const activeTrip = getOrCreateDefaultTrip();

    // Fetch driver & vehicle compliance details from database if available
    let isDriverVerified = true;
    let isVehicleApproved = true;
    let rcDocUrl: string | null = 'https://smartride.com/docs/rc.pdf';
    let insuranceDocUrl: string | null = 'https://smartride.com/docs/insurance.pdf';

    try {
      const driverRecord = await prisma.driverProfile.findFirst({
        where: { id: activeTrip.driverId },
        include: { vehicles: true },
      });

      if (driverRecord) {
        isDriverVerified = driverRecord.isVerified;
        const veh = driverRecord.vehicles[0];
        if (veh) {
          isVehicleApproved = veh.isApproved;
          rcDocUrl = veh.rcDocUrl;
          insuranceDocUrl = veh.insuranceDocUrl;
        }
      }
    } catch (dbErr) {
      // Fallback to default verified parameters
    }

    // Load existing events from SQLite if any
    let dbEvents: any[] = [];
    try {
      dbEvents = await prisma.safetyEvent.findMany({
        where: { tripId },
        orderBy: { detectedAt: 'desc' },
        take: 30,
      });
    } catch (e) {
      // Ignore DB errors in offline/simulated mode
    }

    // Format DB events to SafetyEvent objects
    const formattedDbEvents = dbEvents.map((evt) => ({
      id: evt.id,
      tripId: evt.tripId,
      type: evt.type as any,
      severity: evt.severity as any,
      title: evt.title,
      description: evt.description,
      status: evt.status as any,
      detectedAt: evt.detectedAt.toISOString(),
      resolvedAt: evt.resolvedAt ? evt.resolvedAt.toISOString() : null,
      resolutionNote: evt.resolutionNote,
    }));

    // Calculate full safety score
    const safetyResult = calculateTripSafetyScore({
      tripId,
      status: activeTrip.status,
      liveLocation: activeTrip.liveLocation,
      driver: {
        isVerified: isDriverVerified,
        name: activeTrip.driverName,
      },
      vehicle: {
        isApproved: isVehicleApproved,
        rcDocUrl,
        insuranceDocUrl,
        licensePlate: activeTrip.vehiclePlate,
        model: activeTrip.vehicleModel,
      },
      passengers: activeTrip.passengers,
      sosDetails: activeTrip.sosDetails,
      existingEvents: formattedDbEvents,
      referenceDate: new Date(),
    });

    // Public / Unauthenticated Request -> Return Sanitized Projection Only
    if (!session) {
      const sanitized = createSanitizedPublicSafetyIndicator(safetyResult);
      return NextResponse.json({
        success: true,
        tripId,
        safety: sanitized,
      });
    }

    // Commuter Request: Verify commuter is on this trip or in demo mode
    if (session.role === 'COMMUTER') {
      const isPassengerOnTrip =
        activeTrip.passengers.some((p) => p.userId === session.id) ||
        session.id === 'user_commuter_1';

      if (!isPassengerOnTrip) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have an active booking on this corridor shuttle.' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        tripId,
        safety: {
          score: safetyResult.score,
          riskLevel: safetyResult.riskLevel,
          riskBadgeColor: safetyResult.riskBadgeColor,
          riskLabel: safetyResult.riskLabel,
          primaryReason: safetyResult.primaryReason,
          breakdown: safetyResult.breakdown,
          timeline: safetyResult.timeline.slice(0, 10),
          calculatedAt: safetyResult.calculatedAt,
          operationalDisclaimer: safetyResult.operationalDisclaimer,
        },
      });
    }

    // Driver Request: Verify driver owns this trip or in demo mode
    if (session.role === 'DRIVER') {
      const isAssignedDriver =
        activeTrip.driverId === session.id ||
        activeTrip.driverId === 'driver_rajesh_1' ||
        session.id === 'driver_rajesh_1';

      if (!isAssignedDriver) {
        return NextResponse.json(
          { error: 'Forbidden: You are not assigned to this corridor trip.' },
          { status: 403 }
        );
      }


      return NextResponse.json({
        success: true,
        tripId,
        safety: {
          score: safetyResult.score,
          riskLevel: safetyResult.riskLevel,
          riskBadgeColor: safetyResult.riskBadgeColor,
          riskLabel: safetyResult.riskLabel,
          primaryReason: safetyResult.primaryReason,
          breakdown: safetyResult.breakdown,
          activeEvents: safetyResult.activeEvents,
          calculatedAt: safetyResult.calculatedAt,
          operationalDisclaimer: safetyResult.operationalDisclaimer,
        },
      });
    }

    // Admin Request: Complete Operational Intelligence Access
    // Persist latest score to SQLite asynchronously for auditing
    try {
      await prisma.tripSafetyScore.create({
        data: {
          tripId,
          score: safetyResult.score,
          riskLevel: safetyResult.riskLevel,
          driverVerificationScore: safetyResult.breakdown.driverVerification.earnedScore,
          vehicleDocumentScore: safetyResult.breakdown.vehicleDocuments.earnedScore,
          otpScore: safetyResult.breakdown.otpBoarding.earnedScore,
          routeComplianceScore: safetyResult.breakdown.routeCompliance.earnedScore,
          speedScore: safetyResult.breakdown.speedMonitoring.earnedScore,
          emergencyScore: safetyResult.breakdown.emergencyEvents.earnedScore,
          primaryReason: safetyResult.primaryReason,
        },
      });
    } catch (dbSaveErr) {
      // Ignore SQLite write collisions in high-frequency queries
    }

    return NextResponse.json({
      success: true,
      tripId,
      safety: safetyResult,
    });
  } catch (error: any) {
    console.error('Safety score API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to compute trip safety score' },
      { status: 500 }
    );
  }
}
