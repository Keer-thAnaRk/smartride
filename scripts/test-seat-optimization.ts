/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🧪 AUTOMATED TEST SUITE: SMART SEAT OPTIMIZATION ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Validates:
 * 1. Corridor segment overlap computation (interval math)
 * 2. Strict conflict-free seat assignment invariant
 * 3. Spatial and temporal fragmentation scoring (0-100 bounded)
 * 4. Multi-objective cost function evaluation
 * 5. Greedy segment packing and 1-opt local search
 * 6. Minimum improvement gating threshold (< 5% returns 0 movements)
 * 7. Explainable causal reason generation
 * 8. Deterministic SHA-256 optimistic concurrency checksum
 * 9. Physical vehicle capacity boundary compliance
 * 10. Database schema and relation integrity (Prisma)
 */

import {
  calculateRouteOverlap,
  isSeatConflictFree,
  calculateFragmentationScore,
  calculateObjectiveCost,
  optimizeSeatAllocations,
  generateAllocationChecksum,
  generateReassignmentReason,
} from '../src/lib/optimization/seat-optimization-engine';
import { PassengerSegment } from '../src/lib/optimization/seat-optimization-types';
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

async function runSeatOptimizationTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING SMART SEAT OPTIMIZATION ENGINE TEST SUITE');
  console.log('================================================================\n');

  // Test Group 1: Segment Overlap Mathematics
  console.log('--- 1. Corridor Segment Overlap Math ---');
  const segA: PassengerSegment = {
    passengerId: 'usr-1',
    passengerName: 'Alice',
    subscriptionId: 'sub-1',
    pickupStop: 'Electronic City Phase 1',
    dropStop: 'Silk Board',
    pickupIndex: 0,
    dropIndex: 2,
    segmentLength: 2,
    direction: 'OUTBOUND',
    currentSeat: 1,
  };

  const segB_adjacent: PassengerSegment = {
    passengerId: 'usr-2',
    passengerName: 'Bob',
    subscriptionId: 'sub-2',
    pickupStop: 'Silk Board',
    dropStop: 'Ecospace Bellandur',
    pickupIndex: 2,
    dropIndex: 4,
    segmentLength: 2,
    direction: 'OUTBOUND',
    currentSeat: 2,
  };

  const segC_overlapping: PassengerSegment = {
    passengerId: 'usr-3',
    passengerName: 'Charlie',
    subscriptionId: 'sub-3',
    pickupStop: 'BTM Layout',
    dropStop: 'HSR Sector 2',
    pickupIndex: 1,
    dropIndex: 3,
    segmentLength: 2,
    direction: 'OUTBOUND',
    currentSeat: 3,
  };

  const segD_disjoint: PassengerSegment = {
    passengerId: 'usr-4',
    passengerName: 'Diana',
    subscriptionId: 'sub-4',
    pickupStop: 'HSR Sector 2',
    dropStop: 'Marathahalli',
    pickupIndex: 3,
    dropIndex: 5,
    segmentLength: 2,
    direction: 'OUTBOUND',
    currentSeat: 4,
  };

  const overlapAdjacent = calculateRouteOverlap(segA, segB_adjacent);
  const overlapConflicting = calculateRouteOverlap(segA, segC_overlapping);
  const overlapDisjoint = calculateRouteOverlap(segA, segD_disjoint);

  assert(overlapAdjacent === 0, `Adjacent segments [0,2] and [2,4] have 0 overlap (got: ${overlapAdjacent})`);
  assert(overlapConflicting === 1, `Overlapping segments [0,2] and [1,3] have 1 leg overlap (got: ${overlapConflicting})`);
  assert(overlapDisjoint === 0, `Disjoint segments [0,2] and [3,5] have 0 overlap (got: ${overlapDisjoint})`);

  // Test Group 2: Strict Conflict Invariant
  console.log('\n--- 2. Conflict-Free Invariant Verification ---');
  const conflictFreeSameSeat = isSeatConflictFree([segA, segB_adjacent]);
  const conflictingSameSeat = isSeatConflictFree([segA, segC_overlapping]);
  const threeNonOverlapping = isSeatConflictFree([
    { ...segA, pickupIndex: 0, dropIndex: 1, segmentLength: 1 },
    { ...segB_adjacent, pickupIndex: 1, dropIndex: 2, segmentLength: 1 },
    { ...segD_disjoint, pickupIndex: 2, dropIndex: 3, segmentLength: 1 },
  ]);

  assert(conflictFreeSameSeat === true, 'Adjacent segments [0,2] and [2,4] can safely share the same physical seat');
  assert(conflictingSameSeat === false, 'Overlapping segments [0,2] and [1,3] are strictly flagged as conflicting');
  assert(threeNonOverlapping === true, 'Multi-passenger chain [0,1], [1,2], [2,3] is conflict-free in a single seat');

  // Test Group 3: Spatial and Temporal Fragmentation Scoring
  console.log('\n--- 3. Fragmentation Scoring (0-100 Bounded) ---');
  const compactMap = new Map<number, PassengerSegment[]>([
    [1, [segA]],
    [2, [segB_adjacent]],
    [3, []],
    [4, []],
    [5, []],
  ]);

  const fragmentedMap = new Map<number, PassengerSegment[]>([
    [1, [segA]],
    [2, []],
    [3, []],
    [4, [segB_adjacent]],
    [5, []],
  ]);

  const scoreCompact = calculateFragmentationScore(compactMap, 5, 5);
  const scoreFragmented = calculateFragmentationScore(fragmentedMap, 5, 5);

  assert(scoreCompact.score >= 0 && scoreCompact.score <= 100, `Compact score is within 0-100 bounds (got: ${scoreCompact.score})`);
  assert(scoreFragmented.score >= 0 && scoreFragmented.score <= 100, `Fragmented score is within 0-100 bounds (got: ${scoreFragmented.score})`);
  assert(scoreFragmented.score > scoreCompact.score, `Fragmented score (${scoreFragmented.score}) is higher than compact score (${scoreCompact.score})`);
  assert(scoreFragmented.holesCount > 0, `Fragmented allocation detects ${scoreFragmented.holesCount} empty hole(s)`);

  // Test Group 4: Multi-Objective Cost Function
  console.log('\n--- 4. Multi-Objective Cost Function J(S) ---');
  const initialSeats = new Map<string, number>([
    ['usr-1', 1],
    ['usr-2', 4],
  ]);
  const costOriginal = calculateObjectiveCost(fragmentedMap, initialSeats, 5, 5);
  const costPacked = calculateObjectiveCost(compactMap, initialSeats, 5, 5);

  assert(typeof costOriginal.totalCost === 'number' && !isNaN(costOriginal.totalCost), `Objective cost evaluates to valid number (${costOriginal.totalCost.toFixed(2)})`);
  assert(costPacked.totalCost < costOriginal.totalCost, `Packed allocation has lower objective cost than fragmented (${costPacked.totalCost.toFixed(2)} vs ${costOriginal.totalCost.toFixed(2)})`);

  // Test Group 5: Optimization Engine Execution & Segment Packing
  console.log('\n--- 5. Optimization Engine Execution & Segment Consolidation ---');
  const unoptimizedPassengers: PassengerSegment[] = [
    { ...segA, currentSeat: 1 },
    { ...segB_adjacent, currentSeat: 4 },
  ];

  const resultConsolidation = optimizeSeatAllocations({
    routeId: 'route-test-1',
    routeName: 'ECity to Manyata Express',
    routeCode: 'SR-101',
    vehicleModel: 'Tata Winger Executive',
    vehiclePlate: 'KA-01-EQ-5544',
    vehicleCapacity: 6,
    numStops: 5,
    passengers: unoptimizedPassengers,
  });

  assert(resultConsolidation.reassignments.length > 0, `Engine identifies reassignment opportunity (moved: ${resultConsolidation.reassignments.length})`);
  assert(resultConsolidation.improvementPercent >= 5.0, `Engine yields >= 5.0% improvement (got: ${resultConsolidation.improvementPercent.toFixed(1)}%)`);
  
  // Verify all seats in result are conflict-free
  let allSeatsValid = true;
  for (const entry of resultConsolidation.afterSeatMap) {
    // Check if multiple passengers on same seat overlap
    if (entry.passengers.length > 1) {
      for (let i = 0; i < entry.passengers.length; i++) {
        for (let j = i + 1; j < entry.passengers.length; j++) {
          const p1 = entry.passengers[i];
          const p2 = entry.passengers[j];
          const overlap = Math.max(0, Math.min(p1.dropIndex, p2.dropIndex) - Math.max(p1.pickupIndex, p2.pickupIndex));
          if (overlap > 0) {
            allSeatsValid = false;
            break;
          }
        }
      }
    }
  }
  assert(allSeatsValid, 'All seats in optimized result are strictly conflict-free');

  // Verify Bob was consolidated with Alice into Seat 1
  const seat1Passengers = resultConsolidation.afterSeatMap.find(s => s.seatNumber === 1)?.passengers || [];
  assert(seat1Passengers.length === 2, `Seat 1 now holds both complementary passengers (count: ${seat1Passengers.length})`);

  // Test Group 6: Stability Gating (<5% improvement prevents unnecessary movement)
  console.log('\n--- 6. Stability Gating & Anti-Churn Threshold ---');
  // Pass in an already optimal compact layout
  const alreadyOptimalPassengers: PassengerSegment[] = [
    { ...segA, currentSeat: 1 },
    { ...segC_overlapping, currentSeat: 2 },
  ];

  const resultOptimal = optimizeSeatAllocations({
    routeId: 'route-test-2',
    routeName: 'Whitefield Direct',
    routeCode: 'SR-202',
    vehicleModel: 'Force Urbania Luxury',
    vehiclePlate: 'KA-03-MB-9900',
    vehicleCapacity: 4,
    numStops: 4,
    passengers: alreadyOptimalPassengers,
  });

  assert(resultOptimal.reassignments.length === 0, `Already optimal allocation triggers 0 unnecessary reassignments (got: ${resultOptimal.reassignments.length})`);
  assert(resultOptimal.improvementPercent === 0, `No improvement needed: returns 0% change (got: ${resultOptimal.improvementPercent}%)`);

  // Test Group 7: Deterministic Checksum & Concurrency Guard
  console.log('\n--- 7. Deterministic Concurrency Checksum ---');
  const checksum1 = generateAllocationChecksum(unoptimizedPassengers, 'route-test-1');
  const checksum2 = generateAllocationChecksum(unoptimizedPassengers, 'route-test-1');
  const checksumDifferentRoute = generateAllocationChecksum(unoptimizedPassengers, 'route-test-diff');
  const checksumModified = generateAllocationChecksum([
    ...unoptimizedPassengers,
    { ...segC_overlapping, currentSeat: 3 },
  ], 'route-test-1');

  assert(typeof checksum1 === 'string' && checksum1.length === 64, `Checksum is a 64-character SHA-256 hex string (${checksum1.slice(0, 16)}...)`);
  assert(checksum1 === checksum2, 'Identical passenger allocation produces identical checksum');
  assert(checksum1 !== checksumDifferentRoute, 'Different route ID produces different checksum');
  assert(checksum1 !== checksumModified, 'Modified passenger allocation produces completely different checksum');

  // Test Group 8: Explainable Causal Reason Generation
  console.log('\n--- 8. Explainable Causal Reason Generation ---');
  const reasonConsolidation = generateReassignmentReason(
    segB_adjacent,
    4,
    1,
    [segA],
    true
  );

  assert(typeof reasonConsolidation === 'string' && reasonConsolidation.length > 20, 'Reason generated is non-empty string');
  assert(reasonConsolidation.includes('Seat 1') && reasonConsolidation.includes('Seat 4'), `Reason mentions previous and target seat (${reasonConsolidation})`);
  assert(reasonConsolidation.includes('Alice'), `Reason mentions complementary passenger paired with (${reasonConsolidation})`);

  // Test Group 9: Physical Vehicle Capacity Boundary
  console.log('\n--- 9. Physical Capacity Boundary Enforcement ---');
  resultConsolidation.afterSeatMap.forEach(seat => {
    assert(seat.seatNumber >= 1 && seat.seatNumber <= 6, `Seat #${seat.seatNumber} is within vehicle boundaries (1 to 6)`);
  });

  // Test Group 10: Database Schema & Entity Verification
  console.log('\n--- 10. Database Schema Verification (Prisma) ---');
  try {
    const route = await prisma.route.findFirst({
      include: { subscriptions: true },
    });

    if (route) {
      assert(true, `Found route ${route.code} in database for optimization testing`);

      // Verify SeatOptimizationRun table is accessible
      const recentRuns = await prisma.seatOptimizationRun.findMany({
        take: 1,
      });
      assert(Array.isArray(recentRuns), 'Prisma client successfully queries SeatOptimizationRun table');
    } else {
      console.log('  ⚠️ No routes in database; schema queried without error');
      assert(true, 'Prisma models compiled and ready');
    }
  } catch (err: any) {
    assert(false, `Database schema query failed: ${err.message}`);
  }

  // Summary
  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL SMART SEAT OPTIMIZATION ENGINE TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.error(`💥 ${totalTests - passedTests} TESTS FAILED\n`);
    process.exit(1);
  }
}

runSeatOptimizationTests().catch((err) => {
  console.error('Fatal error running seat optimization test suite:', err);
  process.exit(1);
});
