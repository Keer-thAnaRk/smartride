/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🌱 SMARTRIDE SUSTAINABILITY & CARBON IMPACT ENGINE — CONFIGURATION
 * ══════════════════════════════════════════════════════════════════════════════
 * Centralized, auditable assumptions for carbon footprint modeling.
 *
 * IMPORTANT:
 * All figures produced using this configuration are MODELED ESTIMATES based on
 * documented commute baseline assumptions, NOT direct sensor/tailpipe measurements.
 */

export interface SustainabilityConfig {
  modelVersion: string;
  baselineCarEmissionKgPerKm: number; // kg CO2e / km for private passenger car (default: 0.180 kg/km)
  baselineCarOccupancy: number;       // Average baseline passenger occupancy (default: 1.15)
  shuttleEmissionsKgPerKm: {
    SEDAN: number;                    // 0.180 kg CO2e / km
    SUV: number;                      // 0.220 kg CO2e / km
    VAN: number;                      // 0.260 kg CO2e / km
    MINI_BUS: number;                 // 0.320 kg CO2e / km
  };
  workingDaysPerMonth: number;        // Default 22 working days
  tripsPerWorkingDay: number;         // 2 commute legs (morning + evening)
  lastUpdated: string;
  updatedBy: string;
  disclaimerText: string;
}

export const DEFAULT_SUSTAINABILITY_CONFIG: SustainabilityConfig = {
  modelVersion: 'v1.0',
  baselineCarEmissionKgPerKm: 0.180,  // 180 g CO2e / km (ARAI / CPCB urban commute standard)
  baselineCarOccupancy: 1.15,         // Typical urban Indian single-occupancy commute
  shuttleEmissionsKgPerKm: {
    SEDAN: 0.180,
    SUV: 0.220,
    VAN: 0.260,
    MINI_BUS: 0.320,
  },
  workingDaysPerMonth: 22,
  tripsPerWorkingDay: 2,
  lastUpdated: '2026-09-17T10:00:00.000Z',
  updatedBy: 'SYSTEM',
  disclaimerText: 'Modeled estimates based on configurable commute assumptions (Model v1.0). Not direct tailpipe sensor measurements.',
};

/**
 * Returns the shuttle emission factor in kg CO2e / km for a given vehicle type string.
 */
export function getShuttleEmissionFactor(
  vehicleType: string = 'VAN',
  config: SustainabilityConfig = DEFAULT_SUSTAINABILITY_CONFIG
): number {
  const normalized = (vehicleType || 'VAN').toUpperCase();
  if (normalized.includes('MINI') || normalized.includes('BUS')) {
    return config.shuttleEmissionsKgPerKm.MINI_BUS;
  }
  if (normalized.includes('SUV')) {
    return config.shuttleEmissionsKgPerKm.SUV;
  }
  if (normalized.includes('SEDAN')) {
    return config.shuttleEmissionsKgPerKm.SEDAN;
  }
  // Default to VAN (Innova, Urbania, etc.)
  return config.shuttleEmissionsKgPerKm.VAN;
}
