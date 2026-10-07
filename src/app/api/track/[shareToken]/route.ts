import { NextRequest, NextResponse } from 'next/server';
import { getSessionByRawToken, isSessionExpired } from '@/lib/tracking/token-service';
import {
  buildFamilyTrackingStatus,
  recordFamilyNotification,
} from '@/lib/tracking/safe-arrival-engine';
import { FAMILY_TRACKING_CONFIG } from '@/lib/tracking/family-tracking-config';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { shareToken: string } }
) {
  try {
    const rawToken = params.shareToken?.trim();
    if (!rawToken) {
      return NextResponse.json(
        { success: false, error: 'Share token is required' },
        { status: 400 }
      );
    }

    const session = await getSessionByRawToken(rawToken);
    if (!session && rawToken !== FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive tracking token' },
        { status: 404 }
      );
    }

    // Check expiration
    if (session && isSessionExpired(session)) {
      return NextResponse.json({
        success: true,
        isExpired: true,
        session: {
          commuterName: session.commuterId === 'commuter_rahul_1' ? 'Rahul' : 'Commuter',
          destinationStop: session.destinationStop,
          scheduledArrival: session.scheduledArrival || '08:25 AM',
          arrivedAt: session.arrivedAt
            ? new Date(session.arrivedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '08:47 AM',
          expiresAt: new Date(session.expiresAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      });
    }

    // Default mock trip projection for SR-101
    const defaultTrip = {
      tripId: session?.tripId || FAMILY_TRACKING_CONFIG.DEFAULT_TRIP_ID,
      routeId: 'route-sr-101',
      routeName: 'Whitefield Tech Corridor Express',
      routeCode: 'SR-101',
      vehicleModel: 'Toyota Innova Crysta',
      vehiclePlate: 'KA-01-MJ-8822',
      status: session?.isArrived ? 'completed' : 'in_transit',
      liveLocation: session?.isArrived
        ? { lat: 12.9360, lng: 77.6920, speedKmH: 0, heading: 68 }
        : { lat: 12.9340, lng: 77.6880, speedKmH: 38, heading: 68 },
    };

    const status = buildFamilyTrackingStatus(defaultTrip, session);

    // If newly arrived or significantly delayed, record simulated notification in background
    if (status.isArrived) {
      recordFamilyNotification({
        sessionId: session?.id,
        tripId: defaultTrip.tripId,
        commuterId: session?.commuterId || 'commuter_rahul_1',
        commuterName: status.commuterName,
        type: 'SAFE_ARRIVAL',
        delayCategory: 'ARRIVED',
        title: 'Safe Arrival Confirmed',
        message: `${status.commuterName} has arrived safely at ${status.destinationStop}.`,
        destination: status.destinationStop,
        delayMinutes: status.delayMinutes,
        eta: status.arrivedAt || '08:47 AM',
      }).catch((e) => console.warn('Notification log skipped:', e));
    } else if (status.delayMinutes >= 10) {
      recordFamilyNotification({
        sessionId: session?.id,
        tripId: defaultTrip.tripId,
        commuterId: session?.commuterId || 'commuter_rahul_1',
        commuterName: status.commuterName,
        type: 'COMMUTE_DELAY',
        delayCategory: status.delayCategory,
        title: status.delayHeadline,
        message: status.delayMessage,
        destination: status.destinationStop,
        delayMinutes: status.delayMinutes,
        eta: status.updatedEta,
        lastLocation: status.lastKnownLocation,
      }).catch((e) => console.warn('Delay notification log skipped:', e));
    }

    return NextResponse.json({
      success: true,
      isExpired: false,
      tracking: status,
    });
  } catch (error: any) {
    console.error('Error fetching public family tracking:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
