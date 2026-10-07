import { FAMILY_TRACKING_CONFIG, DelayCategory } from './family-tracking-config';
import {
  LocationCoord,
  DestinationCoord,
  SafeArrivalEvaluation,
  FamilyDelayInfo,
  calculateDistanceMeters,
  evaluateSafeArrival,
  classifyDelay,
} from './safe-arrival-logic';
import { calculateSmartEta, SR101_CORRIDOR_WAYPOINTS } from '@/lib/ai/smart-eta';
import prisma from '@/lib/prisma';
import { calculateSessionExpiration } from './token-service';

export type {
  LocationCoord,
  DestinationCoord,
  SafeArrivalEvaluation,
  FamilyDelayInfo,
};
export { calculateDistanceMeters, evaluateSafeArrival, classifyDelay };

export interface SanitizedFamilyStatus {
  isArrived: boolean;
  arrivedAt?: string;
  commuterName: string;
  destinationStop: string;
  scheduledArrival: string;
  delayMinutes: number;
  delayCategory: DelayCategory;
  delayHeadline: string;
  delayMessage: string;
  lastKnownLocation: string;
  updatedEta: string;
  vehiclePlate: string;
  vehicleModel: string;
  routeCode: string;
  routeName: string;
  isExpired: boolean;
  expiresAt: string;
}

/**
 * Builds sanitized family tracking status object suitable for public tracking.
 */
export function buildFamilyTrackingStatus(
  trip: any,
  session?: any
): SanitizedFamilyStatus {
  const loc: LocationCoord = trip?.liveLocation || {
    lat: 12.936,
    lng: 77.692,
    speedKmH: 42,
  };

  const destinationStop =
    session?.destinationStop ||
    FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_STOP;

  const destinationLat =
    session?.destinationLat || FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_LAT;
  const destinationLng =
    session?.destinationLng || FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_LNG;

  const arrivalEval = evaluateSafeArrival(
    loc,
    { name: destinationStop, lat: destinationLat, lng: destinationLng },
    trip?.status
  );

  const isArrived = session?.isArrived || arrivalEval.isArrived || trip?.status === 'completed';

  // Calculate Smart ETA & Delay
  const etaPrediction = calculateSmartEta(loc, SR101_CORRIDOR_WAYPOINTS);
  const delayMinutes = session?.delayMinutesAtArrival ?? etaPrediction.currentDelayMinutes;
  const delayInfo = classifyDelay(delayMinutes, isArrived);

  // Commuter first name only (Privacy Guard: zero full PII)
  const commuterFullName = session?.commuterName || FAMILY_TRACKING_CONFIG.DEFAULT_COMMUTER_NAME;
  const commuterFirstName = commuterFullName.split(' ')[0];

  const scheduledArrival = session?.scheduledArrival || FAMILY_TRACKING_CONFIG.DEFAULT_SCHEDULED_ARRIVAL;
  const arrivedAt = session?.arrivedAt
    ? new Date(session.arrivedAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : isArrived
    ? new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : undefined;

  const expiresAtDate = session?.expiresAt
    ? new Date(session.expiresAt)
    : calculateSessionExpiration(isArrived);

  const isExpired = session?.status === 'EXPIRED' || Date.now() > expiresAtDate.getTime();

  return {
    isArrived,
    arrivedAt,
    commuterName: commuterFirstName,
    destinationStop,
    scheduledArrival,
    delayMinutes,
    delayCategory: delayInfo.category,
    delayHeadline: delayInfo.headline,
    delayMessage: delayInfo.message,
    lastKnownLocation: etaPrediction.nextStopName || 'Bellandur EcoSpace Corridor',
    updatedEta: etaPrediction.trafficAdjustedEta,
    vehiclePlate: trip?.vehiclePlate || 'KA-01-MJ-8822',
    vehicleModel: trip?.vehicleModel || 'Toyota Innova Crysta',
    routeCode: trip?.routeCode || 'SR-101',
    routeName: trip?.routeName || 'Whitefield Tech Corridor Express',
    isExpired,
    expiresAt: expiresAtDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

/**
 * Dispatches simulated family notifications with deduplication.
 */
export async function recordFamilyNotification(params: {
  sessionId?: string;
  tripId: string;
  commuterId: string;
  commuterName: string;
  type: 'SAFE_ARRIVAL' | 'COMMUTE_DELAY';
  delayCategory?: DelayCategory;
  title: string;
  message: string;
  destination: string;
  delayMinutes: number;
  eta?: string;
  lastLocation?: string;
}) {
  try {
    // Deduplication check: Do not duplicate same notification type within 15 minutes
    const recent = await prisma.familyNotification.findFirst({
      where: {
        tripId: params.tripId,
        commuterId: params.commuterId,
        type: params.type,
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recent && recent.type === 'SAFE_ARRIVAL') {
      return recent; // Safe arrival is one-shot
    }

    // For delay notifications, only record if delay changed significantly (> 3 min)
    if (recent && Math.abs(recent.delayMinutes - params.delayMinutes) < 4) {
      return recent;
    }

    return await prisma.familyNotification.create({
      data: {
        sessionId: params.sessionId,
        tripId: params.tripId,
        commuterId: params.commuterId,
        commuterName: params.commuterName,
        type: params.type,
        delayCategory: params.delayCategory,
        title: params.title,
        message: params.message,
        destination: params.destination,
        delayMinutes: params.delayMinutes,
        eta: params.eta,
        lastLocation: params.lastLocation,
        deliveredAt: new Date(),
      },
    });
  } catch (err) {
    console.error('Error recording family notification:', err);
    return null;
  }
}
