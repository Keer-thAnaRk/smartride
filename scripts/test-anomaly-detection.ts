/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🧪 SMARTRIDE ANOMALY DETECTION & SECURITY MONITORING TEST SUITE
 * ══════════════════════════════════════════════════════════════════════════════
 * Comprehensive automated verification covering all 10 core scenarios:
 * 1. Sudden Speed Increase with Multi-Reading Persistence
 * 2. Unexpected Route Corridor Deviation Tiered Detection
 * 3. Unexpected Long Stop with Designated Stop Exemption
 * 4. GPS Signal Loss / Telemetry Interruption Tiers
 * 5. Unexpected Trip Start Guard
 * 6. Multiple Failed OTP Attempts with Privacy Redaction
 * 7. Event Deduplication and Duration Accumulation
 * 8. Multi-Signal Anomaly Correlation
 * 9. Smart Safety Score Impact & ETA Delay Detour Recalculation
 * 10. Role-Tailored RBAC Sanitization & Audit Redaction
 */

import { evaluateTripAnomalies, TelemetryReadingInput } from '../src/lib/security/anomaly-engine';
import { logSecurityAudit, getSecurityAuditLogs } from '../src/lib/security/audit-logger';
import { SR101_CORRIDOR_WAYPOINTS } from '../src/lib/ai/smart-eta';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (detail) console.error(`     ↳ Detail: ${detail}`);
  }
}

async function runAllTests() {
  console.log('\n🚨 STARTING SMARTRIDE ANOMALY DETECTION TEST SUITE\n' + '═'.repeat(70));

  // --------------------------------------------------------------------------
  // TEST 1: Sudden Speed Increase with Persistence Rule
  // --------------------------------------------------------------------------
  console.log('\n[1] Testing Sudden Speed Increase & Persistence Verification...');
  {
    // Reading 1: Spike of +35 km/h, but spikeCount = 0 (first reading)
    const reading1: TelemetryReadingInput = {
      tripId: 'test-trip-01',
      currentLocation: { lat: 12.9250, lng: 77.6680, speedKmH: 72 },
      previousTelemetry: { speedKmH: 35, consecutiveSpikeCount: 0 },
    };
    const res1 = evaluateTripAnomalies(reading1);
    const speedAnom1 = res1.activeAnomalies.find((a) => a.type === 'SPEED_ANOMALY');
    assert(!speedAnom1, 'First reading speed spike is suppressed awaiting persistence confirmation');

    // Reading 2: Persistent spike, spikeCount = 1 (second consecutive reading)
    const reading2: TelemetryReadingInput = {
      tripId: 'test-trip-01',
      currentLocation: { lat: 12.9252, lng: 77.6685, speedKmH: 72 },
      previousTelemetry: { speedKmH: 35, consecutiveSpikeCount: 1 },
    };
    const res2 = evaluateTripAnomalies(reading2);
    const speedAnom2 = res2.activeAnomalies.find((a) => a.type === 'SPEED_ANOMALY');
    assert(!!speedAnom2, 'Second reading triggers confirmed SPEED_ANOMALY');
    assert(speedAnom2?.severity === 'HIGH', 'Speed of 72 km/h classified as HIGH severity (>70 km/h)');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Unexpected Route Corridor Deviation Tiered Detection
  // --------------------------------------------------------------------------
  console.log('\n[2] Testing Route Corridor Deviation Tiered Thresholds...');
  {
    // A. Normal on corridor (< 150m)
    const normalInput: TelemetryReadingInput = {
      tripId: 'test-trip-02',
      currentLocation: { lat: 12.9250, lng: 77.6680, speedKmH: 36 }, // On corridor point
    };
    const resNorm = evaluateTripAnomalies(normalInput);
    assert(!resNorm.activeAnomalies.some((a) => a.type === 'ROUTE_DEVIATION'), 'Vehicle on corridor triggers 0 deviation anomalies');

    // B. Tier 1: Minor deviation (150m – 300m) -> MEDIUM
    const minorInput: TelemetryReadingInput = {
      tripId: 'test-trip-02',
      currentLocation: { lat: 12.9250, lng: 77.6725, speedKmH: 34 }, // 208m off
    };
    const resMinor = evaluateTripAnomalies(minorInput);
    const devMinor = resMinor.activeAnomalies.find((a) => a.type === 'ROUTE_DEVIATION');
    assert(!!devMinor, '208m deviation detected as ROUTE_DEVIATION');
    assert(devMinor?.severity === 'MEDIUM', '208m deviation classified as MEDIUM severity (150m-300m tier)');

    // C. Tier 2: Major deviation (300m – 800m) -> HIGH
    const majorInput: TelemetryReadingInput = {
      tripId: 'test-trip-02',
      currentLocation: { lat: 12.9250, lng: 77.6765, speedKmH: 34 }, // 392m off
    };
    const resMajor = evaluateTripAnomalies(majorInput);
    const devMajor = resMajor.activeAnomalies.find((a) => a.type === 'ROUTE_DEVIATION');
    assert(!!devMajor && devMajor.severity === 'HIGH', '392m deviation classified as HIGH severity (300m-800m tier)');

    // D. Tier 3: Extreme deviation (> 800m) -> CRITICAL
    const extremeInput: TelemetryReadingInput = {
      tripId: 'test-trip-02',
      currentLocation: { lat: 12.9200, lng: 77.6850, speedKmH: 34 }, // 1289m off
    };
    const resExtreme = evaluateTripAnomalies(extremeInput);
    const devExtreme = resExtreme.activeAnomalies.find((a) => a.type === 'ROUTE_DEVIATION');
    assert(!!devExtreme && devExtreme.severity === 'CRITICAL', '1289m deviation classified as CRITICAL severity (>800m tier)');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Unexpected Long Stop with Designated Stop Exemption
  // --------------------------------------------------------------------------
  console.log('\n[3] Testing Long Stop Detection with Stop Exemption Geo-fence...');
  {
    // A. Vehicle stationary at HSR Layout designated stop for 240 seconds (> 180s threshold)
    const stopLocation = SR101_CORRIDOR_WAYPOINTS[0]; // HSR Layout stop
    const exemptInput: TelemetryReadingInput = {
      tripId: 'test-trip-03',
      currentLocation: { lat: stopLocation.lat, lng: stopLocation.lng, speedKmH: 0 },
      stoppedDurationSeconds: 240,
    };
    const resExempt = evaluateTripAnomalies(exemptInput);
    assert(!resExempt.activeAnomalies.some((a) => a.type === 'LONG_STOP'), 'Stationary at designated corridor stop is EXEMPT from LONG_STOP alert');

    // B. Vehicle stationary mid-corridor (away from stops) for 240 seconds (3-5 min tier) -> MEDIUM
    const medStopInput: TelemetryReadingInput = {
      tripId: 'test-trip-03',
      currentLocation: { lat: 12.9390, lng: 77.6890, speedKmH: 0 }, // Mid-corridor
      stoppedDurationSeconds: 240,
    };
    const resMedStop = evaluateTripAnomalies(medStopInput);
    const stopMed = resMedStop.activeAnomalies.find((a) => a.type === 'LONG_STOP');
    assert(!!stopMed, 'Stationary away from designated stop triggers LONG_STOP anomaly');
    assert(stopMed?.severity === 'MEDIUM', '240s stationary stop classified as MEDIUM severity (3-5m tier)');

    // C. Vehicle stationary for 360 seconds (5-10 min tier) -> HIGH
    const highStopInput: TelemetryReadingInput = {
      tripId: 'test-trip-03',
      currentLocation: { lat: 12.9390, lng: 77.6890, speedKmH: 0 },
      stoppedDurationSeconds: 360,
    };
    const resHighStop = evaluateTripAnomalies(highStopInput);
    const stopHigh = resHighStop.activeAnomalies.find((a) => a.type === 'LONG_STOP');
    assert(stopHigh?.severity === 'HIGH', '360s stationary stop classified as HIGH severity (5-10m tier)');
  }

  // --------------------------------------------------------------------------
  // TEST 4: GPS Telemetry Loss / Interruption Tiers
  // --------------------------------------------------------------------------
  console.log('\n[4] Testing GPS Telemetry Interruption Tiers...');
  {
    const now = new Date();

    // A. Fresh GPS (5s ago) -> No anomaly
    const freshInput: TelemetryReadingInput = {
      tripId: 'test-trip-04',
      currentLocation: { lat: 12.9250, lng: 77.6680, speedKmH: 35, updatedAt: new Date(now.getTime() - 5000).toISOString() },
      referenceDate: now,
    };
    const resFresh = evaluateTripAnomalies(freshInput);
    assert(!resFresh.activeAnomalies.some((a) => a.type === 'GPS_SIGNAL_LOSS' || a.type === 'GPS_LOSS'), 'Fresh GPS updates trigger no signal loss anomaly');

    // B. 25s stale (15-60s tier) -> MEDIUM severity
    const stale25: TelemetryReadingInput = {
      tripId: 'test-trip-04',
      currentLocation: { lat: 12.9250, lng: 77.6680, speedKmH: 35, updatedAt: new Date(now.getTime() - 25000).toISOString() },
      referenceDate: now,
    };
    const res25 = evaluateTripAnomalies(stale25);
    const gps25 = res25.activeAnomalies.find((a) => a.type === 'GPS_SIGNAL_LOSS' || a.type === 'GPS_LOSS');
    assert(!!gps25 && gps25.severity === 'MEDIUM', '25s stale telemetry triggers MEDIUM GPS_SIGNAL_LOSS');

    // C. 75s stale (60-120s tier) -> HIGH severity
    const stale75: TelemetryReadingInput = {
      tripId: 'test-trip-04',
      currentLocation: { lat: 12.9250, lng: 77.6680, speedKmH: 35, updatedAt: new Date(now.getTime() - 75000).toISOString() },
      referenceDate: now,
    };
    const res75 = evaluateTripAnomalies(stale75);
    const gps75 = res75.activeAnomalies.find((a) => a.type === 'GPS_SIGNAL_LOSS' || a.type === 'GPS_LOSS');
    assert(!!gps75 && gps75.severity === 'HIGH', '75s stale telemetry triggers HIGH GPS_SIGNAL_LOSS');

    // D. 140s stale (> 120s tier) -> CRITICAL severity
    const stale140: TelemetryReadingInput = {
      tripId: 'test-trip-04',
      currentLocation: { lat: 12.9250, lng: 77.6680, speedKmH: 35, updatedAt: new Date(now.getTime() - 140000).toISOString() },
      referenceDate: now,
    };
    const res140 = evaluateTripAnomalies(stale140);
    const gps140 = res140.activeAnomalies.find((a) => a.type === 'GPS_SIGNAL_LOSS' || a.type === 'GPS_LOSS');
    assert(!!gps140 && gps140.severity === 'CRITICAL', '140s stale telemetry triggers CRITICAL GPS_SIGNAL_LOSS');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Unexpected Trip Start Guard
  // --------------------------------------------------------------------------
  console.log('\n[5] Testing Unexpected Trip Start Lifecycle Guard...');
  {
    const tripStartViolationInput: TelemetryReadingInput = {
      tripId: 'test-trip-05',
      currentLocation: { lat: 12.9121, lng: 77.6446, speedKmH: 15 },
      attemptedTripStartBeforeOtp: true,
      passengers: [
        { name: 'Rahul Verma', boarded: false },
        { name: 'Priya Sharma', boarded: false },
      ],
    };
    const resStart = evaluateTripAnomalies(tripStartViolationInput);
    const startAnom = resStart.activeAnomalies.find((a) => a.type === 'UNEXPECTED_TRIP_START');
    assert(!!startAnom, 'Trip dispatch before commuter OTP verification triggers UNEXPECTED_TRIP_START');
    assert(startAnom?.severity === 'HIGH', 'Trip start violation classified as HIGH severity');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Multiple Failed OTP Attempts with Privacy Redaction
  // --------------------------------------------------------------------------
  console.log('\n[6] Testing Multiple Failed OTP Attempts & Redaction...');
  {
    const otpFailInput: TelemetryReadingInput = {
      tripId: 'test-trip-06',
      currentLocation: { lat: 12.9121, lng: 77.6446, speedKmH: 0 },
      passengers: [
        { name: 'Rahul Verma', boarded: false, failedAttempts: 3 },
      ],
    };
    const resOtp = evaluateTripAnomalies(otpFailInput);
    const otpAnom = resOtp.activeAnomalies.find(
      (a) => a.type === 'MULTIPLE_FAILED_OTP' || a.type === 'MULTIPLE_OTP_FAILURES'
    );
    assert(!!otpAnom, '3 consecutive failed OTP attempts triggers MULTIPLE_FAILED_OTP');
    assert(otpAnom?.severity === 'HIGH', '3 failed attempts classified as HIGH severity security alert');

    // Strict zero raw OTP leakage verification
    const metadataStr = JSON.stringify(otpAnom?.metadata || {});
    assert(!metadataStr.includes('4821') && !metadataStr.includes('otp') && !metadataStr.includes('rideOtp'),
      'CRITICAL SECURITY: Zero raw OTP exposure in anomaly metadata'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 7: Event Deduplication and Duration Accumulation
  // --------------------------------------------------------------------------
  console.log('\n[7] Testing Event Deduplication & Duration Accumulation...');
  {
    const initialAnom = {
      id: 'anom-dev-existing-1',
      tripId: 'test-trip-07',
      type: 'ROUTE_DEVIATION' as const,
      severity: 'HIGH' as const,
      status: 'ACTIVE' as const,
      title: 'Major Route Deviation',
      description: 'Vehicle deviated from corridor',
      detectedAt: new Date(Date.now() - 30000).toISOString(),
      metadata: {
        durationSeconds: 30,
        deviationMeters: 392,
        maxDeviationMeters: 392,
        latestDeviationMeters: 392,
      },
    };

    const nextTickInput: TelemetryReadingInput = {
      tripId: 'test-trip-07',
      currentLocation: { lat: 12.9250, lng: 77.6765, speedKmH: 34 }, // 392m deviation
      existingAnomalies: [initialAnom],
    };

    const resDedup = evaluateTripAnomalies(nextTickInput);
    const devAnomalies = resDedup.activeAnomalies.filter((a) => a.type === 'ROUTE_DEVIATION');
    assert(devAnomalies.length === 1, 'Deduplication: Only 1 active deviation anomaly exists (no spamming)');
    assert(devAnomalies[0].id === initialAnom.id, 'Deduplication: Existing anomaly ID was updated in place');
    assert(devAnomalies[0].metadata.durationSeconds! === 34, `Duration accumulated correctly to ${devAnomalies[0].metadata.durationSeconds}s`);
    assert(devAnomalies[0].metadata.maxDeviationMeters! >= 392, 'Max deviation updated to reflect peak variance');
  }

  // --------------------------------------------------------------------------
  // TEST 8: Multi-Signal Anomaly Correlation
  // --------------------------------------------------------------------------
  console.log('\n[8] Testing Multi-Signal Correlation (Deviation + Speed)...');
  {
    const multiSignalInput: TelemetryReadingInput = {
      tripId: 'test-trip-08',
      currentLocation: { lat: 12.9250, lng: 77.6765, speedKmH: 72 }, // 392m deviation AND 72 km/h speed
      previousTelemetry: { speedKmH: 35, consecutiveSpikeCount: 2 },
    };

    const resMulti = evaluateTripAnomalies(multiSignalInput);
    assert(!!resMulti.multiSignalAnomaly, 'Correlated multi-signal anomaly created for simultaneous detour + speed');
    assert(resMulti.multiSignalAnomaly?.title.includes('Aggressive Off-Corridor Detour'),
      `Correlated event title matches Aggressive Detour: ${resMulti.multiSignalAnomaly?.title}`
    );
    assert(resMulti.highestSeverity === 'CRITICAL', 'Multi-signal correlation elevated to CRITICAL severity');
  }

  // --------------------------------------------------------------------------
  // TEST 9: Smart Safety Score Impact & ETA Delay Detour Recalculation
  // --------------------------------------------------------------------------
  console.log('\n[9] Testing Safety Score Impact & ETA Detour Recalculation...');
  {
    const deviationInput: TelemetryReadingInput = {
      tripId: 'test-trip-09',
      currentLocation: { lat: 12.9250, lng: 77.6765, speedKmH: 35 }, // 392m off route (High severity, -18 penalty)
    };

    const resImpact = evaluateTripAnomalies(deviationInput);
    assert(resImpact.safetyScoreImpact.currentScore < resImpact.safetyScoreImpact.previousScore,
      `Safety score penalized from ${resImpact.safetyScoreImpact.previousScore} to ${resImpact.safetyScoreImpact.currentScore}`
    );
    assert(resImpact.etaImpact.delayMinutes > 0,
      `ETA delay recalculated with detour penalty: +${resImpact.etaImpact.delayMinutes} min`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 10: Role-Tailored RBAC Sanitization & Audit Trail
  // --------------------------------------------------------------------------
  console.log('\n[10] Testing RBAC Sanitization & Immutable Audit Trail...');
  {
    // Verify sanitized public status projection
    const criticalInput: TelemetryReadingInput = {
      tripId: 'test-trip-10',
      currentLocation: { lat: 12.9200, lng: 77.6850, speedKmH: 88 }, // Extreme deviation + critical speed
      previousTelemetry: { speedKmH: 35, consecutiveSpikeCount: 2 },
    };
    const resPublic = evaluateTripAnomalies(criticalInput);
    assert(resPublic.sanitizedStatus.status === 'SAFETY_MONITORING', 'Critical incident projects as calm SAFETY_MONITORING');
    assert(!resPublic.sanitizedStatus.headline.includes('CRITICAL') && !resPublic.sanitizedStatus.headline.includes('Lockout'),
      'Public projection does not cause passenger panic or leak internal severity codes'
    );

    // Test Audit Logger Redaction
    const auditEntry = await logSecurityAudit({
      action: 'ANOMALY_RESOLVED',
      tripId: 'test-trip-10',
      actorId: 'admin-1',
      actorName: 'Operations Lead',
      details: 'Incident verified and cleared',
      metadata: {
        reason: 'Authorized detour',
        rideOtp: '4821', // SHOULD BE PURGED
        password: 'supersecretpassword', // SHOULD BE PURGED
      },
    });

    assert(auditEntry.metadata?.reason === 'Authorized detour', 'Legitimate metadata preserved in audit entry');
    assert(auditEntry.metadata?.rideOtp === undefined, 'CRITICAL: rideOtp strictly purged from audit log');
    assert(auditEntry.metadata?.password === undefined, 'CRITICAL: password strictly purged from audit log');

    const logs = await getSecurityAuditLogs(5);
    assert(logs.length > 0, 'Security audit log retrieves recorded history');
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n' + '═'.repeat(70));
  console.log(`🏁 TEST EXECUTION COMPLETE: ${passedTests} / ${totalTests} TESTS PASSED`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL 10 ANOMALY DETECTION SUITE SCENARIOS VERIFIED SUCCESSFULLY!\n');
  } else {
    console.error(`⚠️ ${totalTests - passedTests} TESTS FAILED\n`);
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
