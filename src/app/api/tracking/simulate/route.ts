import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { FAMILY_TRACKING_CONFIG } from '@/lib/tracking/family-tracking-config';
import { hashShareToken, calculateSessionExpiration } from '@/lib/tracking/token-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userSession = getSessionFromRequest(request);
    if (!userSession) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    if (userSession.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin privileges required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action; // 'SIMULATE_MINOR_DELAY' | 'SIMULATE_SIGNIFICANT_DELAY' | 'SIMULATE_SAFE_ARRIVAL' | 'RESET_TRACKING'
    const shareToken = body.shareToken || FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN;
    const tokenHash = hashShareToken(shareToken);

    // Find or seed demo session
    let session = await prisma.familyTrackingSession.findUnique({
      where: { shareTokenHash: tokenHash },
    });

    if (!session) {
      session = await prisma.familyTrackingSession.create({
        data: {
          tripId: FAMILY_TRACKING_CONFIG.DEFAULT_TRIP_ID,
          commuterId: 'commuter_rahul_1',
          shareTokenHash: tokenHash,
          shareTokenPrefix: shareToken.substring(0, 8),
          destinationStop: FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_STOP,
          destinationLat: FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_LAT,
          destinationLng: FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_LNG,
          status: 'ACTIVE',
          isArrived: false,
          scheduledArrival: FAMILY_TRACKING_CONFIG.DEFAULT_SCHEDULED_ARRIVAL,
          expiresAt: calculateSessionExpiration(false),
        },
      });
    }

    if (action === 'SIMULATE_MINOR_DELAY') {
      await prisma.familyTrackingSession.update({
        where: { id: session.id },
        data: {
          status: 'ACTIVE',
          isArrived: false,
          delayMinutesAtArrival: 7,
        },
      });

      const notification = await prisma.familyNotification.create({
        data: {
          sessionId: session.id,
          tripId: session.tripId,
          commuterId: session.commuterId,
          commuterName: 'Rahul Verma',
          type: 'COMMUTE_DELAY',
          delayCategory: 'MINOR_DELAY',
          title: 'Minor Traffic Delay (+7 min)',
          message: "Rahul's shuttle is currently 7 minutes behind schedule due to junction congestion.",
          destination: session.destinationStop,
          delayMinutes: 7,
          eta: '08:32 AM',
          lastLocation: 'Agara Lake Junction',
          deliveredAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Minor delay (+7 min) simulated successfully',
        action,
        notification,
      });
    }

    if (action === 'SIMULATE_SIGNIFICANT_DELAY') {
      await prisma.familyTrackingSession.update({
        where: { id: session.id },
        data: {
          status: 'ACTIVE',
          isArrived: false,
          delayMinutesAtArrival: 17,
        },
      });

      const notification = await prisma.familyNotification.create({
        data: {
          sessionId: session.id,
          tripId: session.tripId,
          commuterId: session.commuterId,
          commuterName: 'Rahul Verma',
          type: 'COMMUTE_DELAY',
          delayCategory: 'SIGNIFICANT_DELAY',
          title: '⚠️ Commute Delay (+17 min)',
          message: "Rahul's shuttle is currently 17 minutes behind schedule. Updated ETA: 9:04 AM. Last known location: Bellandur.",
          destination: session.destinationStop,
          delayMinutes: 17,
          eta: '09:04 AM',
          lastLocation: 'Bellandur EcoSpace Flyover',
          deliveredAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Significant delay (+17 min) simulated successfully',
        action,
        notification,
      });
    }

    if (action === 'SIMULATE_SAFE_ARRIVAL') {
      const arrivalTime = new Date();
      const expirationDate = calculateSessionExpiration(true, arrivalTime);

      const updated = await prisma.familyTrackingSession.update({
        where: { id: session.id },
        data: {
          status: 'ARRIVED',
          isArrived: true,
          arrivedAt: arrivalTime,
          delayMinutesAtArrival: 3,
          expiresAt: expirationDate,
        },
      });

      const notification = await prisma.familyNotification.create({
        data: {
          sessionId: session.id,
          tripId: session.tripId,
          commuterId: session.commuterId,
          commuterName: 'Rahul Verma',
          type: 'SAFE_ARRIVAL',
          delayCategory: 'ARRIVED',
          title: '✅ Safe Arrival Confirmed',
          message: 'Rahul has arrived safely at Ecospace.',
          destination: 'Ecospace Gate 1',
          delayMinutes: 3,
          eta: '08:47 AM',
          lastLocation: 'Ecospace Gate 1 Arrival Bay',
          deliveredAt: arrivalTime,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Safe arrival simulated successfully. Tracking experience transitioned.',
        action,
        session: updated,
        notification,
      });
    }

    if (action === 'RESET_TRACKING') {
      const resetSession = await prisma.familyTrackingSession.update({
        where: { id: session.id },
        data: {
          status: 'ACTIVE',
          isArrived: false,
          arrivedAt: null,
          delayMinutesAtArrival: 0,
          expiresAt: calculateSessionExpiration(false),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Family tracking simulation reset to active en-route corridor',
        action,
        session: resetSession,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown simulation action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error during family tracking simulation:', error);
    return NextResponse.json(
      { success: false, error: 'Simulation failed: ' + error.message },
      { status: 500 }
    );
  }
}
