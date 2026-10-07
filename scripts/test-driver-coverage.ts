/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🧪 AUTOMATED TEST SUITE: DRIVER NO-SHOW & CONTINGENCY ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Validates:
 * 1. Time parsing and check-in deadline calculation (15 min prior)
 * 2. Deterministic timeline state transitions (EXPECTED, CHECKED_IN, LATE, NO_SHOW_RISK, NO_SHOW_CONFIRMED)
 * 3. Haversine distance calculation in kilometers
 * 4. Hard candidate eligibility filtering (Leave, Concurrent Trip, Unverified, Capacity, Distance)
 * 5. Multi-factor operational suitability scoring (0-100 bounded)
 * 6. Score similarity and tie-break detection (<= 3.0 pts)
 * 7. Explainable causal justification generator ("Why Arun?", "Why not Vijay?")
 * 8. Race condition protection (Primary driver late arrival after standby replacement)
 * 9. Prisma database schema and audit log integrity
 */

import {
  parseTimeToMinutes,
  formatMinutesToTime,
  computeCheckInDeadline,
  evaluateCheckInStatus,
  calculateHaversineKm,
  evaluateStandbyCandidate,
  detectSimilarScores,
} from '../src/lib/operations/driver-coverage-engine';
import { DRIVER_MONITOR_CONFIG } from '../src/lib/operations/driver-monitor-config';
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

async function runDriverCoverageTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING DRIVER NO-SHOW & CONTINGENCY ENGINE TEST SUITE');
  console.log('================================================================\n');

  // Test Group 1: Time Parsing and Deadline Calculation
  console.log('--- 1. Time Parsing & Deadline Mathematics ---');
  const minsMorning = parseTimeToMinutes('08:00 AM');
  const minsEvening = parseTimeToMinutes('06:00 PM');
  const formattedTime = formatMinutesToTime(465); // 07:45 AM

  assert(minsMorning === 480, `08:00 AM parses to 480 minutes (got: ${minsMorning})`);
  assert(minsEvening === 1080, `06:00 PM parses to 1080 minutes (got: ${minsEvening})`);
  assert(formattedTime === '07:45 AM', `465 minutes formats to 07:45 AM (got: ${formattedTime})`);

  const deadline = computeCheckInDeadline('08:00 AM', 15);
  assert(deadline === '07:45 AM', `08:00 AM dispatch yields 07:45 AM check-in deadline (got: ${deadline})`);

  // Test Group 2: Check-In State Machine Brackets
  console.log('\n--- 2. Deterministic State Machine Transitions ---');
  // Dispatch: 08:00 AM, Deadline: 07:45 AM
  // Reference times:
  const t740 = new Date('2026-09-17T07:40:00'); // 5 min before deadline -> EXPECTED
  const t745 = new Date('2026-09-17T07:45:00'); // exactly on deadline -> EXPECTED
  const t748 = new Date('2026-09-17T07:48:00'); // 3 min past deadline (within 5m grace) -> LATE
  const t752 = new Date('2026-09-17T07:52:00'); // 7 min past deadline (grace exceeded) -> NO_SHOW_RISK
  const t758 = new Date('2026-09-17T07:58:00'); // 13 min past deadline (>10m cutoff) -> NO_SHOW_CONFIRMED

  const state740 = evaluateCheckInStatus({
    scheduledDispatch: '08:00 AM',
    referenceTime: t740,
  });
  const state745 = evaluateCheckInStatus({
    scheduledDispatch: '08:00 AM',
    referenceTime: t745,
  });
  const state748 = evaluateCheckInStatus({
    scheduledDispatch: '08:00 AM',
    referenceTime: t748,
  });
  const state752 = evaluateCheckInStatus({
    scheduledDispatch: '08:00 AM',
    referenceTime: t752,
  });
  const state758 = evaluateCheckInStatus({
    scheduledDispatch: '08:00 AM',
    referenceTime: t758,
  });

  assert(state740.status === 'EXPECTED', 'Before deadline is classified as EXPECTED');
  assert(state740.minutesUntilDeadline === 5, '7:40 AM correctly reports 5 minutes until deadline');
  assert(state745.status === 'EXPECTED', 'At deadline is classified as EXPECTED');
  assert(state748.status === 'LATE', '7:48 AM is classified as LATE (within 5 min grace period)');
  assert(state748.isPotentialNoShow === false, 'LATE state within grace period does NOT prematurely trigger no-show');
  assert(state752.status === 'NO_SHOW_RISK', '7:52 AM is classified as NO_SHOW_RISK');
  assert(state752.isPotentialNoShow === true, 'NO_SHOW_RISK flags potential no-show');
  assert(state758.status === 'NO_SHOW_CONFIRMED', '7:58 AM is classified as NO_SHOW_CONFIRMED (mandatory replacement)');

  // Driver on-time check-in
  const stateCheckedIn = evaluateCheckInStatus({
    scheduledDispatch: '08:00 AM',
    checkedInAt: t740,
    referenceTime: t740,
  });
  assert(stateCheckedIn.status === 'CHECKED_IN', 'Submitting check-in evaluates to CHECKED_IN');

  // Test Group 3: Haversine Distance Math
  console.log('\n--- 3. Haversine Distance Mathematics ---');
  // Silk Board (12.9141, 77.6200) to HSR Sector 2 (12.9116, 77.6389) ~ 2.1 km
  const distClose = calculateHaversineKm(12.9141, 77.6200, 12.9116, 77.6389);
  // Silk Board to Hebbal (13.0358, 77.5970) ~ 13.7 km
  const distFar = calculateHaversineKm(12.9141, 77.6200, 13.0358, 77.5970);

  assert(distClose >= 1.5 && distClose <= 2.5, `Silk Board to HSR measures ~2.1 km (measured: ${distClose} km)`);
  assert(distFar >= 12.0 && distFar <= 15.0, `Silk Board to Hebbal measures ~13.7 km (measured: ${distFar} km)`);

  // Test Group 4: Hard Candidate Eligibility Filtering
  console.log('\n--- 4. Hard Candidate Eligibility Filtering ---');
  const routeSR101 = {
    id: 'route-1',
    code: 'SR-101',
    name: 'HSR Layout to ITPB Whitefield',
    originLat: 12.9141,
    originLng: 77.6200,
    activeSubscriptionCount: 4,
  };

  const validStandby = {
    id: 'drv-arun',
    name: 'Arun Kumar',
    phone: '+91 98765 11111',
    rating: 4.9,
    experienceYears: 5,
    isVerified: true,
    status: 'AVAILABLE',
    hasApprovedLeave: false,
    hasConflictingTrip: false,
    assignedRouteCode: 'SR-101',
    location: { lat: 12.9116, lng: 77.6389 }, // 2.1 km away
    vehicle: { capacity: 6, isApproved: true },
  };

  // Case A: Driver on leave
  const driverOnLeave = {
    ...validStandby,
    id: 'drv-leave',
    hasApprovedLeave: true,
  };

  // Case B: Driver on active trip
  const driverOnTrip = {
    ...validStandby,
    id: 'drv-active',
    hasConflictingTrip: true,
  };

  // Case C: Unverified driver
  const driverUnverified = {
    ...validStandby,
    id: 'drv-unverified',
    isVerified: false,
  };

  // Case D: Driver too far (> 15 km)
  const driverTooFar = {
    ...validStandby,
    id: 'drv-far',
    location: { lat: 13.2000, lng: 77.7000 }, // ~33 km away
  };

  const evalValid = evaluateStandbyCandidate({ driver: validStandby, route: routeSR101 });
  const evalLeave = evaluateStandbyCandidate({ driver: driverOnLeave, route: routeSR101 });
  const evalActive = evaluateStandbyCandidate({ driver: driverOnTrip, route: routeSR101 });
  const evalUnverified = evaluateStandbyCandidate({ driver: driverUnverified, route: routeSR101 });
  const evalTooFar = evaluateStandbyCandidate({ driver: driverTooFar, route: routeSR101 });

  assert(evalValid.isEligible === true, 'Available verified standby driver is ELIGIBLE');
  assert(evalLeave.isEligible === false, 'Driver on approved leave is strictly INELIGIBLE');
  assert(evalLeave.ineligibilityReason?.includes('leave') === true, 'Leave exclusion mentions approved leave');
  assert(evalActive.isEligible === false, 'Driver with concurrent trip is strictly INELIGIBLE');
  assert(evalUnverified.isEligible === false, 'Unverified driver is strictly INELIGIBLE');
  assert(evalTooFar.isEligible === false, 'Driver beyond 15 km threshold is strictly INELIGIBLE');

  // Test Group 5: Multi-Factor Suitability Scoring
  console.log('\n--- 5. Operational Suitability Scoring (0-100 Bounded) ---');
  const distantEligibleDriver = {
    ...validStandby,
    id: 'drv-distant',
    name: 'Kiran Reddy',
    assignedRouteCode: 'SR-202', // Different corridor
    location: { lat: 12.9800, lng: 77.6500 }, // ~8.0 km away
    rating: 4.4,
  };

  const evalDistant = evaluateStandbyCandidate({ driver: distantEligibleDriver, route: routeSR101 });

  assert(evalValid.suitabilityScore >= 85 && evalValid.suitabilityScore <= 100, `Close corridor-qualified driver scores high (got: ${evalValid.suitabilityScore}/100)`);
  assert(evalDistant.suitabilityScore >= 50 && evalDistant.suitabilityScore <= 80, `Distant cross-corridor driver scores lower (got: ${evalDistant.suitabilityScore}/100)`);
  assert(evalValid.suitabilityScore > evalDistant.suitabilityScore, 'Top candidate has higher score than distant candidate');

  // Test Group 6: Score Similarity & Tie-Break Detection
  console.log('\n--- 6. Score Similarity & Tie-Break Detection ---');
  const similarScoreCandidate = {
    ...validStandby,
    id: 'drv-vijay',
    name: 'Vijay Verma',
    rating: 4.85,
    location: { lat: 12.9130, lng: 77.6350 }, // ~2.2 km away
  };
  const evalVijay = evaluateStandbyCandidate({ driver: similarScoreCandidate, route: routeSR101 });

  const tieBreakResult = detectSimilarScores([evalValid, evalVijay]);
  const clearWinnerResult = detectSimilarScores([evalValid, evalDistant]);

  assert(tieBreakResult.hasSimilarScores === true, 'Candidates within 3.0 pts flag hasSimilarScores: true');
  assert(tieBreakResult.advisoryNote?.includes('Admin discretion') === true, 'Advisory note prompts Admin manual review');
  assert(clearWinnerResult.hasSimilarScores === false, 'Candidates with wide gap (>3.0 pts) do not trigger tie-break advisory');

  // Test Group 7: Explainable Causal Justifications
  console.log('\n--- 7. Explainable Causal Justifications ---');
  assert(evalValid.recommendationReason.includes('Arun') || evalValid.recommendationReason.includes('verified'), 'Explanation cites verified credentials');
  assert(evalValid.recommendationReason.includes('2.1 km'), 'Explanation cites accurate 2.1 km proximity distance');
  assert(evalValid.recommendationReason.includes('HSR'), 'Explanation cites corridor qualification');
  assert(evalDistant.caveatNotes?.some(c => c.includes('corridor')) === true, 'Distant candidate generates caveat note for different corridor');

  // Test Group 8: Race Condition Protection (Late Primary Arrival)
  console.log('\n--- 8. Race Condition Guard (Primary Driver Late Arrival) ---');
  const latePrimaryCheckIn = evaluateCheckInStatus({
    scheduledDispatch: '08:00 AM',
    checkedInAt: new Date('2026-09-17T07:56:00'),
    referenceTime: new Date('2026-09-17T07:56:00'),
    isReplaced: true, // Standby captain already assigned!
  });

  assert(latePrimaryCheckIn.status === 'PRIMARY_RETURNED', 'Late primary arrival after standby assignment evaluates to PRIMARY_RETURNED');

  // Test Group 9: Database Schema Verification
  console.log('\n--- 9. Database Schema Verification (Prisma) ---');
  try {
    const route = await prisma.route.findFirst({
      include: { assignedDriver: true },
    });
    assert(route !== null, `Found active route ${route?.code} for coverage testing`);

    const checkIns = await prisma.driverCheckIn.findMany({ take: 1 });
    assert(Array.isArray(checkIns), 'Prisma client queries DriverCheckIn table without error');

    const coverageEvents = await prisma.driverCoverageEvent.findMany({ take: 1 });
    assert(Array.isArray(coverageEvents), 'Prisma client queries DriverCoverageEvent table without error');

    const auditLogs = await prisma.coverageAuditLog.findMany({ take: 1 });
    assert(Array.isArray(auditLogs), 'Prisma client queries CoverageAuditLog table without error');
  } catch (err: any) {
    assert(false, `Database query failed: ${err.message}`);
  }

  // Summary
  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL DRIVER NO-SHOW & CONTINGENCY ENGINE TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.error(`💥 ${totalTests - passedTests} TESTS FAILED\n`);
    process.exit(1);
  }
}

runDriverCoverageTests().catch((err) => {
  console.error('Fatal error running driver coverage test suite:', err);
  process.exit(1);
});
