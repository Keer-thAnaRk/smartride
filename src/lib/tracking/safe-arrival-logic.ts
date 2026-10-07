import { FAMILY_TRACKING_CONFIG, DelayCategory } from './family-tracking-config';

export interface LocationCoord {
  lat: number;
  lng: number;
  speedKmH?: number;
}

export interface DestinationCoord {
  name: string;
  lat: number;
  lng: number;
}

export interface SafeArrivalEvaluation {
  isArrived: boolean;
  distanceMeters: number;
  speedKmH: number;
  reason: string;
}

export interface FamilyDelayInfo {
  category: DelayCategory;
  label: string;
  badgeColor: 'emerald' | 'amber' | 'orange' | 'rose';
  delayMinutes: number;
  headline: string;
  message: string;
}

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
 * Calculates spherical distance between two coordinates in meters.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Evaluates whether vehicle has arrived at destination stop:
 * 1. Trip status completed OR
 * 2. Vehicle within geofence radius (<= 100m) AND speed <= 3 km/h
 */
export function evaluateSafeArrival(
  vehicleLoc: LocationCoord,
  destination: DestinationCoord,
  tripStatus?: string
): SafeArrivalEvaluation {
  if (tripStatus === 'completed' || tripStatus === 'COMPLETED') {
    return {
      isArrived: true,
      distanceMeters: 0,
      speedKmH: 0,
      reason: 'Trip successfully completed by shuttle captain',
    };
  }

  const speed = vehicleLoc.speedKmH ?? 0;
  const distanceMeters = calculateDistanceMeters(
    vehicleLoc.lat,
    vehicleLoc.lng,
    destination.lat,
    destination.lng
  );

  const isWithinGeofence = distanceMeters <= FAMILY_TRACKING_CONFIG.DESTINATION_GEOFENCE_RADIUS_METERS;
  const isStoppedOrCrawling = speed <= FAMILY_TRACKING_CONFIG.ARRIVAL_SPEED_MAX_KMH;

  if (isWithinGeofence && isStoppedOrCrawling) {
    return {
      isArrived: true,
      distanceMeters,
      speedKmH: speed,
      reason: `Vehicle within destination geofence (${distanceMeters}m <= ${FAMILY_TRACKING_CONFIG.DESTINATION_GEOFENCE_RADIUS_METERS}m) and halted (${speed} km/h)`,
    };
  }

  return {
    isArrived: false,
    distanceMeters,
    speedKmH: speed,
    reason: isWithinGeofence
      ? `Vehicle within geofence (${distanceMeters}m) but still moving at ${speed} km/h`
      : `Vehicle ${distanceMeters}m away from ${destination.name}`,
  };
}

/**
 * Categorizes transit delay into transparent operational brackets.
 */
export function classifyDelay(delayMinutes: number, isArrived: boolean): FamilyDelayInfo {
  if (isArrived) {
    return {
      category: 'ARRIVED',
      label: 'Safe Arrival',
      badgeColor: 'emerald',
      delayMinutes,
      headline: 'Safe Arrival Confirmed',
      message: 'Commuter has safely arrived at their destination.',
    };
  }

  const thresholds = FAMILY_TRACKING_CONFIG.DELAY_THRESHOLDS;

  if (delayMinutes <= thresholds.ON_TIME_MAX) {
    return {
      category: 'ON_TIME',
      label: 'On Schedule',
      badgeColor: 'emerald',
      delayMinutes,
      headline: 'Shuttle On Schedule',
      message: 'Smooth traffic conditions across the corridor.',
    };
  }

  if (delayMinutes <= thresholds.MINOR_DELAY_MAX) {
    return {
      category: 'MINOR_DELAY',
      label: 'Minor Delay',
      badgeColor: 'amber',
      delayMinutes,
      headline: `Minor Traffic (+${delayMinutes} min)`,
      message: `Moderate corridor volume. Shuttle running ${delayMinutes} minutes behind schedule.`,
    };
  }

  if (delayMinutes <= thresholds.SIGNIFICANT_DELAY_MAX) {
    return {
      category: 'SIGNIFICANT_DELAY',
      label: 'Commute Delay',
      badgeColor: 'orange',
      delayMinutes,
      headline: `⚠️ Commute Delay (+${delayMinutes} min)`,
      message: `Heavier traffic congestion detected along corridor. Shuttle is currently ${delayMinutes} minutes behind schedule.`,
    };
  }

  return {
    category: 'MAJOR_DELAY',
    label: 'Major Traffic Delay',
    badgeColor: 'rose',
    delayMinutes,
    headline: `🚨 Severe Delay (+${delayMinutes} min)`,
    message: `Major choke-point gridlock encountered. Central Operations monitoring shuttle progress.`,
  };
}
