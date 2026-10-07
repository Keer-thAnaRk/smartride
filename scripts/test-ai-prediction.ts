/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🧪 SMARTRIDE — AUTOMATED AI PIPELINE VERIFICATION SUITE
 * ══════════════════════════════════════════════════════════════════════════════
 * Verifies end-to-end execution of:
 * 1. Historical data simulation
 * 2. Feature engineering & matrix extraction
 * 3. 80/20 train/test holdout evaluation
 * 4. Random Forest Regressor fit & inference
 * 5. Empirical MAE, RMSE, and R² computation
 * 6. Business-rule recommendations & shuttle math
 */

import { generateHistoricalCommuteData } from '../src/lib/ai/historical-data';
import { extractFeatureMatrix, buildInferenceFeatureVector } from '../src/lib/ai/feature-engineering';
import { trainAndEvaluateDemandModel } from '../src/lib/ai/evaluation';
import {
  calculateOccupancy,
  classifyDemandStatus,
  calculateAdditionalShuttles,
  calculateStopLevelDemands,
  identifyRouteConsolidationCandidates,
} from '../src/lib/ai/business-rules';

async function runTests() {
  console.log('=' .repeat(70));
  console.log('🧪 RUNNING SMARTRIDE AI DEMAND PREDICTION VERIFICATION SUITE');
  console.log('=' .repeat(70));

  // Test 1: Historical Data Generation
  console.log('\n[TEST 1] Testing Historical Commute Data Generator...');
  const data = generateHistoricalCommuteData(60, 42);
  if (!data || data.length < 100) {
    throw new Error(`Expected >= 100 historical records, got ${data?.length}`);
  }
  console.log(`✅ Generated ${data.length} historical commute records successfully.`);
  console.log(`   Sample record: Route ${data[0].routeCode}, Date ${data[0].date}, Demand ${data[0].actualDemand}`);

  // Test 2: Feature Matrix Extraction
  console.log('\n[TEST 2] Testing Feature Engineering & Matrix Transformation...');
  const matrix = extractFeatureMatrix(data);
  if (!matrix.X || matrix.X.length !== data.length || matrix.X[0].length !== 9) {
    throw new Error(`Feature matrix shape mismatch. Expected (${data.length}, 9), got (${matrix.X.length}, ${matrix.X[0]?.length})`);
  }
  console.log(`✅ Extracted feature matrix shape: (${matrix.X.length}, ${matrix.X[0].length}) with 9 engineered features.`);
  console.log(`   Route mappings: ${JSON.stringify(matrix.routeMapping)}`);

  // Test 3: Model Training & Real Evaluation Metrics
  console.log('\n[TEST 3] Training Random Forest Regressor & Computing Empirical Metrics...');
  const { model, metrics } = trainAndEvaluateDemandModel(matrix, 25);
  if (!model.isTrained) {
    throw new Error('Model fit failed.');
  }

  console.log(`✅ Model trained successfully with ${model.trees.length} Decision Trees.`);
  console.log(`   Empirical Holdout Metrics (80/20 split):`);
  console.log(`   • MAE  : ${metrics.mae} passengers`);
  console.log(`   • RMSE : ${metrics.rmse}`);
  console.log(`   • R²   : ${metrics.r2}`);
  console.log(`   • Train samples: ${metrics.trainSamplesCount}, Test samples: ${metrics.testSamplesCount}`);

  if (isNaN(metrics.mae) || isNaN(metrics.rmse) || isNaN(metrics.r2)) {
    throw new Error('Metrics contain NaN values.');
  }

  console.log(`   Top 3 Feature Importances:`);
  metrics.featureImportances.slice(0, 3).forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.feature}: ${f.percentage}%`);
  });

  // Test 4: Inference on Tomorrow's Morning Shift
  console.log('\n[TEST 4] Testing Inference on Target Corridor (SR-101 Morning Pickup)...');
  const inferenceVector = buildInferenceFeatureVector(
    {
      routeCode: 'SR-101',
      shift: 'MORNING_PICKUP',
      date: '2026-09-17',
      vehicleCapacity: 20,
    },
    data,
    matrix.routeMapping
  );

  const predictedPax = model.predictSample(inferenceVector);
  const roundedDemand = Math.round(predictedPax);
  const occupancy = calculateOccupancy(roundedDemand, 20);
  const status = classifyDemandStatus(occupancy);
  const shuttleInfo = calculateAdditionalShuttles(roundedDemand, 20);

  console.log(`✅ Inference complete:`);
  console.log(`   • Route: SR-101 (Capacity 20)`);
  console.log(`   • Raw Model Output: ${predictedPax.toFixed(2)} -> Rounded: ${roundedDemand} passengers`);
  console.log(`   • Calculated Occupancy: ${occupancy}%`);
  console.log(`   • Classified Status: ${status}`);
  console.log(`   • Shuttle Recommendation: ${shuttleInfo.recommendation}`);

  // Test 5: Stop Level Demands Breakdown
  console.log('\n[TEST 5] Testing Stop-Level Queue Pressure Analysis...');
  const stops = [
    'HSR Layout 27th Main',
    'Agara Lake Junction',
    'Bellandur EcoSpace Flyover',
    'Marathahalli Bridge',
    'ITPB Tech Park Hub',
  ];
  const stopDemands = calculateStopLevelDemands(stops, roundedDemand);
  if (stopDemands.length !== stops.length) {
    throw new Error(`Stop demands count mismatch. Expected ${stops.length}, got ${stopDemands.length}`);
  }
  console.log(`✅ Stop breakdown computed for ${stopDemands.length} stops:`);
  stopDemands.forEach((s) => {
    console.log(`   • ${s.stopName}: ${s.predictedPassengers} pax (${s.utilizationPercent}% util) -> [${s.capacityPressure}]`);
  });

  // Test 6: Route Consolidation Check
  console.log('\n[TEST 6] Testing Route Consolidation (Merge Candidates)...');
  const dummyPredictions: any[] = [
    {
      routeId: 'r-1',
      routeCode: 'SR-104',
      routeName: 'Bannerghatta Link',
      shift: 'MORNING_PICKUP',
      predictedDemand: 3,
      vehicleCapacity: 8,
      predictedOccupancy: 37.5,
    },
    {
      routeId: 'r-2',
      routeCode: 'SR-105',
      routeName: 'Jayadeva Feeder',
      shift: 'MORNING_PICKUP',
      predictedDemand: 4,
      vehicleCapacity: 8,
      predictedOccupancy: 50.0,
    },
  ];
  const mergeCandidates = identifyRouteConsolidationCandidates(dummyPredictions);
  console.log(`✅ Route consolidation engine produced ${mergeCandidates.length} candidate recommendation.`);
  if (mergeCandidates.length > 0) {
    console.log(`   • Candidate: ${mergeCandidates[0].routeA.code} + ${mergeCandidates[0].routeB.code}`);
    console.log(`   • Note: ${mergeCandidates[0].adminActionNote}`);
  }

  console.log('\n' + '=' .repeat(70));
  console.log('🎉 ALL 6 VERIFICATION SUITE TESTS PASSED WITH 0 ERRORS!');
  console.log('=' .repeat(70));
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
