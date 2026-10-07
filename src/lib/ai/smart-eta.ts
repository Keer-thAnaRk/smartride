/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🚦 SMARTRIDE (COMMUTESYNC) — SMART ETA & DELAY PREDICTION ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Predicts real-time shuttle arrival and traffic-adjusted delays using
 * simulated GPS telemetry, route distance, corridor choke points, and
 * historical transit speed models.
 *
 * Provides:
 * - 🟢 Arriving in X min
 * - Current delay: +X min (or on time)
 * - Predicted arrival: HH:MM AM/PM
 * - Dual ETA: Normal ETA vs. Traffic-adjusted ETA
 */

export interface WaypointCoord {
  name: string;
  lat: number;
  lng: number;
  scheduledTime: string; // e.g. "08:40 AM"
  landmark?: string;
}

export interface StopEtaInfo {
  stopName: string;
  landmark?: string;
  distanceKm: number;
  scheduledTime: string;      // e.g. "08:40 AM"
  trafficAdjustedTime: string;// e.g. "08:43 AM"
  estimatedMinutes: number;   // e.g. 8
  delayMinutes: number;       // e.g. +3
  status: 'completed' | 'arriving_next' | 'upcoming';
  congestionLevel: 'Low' | 'Moderate' | 'Heavy';
}

export interface SmartEtaPrediction {
  nextStopName: string;
  distanceToNextStopKm: number;
  estimatedMinutesToNextStop: number;
  currentDelayMinutes: number;
  statusIndicator: string; // "🟢 Arriving in 8 min"
  statusBadgeColor: 'emerald' | 'amber' | 'rose';
  normalScheduledEta: string;
  trafficAdjustedEta: string;
  currentSpeedKmH: number;
  normalCorridorSpeedKmH: number;
  trafficSlowdownPercent: number;
  trafficCondition: string;
  destinationStopName: string;
  destinationNormalEta: string;
  destinationTrafficEta: string;
  destinationMinutes: number;
  allStops: StopEtaInfo[];
  lastCalculatedAt: string;
}

/**
 * Standard Tech Corridor Waypoints (SR-101 Whitefield Tech Express)
 */
export const SR101_CORRIDOR_WAYPOINTS: WaypointCoord[] = [
  { name: 'HSR Layout 27th Main', lat: 12.9121, lng: 77.6446, scheduledTime: '08:00 AM', landmark: 'Sector 2 Circle' },
  { name: 'Agara Lake Junction', lat: 12.9250, lng: 77.6680, scheduledTime: '08:12 AM', landmark: 'Shell Fuel Station' },
  { name: 'Bellandur EcoSpace Flyover', lat: 12.9360, lng: 77.6920, scheduledTime: '08:25 AM', landmark: 'Pedestrian Skywalk' },
  { name: 'Marathahalli Bridge', lat: 12.9550, lng: 77.7010, scheduledTime: '08:35 AM', landmark: 'Multiplex Bus Bay' },
  { name: 'ITPB Tech Park Hub', lat: 12.9850, lng: 77.7314, scheduledTime: '08:45 AM', landmark: 'Gate 2 Main Entrance' },
];

/**
 * Calculates Haversine spherical distance between two coordinates in kilometers.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Parses a time string like "08:40 AM" into minutes from midnight.
 */
export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(' ');
  const time = parts[0];
  const ampm = parts[1]?.toUpperCase() || 'AM';

  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;

  return h * 60 + m;
}

/**
 * Formats minutes from midnight into "08:43 AM".
 */
export function formatMinutesToTime(totalMinutes: number): string {
  let normalized = Math.round(totalMinutes) % (24 * 60);
  if (normalized < 0) normalized += 24 * 60;

  let h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';

  h = h % 12;
  if (h === 0) h = 12;

  const hStr = h < 10 ? `0${h}` : `${h}`;
  const mStr = m < 10 ? `0${m}` : `${m}`;

  return `${hStr}:${mStr} ${ampm}`;
}

/**
 * Adds minutes to an existing time string (e.g. "08:40 AM" + 3 min -> "08:43 AM").
 */
export function addMinutesToTimeString(timeStr: string, minutesToAdd: number): string {
  const baseMinutes = parseTimeToMinutes(timeStr);
  return formatMinutesToTime(baseMinutes + minutesToAdd);
}

/**
 * Computes Smart ETA & Delay Prediction for a vehicle at `currentLocation`.
 */
export function calculateSmartEta(
  currentLocation: { lat: number; lng: number; speedKmH?: number },
  waypoints: WaypointCoord[] = SR101_CORRIDOR_WAYPOINTS,
  referenceDate: Date = new Date()
): SmartEtaPrediction {
  const lat = currentLocation.lat || 12.9360;
  const lng = currentLocation.lng || 77.6920;
  const currentSpeed = Math.max(15, currentLocation.speedKmH || 38);
  const normalCorridorSpeed = 45; // Free-flow corridor design speed in km/h

  // 1. Determine closest passed waypoint and next target waypoint
  let closestDist = Infinity;
  let closestIdx = 0;

  waypoints.forEach((wp, idx) => {
    const dist = calculateHaversineDistance(lat, lng, wp.lat, wp.lng);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = idx;
    }
  });

  // Next target waypoint is closestIdx if distance > 0.3 km, or next index
  let nextIdx = closestDist > 0.4 ? closestIdx : Math.min(waypoints.length - 1, closestIdx + 1);

  // 2. Traffic Congestion & Choke Point Model
  // Peak hour factors (08:00 - 09:30 AM or 17:30 - 19:30 PM)
  const currentHour = referenceDate.getHours();
  const currentMin = referenceDate.getMinutes();
  const timeOfDayDecimal = currentHour + currentMin / 60;

  const isMorningPeak = timeOfDayDecimal >= 8.0 && timeOfDayDecimal <= 9.75;
  const isEveningPeak = timeOfDayDecimal >= 17.5 && timeOfDayDecimal <= 19.5;

  let trafficMultiplier = 1.12; // Base weekday corridor friction
  if (isMorningPeak) trafficMultiplier = 1.25; // 25% peak congestion
  if (isEveningPeak) trafficMultiplier = 1.28;

  // Specific choke points along Bangalore tech corridor (Bellandur Ecospace, Marathahalli)
  const nextWp = waypoints[nextIdx];
  if (nextWp.name.includes('Bellandur') || nextWp.name.includes('Marathahalli')) {
    trafficMultiplier += 0.10; // Extra choke point delay
  }

  // Calculate speed reduction percentage
  const trafficSlowdownPercent = Math.max(
    5,
    Math.round(((normalCorridorSpeed - (currentSpeed / trafficMultiplier)) / normalCorridorSpeed) * 100)
  );

  // 3. Compute ETA for Next Stop
  const distToNextKm = calculateHaversineDistance(lat, lng, nextWp.lat, nextWp.lng);

  // Effective travel speed (blend of current GPS speed and corridor traffic model)
  const effectiveSpeed = Math.max(12, (currentSpeed * 0.7 + (normalCorridorSpeed / trafficMultiplier) * 0.3));

  // Time required to reach next stop (in minutes)
  const estimatedMinutesToNextStop = Math.max(
    1,
    Math.round((distToNextKm / effectiveSpeed) * 60)
  );

  // Current Delay Calculation (e.g. +3 min)
  // Base normal time = (dist / normalCorridorSpeed) * 60
  const freeFlowMinutes = (distToNextKm / normalCorridorSpeed) * 60;
  const rawDelay = estimatedMinutesToNextStop - freeFlowMinutes;
  
  // Empirical delay calibration: between +1 and +6 minutes during peak
  const currentDelayMinutes = Math.max(0, Math.round(rawDelay + (isMorningPeak ? 2 : 1)));

  // Time formatting
  const nowMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  const predictedArrivalMinutes = nowMinutes + estimatedMinutesToNextStop;
  const normalArrivalMinutes = predictedArrivalMinutes - currentDelayMinutes;

  const trafficAdjustedEta = formatMinutesToTime(predictedArrivalMinutes);
  const normalScheduledEta = formatMinutesToTime(normalArrivalMinutes);

  // Status Indicator
  let statusIndicator = `🟢 Arriving in ${estimatedMinutesToNextStop} min`;
  let statusBadgeColor: 'emerald' | 'amber' | 'rose' = 'emerald';

  if (currentDelayMinutes >= 6) {
    statusIndicator = `🔴 Heavy Corridor Delay (+${currentDelayMinutes} min)`;
    statusBadgeColor = 'rose';
  } else if (currentDelayMinutes >= 3) {
    statusIndicator = `🟡 Arriving in ${estimatedMinutesToNextStop} min (+${currentDelayMinutes}m delay)`;
    statusBadgeColor = 'amber';
  }

  // Traffic Condition String
  let trafficCondition = 'Smooth corridor flow • Standard transit velocity';
  if (currentDelayMinutes >= 6) {
    trafficCondition = `Heavy choke-point bottleneck near ${nextWp.name} • ${trafficSlowdownPercent}% speed reduction`;
  } else if (currentDelayMinutes >= 2) {
    trafficCondition = `Moderate corridor commute traffic • +${currentDelayMinutes}m delay expected`;
  }

  // 4. Compute ETAs for all stops along the corridor
  let accumulatedMinutes = 0;
  let prevLat = lat;
  let prevLng = lng;

  const allStops: StopEtaInfo[] = waypoints.map((wp, idx) => {
    const distFromPrev = calculateHaversineDistance(prevLat, prevLng, wp.lat, wp.lng);
    const segMinutes = Math.max(2, Math.round((distFromPrev / effectiveSpeed) * 60));
    accumulatedMinutes += segMinutes;

    prevLat = wp.lat;
    prevLng = wp.lng;

    let status: 'completed' | 'arriving_next' | 'upcoming' = 'upcoming';
    if (idx < nextIdx) status = 'completed';
    else if (idx === nextIdx) status = 'arriving_next';

    const stopDelay = status === 'completed' ? 0 : Math.round(currentDelayMinutes * (1 + (idx - nextIdx) * 0.25));
    const schedMins = parseTimeToMinutes(wp.scheduledTime);
    const trafficMins = schedMins + stopDelay;

    return {
      stopName: wp.name,
      landmark: wp.landmark,
      distanceKm: calculateHaversineDistance(lat, lng, wp.lat, wp.lng),
      scheduledTime: wp.scheduledTime,
      trafficAdjustedTime: formatMinutesToTime(trafficMins),
      estimatedMinutes: status === 'completed' ? 0 : accumulatedMinutes,
      delayMinutes: stopDelay,
      status,
      congestionLevel: stopDelay >= 6 ? 'Heavy' : stopDelay >= 3 ? 'Moderate' : 'Low',
    };
  });

  const destStop = waypoints[waypoints.length - 1];
  const destInfo = allStops[allStops.length - 1];

  return {
    nextStopName: nextWp.name,
    distanceToNextStopKm: distToNextKm,
    estimatedMinutesToNextStop,
    currentDelayMinutes,
    statusIndicator,
    statusBadgeColor,
    normalScheduledEta,
    trafficAdjustedEta,
    currentSpeedKmH: Math.round(currentSpeed),
    normalCorridorSpeedKmH: normalCorridorSpeed,
    trafficSlowdownPercent,
    trafficCondition,
    destinationStopName: destStop.name,
    destinationNormalEta: destInfo.scheduledTime,
    destinationTrafficEta: destInfo.trafficAdjustedTime,
    destinationMinutes: destInfo.estimatedMinutes,
    allStops,
    lastCalculatedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}
