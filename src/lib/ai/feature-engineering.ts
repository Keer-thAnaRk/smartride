/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🧠 SMARTRIDE (COMMUTESYNC) — FEATURE ENGINEERING PIPELINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Layer 2: Feature Transformation & Vectorization
 *
 * Converts cleaned historical commute records into structured numerical feature
 * vectors X and target scalar y for Machine Learning regression.
 *
 * Explicitly separates RAW FEATURES from DERIVED FEATURES:
 *
 * RAW FEATURES (5):
 * 1. route_code_idx       - Integer encoding of corridor route (0, 1, 2...)
 * 2. shift_idx            - 0 = MORNING_PICKUP, 1 = EVENING_DROP
 * 3. day_of_week          - 0 (Sun) to 6 (Sat), capturing weekly cycle
 * 4. week_of_month        - 1 to 5, capturing monthly progression
 * 5. vehicle_capacity     - Nominal vehicle seat limit
 *
 * DERIVED FEATURES (4):
 * 6. historical_avg       - Long-term baseline average demand for (route, shift)
 * 7. recent_trend_7d      - 7-day rolling moving average
 * 8. prev_same_day        - Same day-of-week lag demand from previous week
 * 9. cancellation_rate    - Historical ratio of cancellations to scheduled bookings
 */

import { HistoricalTripRecord } from './historical-data';

export const RAW_FEATURE_NAMES = [
  'Route Code Index',
  'Shift Index (0:AM, 1:PM)',
  'Day of Week',
  'Week of Month',
  'Vehicle Capacity',
] as const;

export const DERIVED_FEATURE_NAMES = [
  'Historical Avg Demand',
  'Recent 7-Day Trend',
  'Previous Same-Day Lag',
  'Cancellation Rate',
] as const;

export const FEATURE_NAMES = [
  ...RAW_FEATURE_NAMES,
  ...DERIVED_FEATURE_NAMES,
] as const;

export interface FeatureMatrix {
  X: number[][]; // N x 9 feature matrix
  y: number[];   // N target actual demand values
  featureNames: string[];
  rawFeatureNames: string[];
  derivedFeatureNames: string[];
  routeMapping: Record<string, number>;
  records: HistoricalTripRecord[];
}

export interface PredictionInput {
  routeCode: string;
  shift: 'MORNING_PICKUP' | 'EVENING_DROP';
  date: string; // YYYY-MM-DD
  vehicleCapacity: number;
}

/**
 * Builds a chronological lookup table of past records to compute rolling averages
 * and lag features for each route + shift combination.
 */
export function extractFeatureMatrix(records: HistoricalTripRecord[]): FeatureMatrix {
  if (!records || records.length === 0) {
    return {
      X: [],
      y: [],
      featureNames: [...FEATURE_NAMES],
      rawFeatureNames: [...RAW_FEATURE_NAMES],
      derivedFeatureNames: [...DERIVED_FEATURE_NAMES],
      routeMapping: {},
      records: [],
    };
  }

  // 1. Sort records chronologically
  const sorted = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // 2. Discover unique route codes and map to integer index
  const routeMapping: Record<string, number> = {};
  let nextIdx = 0;
  for (const r of sorted) {
    if (routeMapping[r.routeCode] === undefined) {
      routeMapping[r.routeCode] = nextIdx++;
    }
  }

  // 3. Track historical metrics per (route + shift)
  const historyMap: Record<
    string,
    {
      demands: { date: string; dayOfWeek: number; demand: number; cancellations: number; scheduled: number }[];
    }
  > = {};

  const X: number[][] = [];
  const y: number[] = [];
  const validRecords: HistoricalTripRecord[] = [];

  for (const r of sorted) {
    const key = `${r.routeCode}_${r.shift}`;
    if (!historyMap[key]) {
      historyMap[key] = { demands: [] };
    }

    const past = historyMap[key].demands;

    let histAvg = r.actualDemand;
    let recentTrend7d = r.actualDemand;
    let prevSameDay = r.actualDemand;
    let cancellationRate = 0.05;

    if (past.length > 0) {
      const allDemands = past.map((p) => p.demand);
      histAvg = allDemands.reduce((a, b) => a + b, 0) / allDemands.length;

      const recentPast = past.slice(-7);
      recentTrend7d =
        recentPast.map((p) => p.demand).reduce((a, b) => a + b, 0) /
        recentPast.length;

      // Find demand on same day of week closest to 7 days ago
      const sameDayEntries = past.filter((p) => p.dayOfWeek === r.dayOfWeek);
      if (sameDayEntries.length > 0) {
        prevSameDay = sameDayEntries[sameDayEntries.length - 1].demand;
      } else {
        prevSameDay = histAvg;
      }

      const totalScheduled = past.reduce((sum, p) => sum + p.scheduled, 0);
      const totalCancellations = past.reduce((sum, p) => sum + p.cancellations, 0);
      cancellationRate =
        totalScheduled > 0 ? totalCancellations / totalScheduled : 0.05;
    }

    const routeIdx = routeMapping[r.routeCode] ?? 0;
    const shiftIdx = r.shift === 'MORNING_PICKUP' ? 0 : 1;

    const featureVector = [
      routeIdx,
      shiftIdx,
      r.dayOfWeek,
      r.weekOfMonth,
      r.vehicleCapacity,
      parseFloat(histAvg.toFixed(2)),
      parseFloat(recentTrend7d.toFixed(2)),
      parseFloat(prevSameDay.toFixed(2)),
      parseFloat(cancellationRate.toFixed(4)),
    ];

    X.push(featureVector);
    y.push(r.actualDemand);
    validRecords.push(r);

    past.push({
      date: r.date,
      dayOfWeek: r.dayOfWeek,
      demand: r.actualDemand,
      cancellations: r.cancellations,
      scheduled: r.scheduledBookings,
    });
  }

  return {
    X,
    y,
    featureNames: [...FEATURE_NAMES],
    rawFeatureNames: [...RAW_FEATURE_NAMES],
    derivedFeatureNames: [...DERIVED_FEATURE_NAMES],
    routeMapping,
    records: validRecords,
  };
}

/**
 * Prepares an inference feature vector for an upcoming future trip.
 */
export function buildInferenceFeatureVector(
  input: PredictionInput,
  historyRecords: HistoricalTripRecord[],
  routeMapping: Record<string, number>
): number[] {
  const tripDate = new Date(input.date);
  const dayOfWeek = tripDate.getDay();
  const weekOfMonth = Math.min(5, Math.ceil(tripDate.getDate() / 7));

  const matchingPast = (historyRecords || [])
    .filter((r) => r.routeCode === input.routeCode && r.shift === input.shift)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let histAvg = input.vehicleCapacity * 0.75;
  let recentTrend7d = histAvg;
  let prevSameDay = histAvg;
  let cancellationRate = 0.05;

  if (matchingPast.length > 0) {
    const allDemands = matchingPast.map((p) => p.actualDemand);
    histAvg = allDemands.reduce((a, b) => a + b, 0) / allDemands.length;

    const recentPast = matchingPast.slice(-7);
    recentTrend7d =
      recentPast.map((p) => p.actualDemand).reduce((a, b) => a + b, 0) /
      recentPast.length;

    const sameDayEntries = matchingPast.filter((p) => p.dayOfWeek === dayOfWeek);
    if (sameDayEntries.length > 0) {
      prevSameDay = sameDayEntries[sameDayEntries.length - 1].actualDemand;
    } else {
      prevSameDay = histAvg;
    }

    const totalScheduled = matchingPast.reduce(
      (sum, p) => sum + p.scheduledBookings,
      0
    );
    const totalCancellations = matchingPast.reduce(
      (sum, p) => sum + p.cancellations,
      0
    );
    cancellationRate =
      totalScheduled > 0 ? totalCancellations / totalScheduled : 0.05;
  }

  const routeIdx = routeMapping[input.routeCode] ?? 0;
  const shiftIdx = input.shift === 'MORNING_PICKUP' ? 0 : 1;

  return [
    routeIdx,
    shiftIdx,
    dayOfWeek,
    weekOfMonth,
    input.vehicleCapacity,
    parseFloat(histAvg.toFixed(2)),
    parseFloat(recentTrend7d.toFixed(2)),
    parseFloat(prevSameDay.toFixed(2)),
    parseFloat(cancellationRate.toFixed(4)),
  ];
}
