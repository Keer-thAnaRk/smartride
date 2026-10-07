import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getOrCreateDefaultTrip, updateTripInFirestore } from '@/lib/firebase';
import { evaluateTripAnomalies, TelemetryReadingInput } from '@/lib/security/anomaly-engine';
import { logSecurityAudit } from '@/lib/security/audit-logger';
import { AnomalyEvent } from '@/lib/security/anomaly-types';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    if (session.role !== 'ADMIN' && session.role !== 'DRIVER') {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Driver access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { scenario, tripId = 'trip-sr101-today' } = body;

    const currentTrip = getOrCreateDefaultTrip();
    let updatedLocation = { ...currentTrip.liveLocation };
    let stoppedDurationSeconds = 0;
    let attemptedTripStartBeforeOtp = false;
    let passengers = currentTrip.passengers.map((p) => ({
      name: p.name,
      boarded: p.boarded,
      failedAttempts: 0,
    }));
    let previousTelemetry: any = {
      speedKmH: 35,
      consecutiveSpikeCount: 0,
    };

    switch (scenario) {
      case 'SPEED_ANOMALY':
      case 'SPEED':
        // Persistent speed surge: 68 km/h (> 55 km/h limit)
        updatedLocation = {
          ...updatedLocation,
          speedKmH: 68,
          updatedAt: new Date().toISOString(),
        };
        previousTelemetry = {
          speedKmH: 40,
          consecutiveSpikeCount: 2, // Meets >= 2 reading persistence rule
        };
        break;

      case 'ROUTE_DEVIATION':
      case 'DEVIATION':
        // Offset coordinates ~450m into residential side-street
        updatedLocation = {
          lat: 12.9285,
          lng: 77.6740,
          heading: 180,
          speedKmH: 38,
          updatedAt: new Date().toISOString(),
        };
        break;

      case 'LONG_STOP':
      case 'STOP':
        // Vehicle stationary at 0 km/h for 280 seconds away from any transit hub
        updatedLocation = {
          lat: 12.9390,
          lng: 77.6890,
          heading: 72,
          speedKmH: 0,
          updatedAt: new Date().toISOString(),
        };
        stoppedDurationSeconds = 280; // Exceeds 180s threshold
        break;

      case 'GPS_LOSS':
      case 'GPS':
        // Telemetry stale by 75 seconds (Tier 2 High Severity)
        updatedLocation = {
          ...updatedLocation,
          updatedAt: new Date(Date.now() - 75 * 1000).toISOString(),
        };
        break;

      case 'UNEXPECTED_TRIP_START':
      case 'TRIP_START':
        // Dispatch attempted before any commuter OTP was verified
        attemptedTripStartBeforeOtp = true;
        passengers = passengers.map((p) => ({ ...p, boarded: false }));
        break;

      case 'MULTIPLE_FAILED_OTP':
      case 'OTP':
        // 3 consecutive failed OTP attempts for commuter Rahul Verma
        passengers[0].failedAttempts = 3;
        break;

      case 'MULTI_SIGNAL':
      case 'CORRELATION':
        // Both Route Deviation (420m) AND Speed Surge (64 km/h)
        updatedLocation = {
          lat: 12.9285,
          lng: 77.6740,
          heading: 195,
          speedKmH: 64,
          updatedAt: new Date().toISOString(),
        };
        previousTelemetry = {
          speedKmH: 38,
          consecutiveSpikeCount: 2,
        };
        break;

      case 'RESET':
      case 'CLEAR':
      default:
        // Reset to normal corridor baseline
        updatedLocation = {
          lat: 12.9250,
          lng: 77.6680,
          heading: 72,
          speedKmH: 36,
          updatedAt: new Date().toISOString(),
        };
        stoppedDurationSeconds = 0;
        attemptedTripStartBeforeOtp = false;
        break;
    }

    // Evaluate anomalies through engine
    const evalInput: TelemetryReadingInput = {
      tripId,
      vehiclePlate: currentTrip.vehiclePlate,
      vehicleModel: currentTrip.vehicleModel,
      driverName: currentTrip.driverName,
      routeName: currentTrip.routeName,
      currentLocation: updatedLocation,
      previousTelemetry,
      stoppedDurationSeconds,
      attemptedTripStartBeforeOtp,
      passengers,
      referenceDate: new Date(),
    };

    const evalResult = evaluateTripAnomalies(evalInput);

    // Save newly detected anomalies to SQLite database
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
      } catch (e) {
        // Fallback
      }
    }

    // Synchronize to Firestore live trip
    await updateTripInFirestore(tripId, {
      liveLocation: updatedLocation,
      safetyScore: evalResult.safetyScoreImpact.currentScore,
      riskLevel: evalResult.safetyScoreImpact.currentScore < 50 ? 'CRITICAL' : evalResult.safetyScoreImpact.currentScore < 70 ? 'HIGH' : evalResult.safetyScoreImpact.currentScore < 85 ? 'MODERATE' : 'LOW',
      activeSafetyEvents: evalResult.activeAnomalies as any,
    });

    // Write audit log
    await logSecurityAudit({
      action: 'SIMULATION_TRIGGERED',
      tripId,
      actorId: session?.id || 'ADMIN_SIMULATOR',
      actorName: session?.name || 'Central Operations Simulator',
      details: `Triggered simulation scenario: ${scenario}. Resulting severity: ${evalResult.highestSeverity}`,
      metadata: {
        scenario,
        highestSeverity: evalResult.highestSeverity,
        activeCount: evalResult.activeAnomalies.length,
        safetyScore: evalResult.safetyScoreImpact.currentScore,
      },
    });

    return NextResponse.json({
      success: true,
      scenario,
      result: evalResult,
      location: updatedLocation,
    });
  } catch (error: any) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to trigger simulation scenario' },
      { status: 500 }
    );
  }
}
