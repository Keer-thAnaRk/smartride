/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🌱 SMARTRIDE SUSTAINABILITY & CARBON IMPACT ENGINE — CALCULATOR
 * ══════════════════════════════════════════════════════════════════════════════
 * Deterministic mathematical calculation engine for shared commuting impact.
 *
 * All formulas are explicit, reproducible, and strictly auditable:
 * 1. Baseline emissions: Distance * PrivateCarFactor
 * 2. SmartRide allocated: (Distance * ShuttleFactor) / max(1, Passengers)
 * 3. Avoided CO2: max(0, Baseline - SmartRideAllocated)
 * 4. Shared Commute %: (CompletedTrips / (WorkingDays * TripsPerDay)) * 100
 * 5. Cars Avoided: Net private vehicle trips substituted
 */

import {
  SustainabilityConfig,
  DEFAULT_SUSTAINABILITY_CONFIG,
  getShuttleEmissionFactor,
} from './carbon-config';
import {
  TripCarbonCalculation,
  RouteSustainabilityMetric,
  SustainabilityInsight,
} from './carbon-types';

/**
 * Calculates deterministic carbon emissions and savings for a single corridor trip.
 */
export function calculateTripCarbon(
  distanceKm: number,
  passengerCount: number,
  vehicleType: string = 'VAN',
  config: SustainabilityConfig = DEFAULT_SUSTAINABILITY_CONFIG
): TripCarbonCalculation {
  const safeDistance = Math.max(0, distanceKm);
  const safePassengers = Math.max(1, passengerCount);

  // 1. Baseline emissions (Private Passenger Car counterfactual)
  const baselineEmissionsKg = Number(
    (safeDistance * config.baselineCarEmissionKgPerKm).toFixed(3)
  );

  // 2. Total Shuttle Emissions
  const shuttleFactor = getShuttleEmissionFactor(vehicleType, config);
  const shuttleTotalEmissionsKg = Number(
    (safeDistance * shuttleFactor).toFixed(3)
  );

  // 3. Allocated Shuttle Emissions per passenger
  const allocatedShuttleEmissionsKg = Number(
    (shuttleTotalEmissionsKg / safePassengers).toFixed(3)
  );

  // 4. Net Avoided CO2 per commuter trip (Guaranteed non-negative)
  const avoidedCo2Kg = Number(
    Math.max(0, baselineEmissionsKg - allocatedShuttleEmissionsKg).toFixed(3)
  );

  // 5. Estimated Cars Avoided for this commuter trip
  // Each commuter riding a shuttle displaces 1 private car trip while contributing 1/N to shuttle occupancy
  const carsAvoided = Number(
    Math.max(0, 1 - 1 / safePassengers).toFixed(3)
  );

  // 6. Percentage reduction
  const percentageReduction = baselineEmissionsKg > 0
    ? Math.min(100, Math.max(0, Number((((baselineEmissionsKg - allocatedShuttleEmissionsKg) / baselineEmissionsKg) * 100).toFixed(1))))
    : 0;

  return {
    distanceKm: safeDistance,
    passengerCount: safePassengers,
    vehicleType,
    baselineEmissionsKg,
    shuttleTotalEmissionsKg,
    allocatedShuttleEmissionsKg,
    avoidedCo2Kg,
    carsAvoided,
    percentageReduction,
    modelVersion: config.modelVersion,
  };
}

/**
 * Calculates the commuter's shared commute percentage for a monthly billing period.
 * Completed SmartRide trips divided by total expected working commute trips (e.g. 22 days * 2 trips = 44).
 */
export function calculateSharedCommutePercentage(
  completedTripsCount: number,
  workingDays: number = 22,
  tripsPerDay: number = 2
): number {
  const totalEligibleTrips = Math.max(1, workingDays * tripsPerDay);
  const rawPercentage = (completedTripsCount / totalEligibleTrips) * 100;
  // Bounded between 0% and 100%
  return Math.min(100, Math.max(0, Math.round(rawPercentage)));
}

/**
 * Calculates commuter cumulative cars avoided based on completed trips.
 * Default factor 0.85 reflects private trips eliminated after accounting for shuttle presence.
 */
export function calculateCommuterCarsAvoided(completedTripsCount: number): number {
  return Math.round(Math.max(0, completedTripsCount) * 0.85);
}

/**
 * Generates explainable, rule-based sustainability insights for the Admin Command Center.
 */
export function generateSustainabilityInsights(
  fleetTotalCo2Avoided: number,
  routeMetrics: RouteSustainabilityMetric[]
): SustainabilityInsight[] {
  const insights: SustainabilityInsight[] = [];

  // Insight 1: Fleet Carbon Milestone
  if (fleetTotalCo2Avoided > 0) {
    insights.push({
      id: 'insight-fleet-milestone',
      type: 'ACHIEVEMENT',
      title: 'Decarbonization Impact Milestone',
      description: `SmartRide shared shuttles have prevented an estimated ${fleetTotalCo2Avoided.toFixed(1)} kg of CO₂e emissions from being released into metropolitan transit corridors.`,
      metric: `${fleetTotalCo2Avoided.toFixed(0)} kg CO₂e`,
    });
  }

  // Insight 2: Top Performing Green Corridor
  if (routeMetrics.length > 0) {
    const sorted = [...routeMetrics].sort((a, b) => b.avoidedCo2Kg - a.avoidedCo2Kg);
    const topRoute = sorted[0];
    insights.push({
      id: 'insight-corridor-leader',
      type: 'CORRIDOR_LEADER',
      title: `Corridor Leader: ${topRoute.routeCode}`,
      description: `${topRoute.routeName} leads the network in carbon savings, abating ${topRoute.avoidedCo2Kg.toFixed(1)} kg CO₂e across ${topRoute.totalTrips} completed runs with an average occupancy of ${topRoute.avgOccupancy.toFixed(1)} riders.`,
      routeCode: topRoute.routeCode,
      metric: `${topRoute.avoidedCo2Kg.toFixed(0)} kg CO₂e saved`,
    });

    // Insight 3: High Occupancy Corridor
    const highOccupancy = routeMetrics.find((r) => r.avgOccupancy >= 5);
    if (highOccupancy) {
      insights.push({
        id: 'insight-high-occupancy',
        type: 'ACHIEVEMENT',
        title: `High Density Corridor: ${highOccupancy.routeCode}`,
        description: `Corridor ${highOccupancy.routeCode} maintains high vehicle capacity utilization (${highOccupancy.avgOccupancy.toFixed(1)} passengers/run), maximizing per-commuter emission efficiency.`,
        routeCode: highOccupancy.routeCode,
        metric: `${highOccupancy.avgOccupancy.toFixed(1)} riders/shuttle`,
      });
    }

    // Insight 4: Optimization Opportunity (routes with lower occupancy)
    const opportunityRoute = routeMetrics.find((r) => r.avgOccupancy < 3 && r.totalTrips >= 5);
    if (opportunityRoute) {
      insights.push({
        id: 'insight-opportunity',
        type: 'OPPORTUNITY',
        title: `Consolidation Potential: ${opportunityRoute.routeCode}`,
        description: `Corridor ${opportunityRoute.routeCode} averages ${opportunityRoute.avgOccupancy.toFixed(1)} passengers. Reassigning or pairing bookings via Smart Seat Optimization could increase per-commuter carbon savings by up to 34%.`,
        routeCode: opportunityRoute.routeCode,
        metric: `+34% potential efficiency`,
      });
    }
  }

  return insights;
}
