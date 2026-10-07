/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 📊 SMARTRIDE (COMMUTESYNC) — MODEL EVALUATION & VALIDATION PIPELINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Layer 4: Model Validation & Empirical Evaluation Metrics
 *
 * Implements strict 80/20 train/test split and calculates actual measured
 * regression metrics:
 * - MAE  (Mean Absolute Error): Average passenger difference
 * - RMSE (Root Mean Squared Error): Root of mean squared error
 * - R²   (Coefficient of Determination): Proportion of variance explained
 * - Feature Importances: Normalized percentage contribution per feature
 *
 * Explicitly handles datasets that are too small for evaluation by returning
 * EVALUATION_UNAVAILABLE with a clear explanation.
 */

import { RandomForestRegressor } from './model';
import { FEATURE_NAMES, FeatureMatrix } from './feature-engineering';

export interface EvaluationMetrics {
  mae: number;          // Actual measured Mean Absolute Error
  rmse: number;         // Actual measured Root Mean Squared Error
  r2: number;           // Actual measured R-squared coefficient
  trainSamplesCount: number;
  testSamplesCount: number;
  evaluationStatus: 'EVALUATED' | 'EVALUATION_UNAVAILABLE';
  explanation?: string;
  featureImportances: { feature: string; importance: number; percentage: number }[];
  trainedAt: string;
}

export interface TrainedModelResult {
  model: RandomForestRegressor;
  metrics: EvaluationMetrics;
  routeMapping: Record<string, number>;
}

/**
 * Splits feature matrix X and target y into training (80%) and testing (20%) sets.
 */
export function trainTestSplit(
  X: number[][],
  y: number[],
  trainRatio = 0.8,
  seed = 42
): {
  trainX: number[][];
  trainY: number[];
  testX: number[][];
  testY: number[];
} {
  const n = X.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  // Deterministic shuffle with seed
  let s = seed % 2147483647;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = Math.floor(((s - 1) / 2147483646) * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const splitIdx = Math.max(1, Math.floor(n * trainRatio));
  const trainIdx = indices.slice(0, splitIdx);
  const testIdx = indices.slice(splitIdx);

  return {
    trainX: trainIdx.map((i) => X[i]),
    trainY: trainIdx.map((i) => y[i]),
    testX: testIdx.map((i) => X[i]),
    testY: testIdx.map((i) => y[i]),
  };
}

/**
 * Calculates empirical MAE, RMSE, and R² scores on actual vs. predicted values.
 */
export function calculateMetrics(actual: number[], predicted: number[]): {
  mae: number;
  rmse: number;
  r2: number;
} {
  if (actual.length === 0 || actual.length !== predicted.length) {
    return { mae: 0, rmse: 0, r2: 0 };
  }

  const n = actual.length;
  let absErrorSum = 0;
  let squaredErrorSum = 0;
  const actualMean = actual.reduce((a, b) => a + b, 0) / n;
  let totalSumOfSquares = 0;

  for (let i = 0; i < n; i++) {
    const err = actual[i] - predicted[i];
    absErrorSum += Math.abs(err);
    squaredErrorSum += err * err;
    totalSumOfSquares += (actual[i] - actualMean) ** 2;
  }

  const mae = parseFloat((absErrorSum / n).toFixed(2));
  const rmse = parseFloat(Math.sqrt(squaredErrorSum / n).toFixed(2));

  // R² = 1 - (SS_res / SS_tot)
  const r2Raw =
    totalSumOfSquares > 0 ? 1 - squaredErrorSum / totalSumOfSquares : 0;
  const r2 = parseFloat(Math.max(-1, Math.min(1, r2Raw)).toFixed(3));

  return { mae, rmse, r2 };
}

/**
 * Trains and evaluates the Random Forest Regressor on the provided feature matrix.
 */
export function trainAndEvaluateDemandModel(
  matrix: FeatureMatrix,
  treesCount = 25
): TrainedModelResult {
  // If dataset is too small (< 8 samples), train on available samples but mark evaluation unavailable
  if (matrix.X.length < 8) {
    const model = new RandomForestRegressor({
      nEstimators: Math.min(10, treesCount),
      maxDepth: 4,
      minSamplesSplit: 2,
      seed: 777,
    });

    if (matrix.X.length > 0) {
      model.fit(matrix.X, matrix.y);
    }

    return {
      model,
      routeMapping: matrix.routeMapping,
      metrics: {
        mae: 0,
        rmse: 0,
        r2: 0,
        trainSamplesCount: matrix.X.length,
        testSamplesCount: 0,
        evaluationStatus: 'EVALUATION_UNAVAILABLE',
        explanation: `Dataset contains only ${matrix.X.length} record(s); holdout validation requires at least 8 samples.`,
        featureImportances: [],
        trainedAt: new Date().toISOString(),
      },
    };
  }

  const { trainX, trainY, testX, testY } = trainTestSplit(
    matrix.X,
    matrix.y,
    0.8,
    101
  );

  const model = new RandomForestRegressor({
    nEstimators: treesCount,
    maxDepth: 6,
    minSamplesSplit: 4,
    seed: 777,
  });

  // 1. Train on 80% training set
  model.fit(trainX, trainY);

  // 2. Predict on 20% holdout test set
  const testPredictions = model.predict(testX);

  // 3. Compute empirical evaluation metrics
  const { mae, rmse, r2 } = calculateMetrics(testY, testPredictions);

  // 4. Map feature importances to named attributes
  const featureImportances = model.featureImportances.map((imp, idx) => ({
    feature: FEATURE_NAMES[idx] || `Feature ${idx}`,
    importance: imp,
    percentage: parseFloat((imp * 100).toFixed(1)),
  }));

  // Sort by highest contributing importance
  featureImportances.sort((a, b) => b.importance - a.importance);

  return {
    model,
    routeMapping: matrix.routeMapping,
    metrics: {
      mae,
      rmse,
      r2,
      trainSamplesCount: trainX.length,
      testSamplesCount: testX.length,
      evaluationStatus: 'EVALUATED',
      featureImportances,
      trainedAt: new Date().toISOString(),
    },
  };
}
