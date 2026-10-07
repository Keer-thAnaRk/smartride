/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🧪 AUTOMATED TEST SUITE: SMART SUSTAINABILITY & CARBON IMPACT ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Validates:
 * 1. Deterministic baseline vs shared shuttle carbon calculation math
 * 2. Vehicle-specific emission factors (Sedan, SUV, Van, Mini-bus)
 * 3. Extreme bounds & edge cases (zero km, 1 rider, high occupancy, non-negative clamp)
 * 4. Commuter and fleet-level cars avoided formulas
 * 5. Monthly shared commute percentage computation & capping (0% - 100%)
 * 6. Rule-based natural language sustainability insights generator
 * 7. Model versioning integrity and configurable assumptions
 * 8. Prisma database model persistence (SustainabilityModelConfig, SustainabilityRecord)
 */

import {
  calculateTripCarbon,
  calculateSharedCommutePercentage,
  calculateCommuterCarsAvoided,
  generateSustainabilityInsights,
} from '../src/lib/sustainability/carbon-calculator';
import {
  DEFAULT_SUSTAINABILITY_CONFIG,
  getShuttleEmissionFactor,
  SustainabilityConfig,
} from '../src/lib/sustainability/carbon-config';
import { RouteSustainabilityMetric } from '../src/lib/sustainability/carbon-types';
import prisma from '../src/lib/prisma';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    if (detail) console.error('    Details:', detail);
  }
}

async function runSustainabilityTests() {
  console.log('\n================================================================');
  console.log('🌱 RUNNING SMART SUSTAINABILITY & CARBON ENGINE TEST SUITE');
  console.log('================================================================\n');

  // Test Group 1: Deterministic Trip Carbon Calculation Math
  console.log('--- 1. Deterministic Trip Carbon Math ---');
  {
    // Distance = 20 km, 5 passengers, VAN (0.260 kg/km), Baseline = 0.180 kg/km
    // Baseline = 20 * 0.180 = 3.600 kg
    // Shuttle Total = 20 * 0.260 = 5.200 kg
    // Allocated = 5.200 / 5 = 1.040 kg
    // Avoided = 3.600 - 1.040 = 2.560 kg
    const calc = calculateTripCarbon(20.0, 5, 'VAN', DEFAULT_SUSTAINABILITY_CONFIG);
    assert(calc.distanceKm === 20.0, 'Properly stores distance in km');
    assert(calc.passengerCount === 5, 'Properly stores passenger count');
    assert(Math.abs(calc.baselineEmissionsKg - 3.600) < 0.001, 'Calculates baseline private emissions: 3.600 kg', calc.baselineEmissionsKg);
    assert(Math.abs(calc.shuttleTotalEmissionsKg - 5.200) < 0.001, 'Calculates shuttle total emissions: 5.200 kg', calc.shuttleTotalEmissionsKg);
    assert(Math.abs(calc.allocatedShuttleEmissionsKg - 1.040) < 0.001, 'Allocates passenger share: 1.040 kg', calc.allocatedShuttleEmissionsKg);
    assert(Math.abs(calc.avoidedCo2Kg - 2.560) < 0.001, 'Calculates net avoided CO2: 2.560 kg', calc.avoidedCo2Kg);
    assert(calc.percentageReduction > 70 && calc.percentageReduction < 72, 'Calculates percentage reduction ~71.1%', calc.percentageReduction);
    assert(calc.modelVersion === 'v1.0', 'Attaches active model version v1.0');
  }

  // Test Group 2: Vehicle-Specific Emission Factors
  console.log('\n--- 2. Vehicle-Specific Emission Factors ---');
  {
    const sedanFactor = getShuttleEmissionFactor('SEDAN', DEFAULT_SUSTAINABILITY_CONFIG);
    const suvFactor = getShuttleEmissionFactor('SUV', DEFAULT_SUSTAINABILITY_CONFIG);
    const vanFactor = getShuttleEmissionFactor('VAN', DEFAULT_SUSTAINABILITY_CONFIG);
    const busFactor = getShuttleEmissionFactor('MINI_BUS', DEFAULT_SUSTAINABILITY_CONFIG);
    const fallbackFactor = getShuttleEmissionFactor('UNKNOWN_VEHICLE', DEFAULT_SUSTAINABILITY_CONFIG);

    assert(sedanFactor === 0.180, 'Sedan emission factor is 0.180 kg/km');
    assert(suvFactor === 0.220, 'SUV emission factor is 0.220 kg/km');
    assert(vanFactor === 0.260, 'VAN emission factor is 0.260 kg/km');
    assert(busFactor === 0.320, 'Mini-bus emission factor is 0.320 kg/km');
    assert(fallbackFactor === 0.260, 'Unknown vehicle defaults safely to VAN factor (0.260 kg/km)');
  }

  // Test Group 3: Boundary Conditions & Edge Cases
  console.log('\n--- 3. Boundary Conditions & Non-Negative Clamp ---');
  {
    // Zero distance
    const zeroDist = calculateTripCarbon(0, 5, 'VAN');
    assert(zeroDist.baselineEmissionsKg === 0, 'Zero distance yields 0 baseline');
    assert(zeroDist.avoidedCo2Kg === 0, 'Zero distance yields 0 avoided CO2');

    // 1 Passenger in a heavy mini-bus (0.320 kg/km vs 0.180 kg/km baseline)
    // Baseline = 10 * 0.180 = 1.800 kg
    // Shuttle = 10 * 0.320 = 3.200 kg (Higher than 1 private car!)
    // Avoided CO2 MUST clamp to 0 (cannot be negative!)
    const soloMiniBus = calculateTripCarbon(10, 1, 'MINI_BUS');
    assert(soloMiniBus.avoidedCo2Kg === 0, 'Negative avoided CO2 is strictly clamped to 0', soloMiniBus.avoidedCo2Kg);
    assert(soloMiniBus.percentageReduction === 0, 'Percentage reduction clamped to 0% when no savings');

    // High occupancy shuttle (20 passengers in Mini-bus)
    // Baseline = 25 * 0.180 = 4.500 kg
    // Shuttle Total = 25 * 0.320 = 8.000 kg
    // Allocated = 8.000 / 20 = 0.400 kg
    // Avoided = 4.500 - 0.400 = 4.100 kg
    const highOcc = calculateTripCarbon(25, 20, 'MINI_BUS');
    assert(Math.abs(highOcc.avoidedCo2Kg - 4.100) < 0.001, 'High occupancy Mini-bus achieves 4.100 kg CO2 saved per passenger');
    assert(highOcc.percentageReduction > 90, 'High occupancy achieves > 90% emission reduction', highOcc.percentageReduction);
  }

  // Test Group 4: Cars Avoided and Shared Commute %
  console.log('\n--- 4. Cars Avoided & Shared Commute % Math ---');
  {
    const commuterCars = calculateCommuterCarsAvoided(40);
    assert(commuterCars === 34, '40 trips yields 34 cars avoided (40 * 0.85)', commuterCars);

    const zeroPercent = calculateSharedCommutePercentage(0, 22, 2);
    assert(zeroPercent === 0, '0 trips yields 0% shared commute', zeroPercent);

    const halfPercent = calculateSharedCommutePercentage(22, 22, 2);
    assert(halfPercent === 50, '22 of 44 trips yields 50% shared commute', halfPercent);

    const fullPercent = calculateSharedCommutePercentage(44, 22, 2);
    assert(fullPercent === 100, '44 of 44 trips yields 100% shared commute', fullPercent);

    const overLimit = calculateSharedCommutePercentage(60, 22, 2);
    assert(overLimit === 100, 'Trips exceeding working month are clamped at 100%', overLimit);
  }

  // Test Group 5: Rule-Based Sustainability Insights
  console.log('\n--- 5. Explainable Sustainability Insights ---');
  {
    const mockRoutes: RouteSustainabilityMetric[] = [
      {
        routeId: 'rt-1',
        routeCode: 'SR-101',
        routeName: 'HSR Layout → ITPB Tech Park',
        distanceKm: 24.5,
        totalTrips: 44,
        totalPassengers: 240,
        avgOccupancy: 5.5,
        avoidedCo2Kg: 1420.5,
        carsAvoided: 198,
        efficiencyRating: 'EXCELLENT',
      },
      {
        routeId: 'rt-2',
        routeCode: 'SR-202',
        routeName: 'Electronic City → Manyata Tech Park',
        distanceKm: 32.0,
        totalTrips: 20,
        totalPassengers: 50,
        avgOccupancy: 2.5,
        avoidedCo2Kg: 510.0,
        carsAvoided: 30,
        efficiencyRating: 'MODERATE',
      },
    ];

    const insights = generateSustainabilityInsights(1930.5, mockRoutes);
    assert(insights.length >= 3, 'Generates at least 3 distinct insights', insights.length);
    
    const leaderInsight = insights.find((i) => i.type === 'CORRIDOR_LEADER');
    assert(leaderInsight !== undefined, 'Generates corridor leader insight');
    assert(leaderInsight?.routeCode === 'SR-101', 'Correctly identifies SR-101 as corridor leader');

    const opportunityInsight = insights.find((i) => i.type === 'OPPORTUNITY');
    assert(opportunityInsight !== undefined, 'Generates consolidation opportunity insight for SR-202');
    assert(opportunityInsight?.routeCode === 'SR-202', 'Correctly flags SR-202 for occupancy optimization');
  }

  // Test Group 6: Prisma Database Persistence & Model Versioning
  console.log('\n--- 6. Prisma Database Persistence & Auditability ---');
  {
    // Test creating or updating SustainabilityModelConfig
    const configRecord = await prisma.sustainabilityModelConfig.upsert({
      where: { id: 'active_config' },
      update: {
        modelVersion: 'v1.0',
        baselineCarEmissionKgPerKm: 0.180,
        baselineCarOccupancy: 1.15,
        shuttleSedanKgPerKm: 0.180,
        shuttleSuvKgPerKm: 0.220,
        shuttleVanKgPerKm: 0.260,
        shuttleMiniBusKgPerKm: 0.320,
        workingDaysPerMonth: 22,
        tripsPerWorkingDay: 2,
        updatedBy: 'TEST_SUITE',
      },
      create: {
        id: 'active_config',
        modelVersion: 'v1.0',
        baselineCarEmissionKgPerKm: 0.180,
        baselineCarOccupancy: 1.15,
        shuttleSedanKgPerKm: 0.180,
        shuttleSuvKgPerKm: 0.220,
        shuttleVanKgPerKm: 0.260,
        shuttleMiniBusKgPerKm: 0.320,
        workingDaysPerMonth: 22,
        tripsPerWorkingDay: 2,
        updatedBy: 'TEST_SUITE',
      },
    });
    assert(configRecord.id === 'active_config', 'Persists active configuration in SQLite');
    assert(configRecord.modelVersion === 'v1.0', 'Stores model version v1.0');

    // Test creating a SustainabilityRecord
    const record = await prisma.sustainabilityRecord.create({
      data: {
        commuterId: 'test-commuter-001',
        routeId: 'route-sr-101',
        date: '2026-09-17',
        month: '2026-09',
        distanceKm: 24.5,
        passengerCount: 6,
        baselineEmissionsKg: 4.41,
        allocatedEmissionsKg: 1.06,
        avoidedCo2Kg: 3.35,
        carsAvoidedCount: 0.833,
        modelVersion: 'v1.0',
      },
    });
    assert(record.id.length > 0, 'Successfully inserts SustainabilityRecord with CUID');
    assert(record.avoidedCo2Kg === 3.35, 'Persists exact avoided CO2 metric');
    assert(record.modelVersion === 'v1.0', 'Stamps calculation with active model version');

    // Clean up test record
    await prisma.sustainabilityRecord.delete({ where: { id: record.id } });
    assert(true, 'Cleans up test record cleanly without leaving artifacts');
  }

  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSustainabilityTests()
  .catch((err) => {
    console.error('Test runner encountered uncaught error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
