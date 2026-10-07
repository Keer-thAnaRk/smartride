import crypto from 'crypto';
import { SEAT_OPTIMIZATION_CONFIG } from './seat-optimization-config';
import {
  PassengerSegment,
  OptimizationMetrics,
  SeatReassignment,
  OptimizationPreviewResult,
  SeatMapEntry,
} from './seat-optimization-types';

/**
 * Calculates the number of shared corridor legs between two passengers.
 * Stops are indexed 0, 1, ..., N-1.
 * Segment A: [pA, dA], Segment B: [pB, dB].
 */
export function calculateRouteOverlap(segA: PassengerSegment, segB: PassengerSegment): number {
  const overlapStart = Math.max(segA.pickupIndex, segB.pickupIndex);
  const overlapEnd = Math.min(segA.dropIndex, segB.dropIndex);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Validates that no two passengers assigned to the same physical seat overlap in transit.
 */
export function isSeatConflictFree(passengersOnSeat: PassengerSegment[]): boolean {
  for (let i = 0; i < passengersOnSeat.length; i++) {
    for (let j = i + 1; j < passengersOnSeat.length; j++) {
      if (calculateRouteOverlap(passengersOnSeat[i], passengersOnSeat[j]) > 0) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Calculates deterministic seat fragmentation score (0 = perfectly consolidated, 100 = highly fragmented).
 */
export function calculateFragmentationScore(
  seatAllocation: Map<number, PassengerSegment[]>,
  capacity: number,
  numStops: number
): { score: number; holesCount: number; unpairedLegs: number } {
  const totalLegsPerSeat = Math.max(1, numStops - 1);

  // 1. Spatial Fragmentation (Gaps between occupied seats)
  let firstOccupied = -1;
  let lastOccupied = -1;
  let holesCount = 0;
  let occupiedSeatsCount = 0;
  let alternatingTransitions = 0;

  for (let s = 1; s <= capacity; s++) {
    const isOccupied = (seatAllocation.get(s)?.length ?? 0) > 0;
    if (isOccupied) {
      occupiedSeatsCount++;
      if (firstOccupied === -1) firstOccupied = s;
      lastOccupied = s;
    }
  }

  // Count vacant holes enclosed between occupied seats
  if (firstOccupied !== -1 && lastOccupied !== -1 && lastOccupied > firstOccupied) {
    for (let s = firstOccupied; s <= lastOccupied; s++) {
      const isOccupied = (seatAllocation.get(s)?.length ?? 0) > 0;
      if (!isOccupied) holesCount++;
    }
  }

  const span = Math.max(1, lastOccupied - firstOccupied);
  const spatialFrag = holesCount === 0 ? 0 : Math.min(100, Math.round((holesCount / span) * 100));

  // 2. Temporal / Corridor Fragmentation (Unused legs on seats that are in use)
  let unusedLegsTotal = 0;
  let unpairedLegs = 0;

  seatAllocation.forEach((passengers, seatNum) => {
    if (passengers.length > 0) {
      let legsCovered = 0;
      passengers.forEach((p) => {
        legsCovered += p.dropIndex - p.pickupIndex;
      });
      const unused = Math.max(0, totalLegsPerSeat - legsCovered);
      unusedLegsTotal += unused;
      if (unused > 0) unpairedLegs++;
    }
  });

  const maxPossibleLegsInUse = Math.max(1, occupiedSeatsCount * totalLegsPerSeat);
  const temporalFrag = Math.min(100, Math.round((unusedLegsTotal / maxPossibleLegsInUse) * 100));

  // Combined score (0 - 100)
  const combinedScore = Math.round(0.5 * spatialFrag + 0.5 * temporalFrag);

  return {
    score: combinedScore,
    holesCount,
    unpairedLegs,
  };
}

/**
 * Calculates total objective cost J(S) for a candidate allocation.
 */
export function calculateObjectiveCost(
  seatAllocation: Map<number, PassengerSegment[]>,
  initialSeats: Map<string, number>,
  capacity: number,
  numStops: number
): { totalCost: number; metrics: OptimizationMetrics } {
  const frag = calculateFragmentationScore(seatAllocation, capacity, numStops);

  // Reassignment penalty
  let movedCount = 0;
  let totalPassengers = 0;

  seatAllocation.forEach((passengers, currentSeat) => {
    passengers.forEach((p) => {
      totalPassengers++;
      const initSeat = initialSeats.get(p.passengerId);
      if (initSeat !== undefined && initSeat !== currentSeat) {
        movedCount++;
      }
    });
  });

  const reassignmentScore = totalPassengers > 0 ? (movedCount / totalPassengers) * 100 : 0;

  // Occupancy Waste (highest-numbered seat used)
  let highestSeatUsed = 0;
  let totalBooked = 0;
  seatAllocation.forEach((passengers, seatNum) => {
    if (passengers.length > 0) {
      totalBooked += passengers.length;
      if (seatNum > highestSeatUsed) highestSeatUsed = seatNum;
    }
  });

  const occupancyWasteScore = Math.min(100, Math.round((highestSeatUsed / capacity) * 100));
  const segmentMismatchScore = Math.min(100, frag.unpairedLegs * 25);

  const w = SEAT_OPTIMIZATION_CONFIG.WEIGHTS;
  const totalCost =
    w.fragmentation * frag.score +
    w.reassignment * reassignmentScore +
    w.segmentMismatch * segmentMismatchScore +
    w.occupancyWaste * occupancyWasteScore;

  const metrics: OptimizationMetrics = {
    totalSeats: capacity,
    bookedCount: totalBooked,
    vacantCount: Math.max(0, capacity - seatAllocation.size),
    utilizationPercent: Math.round((totalBooked / capacity) * 100),
    fragmentationScore: frag.score,
    emptyHolesCount: frag.holesCount,
    unpairedLegsCount: frag.unpairedLegs,
    objectiveCost: parseFloat(totalCost.toFixed(2)),
  };

  return { totalCost: parseFloat(totalCost.toFixed(2)), metrics };
}

/**
 * Builds SeatMapEntry array for UI visualization.
 */
export function buildSeatMap(
  seatAllocation: Map<number, PassengerSegment[]>,
  capacity: number,
  numStops: number
): SeatMapEntry[] {
  const totalLegs = Math.max(1, numStops - 1);
  const map: SeatMapEntry[] = [];

  for (let s = 1; s <= capacity; s++) {
    const passengers = seatAllocation.get(s) || [];
    let legsCovered = 0;
    passengers.forEach((p) => {
      legsCovered += p.dropIndex - p.pickupIndex;
    });

    map.push({
      seatNumber: s,
      passengers: passengers.map((p) => ({
        passengerId: p.passengerId,
        name: p.passengerName,
        pickupStop: p.pickupStop,
        dropStop: p.dropStop,
        pickupIndex: p.pickupIndex,
        dropIndex: p.dropIndex,
      })),
      isOccupied: passengers.length > 0,
      utilizationPercent: Math.min(100, Math.round((legsCovered / totalLegs) * 100)),
      legsCovered: Math.min(totalLegs, legsCovered),
      totalLegs,
    });
  }

  return map;
}

/**
 * Generates an optimistic concurrency checksum from input bookings.
 */
export function generateAllocationChecksum(passengers: PassengerSegment[], routeId: string): string {
  const payload = passengers
    .map((p) => `${p.passengerId}:${p.currentSeat}:${p.pickupIndex}:${p.dropIndex}`)
    .sort()
    .join('|');
  return crypto.createHash('sha256').update(`${routeId}::${payload}`).digest('hex');
}

/**
 * Generates explainable, deterministic causal reasons for recommended seat shifts.
 */
export function generateReassignmentReason(
  p: PassengerSegment,
  prevSeat: number,
  newSeat: number,
  passengersOnNewSeat: PassengerSegment[],
  isHoleReduced: boolean
): string {
  const otherPassenger = passengersOnNewSeat.find((other) => other.passengerId !== p.passengerId);

  if (otherPassenger) {
    return `Seat ${newSeat} perfectly chains with ${otherPassenger.passengerName} (${otherPassenger.pickupStop} → ${otherPassenger.dropStop}) with zero corridor overlap, freeing Seat ${prevSeat} for future end-to-end reservations.`;
  }

  if (isHoleReduced && newSeat < prevSeat) {
    return `Seat ${newSeat} eliminates an isolated vacant gap and consolidates seats 1-${newSeat} into a contiguous block, lowering seat fragmentation.`;
  }

  return `Seat ${newSeat} improves vehicle pack density and leaves higher-numbered seats free for upcoming corridor group bookings.`;
}

/**
 * Core Optimization Engine: Evaluates current allocations and generates an optimized assignment.
 */
export function optimizeSeatAllocations(params: {
  routeId: string;
  routeName: string;
  routeCode: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleCapacity: number;
  numStops: number;
  passengers: PassengerSegment[];
}): OptimizationPreviewResult {
  const {
    routeId,
    routeName,
    routeCode,
    vehicleModel,
    vehiclePlate,
    vehicleCapacity,
    numStops,
    passengers,
  } = params;

  // 1. Build initial allocation map
  const initialSeats = new Map<string, number>();
  const initialAllocation = new Map<number, PassengerSegment[]>();
  for (let s = 1; s <= vehicleCapacity; s++) {
    initialAllocation.set(s, []);
  }

  passengers.forEach((p) => {
    const s = Math.max(1, Math.min(vehicleCapacity, p.currentSeat || 1));
    initialSeats.set(p.passengerId, s);
    const existing = initialAllocation.get(s) || [];
    existing.push(p);
    initialAllocation.set(s, existing);
  });

  const { totalCost: baselineCost, metrics: beforeMetrics } = calculateObjectiveCost(
    initialAllocation,
    initialSeats,
    vehicleCapacity,
    numStops
  );

  const beforeSeatMap = buildSeatMap(initialAllocation, vehicleCapacity, numStops);
  const checksum = generateAllocationChecksum(passengers, routeId);

  // If no passengers or 1 passenger, already optimal
  if (passengers.length <= 1) {
    return {
      routeId,
      routeName,
      routeCode,
      vehicleModel,
      vehiclePlate,
      vehicleCapacity,
      isOptimal: true,
      statusMessage: '✓ Allocation already optimal under current constraints. No changes recommended.',
      beforeMetrics,
      afterMetrics: { ...beforeMetrics },
      improvementPercent: 0,
      reassignments: [],
      beforeSeatMap,
      afterSeatMap: beforeSeatMap,
      checksum,
      createdAt: new Date().toISOString(),
    };
  }

  // 2. Hybrid Optimization Strategy
  // Phase 1: Sort passengers by descending segment length and ascending pickup index
  const sorted = [...passengers].sort((a, b) => {
    if (b.segmentLength !== a.segmentLength) {
      return b.segmentLength - a.segmentLength; // Longest journeys first
    }
    return a.pickupIndex - b.pickupIndex;
  });

  // Candidate allocation map
  const candidateAllocation = new Map<number, PassengerSegment[]>();
  for (let s = 1; s <= vehicleCapacity; s++) {
    candidateAllocation.set(s, []);
  }

  // Greedily pack into lowest non-conflicting seat numbers
  for (const p of sorted) {
    let assigned = false;

    // 1. First Priority: Try pairing with complementary non-overlapping segments on already opened seats
    for (let s = 1; s <= vehicleCapacity; s++) {
      const onSeat = candidateAllocation.get(s) || [];
      if (onSeat.length > 0 && isSeatConflictFree([...onSeat, p])) {
        onSeat.push(p);
        candidateAllocation.set(s, onSeat);
        assigned = true;
        break;
      }
    }

    // 2. Second Priority: Assign to lowest completely vacant seat to prevent empty holes
    if (!assigned) {
      for (let s = 1; s <= vehicleCapacity; s++) {
        const onSeat = candidateAllocation.get(s) || [];
        if (onSeat.length === 0) {
          onSeat.push(p);
          candidateAllocation.set(s, onSeat);
          assigned = true;
          break;
        }
      }
    }

    // Fallback: place in seat 1 if all full
    if (!assigned) {
      const s1 = candidateAllocation.get(1) || [];
      s1.push(p);
      candidateAllocation.set(1, s1);
    }
  }

  // Phase 2: Local Search / 1-Opt refinement
  let bestAllocation = new Map<number, PassengerSegment[]>();
  candidateAllocation.forEach((pList, s) => bestAllocation.set(s, [...pList]));

  let { totalCost: bestCost } = calculateObjectiveCost(
    bestAllocation,
    initialSeats,
    vehicleCapacity,
    numStops
  );

  // If initial allocation was already as good or better, keep initial
  if (baselineCost <= bestCost) {
    bestAllocation = new Map<number, PassengerSegment[]>();
    initialAllocation.forEach((pList, s) => bestAllocation.set(s, [...pList]));
    bestCost = baselineCost;
  }

  // 1-Opt Local Search pass across all passengers
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 5) {
    improved = false;
    iterations++;

    for (const p of passengers) {
      let currentSeat = -1;
      for (let s = 1; s <= vehicleCapacity; s++) {
        if ((bestAllocation.get(s) || []).some((x) => x.passengerId === p.passengerId)) {
          currentSeat = s;
          break;
        }
      }

      if (currentSeat === -1) continue;

      for (let targetSeat = 1; targetSeat <= vehicleCapacity; targetSeat++) {
        if (targetSeat === currentSeat) continue;

        const targetPassengers = (bestAllocation.get(targetSeat) || []).filter(
          (x) => x.passengerId !== p.passengerId
        );
        if (isSeatConflictFree([...targetPassengers, p])) {
          const trialAllocation = new Map<number, PassengerSegment[]>();
          bestAllocation.forEach((list, s) =>
            trialAllocation.set(
              s,
              [...list.filter((x) => x.passengerId !== p.passengerId)]
            )
          );
          const trialTarget = trialAllocation.get(targetSeat) || [];
          trialTarget.push(p);
          trialAllocation.set(targetSeat, trialTarget);

          const { totalCost: trialCost } = calculateObjectiveCost(
            trialAllocation,
            initialSeats,
            vehicleCapacity,
            numStops
          );

          if (trialCost < bestCost - 0.05) {
            bestAllocation = trialAllocation;
            bestCost = trialCost;
            improved = true;
            break;
          }
        }
      }
    }
  }

  // 3. Evaluate Improvement & Apply Threshold Gate
  const rawImprovement = baselineCost > 0 ? ((baselineCost - bestCost) / baselineCost) * 100 : 0;
  const improvementPercent = parseFloat(Math.max(0, rawImprovement).toFixed(1));

  // Minimum threshold gate: Must be >= MIN_IMPROVEMENT_PERCENT (5%)
  if (improvementPercent < SEAT_OPTIMIZATION_CONFIG.MIN_IMPROVEMENT_PERCENT) {
    return {
      routeId,
      routeName,
      routeCode,
      vehicleModel,
      vehiclePlate,
      vehicleCapacity,
      isOptimal: true,
      statusMessage: '✓ Allocation already optimal under current constraints. No changes recommended.',
      beforeMetrics,
      afterMetrics: { ...beforeMetrics },
      improvementPercent: 0,
      reassignments: [],
      beforeSeatMap,
      afterSeatMap: beforeSeatMap,
      checksum,
      createdAt: new Date().toISOString(),
    };
  }

  // 4. Build Reassignment List with Causal Reasons
  const reassignments: SeatReassignment[] = [];
  const afterSeatMap = buildSeatMap(bestAllocation, vehicleCapacity, numStops);

  bestAllocation.forEach((passengersOnSeat, newSeat) => {
    passengersOnSeat.forEach((p) => {
      const prevSeat = initialSeats.get(p.passengerId) || p.currentSeat;
      if (prevSeat !== newSeat) {
        const isHoleReduced = newSeat < prevSeat;
        const reason = generateReassignmentReason(p, prevSeat, newSeat, passengersOnSeat, isHoleReduced);

        reassignments.push({
          passengerId: p.passengerId,
          passengerName: p.passengerName,
          subscriptionId: p.subscriptionId,
          pickupStop: p.pickupStop,
          dropStop: p.dropStop,
          previousSeat: prevSeat,
          newSeat,
          reason,
        });
      }
    });
  });

  // Sort reassignments by new seat number
  reassignments.sort((a, b) => a.newSeat - b.newSeat);

  const { metrics: afterMetrics } = calculateObjectiveCost(
    bestAllocation,
    initialSeats,
    vehicleCapacity,
    numStops
  );

  return {
    routeId,
    routeName,
    routeCode,
    vehicleModel,
    vehiclePlate,
    vehicleCapacity,
    isOptimal: false,
    statusMessage: `Optimization calculated: ${reassignments.length} seat reassignments reduce fragmentation from ${beforeMetrics.fragmentationScore} to ${afterMetrics.fragmentationScore} (+${improvementPercent}% improvement).`,
    beforeMetrics,
    afterMetrics,
    improvementPercent,
    reassignments,
    beforeSeatMap,
    afterSeatMap,
    checksum,
    createdAt: new Date().toISOString(),
  };
}
