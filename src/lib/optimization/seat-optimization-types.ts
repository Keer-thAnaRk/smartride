export interface PassengerSegment {
  passengerId: string;
  passengerName: string;
  subscriptionId?: string;
  pickupStop: string;
  dropStop: string;
  pickupIndex: number;
  dropIndex: number;
  segmentLength: number;
  direction: 'OUTBOUND' | 'INBOUND' | string;
  currentSeat: number;
  isBoarded?: boolean;
}

export interface SeatMapPassenger {
  passengerId: string;
  name: string;
  pickupStop: string;
  dropStop: string;
  pickupIndex: number;
  dropIndex: number;
}

export interface SeatMapEntry {
  seatNumber: number;
  passengers: SeatMapPassenger[];
  isOccupied: boolean;
  utilizationPercent: number; // Percentage of total corridor legs this seat is filled
  legsCovered: number;        // Number of legs covered
  totalLegs: number;          // Total corridor legs (numStops - 1)
}

export interface OptimizationMetrics {
  totalSeats: number;
  bookedCount: number;
  vacantCount: number;
  utilizationPercent: number;
  fragmentationScore: number;  // 0 (minimal) to 100 (maximum fragmentation)
  emptyHolesCount: number;     // Vacant seats between occupied seats
  unpairedLegsCount: number;   // Incomplete corridor leg seats that could be paired
  objectiveCost: number;       // J(S)
}

export interface SeatReassignment {
  passengerId: string;
  passengerName: string;
  subscriptionId?: string;
  pickupStop: string;
  dropStop: string;
  previousSeat: number;
  newSeat: number;
  reason: string;
}

export interface OptimizationPreviewResult {
  runId?: string;
  routeId: string;
  routeName: string;
  routeCode: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleCapacity: number;
  isOptimal: boolean;
  statusMessage: string;
  beforeMetrics: OptimizationMetrics;
  afterMetrics: OptimizationMetrics;
  improvementPercent: number;
  reassignments: SeatReassignment[];
  beforeSeatMap: SeatMapEntry[];
  afterSeatMap: SeatMapEntry[];
  checksum: string;
  createdAt: string;
}

export interface FleetSeatSummary {
  totalFleetSeats: number;
  totalOccupiedSeats: number;
  overallUtilizationPercent: number;
  fragmentedRoutesCount: number;
  optimizationOpportunitiesCount: number;
  routes: Array<{
    routeId: string;
    routeCode: string;
    routeName: string;
    origin: string;
    destination: string;
    vehicleModel: string;
    vehiclePlate: string;
    capacity: number;
    assignedCount: number;
    occupancyPercent: number;
    fragmentationLevel: 'Low' | 'Medium' | 'High';
    fragmentationScore: number;
    canOptimize: boolean;
  }>;
}
