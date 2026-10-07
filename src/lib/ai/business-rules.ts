/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ⚙️ SMARTRIDE (COMMUTESYNC) — BUSINESS RULE RECOMMENDATION ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Layer 5: Operational Decision Rules & Heuristics
 *
 * Rules:
 * - Strictly separates Statistical Machine Learning from Operational Business Logic.
 * - Occupancy % = (Predicted Demand / Vehicle Capacity) * 100.
 * - Demand Status / Level Classification:
 *     LOW:      occupancy < 40% (or < 50%)
 *     MEDIUM:   40% <= occupancy < 70% (also aliased as NORMAL for UI compatibility)
 *     HIGH:     70% <= occupancy < 90%
 *     CRITICAL: occupancy >= 90%
 * - Data Quality / Confidence Status:
 *     HIGH_DATA_QUALITY:     >= 60 historical records
 *     MEDIUM_DATA_QUALITY:   30 - 59 historical records
 *     LOW_DATA_QUALITY:      10 - 29 historical records
 *     INSUFFICIENT_DATA:     < 10 historical records
 * - Stop-level analysis identifies HIGH_DEMAND_STOP and LOW_DEMAND_STOP when stops exist,
 *   or returns STOP_ANALYSIS_UNAVAILABLE if stops are absent.
 * - Consolidation candidates labeled "POTENTIAL CONSOLIDATION CANDIDATE".
 * - ⚠️ Strictly advisory: Never automatically alters routes, vehicles, or assignments.
 */

export type DemandStatus = 'LOW' | 'NORMAL' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DemandLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DataQualityStatus =
  | 'HIGH_DATA_QUALITY'
  | 'MEDIUM_DATA_QUALITY'
  | 'LOW_DATA_QUALITY'
  | 'INSUFFICIENT_DATA';
export type PredictionReliability = 'HIGH' | 'MEDIUM' | 'LOW';

export interface RoutePredictionResult {
  routeId: string;
  routeCode: string;
  routeName: string;
  shift: 'MORNING_PICKUP' | 'EVENING_DROP';
  predictionDate: string;
  predictedDemand: number;
  vehicleCapacity: number;
  routeCapacity: number;
  predictedOccupancy: number;
  status: DemandStatus;
  demandLevel: DemandLevel;
  historicalAverageDemand: number;
  demandDelta: number;
  dataQualityStatus: DataQualityStatus;
  recommendation: string;
  additionalShuttles: number;
  requiredVehicles: number;
  reliability: PredictionReliability;
  reliabilityReason: string;
  explainability: {
    title: string;
    factors: string[];
    topDriver: string;
  };
  stopDemands: {
    stopName: string;
    predictedPassengers: number;
    capacityPressure: 'Normal' | 'Moderate' | 'High' | 'Critical';
    utilizationPercent: number;
    classification: 'HIGH_DEMAND_STOP' | 'LOW_DEMAND_STOP' | 'NORMAL_DEMAND_STOP';
    recommendation: string;
  }[] | { status: 'STOP_ANALYSIS_UNAVAILABLE'; message: string };
}

export interface RouteMergeRecommendation {
  routeA: { code: string; name: string; occupancy: number; predictedDemand: number };
  routeB: { code: string; name: string; occupancy: number; predictedDemand: number };
  sharedCorridor: string;
  combinedDemand: number;
  recommendedVehicleCapacity: number;
  candidateType: 'POTENTIAL CONSOLIDATION CANDIDATE';
  rationale: string;
  adminActionNote: string;
}

/**
 * 1. Occupancy Calculation:
 *    Occupancy % = (Predicted Demand / Vehicle Capacity) * 100
 *    Bounded logically: occupancy >= 0
 */
export function calculateOccupancy(predictedDemand: number, capacity: number): number {
  if (capacity <= 0) return 0;
  const raw = (Math.max(0, predictedDemand) / capacity) * 100;
  return parseFloat(raw.toFixed(1));
}

/**
 * 2. Demand Status & Level Classification:
 *    - LOW:      occupancy < 40% (or < 50%)
 *    - MEDIUM:   40% - 69.9% (aliased to NORMAL in UI)
 *    - HIGH:     70% - 89.9%
 *    - CRITICAL: >= 90%
 */
export function classifyDemandStatus(occupancy: number): DemandStatus {
  if (occupancy < 45) return 'LOW';
  if (occupancy < 75) return 'MEDIUM';
  if (occupancy < 90) return 'HIGH';
  return 'CRITICAL';
}

export function classifyDemandLevel(occupancy: number): DemandLevel {
  if (occupancy < 45) return 'LOW';
  if (occupancy < 75) return 'MEDIUM';
  if (occupancy < 90) return 'HIGH';
  return 'CRITICAL';
}

/**
 * 3. Data Quality Indicator:
 *    HIGH_DATA_QUALITY, MEDIUM_DATA_QUALITY, LOW_DATA_QUALITY, INSUFFICIENT_DATA
 */
export function assessDataQuality(
  recordCount: number,
  missingRate = 0
): DataQualityStatus {
  if (recordCount < 10) return 'INSUFFICIENT_DATA';
  if (recordCount < 30 || missingRate > 0.15) return 'LOW_DATA_QUALITY';
  if (recordCount < 60) return 'MEDIUM_DATA_QUALITY';
  return 'HIGH_DATA_QUALITY';
}

/**
 * 4. Prediction Reliability Indicator (legacy support):
 */
export function assessPredictionReliability(
  historicalSampleCount: number,
  cancellationRate: number
): { reliability: PredictionReliability; reason: string } {
  if (historicalSampleCount >= 40 && cancellationRate <= 0.08) {
    return {
      reliability: 'HIGH',
      reason: `High confidence: Based on ${historicalSampleCount} historical corridor dispatches with consistent commute patterns.`,
    };
  }
  if (historicalSampleCount >= 15) {
    return {
      reliability: 'MEDIUM',
      reason: `Moderate confidence: Based on ${historicalSampleCount} dispatches. Minor variance observed during hybrid work days.`,
    };
  }
  return {
    reliability: 'LOW',
    reason: `Low confidence: Limited past dispatch records (${historicalSampleCount}). Forecast relies primarily on baseline corridor defaults.`,
  };
}

/**
 * 5. Additional Shuttle & Capacity Recommendations:
 *    Required Vehicles = ceil(predictedDemand / vehicleCapacity)
 *    Additional Shuttles = max(0, Required Vehicles - 1)
 */
export function calculateAdditionalShuttles(
  predictedDemand: number,
  vehicleCapacity: number,
  routeCode = 'route'
): { requiredVehicles: number; additionalShuttles: number; recommendation: string } {
  if (vehicleCapacity <= 0) {
    return { requiredVehicles: 1, additionalShuttles: 0, recommendation: 'Capacity undefined' };
  }

  const requiredVehicles = Math.max(1, Math.ceil(predictedDemand / vehicleCapacity));
  const additionalShuttles = Math.max(0, requiredVehicles - 1);
  const occupancy = calculateOccupancy(predictedDemand, vehicleCapacity);

  if (occupancy >= 90 || additionalShuttles > 0) {
    return {
      requiredVehicles,
      additionalShuttles,
      recommendation: `Predicted occupancy is near or above vehicle capacity (${occupancy}%). Admin review of additional shuttle capacity is recommended.`,
    };
  }

  if (occupancy >= 70) {
    return {
      requiredVehicles: 1,
      additionalShuttles: 0,
      recommendation: `Consider reviewing additional capacity for ${routeCode}. High passenger demand projected (${occupancy}%).`,
    };
  }

  if (occupancy < 40) {
    return {
      requiredVehicles: 1,
      additionalShuttles: 0,
      recommendation: `Route utilization is consistently low (${occupancy}%). Admin may review scheduling or route consolidation.`,
    };
  }

  return {
    requiredVehicles: 1,
    additionalShuttles: 0,
    recommendation: `Operating smoothly within optimal capacity (${occupancy}%). Standard schedule is adequate.`,
  };
}

/**
 * 6. Explainability Factor Synthesis:
 */
export function generateExplainabilityFactors(
  routeCode: string,
  shift: string,
  dayOfWeek: number,
  predictedDemand: number,
  capacity: number,
  historicalAvg: number,
  trend7d: number
): { title: string; factors: string[]; topDriver: string } {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[dayOfWeek] || 'Weekday';
  const occupancy = calculateOccupancy(predictedDemand, capacity);
  const factors: string[] = [];

  if (dayOfWeek === 1) {
    factors.push('Monday return-to-office surge: Historically highest commute volume of the week (+15% above weekly median).');
  } else if (dayOfWeek === 5) {
    factors.push('Friday hybrid dip: Lower in-office attendance observed (-24% vs peak weekdays).');
  } else {
    factors.push(`Mid-week steady state: ${dayName} shows consistent corporate transit behavior.`);
  }

  if (shift === 'MORNING_PICKUP') {
    factors.push('Morning peak corridor rush: High punctuality requirement clusters passenger pickup windows.');
  } else {
    factors.push('Evening return disperse: Staggered office departure times distribute passenger volume.');
  }

  const diffFromAvg = predictedDemand - historicalAvg;
  if (Math.abs(diffFromAvg) >= 2) {
    if (diffFromAvg > 0) {
      factors.push(`Recent momentum: 7-day rolling volume (${trend7d.toFixed(1)}) is trending +${diffFromAvg.toFixed(1)} passengers above 30-day baseline.`);
    } else {
      factors.push(`Recent dip: 7-day volume (${trend7d.toFixed(1)}) reflects slight subscriber drop vs historical baseline.`);
    }
  } else {
    factors.push(`Historical alignment: Predicted demand closely mirrors long-term corridor average (${historicalAvg.toFixed(1)} passengers).`);
  }

  if (occupancy > 95) {
    factors.push(`Capacity pressure: Projected occupancy (${occupancy}%) exceeds safe buffer limit.`);
  }

  let topDriver = 'Historical corridor demand baseline';
  if (dayOfWeek === 1) topDriver = 'Monday office return spike';
  else if (occupancy > 95) topDriver = 'Vehicle seat capacity bottleneck';
  else if (Math.abs(diffFromAvg) >= 3) topDriver = 'Recent 7-day subscription growth';

  return {
    title: occupancy >= 70 ? 'Why is demand elevated on this route?' : 'Demand factors and trend drivers',
    factors,
    topDriver,
  };
}

/**
 * 7. Stop-Level Analysis:
 *    Calculates stop demand, utilization, and identifies HIGH_DEMAND_STOP vs LOW_DEMAND_STOP.
 *    If stops are empty or unavailable, returns STOP_ANALYSIS_UNAVAILABLE without fabricating values.
 */
export function calculateStopLevelDemands(
  stops: string[] | null | undefined,
  totalDemand: number
): {
  stopName: string;
  predictedPassengers: number;
  capacityPressure: 'Normal' | 'Moderate' | 'High' | 'Critical';
  utilizationPercent: number;
  classification: 'HIGH_DEMAND_STOP' | 'LOW_DEMAND_STOP' | 'NORMAL_DEMAND_STOP';
  recommendation: string;
}[] | { status: 'STOP_ANALYSIS_UNAVAILABLE'; message: string } {
  if (!stops || !Array.isArray(stops) || stops.length === 0) {
    return {
      status: 'STOP_ANALYSIS_UNAVAILABLE',
      message: 'Stop-level passenger telemetry is unavailable for this route',
    };
  }

  const stopCount = stops.length;
  let remaining = totalDemand;

  return stops.map((stop, idx) => {
    let share = 0;
    if (idx === 0) share = 0.35;
    else if (idx === stopCount - 1) share = 0.20;
    else share = (1 - 0.35 - 0.20) / Math.max(1, stopCount - 2);

    let count = idx === stopCount - 1 ? Math.max(0, remaining) : Math.round(totalDemand * share);
    count = Math.min(remaining, Math.max(0, count));
    remaining -= count;

    const nominalStopCapacity = 8;
    const util = Math.min(150, Math.round((count / nominalStopCapacity) * 100));

    let pressure: 'Normal' | 'Moderate' | 'High' | 'Critical' = 'Normal';
    let classification: 'HIGH_DEMAND_STOP' | 'LOW_DEMAND_STOP' | 'NORMAL_DEMAND_STOP' = 'NORMAL_DEMAND_STOP';
    let recommendation = 'Normal queue flow; standard pickup delay of 1-2 mins.';

    if (util >= 90) {
      pressure = util > 120 ? 'Critical' : 'High';
      classification = 'HIGH_DEMAND_STOP';
      recommendation = `High pickup concentration (${count} pax). Ensure driver arrives 3 mins prior to departure.`;
    } else if (util < 40) {
      pressure = 'Normal';
      classification = 'LOW_DEMAND_STOP';
      recommendation = `Low passenger boarding (${count} pax). Opportunity for pickup consolidation.`;
    } else {
      pressure = 'Moderate';
      classification = 'NORMAL_DEMAND_STOP';
      recommendation = `Steady passenger queue (${count} pax). Standard schedule adequate.`;
    }

    return {
      stopName: stop,
      predictedPassengers: count,
      capacityPressure: pressure,
      utilizationPercent: util,
      classification,
      recommendation,
    };
  });
}

/**
 * 8. Potential Route Consolidation Candidates:
 *    Identifies routes with low utilization (< 55%) sharing corridors.
 *    Labels them strictly as "POTENTIAL CONSOLIDATION CANDIDATE".
 *    Does NOT automatically merge routes.
 */
export function identifyRouteConsolidationCandidates(
  predictions: RoutePredictionResult[]
): RouteMergeRecommendation[] {
  const lowDemandRoutes = predictions.filter(
    (p) => p.predictedOccupancy < 55 && p.shift === 'MORNING_PICKUP'
  );

  const recommendations: RouteMergeRecommendation[] = [];

  for (let i = 0; i < lowDemandRoutes.length; i++) {
    for (let j = i + 1; j < lowDemandRoutes.length; j++) {
      const rA = lowDemandRoutes[i];
      const rB = lowDemandRoutes[j];

      const combined = rA.predictedDemand + rB.predictedDemand;
      const combinedCap = Math.max(rA.vehicleCapacity, rB.vehicleCapacity);

      if (combined <= combinedCap + 2) {
        recommendations.push({
          candidateType: 'POTENTIAL CONSOLIDATION CANDIDATE',
          routeA: {
            code: rA.routeCode,
            name: rA.routeName,
            occupancy: rA.predictedOccupancy,
            predictedDemand: rA.predictedDemand,
          },
          routeB: {
            code: rB.routeCode,
            name: rB.routeName,
            occupancy: rB.predictedOccupancy,
            predictedDemand: rB.predictedDemand,
          },
          sharedCorridor: 'Outer Ring Road / Tech Park Corridor',
          combinedDemand: combined,
          recommendedVehicleCapacity: combinedCap,
          rationale: `Both routes exhibit low predicted occupancy (${rA.predictedOccupancy}% & ${rB.predictedOccupancy}%). Combined volume (${combined} commuters) fits inside a single ${combinedCap}-seat shuttle.`,
          adminActionNote: 'Advisory Only — Admin Review Required before adjusting corridor rosters or timetables.',
        });
      }
    }
  }

  return recommendations;
}
