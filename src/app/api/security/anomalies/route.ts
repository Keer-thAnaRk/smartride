import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getOrCreateDefaultTrip } from '@/lib/firebase';
import { evaluateTripAnomalies, TelemetryReadingInput } from '@/lib/security/anomaly-engine';
import { detectAnomalies, persistDetectedAnomalies } from '@/lib/safety/anomaly-detection-engine';
import { logSecurityAudit } from '@/lib/security/audit-logger';
import { AnomalyEvent } from '@/lib/security/anomaly-types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Guest mode bypass guard: Reject explicit guest parameter attempts
    if (searchParams.get('mode') === 'guest') {
      return NextResponse.json(
        { error: 'Unauthorized: Guest mode is not permitted on protected security APIs' },
        { status: 401 }
      );
    }

    const session = getSessionFromRequest(req);

    // 1. Unauthenticated access -> 401 Unauthorized
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to access security anomaly data' },
        { status: 401 }
      );
    }

    // 2. Commuter RBAC -> 403 Forbidden (commuters cannot view operational security anomaly intelligence)
    if (session.role === 'COMMUTER') {
      return NextResponse.json(
        { error: 'Forbidden: Commuter accounts do not have access to operational security anomaly intelligence' },
        { status: 403 }
      );
    }

    const tripId = searchParams.get('tripId') || 'trip-sr101-today';
    const activeTrip = getOrCreateDefaultTrip();

    // Fetch existing safety events from DB
    let dbEvents: any[] = [];
    try {
      dbEvents = await prisma.safetyEvent.findMany({
        where: { tripId },
        orderBy: { detectedAt: 'desc' },
        take: 30,
      });
    } catch (e) {
      // Fallback
    }

    const formattedEvents: AnomalyEvent[] = dbEvents.map((e) => ({
      id: e.id,
      tripId: e.tripId,
      type: e.type as any,
      severity: e.severity as any,
      status: e.status as any,
      title: e.title,
      description: e.description,
      detectedAt: e.detectedAt.toISOString(),
      resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : undefined,
      resolutionNote: e.resolutionNote || undefined,
      lastDetectedAt: e.lastDetectedAt ? e.lastDetectedAt.toISOString() : undefined,
      investigatedBy: e.investigatedBy || undefined,
      metadata: e.metadata ? (typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata) : {},
    }));

    // Evaluate anomalies with current live trip telemetry
    const evalInput: TelemetryReadingInput = {
      tripId,
      vehiclePlate: activeTrip.vehiclePlate,
      vehicleModel: activeTrip.vehicleModel,
      driverName: activeTrip.driverName,
      routeName: activeTrip.routeName,
      currentLocation: activeTrip.liveLocation,
      existingAnomalies: formattedEvents,
      passengers: activeTrip.passengers.map((p) => ({
        name: p.name,
        boarded: p.boarded,
      })),
      referenceDate: new Date(),
    };

    const evalResult = evaluateTripAnomalies(evalInput);

    // Also run deterministic anomaly detection engine
    const deterministicResult = detectAnomalies({
      routeId: activeTrip.routeCode || 'route-sr-101',
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

    // 3. Driver RBAC -> Return operational driving advisories
    if (session.role === 'DRIVER') {
      const activeSpeed = evalResult.activeAnomalies.find((a) => a.type === 'SPEED_ANOMALY');
      const activeDev = evalResult.activeAnomalies.find((a) => a.type === 'ROUTE_DEVIATION');
      const unverifiedCount = activeTrip.passengers.filter((p) => !p.boarded).length;

      return NextResponse.json({
        success: true,
        tripId,
        operationalAdvisories: {
          currentSpeedKmH: activeTrip.liveLocation.speedKmH || 0,
          speedWarning: activeSpeed ? activeSpeed.description : null,
          corridorDeviation: activeDev ? activeDev.description : null,
          unverifiedPassengers: unverifiedCount,
          status: evalResult.sanitizedStatus.status,
          headline: evalResult.sanitizedStatus.headline,
        },
        sanitizedStatus: evalResult.sanitizedStatus,
        etaImpact: evalResult.etaImpact,
      });
    }

    // 4. Admin RBAC -> Complete operational security intelligence
    return NextResponse.json({
      success: true,
      tripId,
      result: evalResult,
      deterministicEngine: deterministicResult,
      anomalies: evalResult.anomalies,
      activeAnomalies: evalResult.activeAnomalies,
      detectedAnomalies: deterministicResult.anomalies,
      trip: {
        tripId: activeTrip.tripId,
        routeName: activeTrip.routeName,
        routeCode: activeTrip.routeCode,
        driverName: activeTrip.driverName,
        vehiclePlate: activeTrip.vehiclePlate,
        vehicleModel: activeTrip.vehicleModel,
        status: activeTrip.status,
        liveLocation: activeTrip.liveLocation,
      },
    });
  } catch (error: any) {
    console.error('Anomalies fetch API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch anomaly data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    if (session.role !== 'ADMIN' && session.role !== 'DRIVER') {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Driver privileges required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const evalResult = evaluateTripAnomalies(body);

    // Asynchronously log new anomalies to DB
    for (const anom of evalResult.activeAnomalies) {
      try {
        await prisma.safetyEvent.upsert({
          where: { id: anom.id },
          create: {
            id: anom.id,
            tripId: anom.tripId,
            type: anom.type,
            severity: anom.severity,
            status: anom.status,
            title: anom.title,
            description: anom.description,
            detectedAt: new Date(anom.detectedAt),
            metadata: JSON.stringify({ ...anom.metadata, lastDetectedAt: anom.lastDetectedAt }),
          },
          update: {
            status: anom.status,
            description: anom.description,
            metadata: JSON.stringify({ ...anom.metadata, lastDetectedAt: anom.lastDetectedAt }),
          },
        });
      } catch (err) {
        // Ignore in-memory fallback
      }
    }

    return NextResponse.json({
      success: true,
      result: evalResult,
      anomalies: evalResult.anomalies,
      activeAnomalies: evalResult.activeAnomalies,
    });
  } catch (error: any) {
    console.error('Anomalies evaluation API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to evaluate anomalies' },
      { status: 500 }
    );
  }
}
