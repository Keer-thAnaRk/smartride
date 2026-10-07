import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getOrCreateDefaultTrip } from '@/lib/firebase';
import {
  detectAnomalies,
  persistDetectedAnomalies,
  AnomalyDetectionInput,
} from '@/lib/safety/anomaly-detection-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Guest mode protection
    if (searchParams.get('mode') === 'guest') {
      return NextResponse.json(
        { error: 'Unauthorized: Guest mode is not permitted on protected security APIs' },
        { status: 401 }
      );
    }

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to run anomaly detection' },
        { status: 401 }
      );
    }

    if (session.role === 'COMMUTER') {
      return NextResponse.json(
        { error: 'Forbidden: Commuter accounts do not have access to anomaly detection' },
        { status: 403 }
      );
    }

    if (session.role !== 'ADMIN' && session.role !== 'DRIVER') {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Driver privileges required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const routeId = body.routeId || 'route-sr-101';
    const tripId = body.tripId || `trip-${routeId}-today`;

    // Fetch existing safety events for this trip/route from DB for deduplication
    let existingDbEvents: any[] = [];
    try {
      existingDbEvents = await prisma.safetyEvent.findMany({
        where: {
          OR: [
            { tripId },
            { metadata: { contains: routeId } },
          ],
        },
        orderBy: { detectedAt: 'desc' },
        take: 50,
      });
    } catch (dbErr) {
      // Fallback
    }

    const detectionInput: AnomalyDetectionInput = {
      routeId,
      tripId,
      driverId: body.driverId,
      vehicleId: body.vehicleId,
      vehiclePlate: body.vehiclePlate,
      driverName: body.driverName,
      routeName: body.routeName,
      currentLocation: body.currentLocation,
      previousTelemetry: body.previousTelemetry,
      previousSpeedKmH: body.previousSpeedKmH,
      stoppedDurationSeconds: body.stoppedDurationSeconds,
      waypoints: body.waypoints,
      expectedScheduledEta: body.expectedScheduledEta,
      currentEstimatedEta: body.currentEstimatedEta,
      delayMinutes: body.delayMinutes,
      attemptedTripStartBeforeOtp: body.attemptedTripStartBeforeOtp,
      passengers: body.passengers,
      hasActiveSos: body.hasActiveSos,
      sosReason: body.sosReason,
      existingAnomalies: body.existingAnomalies || existingDbEvents,
      referenceDate: body.referenceDate ? new Date(body.referenceDate) : new Date(),
    };

    const detectionResult = detectAnomalies(detectionInput);

    // Persist active anomalies to database if persist !== false
    if (body.persist !== false && detectionResult.activeAnomalies.length > 0) {
      await persistDetectedAnomalies(detectionResult.activeAnomalies);
    }

    return NextResponse.json({
      success: true,
      result: detectionResult,
      anomalies: detectionResult.anomalies,
      activeAnomalies: detectionResult.activeAnomalies,
      highestSeverity: detectionResult.highestSeverity,
      detectedCount: detectionResult.detectedCount,
    });
  } catch (error: any) {
    console.error('Anomaly detection API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to execute anomaly detection' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get('mode') === 'guest') {
      return NextResponse.json(
        { error: 'Unauthorized: Guest mode is not permitted on protected security APIs' },
        { status: 401 }
      );
    }

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to access anomaly detection' },
        { status: 401 }
      );
    }

    if (session.role === 'COMMUTER') {
      return NextResponse.json(
        { error: 'Forbidden: Commuter accounts do not have access to anomaly detection' },
        { status: 403 }
      );
    }

    if (session.role !== 'ADMIN' && session.role !== 'DRIVER') {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Driver privileges required' },
        { status: 403 }
      );
    }

    const routeId = searchParams.get('routeId') || 'route-sr-101';
    const tripId = searchParams.get('tripId') || `trip-${routeId}-today`;

    // Fetch existing events from database
    let dbEvents: any[] = [];
    try {
      dbEvents = await prisma.safetyEvent.findMany({
        where: {
          OR: [
            { tripId },
            { metadata: { contains: routeId } },
          ],
        },
        orderBy: { detectedAt: 'desc' },
        take: 50,
      });
    } catch (e) {
      // Fallback
    }

    const activeTrip = getOrCreateDefaultTrip();

    const detectionResult = detectAnomalies({
      routeId,
      tripId,
      driverName: activeTrip.driverName,
      vehiclePlate: activeTrip.vehiclePlate,
      currentLocation: activeTrip.liveLocation,
      passengers: activeTrip.passengers.map((p) => ({
        name: p.name,
        boarded: p.boarded,
      })),
      existingAnomalies: dbEvents,
      referenceDate: new Date(),
    });

    return NextResponse.json({
      success: true,
      routeId,
      tripId,
      result: detectionResult,
      anomalies: detectionResult.anomalies,
      activeAnomalies: detectionResult.activeAnomalies,
      highestSeverity: detectionResult.highestSeverity,
    });
  } catch (error: any) {
    console.error('Anomaly detection fetch API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch anomaly detection data' },
      { status: 500 }
    );
  }
}
