import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  generateShareToken,
  hashShareToken,
  calculateSessionExpiration,
} from '@/lib/tracking/token-service';
import { FAMILY_TRACKING_CONFIG } from '@/lib/tracking/family-tracking-config';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }
    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Commuter access required' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    const commuterId = session.id;
    const commuterName = session.name || FAMILY_TRACKING_CONFIG.DEFAULT_COMMUTER_NAME;
    const tripId = body.tripId || FAMILY_TRACKING_CONFIG.DEFAULT_TRIP_ID;
    const destinationStop =
      body.destinationStop || FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_STOP;
    const destinationLat =
      body.destinationLat || FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_LAT;
    const destinationLng =
      body.destinationLng || FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_LNG;

    // Check if an active session already exists for this commuter and trip
    const existing = await prisma.familyTrackingSession.findFirst({
      where: {
        commuterId,
        tripId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      // Re-use active demo token if matching default
      const isDefault =
        existing.shareTokenHash === hashShareToken(FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN);
      const returnedToken = isDefault
        ? FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN
        : `${existing.shareTokenPrefix}...`;

      return NextResponse.json({
        success: true,
        shareToken: isDefault ? returnedToken : FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN,
        shareUrl: `/track/${isDefault ? returnedToken : FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN}`,
        session: existing,
        isExisting: true,
      });
    }

    // Generate new secure bearer token
    const rawToken = generateShareToken();
    const tokenHash = hashShareToken(rawToken);
    const expiresAt = calculateSessionExpiration(false);

    const newSession = await prisma.familyTrackingSession.create({
      data: {
        tripId,
        commuterId,
        shareTokenHash: tokenHash,
        shareTokenPrefix: rawToken.substring(0, 8),
        destinationStop,
        destinationLat,
        destinationLng,
        status: 'ACTIVE',
        isArrived: false,
        scheduledArrival: body.scheduledArrival || FAMILY_TRACKING_CONFIG.DEFAULT_SCHEDULED_ARRIVAL,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      shareToken: rawToken,
      shareUrl: `/track/${rawToken}`,
      session: newSession,
      isExisting: false,
    });
  } catch (error: any) {
    console.error('Error generating family tracking token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate tracking session' },
      { status: 500 }
    );
  }
}
