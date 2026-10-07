/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🚗 SMARTRIDE (COMMUTESYNC) — HISTORICAL COMMUTE DATASET & PREPROCESSING
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 5: Data Acquisition, Data Cleaning & Preprocessing Layer
 *
 * Rules:
 * - Load real existing platform data (Attendance, Subscription, Trip, Route).
 * - Multi-stage data cleaning layer: drops duplicates, handles missing values,
 *   rejects invalid dates and route IDs, clamps impossible counts.
 * - Explicitly handles insufficient training data without fabricating production records.
 * - Minimum training threshold: MIN_TRAINING_RECORDS = 20.
 * - Separates real platform data from clearly labeled synthetic benchmark data.
 */

import prisma from '@/lib/prisma';

export interface HistoricalTripRecord {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  date: string; // YYYY-MM-DD
  shift: 'MORNING_PICKUP' | 'EVENING_DROP';
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
  weekOfMonth: number; // 1 to 5
  vehicleCapacity: number;
  vehicleType: string;
  actualDemand: number; // Target y: actual boarded passenger count
  scheduledBookings: number;
  cancellations: number;
  noShows: number;
  stopBreakdown: { stopName: string; count: number }[];
  isSynthetic: boolean;
}

export interface CorridorRouteConfig {
  id: string;
  code: string;
  name: string;
  defaultCapacity: number;
  baseMorningDemand: number;
  baseEveningDemand: number;
  stops: string[];
}

export interface CleaningReport {
  totalRaw: number;
  validCount: number;
  droppedCount: number;
  droppedReasons: { recordId: string; reason: string }[];
  cleanedAt: string;
}

export const MIN_TRAINING_RECORDS = 20;

export const KNOWN_CORRIDOR_ROUTES: CorridorRouteConfig[] = [
  {
    id: 'route-sr-101',
    code: 'SR-101',
    name: 'Whitefield Tech Express (HSR → ITPB)',
    defaultCapacity: 20, // Mini-shuttle
    baseMorningDemand: 18,
    baseEveningDemand: 17,
    stops: [
      'HSR Layout 27th Main',
      'Agara Lake Junction',
      'Bellandur EcoSpace Flyover',
      'Marathahalli Bridge',
      'ITPB Tech Park Hub',
    ],
  },
  {
    id: 'route-sr-102',
    code: 'SR-102',
    name: 'Electronic City Express (Koramangala → E-City)',
    defaultCapacity: 16,
    baseMorningDemand: 15,
    baseEveningDemand: 14,
    stops: [
      'Koramangala Sony World',
      'Silk Board Junction',
      'Bommanahalli Central',
      'Electronic City Toll Hub',
    ],
  },
  {
    id: 'route-sr-103',
    code: 'SR-103',
    name: 'Outer Ring Road Shuttle (Hebbal → Bellandur)',
    defaultCapacity: 12,
    baseMorningDemand: 11,
    baseEveningDemand: 10,
    stops: [
      'Hebbal Flyover Circle',
      'Manyata Tech Park Gate 2',
      'KR Puram Railway Junction',
      'Ecospace Tech Hub',
    ],
  },
  {
    id: 'route-sr-104',
    code: 'SR-104',
    name: 'Bannerghatta Tech Connector (Jayadeva → Kalyani)',
    defaultCapacity: 8,
    baseMorningDemand: 6,
    baseEveningDemand: 6,
    stops: [
      'Jayadeva Hospital Circle',
      'Vega City Mall Stop',
      'Arekere Junction',
      'Kalyani Magnum Tech Hub',
    ],
  },
];

/**
 * Reusable Data Cleaning & Preprocessing Layer.
 * Validates, cleans, and standardizes raw historical records.
 */
export function prepareDemandDataset(rawRecords: any[]): {
  cleanedRecords: HistoricalTripRecord[];
  cleaningReport: CleaningReport;
} {
  const cleanedRecords: HistoricalTripRecord[] = [];
  const droppedReasons: { recordId: string; reason: string }[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < (rawRecords || []).length; i++) {
    const raw = rawRecords[i];
    const recId = raw?.id || `raw-${i}`;

    // 1. Missing object check
    if (!raw || typeof raw !== 'object') {
      droppedReasons.push({ recordId: recId, reason: 'Null or non-object record' });
      continue;
    }

    // 2. Route validation
    const routeCode = raw.routeCode || raw.route?.code;
    const routeId = raw.routeId || raw.route?.id;
    if (!routeCode || typeof routeCode !== 'string' || !routeCode.trim()) {
      droppedReasons.push({ recordId: recId, reason: 'Missing or empty routeCode' });
      continue;
    }

    // 3. Date validation
    const rawDate = raw.date || raw.createdAt;
    if (!rawDate) {
      droppedReasons.push({ recordId: recId, reason: 'Missing date field' });
      continue;
    }

    const parsedDate = new Date(rawDate);
    if (isNaN(parsedDate.getTime())) {
      droppedReasons.push({ recordId: recId, reason: `Invalid date format: ${rawDate}` });
      continue;
    }
    const dateStr = parsedDate.toISOString().split('T')[0];

    // 4. Shift validation
    let shift: 'MORNING_PICKUP' | 'EVENING_DROP' = 'MORNING_PICKUP';
    if (raw.shift === 'EVENING_DROP' || raw.tripType === 'EVENING_DROP') {
      shift = 'EVENING_DROP';
    } else if (raw.shift === 'MORNING_PICKUP' || raw.tripType === 'MORNING_PICKUP') {
      shift = 'MORNING_PICKUP';
    }

    // 5. Duplicate check for identical (routeCode, date, shift)
    const dedupKey = `${routeCode.trim()}_${dateStr}_${shift}`;
    if (seenKeys.has(dedupKey)) {
      droppedReasons.push({ recordId: recId, reason: `Duplicate record for ${dedupKey}` });
      continue;
    }
    seenKeys.add(dedupKey);

    // 6. Impossible passenger counts / negative values check
    const rawDemand = Number(raw.actualDemand ?? raw.demand ?? raw.boardedCount ?? 0);
    if (isNaN(rawDemand) || rawDemand < 0) {
      droppedReasons.push({ recordId: recId, reason: `Negative or invalid actualDemand: ${rawDemand}` });
      continue;
    }

    // 7. Capacity normalization
    let capacity = Number(raw.vehicleCapacity ?? raw.capacity ?? 16);
    if (isNaN(capacity) || capacity <= 0) {
      capacity = 16;
    }

    // 8. Clamping impossible passenger counts if exceeds physical vehicle capacity by > 200%
    let actualDemand = Math.round(rawDemand);
    if (actualDemand > capacity * 3) {
      actualDemand = capacity * 2; // clamp extreme sensor anomaly
    }

    const scheduled = Math.max(actualDemand, Number(raw.scheduledBookings ?? actualDemand));
    const cancellations = Math.max(0, Number(raw.cancellations ?? 0));
    const noShows = Math.max(0, Number(raw.noShows ?? 0));

    const dayOfWeek = parsedDate.getDay();
    const weekOfMonth = Math.min(5, Math.ceil(parsedDate.getDate() / 7));

    cleanedRecords.push({
      id: String(raw.id || `clean-${dedupKey}`),
      routeId: String(routeId || `route-${routeCode.toLowerCase()}`),
      routeCode: routeCode.trim(),
      routeName: String(raw.routeName || raw.route?.name || `Route ${routeCode}`),
      date: dateStr,
      shift,
      dayOfWeek,
      weekOfMonth,
      vehicleCapacity: capacity,
      vehicleType: String(raw.vehicleType || (capacity >= 20 ? 'MINI_BUS' : capacity >= 12 ? 'VAN' : 'SUV')),
      actualDemand,
      scheduledBookings: scheduled,
      cancellations,
      noShows,
      stopBreakdown: Array.isArray(raw.stopBreakdown) ? raw.stopBreakdown : [],
      isSynthetic: Boolean(raw.isSynthetic),
    });
  }

  return {
    cleanedRecords,
    cleaningReport: {
      totalRaw: (rawRecords || []).length,
      validCount: cleanedRecords.length,
      droppedCount: droppedReasons.length,
      droppedReasons,
      cleanedAt: new Date().toISOString(),
    },
  };
}

/**
 * Loads real platform mobility data from Prisma SQLite (Attendance, Subscription, Trip).
 * Aggregates into clean historical trip manifests.
 */
export async function loadRealPlatformMobilityData(): Promise<{
  records: HistoricalTripRecord[];
  isSufficient: boolean;
  availableRecords: number;
  requiredRecords: number;
  cleaningReport: CleaningReport;
}> {
  const rawList: any[] = [];

  try {
    const attendances = await prisma.attendance.findMany({
      include: { route: true },
      orderBy: { date: 'asc' },
    });

    // Group by routeCode + date + tripType
    const grouped = new Map<string, {
      route: any;
      date: string;
      tripType: string;
      boarded: number;
      scheduled: number;
      skipped: number;
      absent: number;
    }>();

    for (const att of attendances) {
      if (!att.route) continue;
      const key = `${att.route.code}_${att.date}_${att.tripType}`;
      const existing = grouped.get(key) || {
        route: att.route,
        date: att.date,
        tripType: att.tripType,
        boarded: 0,
        scheduled: 0,
        skipped: 0,
        absent: 0,
      };

      existing.scheduled++;
      if (att.status === 'BOARDED' || att.status === 'COMPLETED') {
        existing.boarded++;
      } else if (att.status === 'SKIPPED') {
        existing.skipped++;
      } else if (att.status === 'ABSENT') {
        existing.absent++;
      }
      grouped.set(key, existing);
    }

    for (const [key, g] of grouped.entries()) {
      rawList.push({
        id: `att-agg-${key}`,
        routeId: g.route.id,
        routeCode: g.route.code,
        routeName: g.route.name,
        date: g.date,
        shift: g.tripType === 'EVENING_DROP' ? 'EVENING_DROP' : 'MORNING_PICKUP',
        actualDemand: g.boarded,
        scheduledBookings: g.scheduled,
        cancellations: g.skipped,
        noShows: g.absent,
        vehicleCapacity: 16,
        isSynthetic: false,
      });
    }
  } catch (err) {
    console.warn('[HistoricalData] Failed to load real records from Prisma:', err);
  }

  const { cleanedRecords, cleaningReport } = prepareDemandDataset(rawList);
  const isSufficient = cleanedRecords.length >= MIN_TRAINING_RECORDS;

  return {
    records: cleanedRecords,
    isSufficient,
    availableRecords: cleanedRecords.length,
    requiredRecords: MIN_TRAINING_RECORDS,
    cleaningReport,
  };
}

/**
 * Deterministic pseudo-random number generator (LCG) for reproducible benchmarks.
 */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates N days of documented synthetic commute history across corridors.
 * Clearly labeled `isSynthetic: true` for academic demonstration and regression testing.
 */
export function generateHistoricalCommuteData(
  daysCount = 60,
  seed = 42
): HistoricalTripRecord[] {
  const rand = seededRandom(seed);
  const records: HistoricalTripRecord[] = [];
  const today = new Date();

  // Day of week demand multipliers:
  // Mon: 1.15 (highest peak), Tue: 1.08, Wed: 1.02, Thu: 0.96, Fri: 0.76 (hybrid WFH), Sat/Sun: off
  const dayOfWeekMultipliers = [0.15, 1.15, 1.08, 1.02, 0.96, 0.76, 0.18];

  for (let d = daysCount; d >= 1; d--) {
    const tripDate = new Date(today);
    tripDate.setDate(today.getDate() - d);

    const dayOfWeek = tripDate.getDay();
    const dateStr = tripDate.toISOString().split('T')[0];
    const weekOfMonth = Math.min(5, Math.ceil(tripDate.getDate() / 7));

    // Skip Sundays for corporate commute
    if (dayOfWeek === 0) continue;

    const dayMultiplier = dayOfWeekMultipliers[dayOfWeek] || 1.0;

    for (const route of KNOWN_CORRIDOR_ROUTES) {
      const shifts: ('MORNING_PICKUP' | 'EVENING_DROP')[] = [
        'MORNING_PICKUP',
        'EVENING_DROP',
      ];

      for (const shift of shifts) {
        const baseDemand =
          shift === 'MORNING_PICKUP'
            ? route.baseMorningDemand
            : route.baseEveningDemand;

        const shiftMultiplier = shift === 'MORNING_PICKUP' ? 1.04 : 0.96;
        const growthFactor = 1.0 + ((daysCount - d) / daysCount) * 0.12;
        const noise = (rand() - 0.5) * 3.5;

        let scheduled = Math.round(
          baseDemand * dayMultiplier * shiftMultiplier * growthFactor + noise
        );
        scheduled = Math.max(2, scheduled);

        const cancellationRate = 0.04 + rand() * 0.04;
        const noShowRate = 0.01 + rand() * 0.02;

        const cancellations = Math.round(scheduled * cancellationRate);
        const noShows = Math.round(scheduled * noShowRate);

        const actualDemand = Math.max(1, scheduled - cancellations - noShows);

        const stopCount = route.stops.length;
        let remaining = actualDemand;
        const stopBreakdown: { stopName: string; count: number }[] = [];

        route.stops.forEach((stop, idx) => {
          if (idx === stopCount - 1) {
            stopBreakdown.push({ stopName: stop, count: Math.max(0, remaining) });
          } else {
            const ratio = idx === 0 ? 0.35 : (0.65 / (stopCount - 1));
            const count = Math.min(
              remaining,
              Math.max(1, Math.round(actualDemand * ratio + (rand() - 0.5) * 2))
            );
            stopBreakdown.push({ stopName: stop, count });
            remaining -= count;
          }
        });

        records.push({
          id: `hist_${route.code.toLowerCase()}_${dateStr}_${shift.toLowerCase()}`,
          routeId: route.id,
          routeCode: route.code,
          routeName: route.name,
          date: dateStr,
          shift,
          dayOfWeek,
          weekOfMonth,
          vehicleCapacity: route.defaultCapacity,
          vehicleType:
            route.defaultCapacity >= 20
              ? 'MINI_BUS'
              : route.defaultCapacity >= 12
              ? 'VAN'
              : 'SUV',
          actualDemand,
          scheduledBookings: scheduled,
          cancellations,
          noShows,
          stopBreakdown,
          isSynthetic: true,
        });
      }
    }
  }

  return records;
}
