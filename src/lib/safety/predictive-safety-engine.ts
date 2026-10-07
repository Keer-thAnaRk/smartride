/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🛡️ SMARTRIDE — PREDICTIVE SAFETY INTELLIGENCE ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 4: Explainable, deterministic statistical risk trajectory estimation.
 *
 * Rules:
 * - Purely analytical and deterministic linear regression forecasting.
 * - Based strictly on real historical RouteRiskSnapshot observations.
 * - Zero artificial or synthetic data; zero LLM-generated predictions.
 * - Minimum observation requirement: at least 3 chronological snapshots.
 * - Slope thresholds:
 *     slope >= +2.0  -> RISING
 *     slope <= -2.0  -> FALLING
 *     otherwise      -> STABLE
 * - Forecast scores strictly bounded to [0, 100].
 * - Projected risk level maps strictly to Step 1 thresholds (0-24 LOW, 25-49 MED, 50-74 HIGH, 75-100 CRIT).
 * - Dominant risk driver derived from real factor slope increases (or NO_DOMINANT_DRIVER).
 * - Statistically derived confidence: HIGH | MEDIUM | LOW.
 * - Mandatory disclaimer: statistical trajectory estimate, not a guarantee of future incidents.
 */

import { RouteRiskSnapshot } from '@/lib/safety/route-risk-history-store';
import { RouteRiskLevel } from '@/lib/safety/route-risk-engine';

export type PredictiveTrendStatus = 'INSUFFICIENT_HISTORY' | 'RISING' | 'FALLING' | 'STABLE';
export type ProjectionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface FactorTrends {
  emergency: 'RISING' | 'FALLING' | 'STABLE';
  deviation: 'RISING' | 'FALLING' | 'STABLE';
  speed: 'RISING' | 'FALLING' | 'STABLE';
  stopGps: 'RISING' | 'FALLING' | 'STABLE';
  compliance: 'RISING' | 'FALLING' | 'STABLE';
  complexity: 'RISING' | 'FALLING' | 'STABLE';
}

export interface FactorDetail {
  key: keyof FactorTrends;
  label: string;
  slope: number;
  currentPoints: number;
  averagePoints: number;
  trend: 'RISING' | 'FALLING' | 'STABLE';
}

export interface HistoricalScorePoint {
  evaluatedAt: string;
  riskScore: number;
}

export interface PredictiveSafetyProjection {
  routeId: string;
  routeCode: string;
  routeName: string;
  predictionStatus: PredictiveTrendStatus;
  currentScore: number;
  currentRiskLevel: RouteRiskLevel;
  historicalSnapshotCount: number;
  trendDirection: 'RISING' | 'FALLING' | 'STABLE';
  slope: number;
  intercept: number;
  rSquared: number;
  projectionConfidence: ProjectionConfidence;
  projectedScore: number;
  projectedRiskLevel: RouteRiskLevel;
  dominantRiskDriver: string;
  factorTrends: FactorTrends;
  factorDetails?: FactorDetail[];
  historicalScores: HistoricalScorePoint[];
  evaluatedAt: string;
  explanation: string;
  disclaimer: string;
  message?: string;
}

export interface InsufficientHistoryProjection {
  predictionStatus: 'INSUFFICIENT_HISTORY';
  historicalSnapshotCount: number;
  message: string;
}

export interface PredictiveSafetyResult {
  success: boolean;
  prediction: PredictiveSafetyProjection | InsufficientHistoryProjection;
}

export const MIN_HISTORICAL_SNAPSHOTS = 3;
export const PREDICTIVE_DISCLAIMER =
  'This projection is based on observed historical route-risk scores. It is a statistical trajectory estimate, not a prediction of a specific safety incident.';

/**
 * Maps a numerical risk score (0-100) to the standard Step 1 RouteRiskLevel.
 */
export function mapScoreToRiskLevel(score: number): RouteRiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

/**
 * Calculates Ordinary Least Squares (OLS) linear regression:
 * y = slope * x + intercept
 */
export function calculateLinearRegression(values: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
  variance: number;
} {
  const n = values.length;
  if (n < 2) {
    return { slope: 0, intercept: values[0] || 0, rSquared: 0, variance: 0 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n, rSquared: 0, variance: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R^2 and variance
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < n; i++) {
    const y = values[i];
    const yPred = slope * i + intercept;
    ssTot += Math.pow(y - meanY, 2);
    ssRes += Math.pow(y - yPred, 2);
  }

  const variance = ssTot / (n - 1);
  let rSquared = 0;
  if (ssTot > 0.0001) {
    rSquared = Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  } else {
    // If all y values are identical, variance is 0 and linear line is a perfect flat fit
    rSquared = 1.0;
  }

  return {
    slope: Math.round(slope * 100) / 100,
    intercept: Math.round(intercept * 100) / 100,
    rSquared: Math.round(rSquared * 100) / 100,
    variance: Math.round(variance * 100) / 100,
  };
}

/**
 * Evaluates factor trajectories across the 6 core safety dimensions.
 */
export function analyzeFactorTrends(snapshots: RouteRiskSnapshot[]): {
  factorTrends: FactorTrends;
  factorDetails: FactorDetail[];
  dominantRiskDriver: string;
} {
  const definitions: Array<{
    key: keyof FactorTrends;
    field: keyof RouteRiskSnapshot;
    label: string;
  }> = [
    { key: 'emergency', field: 'emergencyPoints', label: 'Emergency Incidents' },
    { key: 'deviation', field: 'deviationPoints', label: 'Route Deviations' },
    { key: 'speed', field: 'speedPoints', label: 'Speed Anomalies' },
    { key: 'stopGps', field: 'stopGpsPoints', label: 'Stationary Stops & Telemetry' },
    { key: 'compliance', field: 'compliancePoints', label: 'Driver Compliance' },
    { key: 'complexity', field: 'complexityPoints', label: 'Route Complexity' },
  ];

  const factorTrends: FactorTrends = {
    emergency: 'STABLE',
    deviation: 'STABLE',
    speed: 'STABLE',
    stopGps: 'STABLE',
    compliance: 'STABLE',
    complexity: 'STABLE',
  };

  const factorDetails: FactorDetail[] = [];
  let highestPositiveSlope = 0;
  let dominantDriver = 'NO_DOMINANT_DRIVER';

  for (const def of definitions) {
    const values = snapshots.map((s) => Number(s[def.field]) || 0);
    const { slope } = calculateLinearRegression(values);
    const currentPoints = values[values.length - 1];
    const averagePoints = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

    let trend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
    if (slope >= 0.5) {
      trend = 'RISING';
    } else if (slope <= -0.5) {
      trend = 'FALLING';
    }

    factorTrends[def.key] = trend;
    factorDetails.push({
      key: def.key,
      label: def.label,
      slope,
      currentPoints,
      averagePoints,
      trend,
    });

    if (slope > 0 && slope > highestPositiveSlope) {
      highestPositiveSlope = slope;
      dominantDriver = def.label;
    }
  }

  return { factorTrends, factorDetails, dominantRiskDriver: dominantDriver };
}

/**
 * Derives explainable statistical narrative for the trajectory.
 */
function generateTrajectoryExplanation(
  slope: number,
  rSquared: number,
  projectedScore: number,
  projectedRiskLevel: RouteRiskLevel,
  dominantDriver: string,
  snapshotCount: number
): string {
  let narrative = '';
  if (slope >= 2.0) {
    narrative = `Observed route-risk scores have been increasing across the latest ${snapshotCount} snapshots (slope: +${slope} pts/eval).`;
  } else if (slope <= -2.0) {
    narrative = `Observed route-risk scores have been decreasing across the latest ${snapshotCount} snapshots (slope: ${slope} pts/eval).`;
  } else {
    narrative = `Observed route-risk scores have remained relatively stable across the latest ${snapshotCount} snapshots (slope: ${slope >= 0 ? '+' : ''}${slope} pts/eval).`;
  }

  if (dominantDriver !== 'NO_DOMINANT_DRIVER') {
    narrative += ` Primary upward trajectory driver: ${dominantDriver}.`;
  }

  narrative += ` Based on historical least-squares regression (R²: ${rSquared}), projected score for next observation is ${projectedScore}/100 (${projectedRiskLevel}).`;
  return narrative;
}

/**
 * Pure, deterministic function to calculate safety risk projection.
 *
 * Implements Step 4 requirements:
 * - Minimum 3 snapshots.
 * - Slope thresholds: >= +2 RISING, <= -2 FALLING, otherwise STABLE.
 * - Projected score clamped to [0, 100].
 * - Projected risk level mapped using Step 1 thresholds.
 * - Dominant risk driver derived from real factor changes.
 * - Projection confidence: HIGH | MEDIUM | LOW.
 */
export function calculateSafetyRiskProjection(
  snapshots: RouteRiskSnapshot[],
  routeInfo?: { id: string; code: string; name: string }
): PredictiveSafetyResult {
  const fallbackRoute = {
    id: snapshots?.[0]?.routeId || routeInfo?.id || 'UNKNOWN',
    code: snapshots?.[0]?.routeCode || routeInfo?.code || 'UNKNOWN',
    name: snapshots?.[0]?.routeName || routeInfo?.name || 'Corridor Route',
  };
  const route = routeInfo || fallbackRoute;

  // 1. Minimum snapshots validation
  if (!snapshots || snapshots.length < MIN_HISTORICAL_SNAPSHOTS) {
    return {
      success: true,
      prediction: {
        predictionStatus: 'INSUFFICIENT_HISTORY',
        historicalSnapshotCount: snapshots ? snapshots.length : 0,
        message: 'At least 3 historical route-risk snapshots are required to estimate a risk trajectory.',
      },
    };
  }

  // 2. Sort snapshots chronologically
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.evaluatedAt).getTime() - new Date(b.evaluatedAt).getTime()
  );

  const n = sorted.length;
  const currentSnapshot = sorted[n - 1];
  const currentScore = currentSnapshot.riskScore;
  const currentRiskLevel = currentSnapshot.riskLevel || mapScoreToRiskLevel(currentScore);

  // 3. Extract scores & perform linear regression
  const scores = sorted.map((s) => s.riskScore);
  const { slope, intercept, rSquared, variance } = calculateLinearRegression(scores);

  // 4. Trend Direction & Prediction Status
  let trendDirection: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
  if (slope >= 2.0) {
    trendDirection = 'RISING';
  } else if (slope <= -2.0) {
    trendDirection = 'FALLING';
  }

  const predictionStatus: PredictiveTrendStatus = trendDirection;

  // 5. Projected Score (next observation at index x = n)
  const rawProjected = slope * n + intercept;
  const projectedScore = Math.max(0, Math.min(100, Math.round(rawProjected)));
  const projectedRiskLevel = mapScoreToRiskLevel(projectedScore);

  // 6. Projection Confidence (HIGH | MEDIUM | LOW)
  let projectionConfidence: ProjectionConfidence = 'MEDIUM';
  if (variance === 0) {
    // Perfectly static baseline indicates consistent stability
    projectionConfidence = 'HIGH';
  } else if (rSquared >= 0.70 && n >= 5) {
    projectionConfidence = 'HIGH';
  } else if (rSquared < 0.35 || n === 3) {
    projectionConfidence = 'LOW';
  } else {
    projectionConfidence = 'MEDIUM';
  }

  // 7. Factor Trends & Dominant Risk Driver
  const { factorTrends, factorDetails, dominantRiskDriver } = analyzeFactorTrends(sorted);

  // 8. Historical Scores series
  const historicalScores: HistoricalScorePoint[] = sorted.map((s) => ({
    evaluatedAt: s.evaluatedAt,
    riskScore: s.riskScore,
  }));

  // 9. Statistically cautious explanation
  const explanation = generateTrajectoryExplanation(
    slope,
    rSquared,
    projectedScore,
    projectedRiskLevel,
    dominantRiskDriver,
    n
  );

  const prediction: PredictiveSafetyProjection = {
    routeId: route.id,
    routeCode: route.code,
    routeName: route.name,
    predictionStatus,
    currentScore,
    currentRiskLevel,
    historicalSnapshotCount: n,
    trendDirection,
    slope,
    intercept,
    rSquared,
    projectionConfidence,
    projectedScore,
    projectedRiskLevel,
    dominantRiskDriver,
    factorTrends,
    factorDetails,
    historicalScores,
    evaluatedAt: new Date().toISOString(),
    explanation,
    disclaimer: PREDICTIVE_DISCLAIMER,
  };

  return {
    success: true,
    prediction,
  };
}

/**
 * Backward compatibility wrapper for existing callers.
 */
export function predictRouteSafety(
  snapshots: RouteRiskSnapshot[],
  routeInfo?: { id: string; code: string; name: string }
) {
  const result = calculateSafetyRiskProjection(snapshots, routeInfo);
  if (result.prediction.predictionStatus === 'INSUFFICIENT_HISTORY') {
    return {
      success: true,
      status: 'INSUFFICIENT_HISTORY' as const,
      route: routeInfo || { id: 'UNKNOWN', code: 'UNKNOWN', name: 'Unknown' },
      forecast: null,
      message: (result.prediction as InsufficientHistoryProjection).message,
    };
  }

  const p = result.prediction as PredictiveSafetyProjection;
  return {
    success: true,
    status: 'SUFFICIENT_DATA' as const,
    route: { id: p.routeId, code: p.routeCode, name: p.routeName },
    forecast: {
      routeId: p.routeId,
      routeCode: p.routeCode,
      routeName: p.routeName,
      currentRiskScore: p.currentScore,
      currentRiskLevel: p.currentRiskLevel,
      forecastScore: p.projectedScore,
      forecastRiskLevel: p.projectedRiskLevel,
      forecastHorizon: 'NEXT_EVALUATION' as const,
      confidence: p.projectionConfidence === 'HIGH' ? 85 : p.projectionConfidence === 'MEDIUM' ? 65 : 45,
      trendDirection: p.trendDirection,
      historicalSnapshots: p.historicalSnapshotCount,
      scoreSlope: p.slope,
      volatility: 0,
      contributingFactors: p.factorDetails || [],
      historicalSeries: p.historicalScores.map((h, i) => ({
        id: `snap-${i}`,
        evaluatedAt: h.evaluatedAt,
        riskScore: h.riskScore,
        riskLevel: mapScoreToRiskLevel(h.riskScore),
      })),
      explanation: p.explanation,
      generatedAt: p.evaluatedAt,
      disclaimer: p.disclaimer,
    },
  };
}
