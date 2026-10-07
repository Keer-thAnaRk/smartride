export type UserRole = 'COMMUTER' | 'DRIVER' | 'ADMIN';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string | null;
  avatar?: string | null;
  driverProfile?: any;
  commuterProfile?: any;
  jti?: string;
  iat?: number;
  iatMs?: number;
  exp?: number;
}

export interface Waypoint {
  stopName: string;
  landmark: string;
  estimatedPickupTime: string;
  estimatedDropTime: string;
  lat?: number;
  lng?: number;
}

export interface CommuterRosterItem {
  id: string;
  commuterId: string;
  name: string;
  phone: string;
  pickupAddress: string;
  dropAddress: string;
  pickupTime: string;
  dropTime: string;
  seatNumber: number;
  status: 'SCHEDULED' | 'BOARDED' | 'COMPLETED' | 'ABSENT' | 'SKIPPED';
  notes?: string | null;
  avatar?: string | null;
}

export interface AdminMetrics {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  totalCommuters: number;
  activeDrivers: number;
  fleetUtilizationPercent: number;
  churnRatePercent: number;
  totalTripsToday: number;
  revenueByMonth: { month: string; revenue: number }[];
  planDistribution: { plan: string; count: number; percentage: number }[];
  tripsStatus: { status: string; count: number }[];
}

export interface RouteWithDetails {
  id: string;
  name: string;
  code: string;
  origin: string;
  destination: string;
  waypoints: Waypoint[];
  morningStartTime: string;
  eveningStartTime: string;
  distanceKm: number;
  estimatedMinutes: number;
  status: string;
  assignedDriver?: {
    id: string;
    name: string;
    rating: number;
    phone?: string | null;
    isVerified: boolean;
  } | null;
  assignedVehicle?: {
    id: string;
    make: string;
    model: string;
    licensePlate: string;
    capacity: number;
    type: string;
  } | null;
  activeSubscriptionsCount?: number;
}

export interface LeaveRequest {
  id: string;
  requestId: string;
  driverId: string;
  driverName: string;
  driverAvatar?: string | null;
  assignedRouteId?: string | null;
  assignedRouteCode?: string | null;
  assignedRouteName?: string | null;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  replacementDriverId?: string | null;
  replacementDriverName?: string | null;
  replacementDriverRating?: number | null;
  replacementDriverAvatar?: string | null;
  replacementDriverPhone?: string | null;
  replacementVehicleModel?: string | null;
  replacementLicensePlate?: string | null;
  appliedAt: any;
  reviewedAt?: any;
}

export interface StandbyDriver {
  id: string;
  name: string;
  avatar?: string | null;
  phone?: string | null;
  rating: number;
  isVerified: boolean;
  vehicle?: {
    make: string;
    model: string;
    licensePlate: string;
    capacity: number;
    type: string;
  } | null;
}

export interface SubstituteDriverInfo {
  driverId: string;
  name: string;
  avatar?: string | null;
  phone?: string | null;
  rating: number;
  vehicleMake?: string;
  vehicleModel?: string;
  licensePlate?: string;
  capacity?: number;
  originalDriverName: string;
  leaveStartDate: string;
  leaveEndDate: string;
}

