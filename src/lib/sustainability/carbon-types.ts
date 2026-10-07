/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🌱 SMARTRIDE SUSTAINABILITY & CARBON IMPACT ENGINE — TYPE DEFINITIONS
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { SustainabilityConfig } from './carbon-config';

export interface TripCarbonCalculation {
  distanceKm: number;
  passengerCount: number;
  vehicleType: string;
  baselineEmissionsKg: number;
  shuttleTotalEmissionsKg: number;
  allocatedShuttleEmissionsKg: number;
  avoidedCo2Kg: number;
  carsAvoided: number;
  percentageReduction: number;
  modelVersion: string;
}

export interface MonthlySustainabilityPoint {
  month: string;              // e.g. "Apr", "May"
  avoidedCo2Kg: number;       // kg CO2e saved in this month
  sharedTrips: number;        // trips taken
  carsAvoided: number;        // private vehicle trips substituted
  distanceKm: number;         // distance commuted
}

export interface CommuterSustainabilitySummary {
  commuterId: string;
  totalSharedTrips: number;
  totalDistanceKm: number;
  estimatedCo2AvoidedKg: number;
  estimatedCarsAvoided: number;
  sharedCommutePercentage: number;
  baselineEmissionsKg: number;
  smartrideEmissionsKg: number;
  monthlyTrend: MonthlySustainabilityPoint[];
  activeModelVersion: string;
  disclaimer: string;
}

export interface RouteSustainabilityMetric {
  routeId: string;
  routeCode: string;
  routeName: string;
  distanceKm: number;
  totalTrips: number;
  totalPassengers: number;
  avgOccupancy: number;
  avoidedCo2Kg: number;
  carsAvoided: number;
  efficiencyRating: 'EXCELLENT' | 'GOOD' | 'MODERATE';
}

export interface SustainabilityInsight {
  id: string;
  type: 'ACHIEVEMENT' | 'OPPORTUNITY' | 'CORRIDOR_LEADER' | 'FLEET_PEAK';
  title: string;
  description: string;
  routeCode?: string;
  metric?: string;
}

export interface FleetSustainabilitySummary {
  fleetTotalCo2AvoidedKg: number;
  fleetCarsAvoidedCount: number;
  fleetTotalSharedTrips: number;
  fleetTotalDistanceKm: number;
  fleetAvgCo2SavingsPerCommuter: number;
  fleetSharedCommutePercent: number;
  activeCommutersCount: number;
  monthlyTrend: MonthlySustainabilityPoint[];
  routeLeaderboard: RouteSustainabilityMetric[];
  insights: SustainabilityInsight[];
  activeConfig: SustainabilityConfig;
  disclaimer: string;
}
