import { calculateSmartEta, calculateHaversineDistance, addMinutesToTimeString } from '../src/lib/ai/smart-eta';

console.log('=' .repeat(70));
console.log('🧪 TESTING SMART ETA & DELAY PREDICTION ENGINE');
console.log('=' .repeat(70));

// Test 1: Haversine distance
const dist = calculateHaversineDistance(12.9121, 77.6446, 12.9850, 77.7314);
console.log(`\n[TEST 1] Distance from HSR Layout to ITPB Whitefield: ${dist} km`);
if (dist < 10 || dist > 20) throw new Error(`Unexpected distance: ${dist}`);

// Test 2: Smart ETA Prediction at Bangalore EcoSpace corridor
const refDate = new Date('2026-09-17T08:32:00'); // Morning peak 8:32 AM
const prediction = calculateSmartEta(
  { lat: 12.9360, lng: 77.6920, speedKmH: 38 },
  undefined,
  refDate
);

console.log(`\n[TEST 2] Smart ETA Prediction Result:`);
console.log(`   • Next Stop: ${prediction.nextStopName} (${prediction.distanceToNextStopKm} km)`);
console.log(`   • Status Indicator: ${prediction.statusIndicator}`);
console.log(`   • Current Delay: +${prediction.currentDelayMinutes} min`);
console.log(`   • Normal Scheduled ETA: ${prediction.normalScheduledEta}`);
console.log(`   • Traffic-Adjusted ETA: ${prediction.trafficAdjustedEta}`);
console.log(`   • Corridor Velocity: ${prediction.currentSpeedKmH} km/h (Normal: ${prediction.normalCorridorSpeedKmH} km/h)`);
console.log(`   • Traffic Condition: ${prediction.trafficCondition}`);

// Verify all required user fields
if (!prediction.statusIndicator.includes('Arriving in')) {
  throw new Error(`Expected statusIndicator to contain 'Arriving in', got: ${prediction.statusIndicator}`);
}
if (prediction.currentDelayMinutes < 0) {
  throw new Error(`Expected positive or zero delay, got: ${prediction.currentDelayMinutes}`);
}
if (!prediction.normalScheduledEta || !prediction.trafficAdjustedEta) {
  throw new Error('Missing normal or traffic-adjusted ETA');
}

console.log(`\n[TEST 3] Stop-by-Stop Dual ETA Timeline:`);
prediction.allStops.forEach((stop) => {
  console.log(`   • ${stop.stopName}: Scheduled ${stop.scheduledTime} -> Predicted ${stop.trafficAdjustedTime} (${stop.delayMinutes > 0 ? `+${stop.delayMinutes}m delay` : 'On time'}) [${stop.status}]`);
});

console.log('\n' + '=' .repeat(70));
console.log('🎉 ALL SMART ETA TESTS PASSED WITH 100% SUCCESS!');
console.log('=' .repeat(70));
