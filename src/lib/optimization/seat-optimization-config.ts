/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 💺 SMARTRIDE (COMMUTESYNC) — SEAT OPTIMIZATION CONFIGURATION
 * ══════════════════════════════════════════════════════════════════════════════
 * Centralized weights, thresholds, and operational constraints for the
 * Smart Seat Optimization Engine.
 */

export const SEAT_OPTIMIZATION_CONFIG = {
  // 1. Objective Function Cost Weights (Sum = 1.0)
  WEIGHTS: {
    fragmentation: 0.35,      // w1: Cost of spatial & temporal gaps between seats
    reassignment: 0.30,       // w2: Friction penalty for disturbing established passenger seats
    segmentMismatch: 0.20,    // w3: Cost of leaving compatible non-overlapping legs on separate seats
    occupancyWaste: 0.15,     // w4: Cost of using high-index seats when lower-index seats can be packed
  },

  // 2. Minimum Required Improvement Gating
  MIN_IMPROVEMENT_PERCENT: 5.0, // Only suggest reallocations if cost decreases by >= 5%

  // 3. Reassignment Friction Penalty
  REASSIGNMENT_BASE_PENALTY: 15.0, // Base penalty score added to objective for each moved passenger

  // 4. Vehicle Capacity Configurations
  DEFAULT_CAPACITIES: {
    SEDAN: 4,
    SUV: 6,
    MINI_BUS: 12,
  },

  // 5. Route Segment Direction Constants
  DIRECTIONS: {
    OUTBOUND: 'OUTBOUND', // Morning shift: residential hub -> tech corridor
    INBOUND: 'INBOUND',   // Evening shift: tech corridor -> residential hub
  },
} as const;

export type OptimizationDirection = typeof SEAT_OPTIMIZATION_CONFIG.DIRECTIONS[keyof typeof SEAT_OPTIMIZATION_CONFIG.DIRECTIONS];
