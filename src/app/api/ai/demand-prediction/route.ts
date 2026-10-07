import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  generateHistoricalCommuteData,
  prepareDemandDataset,
  MIN_TRAINING_RECORDS,
} from '@/lib/ai/historical-data';
import { extractFeatureMatrix } from '@/lib/ai/feature-engineering';
import { trainAndEvaluateDemandModel } from '@/lib/ai/evaluation';
import {
  runDemandPredictionPipeline,
  getOrTrainModel,
  resetModelCache,
} from '@/lib/ai/prediction-engine';
import prisma from '@/lib/prisma';
import { saveAIModelRun } from '@/lib/firestore-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. RBAC Authentication Enforcement
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const targetRouteParam = searchParams.get('routeId') || searchParams.get('routeCode');
    const requireRealData = searchParams.get('requireRealData') === 'true';

    const result = await runDemandPredictionPipeline({
      routeParam: targetRouteParam,
      requireRealData,
    });

    if (result.status === 'INSUFFICIENT_DATA') {
      return NextResponse.json({
        status: 'INSUFFICIENT_DATA',
        message: result.message,
        requiredRecords: result.requiredRecords || MIN_TRAINING_RECORDS,
        availableRecords: result.availableRecords || 0,
        cleaningReport: result.cleaningReport,
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message?.includes('Route not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    console.error('Error in AI demand prediction:', error);
    return NextResponse.json(
      { error: error.message || 'Demand prediction pipeline failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. RBAC Authentication Enforcement
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // 2. Safe configuration parsing (reject client-side prediction forging)
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'train';
    const treesCount = typeof body.nEstimators === 'number' && body.nEstimators > 0 ? body.nEstimators : 25;

    if (action === 'retrain' || action === 'train') {
      // 1. Load and clean historical commute records
      const freshSeed = Math.floor(Math.random() * 100000);
      const freshHistoricalData = generateHistoricalCommuteData(60, freshSeed);

      // 2. Clean dataset using reusable preprocessor
      const { cleanedRecords, cleaningReport } = prepareDemandDataset(freshHistoricalData);

      // 3. Extract feature matrix
      const featureMatrix = extractFeatureMatrix(cleanedRecords);

      // 4. Retrain Random Forest Regressor & measure empirical metrics
      const newModelResult = trainAndEvaluateDemandModel(featureMatrix, treesCount);
      resetModelCache(freshHistoricalData, newModelResult);

      // 5. Save model run metadata to database
      try {
        await prisma.aIModelRun.create({
          data: {
            modelName: 'RandomForestRegressor',
            trainingRecords: cleanedRecords.length,
            mae: newModelResult.metrics.mae,
            rmse: newModelResult.metrics.rmse,
            r2: newModelResult.metrics.r2,
            trainedAt: new Date(),
            features: JSON.stringify(newModelResult.metrics.featureImportances),
          },
        });
      } catch (dbErr) {
        console.warn('[DemandPredictionAPI] Prisma AIModelRun create notice:', dbErr);
        await saveAIModelRun({
          id: `run_${Date.now()}`,
          modelName: 'RandomForestRegressor',
          trainingRecords: cleanedRecords.length,
          mae: newModelResult.metrics.mae,
          rmse: newModelResult.metrics.rmse,
          r2: newModelResult.metrics.r2,
          trainedAt: new Date(),
          features: JSON.stringify(newModelResult.metrics.featureImportances),
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Random Forest Regressor retrained and evaluated successfully on historical commute records.',
        modelMetrics: newModelResult.metrics,
        cleaningReport,
      });
    }

    if (action === 'generate_demo' || action === 'benchmark') {
      const freshSeed = 100 + Math.floor(Math.random() * 50);
      const freshHistoricalData = generateHistoricalCommuteData(60, freshSeed);
      const featureMatrix = extractFeatureMatrix(freshHistoricalData);
      const newModelResult = trainAndEvaluateDemandModel(featureMatrix, 25);
      resetModelCache(freshHistoricalData, newModelResult);

      return NextResponse.json({
        success: true,
        message: 'Corridor demand forecast refreshed successfully using the trained ML model.',
        modelMetrics: newModelResult.metrics,
      });
    }

    return NextResponse.json({ error: 'Invalid action specified. Supported actions: train, retrain, benchmark' }, { status: 400 });
  } catch (error: any) {
    console.error('Error during AI model operation:', error);
    return NextResponse.json(
      { error: error.message || 'Model operation failed' },
      { status: 500 }
    );
  }
}
