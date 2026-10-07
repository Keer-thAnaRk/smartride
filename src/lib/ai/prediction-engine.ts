/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🤖 SMARTRIDE — AI DEMAND PREDICTION ORCHESTRATION ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Phase 3 Step 5: Shared orchestration service for corridor demand forecasting.
 * 
 * Reusable by both /api/ai/demand-prediction and the Step 6 Operational
 * Decision Support Center.
 */

import {
  generateHistoricalCommuteData,
  prepareDemandDataset,
  loadRealPlatformMobilityData,
  KNOWN_CORRIDOR_ROUTES,
  MIN_TRAINING_RECORDS,
} from '@/lib/ai/historical-data';
import {
  extractFeatureMatrix,
  buildInferenceFeatureVector,
} from '@/lib/ai/feature-engineering';
import { trainAndEvaluateDemandModel, TrainedModelResult } from '@/lib/ai/evaluation';
import {
  calculateOccupancy,
  classifyDemandStatus,
  classifyDemandLevel,
  calculateAdditionalShuttles,
  assessPredictionReliability,
  assessDataQuality,
  generateExplainabilityFactors,
  calculateStopLevelDemands,
  identifyRouteConsolidationCandidates,
  RoutePredictionResult,
} from '@/lib/ai/business-rules';
import prisma from '@/lib/prisma';
import {
  saveAIDemandPrediction,
  getAllRoutes,
} from '@/lib/firestore-db';

// Singleton in-memory cache for trained model in development
let cachedModelResult: TrainedModelResult | null = null;
let cachedHistoricalData = generateHistoricalCommuteData(60, 42);

export function getOrTrainModel(nEstimators: number = 25): TrainedModelResult {
  if (cachedModelResult && cachedModelResult.model.isTrained) {
    return cachedModelResult;
  }
  const featureMatrix = extractFeatureMatrix(cachedHistoricalData);
  cachedModelResult = trainAndEvaluateDemandModel(featureMatrix, nEstimators);
  return cachedModelResult;
}

export function resetModelCache(freshHistoricalData?: any[], modelResult?: TrainedModelResult) {
  if (freshHistoricalData) {
    cachedHistoricalData = freshHistoricalData;
  }
  if (modelResult) {
    cachedModelResult = modelResult;
  }
}

export interface DemandPredictionOptions {
  routeParam?: string | null;
  requireRealData?: boolean;
}

export interface DemandPredictionPipelineResult {
  success: boolean;
  status: 'SUCCESS' | 'INSUFFICIENT_DATA';
  message?: string;
  requiredRecords?: number;
  availableRecords?: number;
  cleaningReport?: any;
  summary?: {
    forecastDate: string;
    totalPredictedDemand: number;
    expectedOccupancy: number;
    highDemandRoutes: number;
    criticalDemandRoutes: number;
    additionalShuttlesRecommended: number;
    routesAnalyzed: number;
  };
  weeklyForecast?: Array<{
    day: string;
    historicalDemand: number;
    predictedDemand: number;
  }>;
  routePredictions: RoutePredictionResult[];
  topStopDemands?: any[];
  consolidationRecommendations?: any[];
  modelMetrics?: any;
}

/**
 * Runs the end-to-end demand prediction pipeline for all or a filtered corridor route.
 */
export async function runDemandPredictionPipeline(
  options: DemandPredictionOptions = {}
): Promise<DemandPredictionPipelineResult> {
  const { routeParam, requireRealData = false } = options;

  // 1. Check real platform records if strictly required
  if (requireRealData) {
    const realData = await loadRealPlatformMobilityData();
    if (!realData.isSufficient) {
      return {
        success: true,
        status: 'INSUFFICIENT_DATA',
        message: 'Not enough historical mobility records are available to train a reliable demand model.',
        requiredRecords: MIN_TRAINING_RECORDS,
        availableRecords: realData.availableRecords,
        cleaningReport: realData.cleaningReport,
        routePredictions: [],
      };
    }
  }

  // 2. Ensure model is trained & evaluated
  const { model, metrics, routeMapping } = getOrTrainModel();

  // 3. Fetch routes from Prisma DB (or Firestore/corridors)
  let activeRoutes: any[] = [];
  try {
    const pRoutes = await prisma.route.findMany({
      where: { status: 'ACTIVE' },
      include: { assignedVehicle: true },
    });
    if (pRoutes.length > 0) {
      activeRoutes = pRoutes.map((r) => {
        let waypoints: any[] = [];
        try {
          waypoints = typeof r.waypoints === 'string' ? JSON.parse(r.waypoints) : r.waypoints;
        } catch {
          waypoints = [];
        }
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          assignedVehicle: r.assignedVehicle || { capacity: 16 },
          waypoints,
        };
      });
    }
  } catch (err) {
    console.warn('[PredictionEngine] Prisma route query notice:', err);
  }

  if (activeRoutes.length === 0) {
    const dbRoutes = await getAllRoutes();
    activeRoutes = dbRoutes.length > 0 ? dbRoutes : KNOWN_CORRIDOR_ROUTES.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      assignedVehicle: { capacity: r.defaultCapacity },
      waypoints: r.stops.map((s) => ({ stopName: s })),
    }));
  }

  // Handle single route filtering if query param was provided
  if (routeParam) {
    const trimmed = routeParam.trim().toLowerCase();
    const matched = activeRoutes.filter(
      (r) =>
        r.id.toLowerCase() === trimmed ||
        r.code.toLowerCase() === trimmed
    );
    if (matched.length === 0) {
      throw new Error(`Route not found with identifier '${routeParam}'`);
    }
    activeRoutes = matched;
  }

  // Target forecast date (Tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tomorrowDayOfWeek = tomorrow.getDay() === 0 ? 1 : tomorrow.getDay(); // Avoid Sunday

  const routePredictions: RoutePredictionResult[] = [];
  const allStopDemands: any[] = [];

  // 4. Generate ML Inference for each route and shift
  for (const route of activeRoutes) {
    const capacity = (route as any).assignedVehicle?.capacity || 16;
    const stops = (route.waypoints || []).map((w: any) =>
      typeof w === 'string' ? w : w.stopName || w.name
    ).filter(Boolean);

    const shifts: ('MORNING_PICKUP' | 'EVENING_DROP')[] = [
      'MORNING_PICKUP',
      'EVENING_DROP',
    ];

    for (const shift of shifts) {
      // Build feature vector
      const featureVector = buildInferenceFeatureVector(
        {
          routeCode: route.code,
          shift,
          date: tomorrowStr,
          vehicleCapacity: capacity,
        },
        cachedHistoricalData,
        routeMapping
      );

      // ML MODEL INFERENCE (Random Forest Regressor)
      const predictedPaxRaw = model.predictSample(featureVector);
      const predictedDemand = Math.max(0, Math.round(predictedPaxRaw));

      // BUSINESS RULE CALCULATIONS
      const occupancy = calculateOccupancy(predictedDemand, capacity);
      const status = classifyDemandStatus(occupancy);
      const demandLevel = classifyDemandLevel(occupancy);
      const shuttleInfo = calculateAdditionalShuttles(predictedDemand, capacity, route.code);

      const routeHistRecords = cachedHistoricalData.filter((r) => r.routeCode === route.code);
      const reliabilityInfo = assessPredictionReliability(
        routeHistRecords.length,
        0.05
      );
      const dataQualityStatus = assessDataQuality(routeHistRecords.length);

      const histAvg = featureVector[5] || predictedDemand;
      const trend7d = featureVector[6] || predictedDemand;
      const demandDelta = parseFloat((predictedDemand - histAvg).toFixed(1));

      const explainability = generateExplainabilityFactors(
        route.code,
        shift,
        tomorrowDayOfWeek,
        predictedDemand,
        capacity,
        histAvg,
        trend7d
      );

      const stopDemands = calculateStopLevelDemands(
        stops.length > 0 ? stops : null,
        predictedDemand
      );
      if (Array.isArray(stopDemands)) {
        allStopDemands.push(...stopDemands);
      }

      const predResult: RoutePredictionResult = {
        routeId: route.id,
        routeCode: route.code,
        routeName: route.name,
        shift,
        predictionDate: tomorrowStr,
        predictedDemand,
        vehicleCapacity: capacity,
        routeCapacity: capacity,
        predictedOccupancy: occupancy,
        status,
        demandLevel,
        historicalAverageDemand: parseFloat(histAvg.toFixed(1)),
        demandDelta,
        dataQualityStatus,
        recommendation: shuttleInfo.recommendation,
        additionalShuttles: shuttleInfo.additionalShuttles,
        requiredVehicles: shuttleInfo.requiredVehicles,
        reliability: reliabilityInfo.reliability,
        reliabilityReason: reliabilityInfo.reason,
        explainability,
        stopDemands,
      };

      routePredictions.push(predResult);

      // Persist prediction to Firestore / SQLite
      saveAIDemandPrediction({
        id: `pred_${route.code.toLowerCase()}_${tomorrowStr}_${shift.toLowerCase()}`,
        routeId: route.id,
        routeCode: route.code,
        routeName: route.name,
        shift,
        predictionDate: tomorrowStr,
        predictedDemand,
        vehicleCapacity: capacity,
        predictedOccupancy: occupancy,
        status: (status === 'MEDIUM' ? 'NORMAL' : status) as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL',
        recommendation: shuttleInfo.recommendation,
        reliability: reliabilityInfo.reliability,
        additionalShuttles: shuttleInfo.additionalShuttles,
        featureImportance: JSON.stringify(metrics.featureImportances.slice(0, 3)),
        createdAt: new Date(),
      }).catch(() => {});
    }
  }

  // 5. Consolidation / Merge Candidates (Descriptive Advisory Logic)
  const consolidationRecommendations =
    identifyRouteConsolidationCandidates(routePredictions);

  // 6. Weekly Trend Forecast for Recharts (Historical vs Predicted across weekdays)
  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const weeklyForecast = weekdayLabels.map((dayName, idx) => {
    const dayNum = idx + 1; // 1: Mon, ..., 5: Fri
    const matchingHist = cachedHistoricalData.filter((r) => r.dayOfWeek === dayNum);
    const histAvg =
      matchingHist.length > 0
        ? Math.round(
            matchingHist.reduce((sum, r) => sum + r.actualDemand, 0) /
              (matchingHist.length / Math.max(1, activeRoutes.length))
          )
        : 42;

    const sampleFeat = [0, 0, dayNum, 2, 20, histAvg, histAvg * 1.05, histAvg, 0.05];
    const pred = Math.round(model.predictSample(sampleFeat) * Math.max(1, activeRoutes.length) * 0.9);

    return {
      day: dayName,
      historicalDemand: histAvg * Math.max(1, activeRoutes.length),
      predictedDemand: pred,
    };
  });

  // 7. Top Executive KPI Summary
  const totalPredictedDemand = routePredictions
    .filter((p) => p.shift === 'MORNING_PICKUP')
    .reduce((sum, p) => sum + p.predictedDemand, 0);

  const totalCapacity = routePredictions
    .filter((p) => p.shift === 'MORNING_PICKUP')
    .reduce((sum, p) => sum + p.vehicleCapacity, 0);

  const expectedOccupancy =
    totalCapacity > 0
      ? parseFloat(((totalPredictedDemand / totalCapacity) * 100).toFixed(1))
      : 82.5;

  const highDemandRoutes = routePredictions.filter(
    (p) => (p.status === 'HIGH' || p.demandLevel === 'HIGH') && p.shift === 'MORNING_PICKUP'
  ).length;

  const criticalDemandRoutes = routePredictions.filter(
    (p) => (p.status === 'CRITICAL' || p.demandLevel === 'CRITICAL') && p.shift === 'MORNING_PICKUP'
  ).length;

  const additionalShuttlesRecommended = routePredictions.reduce(
    (sum, p) => sum + p.additionalShuttles,
    0
  );

  // Filter top unique stop pressures
  const uniqueStopsMap = new Map<string, any>();
  allStopDemands.forEach((s) => {
    if (!uniqueStopsMap.has(s.stopName) || s.utilizationPercent > uniqueStopsMap.get(s.stopName).utilizationPercent) {
      uniqueStopsMap.set(s.stopName, s);
    }
  });
  const topStopDemands = Array.from(uniqueStopsMap.values()).slice(0, 6);

  const { cleaningReport } = prepareDemandDataset(cachedHistoricalData);

  return {
    success: true,
    status: 'SUCCESS',
    summary: {
      forecastDate: tomorrowStr,
      totalPredictedDemand,
      expectedOccupancy,
      highDemandRoutes,
      criticalDemandRoutes,
      additionalShuttlesRecommended,
      routesAnalyzed: activeRoutes.length,
    },
    weeklyForecast,
    routePredictions,
    topStopDemands,
    consolidationRecommendations,
    modelMetrics: metrics,
    cleaningReport,
  };
}
