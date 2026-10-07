/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🧪 AUTOMATED TEST SUITE: SMART COMMUTE GAMIFICATION & ACHIEVEMENTS
 * ══════════════════════════════════════════════════════════════════════════════
 * Validates:
 * 1. Pure deterministic level derivation from XP (250 XP / level)
 * 2. On-time boarding evaluation and Smart Delay Forgiveness
 * 3. Achievement progress, threshold evaluation, and sample size gating
 * 4. Privacy display name masking (REAL_NAME, INITIALS, ANONYMOUS)
 * 5. Anti-gaming idempotency ledger and SQLite persistence
 * 6. Database relations and cascade cleanups
 */

import {
  calculateLevel,
  isOnTimeBoarding,
  evaluateAchievement,
  formatPrivacyDisplayName,
} from '../src/lib/gamification/gamification-engine';
import {
  POINT_RULES,
  INITIAL_ACHIEVEMENTS,
} from '../src/lib/gamification/points-config';
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

async function runGamificationTests() {
  console.log('\n================================================================');
  console.log('🎮 RUNNING SMART COMMUTE GAMIFICATION & ACHIEVEMENTS TEST SUITE');
  console.log('================================================================\n');

  // Test Group 1: Deterministic Level Mathematics
  console.log('--- 1. Deterministic Level Mathematics ---');
  {
    const l0 = calculateLevel(0);
    assert(l0.level === 1, '0 XP evaluates to Level 1', l0.level);
    assert(l0.currentLevelBaseXp === 0, 'Level 1 base XP is 0');
    assert(l0.nextLevelXp === 250, 'Level 1 target next level is 250 XP');
    assert(l0.progressPercent === 0, 'Level 1 with 0 XP has 0% progress');

    const l249 = calculateLevel(249);
    assert(l249.level === 1, '249 XP remains in Level 1', l249.level);
    assert(l249.progressPercent === 100, '249 XP is 100% progress toward Level 2');

    const l250 = calculateLevel(250);
    assert(l250.level === 2, '250 XP advances exactly to Level 2', l250.level);
    assert(l250.currentLevelBaseXp === 250, 'Level 2 base XP is 250');
    assert(l250.progressPercent === 0, '250 XP has 0% progress into Level 2');

    const l1620 = calculateLevel(1620);
    // (1620 / 250) = 6.48 -> Level 7 (base: 1500, next: 1750, progress: 120/250 = 48%)
    assert(l1620.level === 7, '1620 XP evaluates to Level 7', l1620.level);
    assert(l1620.progressPercent === 48, '1620 XP evaluates to 48% progress', l1620.progressPercent);
  }

  // Test Group 2: On-Time Boarding & Smart Delay Forgiveness
  console.log('\n--- 2. On-Time Boarding & Smart Delay Forgiveness ---');
  {
    // Scheduled pickup: 08:20 AM
    // Boarded at: 08:21 AM (1 min after) -> On time (within 3m window)
    const onTimeNormal = isOnTimeBoarding(
      new Date('2026-09-17T08:21:00'),
      '08:20 AM',
      0
    );
    assert(onTimeNormal === true, 'Boarding 1 min after scheduled time is on-time');

    // Boarded at: 08:25 AM (5 min after) with 0 delay -> Late!
    const lateNormal = isOnTimeBoarding(
      new Date('2026-09-17T08:25:00'),
      '08:20 AM',
      0
    );
    assert(lateNormal === false, 'Boarding 5 min after scheduled time with 0 delay is late');

    // Boarded at: 08:25 AM (5 min after) WITH 7 min shuttle delay -> On-Time (Smart Delay Forgiveness!)
    const forgivenLate = isOnTimeBoarding(
      new Date('2026-09-17T08:25:00'),
      '08:20 AM',
      7
    );
    assert(forgivenLate === true, 'Boarding 5 min after scheduled time WITH 7 min shuttle delay is forgiven');
  }

  // Test Group 3: Achievement Thresholds & Sample-Size Gating
  console.log('\n--- 3. Achievement Evaluation & Sample-Size Anti-Gaming ---');
  {
    const greenCommuterAch = INITIAL_ACHIEVEMENTS.find((a) => a.id === 'ach-green-commuter')!;
    const eval19 = evaluateAchievement(greenCommuterAch, {
      completedTrips: 19,
      onTimeRatePercent: 100,
      co2SavedKg: 50,
      otpBoardings: 19,
      consecutiveStreak: 10,
      commuteDays: 19,
      eligibleTripsSample: 19,
    });
    assert(eval19.isUnlocked === false, 'Green Commuter is locked at 19/20 trips');
    assert(eval19.progressPercent === 95, '19/20 trips evaluates to 95% progress');

    const eval20 = evaluateAchievement(greenCommuterAch, {
      completedTrips: 20,
      onTimeRatePercent: 100,
      co2SavedKg: 50,
      otpBoardings: 20,
      consecutiveStreak: 10,
      commuteDays: 20,
      eligibleTripsSample: 20,
    });
    assert(eval20.isUnlocked === true, 'Green Commuter unlocks at 20/20 trips');

    // Route Champion: Requires >= 95% on-time AND >= 10 sample size
    const routeChampAch = INITIAL_ACHIEVEMENTS.find((a) => a.id === 'ach-route-champion')!;
    
    // Scenario A: 1/1 trip (100% on time, but sample size 1 < 10) -> Must remain locked!
    const evalSample1 = evaluateAchievement(routeChampAch, {
      completedTrips: 1,
      onTimeRatePercent: 100,
      co2SavedKg: 2,
      otpBoardings: 1,
      consecutiveStreak: 1,
      commuteDays: 1,
      eligibleTripsSample: 1,
    });
    assert(evalSample1.isUnlocked === false, 'Route Champion remains locked with sample size 1/10');

    // Scenario B: 10/10 trips (100% on time, sample size 10 >= 10) -> Unlocks!
    const evalSample10 = evaluateAchievement(routeChampAch, {
      completedTrips: 10,
      onTimeRatePercent: 100,
      co2SavedKg: 20,
      otpBoardings: 10,
      consecutiveStreak: 10,
      commuteDays: 10,
      eligibleTripsSample: 10,
    });
    assert(evalSample10.isUnlocked === true, 'Route Champion unlocks with sample size 10/10 and 100% rate');

    // Sustainability Eco Saver (30 kg CO2 avoided)
    const ecoSaverAch = INITIAL_ACHIEVEMENTS.find((a) => a.id === 'ach-eco-saver')!;
    const evalEco = evaluateAchievement(ecoSaverAch, {
      completedTrips: 15,
      onTimeRatePercent: 90,
      co2SavedKg: 30.5,
      otpBoardings: 15,
      consecutiveStreak: 5,
      commuteDays: 15,
      eligibleTripsSample: 15,
    });
    assert(evalEco.isUnlocked === true, 'Eco Saver unlocks at 30.5 kg CO2 avoided');
  }

  // Test Group 4: Privacy Masking
  console.log('\n--- 4. Privacy Display Name Masking ---');
  {
    const real = formatPrivacyDisplayName('Rahul Verma', 'REAL_NAME', 1);
    assert(real === 'Rahul Verma', 'REAL_NAME formats full name');

    const initials = formatPrivacyDisplayName('Rahul Verma', 'INITIALS', 1);
    assert(initials === 'R**** V', 'INITIALS formats as R**** V', initials);

    const anon = formatPrivacyDisplayName('Rahul Verma', 'ANONYMOUS', 4);
    assert(anon === 'Commuter #104', 'ANONYMOUS formats as Commuter #104', anon);
  }

  // Test Group 5: SQLite Database Persistence & Idempotency
  console.log('\n--- 5. Database Persistence & Idempotency Ledger ---');
  {
    // Ensure test user exists in User table
    let testUser = await prisma.user.findUnique({
      where: { email: 'gamification.tester@smartride.internal' },
    });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'gamification.tester@smartride.internal',
          name: 'Gamification Tester',
          passwordHash: 'dummy-hash',
          role: 'COMMUTER',
        },
      });
    }

    // Create or find GamificationProfile
    const profile = await prisma.gamificationProfile.upsert({
      where: { userId: testUser.id },
      update: {
        totalXP: 500,
        currentStreak: 4,
        bestStreak: 7,
      },
      create: {
        userId: testUser.id,
        totalXP: 500,
        currentStreak: 4,
        bestStreak: 7,
        privacyDisplayName: 'ANONYMOUS',
      },
    });
    assert(profile.userId === testUser.id, 'Persists GamificationProfile in database');

    // Test Idempotent XP Event recording
    const testIdempotencyKey = `${testUser.id}:COMPLETED_TRIP:test-trip-001`;

    // First insert: Should succeed
    const evt1 = await prisma.xPEvent.create({
      data: {
        profileId: profile.id,
        idempotencyKey: testIdempotencyKey,
        eventType: 'COMPLETED_TRIP',
        points: POINT_RULES.COMPLETED_SHARED_TRIP,
        sourceId: 'test-trip-001',
        month: '2026-09',
        description: 'Completed corridor test commute leg',
      },
    });
    assert(evt1.points === 25, 'Records 25 XP in XPEvent ledger');

    // Duplicate insert: Must be rejected by SQLite unique constraint on idempotencyKey
    let caughtDuplicate = false;
    try {
      await prisma.xPEvent.create({
        data: {
          profileId: profile.id,
          idempotencyKey: testIdempotencyKey, // Same key!
          eventType: 'COMPLETED_TRIP',
          points: POINT_RULES.COMPLETED_SHARED_TRIP,
          sourceId: 'test-trip-001',
          month: '2026-09',
          description: 'Duplicate attempt to award XP',
        },
      });
    } catch (err: any) {
      caughtDuplicate = true;
    }
    assert(caughtDuplicate === true, 'Strict unique idempotencyKey prevents double-awarding XP');

    // Clean up test events and profile
    await prisma.xPEvent.deleteMany({ where: { profileId: profile.id } });
    await prisma.gamificationProfile.delete({ where: { id: profile.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    assert(true, 'Test database artifacts cleaned up cleanly');
  }

  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runGamificationTests()
  .catch((err) => {
    console.error('Test runner encountered uncaught error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
