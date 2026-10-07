import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  WriteBatch,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserRole } from '@/types';

// ==========================================
// 📦 Type Definitions for Firestore Entities
// ==========================================

export interface FirestoreUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  avatar: string | null;
  passwordHash?: string | null;
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreCommuterProfile {
  id: string;
  userId: string;
  defaultPickupAddress: string | null;
  defaultPickupLat: number | null;
  defaultPickupLng: number | null;
  defaultDropAddress: string | null;
  defaultDropLat: number | null;
  defaultDropLng: number | null;
  morningPickupTime: string | null;
  eveningDropTime: string | null;
  emergencyContact: string | null;
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreDriverProfile {
  id: string;
  userId: string;
  licenseNumber: string | null;
  experienceYears: number;
  rating: number;
  isVerified: boolean;
  status: 'OFFLINE' | 'AVAILABLE' | 'ON_TRIP';
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreVehicle {
  id: string;
  driverId: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  capacity: number;
  type: 'SEDAN' | 'SUV' | 'VAN' | 'MINI_BUS';
  isApproved: boolean;
  rcDocUrl: string | null;
  insuranceDocUrl: string | null;
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreWaypoint {
  stopName: string;
  landmark: string;
  estimatedPickupTime: string;
  estimatedDropTime: string;
  lat?: number;
  lng?: number;
}

export interface FirestoreRoute {
  id: string;
  name: string;
  code: string;
  origin: string;
  destination: string;
  waypoints: FirestoreWaypoint[];
  morningStartTime: string;
  eveningStartTime: string;
  distanceKm: number;
  estimatedMinutes: number;
  status: 'ACTIVE' | 'INACTIVE';
  assignedDriverId: string | null;
  assignedVehicleId: string | null;
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreSubscriptionPlan {
  id: string;
  name: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  durationMonths: number;
  price: number; // in INR ₹
  discountPercent: number;
  description: string;
  features: string[];
  isPopular: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreSubscription {
  id: string;
  commuterId: string;
  planId: string;
  routeId: string;
  status: 'ACTIVE' | 'PENDING' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
  startDate: any;
  endDate: any;
  morningPickupTime: string;
  eveningPickupTime: string;
  pickupAddress: string;
  dropAddress: string;
  seatNumber: number;
  autoRenew: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreBooking {
  id: string;
  bookingNumber: string;
  commuterId: string;
  subscriptionId: string;
  routeId: string;
  planId: string;
  seatNumber: number;
  pickupAddress: string;
  dropAddress: string;
  pickupTime: string;
  dropTime: string;
  fare: number; // in INR ₹
  currency: 'INR';
  status: 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  bookingDate: any;
  createdAt: any;
  updatedAt: any;
}

export interface FirestorePayment {
  id: string;
  subscriptionId: string | null;
  bookingId?: string | null;
  commuterId: string;
  amount: number; // in INR ₹
  currency: 'INR';
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED' | 'REFUNDED';
  paymentMethod: 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET';
  transactionId: string;
  invoiceNumber: string;
  receiptUrl: string | null;
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreAttendance {
  id?: string;
  commuterId: string;
  driverId: string | null;
  routeId: string;
  date: string; // YYYY-MM-DD
  tripType: 'MORNING_PICKUP' | 'EVENING_DROP';
  status: 'SCHEDULED' | 'BOARDED' | 'COMPLETED' | 'ABSENT' | 'SKIPPED';
  notes: string | null;
  markedAt: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface FirestoreNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS';
  read: boolean;
  createdAt: any;
}

export interface FirestorePayout {
  id: string;
  driverId: string;
  amount: number; // in INR ₹
  periodStart: any;
  periodEnd: any;
  status: 'PENDING' | 'PROCESSED';
  reference: string;
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreLeaveRecord {
  id: string;
  requestId: string;
  driverId: string;
  driverName?: string;
  assignedRouteId: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  replacementDriverId?: string | null;
  replacementDriverName?: string | null;
  appliedAt: any;
  reviewedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreTripRecord {
  id: string;
  tripId?: string;
  routeId: string;
  driverId: string;
  date: string;
  tripType: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt?: any;
  completedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface FirestoreAIDemandPrediction {
  id: string;
  routeId: string;
  routeCode?: string;
  routeName?: string;
  shift: 'MORNING_PICKUP' | 'EVENING_DROP';
  predictionDate: string; // YYYY-MM-DD
  predictedDemand: number;
  vehicleCapacity: number;
  predictedOccupancy: number; // percentage (e.g. 88.5)
  status: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  recommendation: string;
  reliability: 'HIGH' | 'MEDIUM' | 'LOW';
  additionalShuttles: number;
  featureImportance?: string | Record<string, number>;
  createdAt: any;
}

export interface FirestoreAIModelRun {
  id: string;
  modelName: string;
  trainingRecords: number;
  mae: number;
  rmse: number;
  r2: number;
  trainedAt: any;
  features?: string | Record<string, number>;
}

export interface FirestoreWebhookEvent {
  id: string; // eventId
  provider: string;
  transactionId?: string;
  subscriptionId?: string;
  commuterId?: string;
  amount?: number;
  processedAt: any;
}

export interface MemoryStoreType {
  users: Map<string, FirestoreUser>;
  commuterProfiles: Map<string, FirestoreCommuterProfile>;
  driverProfiles: Map<string, FirestoreDriverProfile>;
  vehicles: Map<string, FirestoreVehicle>;
  routes: Map<string, FirestoreRoute>;
  subscriptionPlans: Map<string, FirestoreSubscriptionPlan>;
  subscriptions: Map<string, FirestoreSubscription>;
  bookings: Map<string, FirestoreBooking>;
  payments: Map<string, FirestorePayment>;
  webhookEvents?: Map<string, FirestoreWebhookEvent>;
  attendances: Map<string, FirestoreAttendance>;
  leaveRequests: Map<string, FirestoreLeaveRecord>;
  notifications: Map<string, FirestoreNotification>;
  payouts: Map<string, FirestorePayout>;
  trips: Map<string, FirestoreTripRecord>;
  aiPredictions: Map<string, FirestoreAIDemandPrediction>;
  aiModelRuns: Map<string, FirestoreAIModelRun>;
}

export const DEFAULT_CORRIDOR_ROUTES: FirestoreRoute[] = [
  {
    id: 'route-sr-101',
    name: 'Whitefield Tech Corridor Express',
    code: 'SR-101',
    origin: 'Electronic City Toll Gate',
    destination: 'ITPB Tech Park, Whitefield',
    distanceKm: 28.5,
    estimatedMinutes: 50,
    morningStartTime: '08:00 AM',
    eveningStartTime: '06:15 PM',
    status: 'ACTIVE',
    assignedDriverId: 'driver_uid_driver_rajesh_smartride_com',
    assignedVehicleId: 'veh_uid_driver_rajesh_smartride_com',
    waypoints: [
      { stopName: 'Electronic City Toll Gate', landmark: 'Flyover Entry Gate', estimatedPickupTime: '08:00 AM', estimatedDropTime: '07:15 PM', lat: 12.8452, lng: 77.6602 },
      { stopName: 'HSR Layout 27th Main', landmark: 'Near BDA Complex', estimatedPickupTime: '08:20 AM', estimatedDropTime: '06:55 PM', lat: 12.9116, lng: 77.6389 },
      { stopName: 'Bellandur EcoSpace', landmark: 'Central Service Road Bus Bay', estimatedPickupTime: '08:35 AM', estimatedDropTime: '06:40 PM', lat: 12.926, lng: 77.6762 },
      { stopName: 'Marathahalli Bridge', landmark: 'Kalamandir Footbridge', estimatedPickupTime: '08:45 AM', estimatedDropTime: '06:25 PM', lat: 12.9569, lng: 77.7011 },
      { stopName: 'ITPB Whitefield Hub', landmark: 'Gate 2 Main Concourse', estimatedPickupTime: '08:55 AM', estimatedDropTime: '06:15 PM', lat: 12.9863, lng: 77.7314 },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'route-sr-102',
    name: 'CyberCity & Manyata Tech Shuttle',
    code: 'SR-102',
    origin: 'Banashankari Metro Hub',
    destination: 'Embassy Manyata Tech Park Gate 1',
    distanceKm: 24.2,
    estimatedMinutes: 48,
    morningStartTime: '08:15 AM',
    eveningStartTime: '06:30 PM',
    status: 'ACTIVE',
    assignedDriverId: null,
    assignedVehicleId: null,
    waypoints: [
      { stopName: 'Banashankari Metro Hub', landmark: 'Metro Station Gate 3', estimatedPickupTime: '08:15 AM', estimatedDropTime: '07:20 PM', lat: 12.9255, lng: 77.5468 },
      { stopName: 'South End Circle Jayanagar', landmark: 'Nanda Talkies Junction', estimatedPickupTime: '08:30 AM', estimatedDropTime: '07:05 PM', lat: 12.9385, lng: 77.58 },
      { stopName: 'MG Road Trinity Circle', landmark: 'Taj MG Road Concourse', estimatedPickupTime: '08:45 AM', estimatedDropTime: '06:50 PM', lat: 12.9738, lng: 77.6205 },
      { stopName: 'Hebbal Flyover Entry', landmark: 'Esteem Mall Bus Bay', estimatedPickupTime: '08:55 AM', estimatedDropTime: '06:40 PM', lat: 13.0358, lng: 77.597 },
      { stopName: 'Manyata Tech Park Gate 1', landmark: 'Main Entrance Terminal', estimatedPickupTime: '09:05 AM', estimatedDropTime: '06:30 PM', lat: 13.0458, lng: 77.6208 },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'route-sr-103',
    name: 'Outer Ring Road Tech Express',
    code: 'SR-103',
    origin: 'Sarjapur Decathlon',
    destination: 'Bagmane World Technology Center',
    distanceKm: 17.8,
    estimatedMinutes: 40,
    morningStartTime: '08:30 AM',
    eveningStartTime: '06:00 PM',
    status: 'ACTIVE',
    assignedDriverId: null,
    assignedVehicleId: null,
    waypoints: [
      { stopName: 'Sarjapur Decathlon', landmark: 'Main Parking Bay', estimatedPickupTime: '08:30 AM', estimatedDropTime: '06:45 PM', lat: 12.9082, lng: 77.6835 },
      { stopName: 'Kaikondrahalli Junction', landmark: 'Total Mall Junction', estimatedPickupTime: '08:42 AM', estimatedDropTime: '06:30 PM', lat: 12.915, lng: 77.674 },
      { stopName: 'Kadubeesanahalli Underpass', landmark: 'Cisco Systems Entry Bay', estimatedPickupTime: '08:55 AM', estimatedDropTime: '06:15 PM', lat: 12.936, lng: 77.692 },
      { stopName: 'Bagmane Tech Park', landmark: 'Lakeview Tower Concourse', estimatedPickupTime: '09:10 AM', estimatedDropTime: '06:00 PM', lat: 12.981, lng: 77.663 },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const DEFAULT_IN_MEMORY_PLANS: FirestoreSubscriptionPlan[] = [
  {
    id: 'plan_monthly',
    name: 'Smart Standard (Monthly)',
    billingCycle: 'MONTHLY',
    durationMonths: 1,
    price: 3499,
    discountPercent: 0,
    description: 'Guaranteed daily morning pickup and evening drop with reserved AC seating and zero surge pricing.',
    features: [
      'Door-to-door morning pickup & evening drop',
      'Guaranteed reserved AC seat',
      'Live vehicle GPS tracking & ETA alerts',
      'Free 2 skip ride credits per month',
      'Dedicated route captain & 24/7 SOS support',
    ],
    isPopular: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'plan_quarterly',
    name: 'Smart Pro (Quarterly)',
    billingCycle: 'QUARTERLY',
    durationMonths: 3,
    price: 9499,
    discountPercent: 10,
    description: 'Most popular choice for hybrid & office commuters. Save 10% with flexible pickup slot swaps.',
    features: [
      'Everything in Standard plan',
      '10% direct savings on quarterly billing',
      'Flexible 15-minute slot time adjustment',
      'Priority driver dispatch & window seats',
      'Free 8 skip ride roll-over credits',
      'Priority commuter concierge assistance',
    ],
    isPopular: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'plan_yearly',
    name: 'Smart Executive (Yearly)',
    billingCycle: 'YEARLY',
    durationMonths: 12,
    price: 34999,
    discountPercent: 16,
    description: 'Maximum savings and exclusive executive perks for long-term daily corporate commuters.',
    features: [
      'Everything in Pro plan',
      '16% ultimate annual cost savings',
      'Guaranteed premium luxury SUV/Van seating',
      'Complimentary weekend airport shuttle voucher (2x/yr)',
      'Unlimited skip ride bank with cash-back credit',
      'VIP Corporate billing & GST automated invoicing',
    ],
    isPopular: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// In-memory fallback cache for development / offline resilience, attached to globalThis across Next.js route bundles
const globalStore: MemoryStoreType = (globalThis as any).__smartride_memoryStore || {
  users: new Map<string, FirestoreUser>(),
  commuterProfiles: new Map<string, FirestoreCommuterProfile>(),
  driverProfiles: new Map<string, FirestoreDriverProfile>(),
  vehicles: new Map<string, FirestoreVehicle>(),
  routes: new Map<string, FirestoreRoute>(DEFAULT_CORRIDOR_ROUTES.map((r) => [r.id, r])),
  subscriptionPlans: new Map<string, FirestoreSubscriptionPlan>(DEFAULT_IN_MEMORY_PLANS.map((p) => [p.id, p])),
  subscriptions: new Map<string, FirestoreSubscription>(),
  bookings: new Map<string, FirestoreBooking>(),
  payments: new Map<string, FirestorePayment>(),
  webhookEvents: new Map<string, FirestoreWebhookEvent>(),
  attendances: new Map<string, FirestoreAttendance>(),
  leaveRequests: new Map<string, FirestoreLeaveRecord>(),
  notifications: new Map<string, FirestoreNotification>(),
  payouts: new Map<string, FirestorePayout>(),
  trips: new Map<string, FirestoreTripRecord>(),
  aiPredictions: new Map<string, FirestoreAIDemandPrediction>(),
  aiModelRuns: new Map<string, FirestoreAIModelRun>(),
};
if (!(globalThis as any).__smartride_memoryStore) {
  (globalThis as any).__smartride_memoryStore = globalStore;

  // Pre-seed standard demo accounts into memoryStore
  const defaultAdmin: FirestoreUser = {
    id: 'uid_admin_smartride_com',
    email: 'admin@smartride.com',
    name: 'Elena Rostova',
    phone: '+91 98450 11223',
    role: 'ADMIN',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const defaultDriver: FirestoreUser = {
    id: 'uid_driver_rajesh_smartride_com',
    email: 'driver.rajesh@smartride.com',
    name: 'Rajesh Sharma',
    phone: '+91 98450 12345',
    role: 'DRIVER',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rajesh%20Sharma',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const defaultCommuter: FirestoreUser = {
    id: 'uid_commuter_rahul_smartride_com',
    email: 'commuter.rahul@smartride.com',
    name: 'Rahul Verma',
    phone: '+91 98451 10001',
    role: 'COMMUTER',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul%20Verma',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const defaultCommuterProfile: FirestoreCommuterProfile = {
    id: defaultCommuter.id,
    userId: defaultCommuter.id,
    defaultPickupAddress: 'Koramangala 4th Block, Bangalore',
    defaultPickupLat: 12.9352,
    defaultPickupLng: 77.6245,
    defaultDropAddress: 'Prestige Tech Park, Marathahalli, Bangalore',
    defaultDropLat: 12.9378,
    defaultDropLng: 77.6946,
    morningPickupTime: '08:30 AM',
    eveningDropTime: '06:00 PM',
    emergencyContact: '+91 98451 99999',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const defaultDriverProfile: FirestoreDriverProfile = {
    id: 'driver_uid_driver_rajesh_smartride_com',
    userId: defaultDriver.id,
    licenseNumber: 'DL-BLR-2022-99000',
    experienceYears: 5,
    rating: 4.9,
    isVerified: true,
    status: 'AVAILABLE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const defaultVehicle: FirestoreVehicle = {
    id: 'veh_uid_driver_rajesh_smartride_com',
    driverId: defaultDriverProfile.id,
    make: 'Toyota',
    model: 'Innova Crysta AC',
    year: 2023,
    licensePlate: 'KA-01-MJ-8822',
    capacity: 6,
    type: 'SUV',
    isApproved: true,
    rcDocUrl: null,
    insuranceDocUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  globalStore.users.set(defaultAdmin.id, defaultAdmin);
  globalStore.users.set(defaultDriver.id, defaultDriver);
  globalStore.users.set(defaultCommuter.id, defaultCommuter);
  globalStore.driverProfiles.set(defaultDriverProfile.id, defaultDriverProfile);
  globalStore.vehicles.set(defaultVehicle.id, defaultVehicle);
  globalStore.commuterProfiles.set(defaultCommuterProfile.userId, defaultCommuterProfile);
  DEFAULT_CORRIDOR_ROUTES.forEach((r) => globalStore.routes.set(r.id, r));
  DEFAULT_IN_MEMORY_PLANS.forEach((p) => globalStore.subscriptionPlans.set(p.id, p));
}
const memoryStore: MemoryStoreType = (globalThis as any).__smartride_memoryStore;

const toTimestamp = (val: any): Timestamp => {
  if (val instanceof Timestamp) return val;
  if (val instanceof Date) return Timestamp.fromDate(val);
  if (typeof val === 'string' || typeof val === 'number') return Timestamp.fromDate(new Date(val));
  return Timestamp.now();
};

const toIsoOrTimestamp = (val: any) => {
  if (!val) return new Date().toISOString();
  if (val.toDate && typeof val.toDate === 'function') return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
};

// ==========================================
// 1. Users Repository
// ==========================================

export async function getUserById(id: string): Promise<FirestoreUser | null> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'users', id));
      if (snap.exists()) {
        const u = { id: snap.id, ...snap.data() } as FirestoreUser;
        memoryStore.users.set(id, u);
        return u;
      }
    } catch (e) {
      console.warn('Firestore getUserById failed, falling back to cache:', e);
    }
  }
  return memoryStore.users.get(id) || null;
}

export async function getUserByEmail(email: string): Promise<FirestoreUser | null> {
  const cleanEmail = email.toLowerCase().trim();
  if (db) {
    try {
      const q = query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const u = { id: docSnap.id, ...docSnap.data() } as FirestoreUser;
        memoryStore.users.set(u.id, u);
        return u;
      }
    } catch (e) {
      console.warn('Firestore getUserByEmail failed, checking cache:', e);
    }
  }

  for (const u of memoryStore.users.values()) {
    if (u.email.toLowerCase() === cleanEmail) return u;
  }
  return null;
}

export async function setUser(user: FirestoreUser): Promise<void> {
  const payload = {
    ...user,
    updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
  };
  memoryStore.users.set(user.id, user);

  if (db) {
    try {
      await setDoc(doc(db, 'users', user.id), payload, { merge: true });
    } catch (e) {
      console.warn('Firestore setUser failed:', e);
    }
  }
}

export async function updateUser(id: string, data: Partial<FirestoreUser>): Promise<void> {
  const existing = memoryStore.users.get(id) || ({ id } as FirestoreUser);
  const updated = { ...existing, ...data, updatedAt: new Date() };
  memoryStore.users.set(id, updated);

  if (db) {
    try {
      await updateDoc(doc(db, 'users', id), {
        ...data,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      });
    } catch (e) {
      console.warn('Firestore updateUser failed:', e);
    }
  }
}

export async function countUsersByRole(role: UserRole): Promise<number> {
  if (db) {
    try {
      const q = query(collection(db, 'users'), where('role', '==', role));
      const snap = await getDocs(q);
      return snap.size;
    } catch (e) {
      console.warn('Firestore countUsersByRole failed:', e);
    }
  }
  let count = 0;
  for (const u of memoryStore.users.values()) {
    if (u.role === role) count++;
  }
  return count;
}

// ==========================================
// 2. Commuter Profiles Repository
// ==========================================

export async function getCommuterProfile(userId: string): Promise<FirestoreCommuterProfile | null> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'commuterProfiles', userId));
      if (snap.exists()) {
        const cp = { id: snap.id, ...snap.data() } as FirestoreCommuterProfile;
        memoryStore.commuterProfiles.set(userId, cp);
        return cp;
      }
    } catch (e) {
      console.warn('Firestore getCommuterProfile failed:', e);
    }
  }
  return memoryStore.commuterProfiles.get(userId) || null;
}

export async function upsertCommuterProfile(
  userId: string,
  data: Partial<FirestoreCommuterProfile>
): Promise<FirestoreCommuterProfile> {
  const existing = (await getCommuterProfile(userId)) || {
    id: userId,
    userId,
    defaultPickupAddress: null,
    defaultPickupLat: null,
    defaultPickupLng: null,
    defaultDropAddress: null,
    defaultDropLat: null,
    defaultDropLng: null,
    morningPickupTime: '08:30 AM',
    eveningDropTime: '06:00 PM',
    emergencyContact: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const updated: FirestoreCommuterProfile = {
    ...existing,
    ...data,
    userId,
    updatedAt: new Date(),
  };

  memoryStore.commuterProfiles.set(userId, updated);

  if (db) {
    try {
      await setDoc(doc(db, 'commuterProfiles', userId), {
        ...updated,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore upsertCommuterProfile failed:', e);
    }
  }

  return updated;
}

// ==========================================
// 3. Driver Profiles & Vehicles Repository
// ==========================================

export async function getDriverProfileByUserId(userId: string): Promise<FirestoreDriverProfile | null> {
  if (db) {
    try {
      const q = query(collection(db, 'driverProfiles'), where('userId', '==', userId), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const dp = { id: docSnap.id, ...docSnap.data() } as FirestoreDriverProfile;
        memoryStore.driverProfiles.set(dp.id, dp);
        return dp;
      }
    } catch (e) {
      console.warn('Firestore getDriverProfileByUserId failed:', e);
    }
  }

  for (const dp of memoryStore.driverProfiles.values()) {
    if (dp.userId === userId) return dp;
  }
  return null;
}

export async function getDriverProfileById(id: string): Promise<FirestoreDriverProfile | null> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'driverProfiles', id));
      if (snap.exists()) {
        const dp = { id: snap.id, ...snap.data() } as FirestoreDriverProfile;
        memoryStore.driverProfiles.set(id, dp);
        return dp;
      }
    } catch (e) {
      console.warn('Firestore getDriverProfileById failed:', e);
    }
  }
  return memoryStore.driverProfiles.get(id) || null;
}

export async function getAllDrivers(verifiedOnly = false): Promise<FirestoreDriverProfile[]> {
  if (db) {
    try {
      const col = collection(db, 'driverProfiles');
      const q = verifiedOnly ? query(col, where('isVerified', '==', true)) : query(col);
      const snap = await getDocs(q);
      const list: FirestoreDriverProfile[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreDriverProfile));
      list.forEach((dp) => memoryStore.driverProfiles.set(dp.id, dp));
      return list;
    } catch (e) {
      console.warn('Firestore getAllDrivers failed:', e);
    }
  }

  const list = Array.from(memoryStore.driverProfiles.values());
  return verifiedOnly ? list.filter((d) => d.isVerified) : list;
}

export const getAllDriverProfiles = getAllDrivers;

export async function setDriverProfile(driver: FirestoreDriverProfile): Promise<void> {
  memoryStore.driverProfiles.set(driver.id, driver);
  if (db) {
    try {
      await setDoc(doc(db, 'driverProfiles', driver.id), {
        ...driver,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore setDriverProfile failed:', e);
    }
  }
}

export async function updateDriverProfile(id: string, data: Partial<FirestoreDriverProfile>): Promise<void> {
  const existing = memoryStore.driverProfiles.get(id);
  if (existing) {
    memoryStore.driverProfiles.set(id, { ...existing, ...data, updatedAt: new Date() });
  }

  if (db) {
    try {
      await updateDoc(doc(db, 'driverProfiles', id), {
        ...data,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      });
    } catch (e) {
      console.warn('Firestore updateDriverProfile failed:', e);
    }
  }
}

export async function getVehiclesByDriverId(driverId: string): Promise<FirestoreVehicle[]> {
  if (db) {
    try {
      const q = query(collection(db, 'vehicles'), where('driverId', '==', driverId));
      const snap = await getDocs(q);
      const list: FirestoreVehicle[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreVehicle));
      list.forEach((v) => memoryStore.vehicles.set(v.id, v));
      return list;
    } catch (e) {
      console.warn('Firestore getVehiclesByDriverId failed:', e);
    }
  }
  return Array.from(memoryStore.vehicles.values()).filter((v) => v.driverId === driverId);
}

export async function getVehicleById(id: string): Promise<FirestoreVehicle | null> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'vehicles', id));
      if (snap.exists()) {
        const v = { id: snap.id, ...snap.data() } as FirestoreVehicle;
        memoryStore.vehicles.set(id, v);
        return v;
      }
    } catch (e) {
      console.warn('Firestore getVehicleById failed:', e);
    }
  }
  return memoryStore.vehicles.get(id) || null;
}

export async function getAllApprovedVehicles(): Promise<FirestoreVehicle[]> {
  if (db) {
    try {
      const q = query(collection(db, 'vehicles'), where('isApproved', '==', true));
      const snap = await getDocs(q);
      const list: FirestoreVehicle[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreVehicle));
      return list;
    } catch (e) {
      console.warn('Firestore getAllApprovedVehicles failed:', e);
    }
  }
  return Array.from(memoryStore.vehicles.values()).filter((v) => v.isApproved);
}

export async function setVehicle(vehicle: FirestoreVehicle): Promise<void> {
  memoryStore.vehicles.set(vehicle.id, vehicle);
  if (db) {
    try {
      await setDoc(doc(db, 'vehicles', vehicle.id), {
        ...vehicle,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore setVehicle failed:', e);
    }
  }
}

export async function updateVehicle(id: string, data: Partial<FirestoreVehicle>): Promise<void> {
  const existing = memoryStore.vehicles.get(id);
  if (existing) {
    memoryStore.vehicles.set(id, { ...existing, ...data, updatedAt: new Date() });
  }
  if (db) {
    try {
      await updateDoc(doc(db, 'vehicles', id), {
        ...data,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      });
    } catch (e) {
      console.warn('Firestore updateVehicle failed:', e);
    }
  }
}

// ==========================================
// 4. Routes Repository
// ==========================================

export async function getAllRoutes(): Promise<FirestoreRoute[]> {
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'routes'));
      if (!snap.empty) {
        const list: FirestoreRoute[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreRoute));
        list.forEach((r) => memoryStore.routes.set(r.id, r));
        return list;
      }
    } catch (e) {
      console.warn('Firestore getAllRoutes failed:', e);
    }
  }
  if (memoryStore.routes.size === 0) {
    DEFAULT_CORRIDOR_ROUTES.forEach((r) => memoryStore.routes.set(r.id, r));
  }
  return Array.from(memoryStore.routes.values());
}

export async function getRouteById(id: string): Promise<FirestoreRoute | null> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'routes', id));
      if (snap.exists()) {
        const r = { id: snap.id, ...snap.data() } as FirestoreRoute;
        memoryStore.routes.set(id, r);
        return r;
      }
    } catch (e) {
      console.warn('Firestore getRouteById failed:', e);
    }
  }
  if (!memoryStore.routes.has(id)) {
    const defaultRoute = DEFAULT_CORRIDOR_ROUTES.find((r) => r.id === id);
    if (defaultRoute) {
      memoryStore.routes.set(id, defaultRoute);
      return defaultRoute;
    }
  }
  return memoryStore.routes.get(id) || null;
}

export async function getRouteByCode(code: string): Promise<FirestoreRoute | null> {
  if (db) {
    try {
      const q = query(collection(db, 'routes'), where('code', '==', code), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        const r = { id: d.id, ...d.data() } as FirestoreRoute;
        memoryStore.routes.set(r.id, r);
        return r;
      }
    } catch (e) {
      console.warn('Firestore getRouteByCode failed:', e);
    }
  }
  for (const r of memoryStore.routes.values()) {
    if (r.code === code) return r;
  }
  return null;
}

export async function setRoute(route: FirestoreRoute): Promise<void> {
  memoryStore.routes.set(route.id, route);
  if (db) {
    try {
      await setDoc(doc(db, 'routes', route.id), {
        ...route,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore setRoute failed:', e);
    }
  }
}

export async function updateRoute(id: string, data: Partial<FirestoreRoute>): Promise<void> {
  const existing = memoryStore.routes.get(id);
  if (existing) {
    memoryStore.routes.set(id, { ...existing, ...data, updatedAt: new Date() });
  }
  if (db) {
    try {
      await updateDoc(doc(db, 'routes', id), {
        ...data,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      });
    } catch (e) {
      console.warn('Firestore updateRoute failed:', e);
    }
  }
}

// ==========================================
// 5. Subscription Plans Repository (INR ₹)
// ==========================================

export async function getAllPlans(): Promise<FirestoreSubscriptionPlan[]> {
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'subscriptionPlans'));
      const list: FirestoreSubscriptionPlan[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreSubscriptionPlan));
      if (list.length > 0) {
        list.sort((a, b) => a.price - b.price);
        list.forEach((p) => memoryStore.subscriptionPlans.set(p.id, p));
        return list;
      }
    } catch (e) {
      console.warn('Firestore getAllPlans failed:', e);
    }
  }

  if (memoryStore.subscriptionPlans.size === 0) {
    DEFAULT_IN_MEMORY_PLANS.forEach((p) => memoryStore.subscriptionPlans.set(p.id, p));
  }

  return Array.from(memoryStore.subscriptionPlans.values()).sort((a, b) => a.price - b.price);
}


export async function getPlanById(id: string): Promise<FirestoreSubscriptionPlan | null> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'subscriptionPlans', id));
      if (snap.exists()) {
        const p = { id: snap.id, ...snap.data() } as FirestoreSubscriptionPlan;
        memoryStore.subscriptionPlans.set(id, p);
        return p;
      }
    } catch (e) {
      console.warn('Firestore getPlanById failed:', e);
    }
  }
  if (!memoryStore.subscriptionPlans.has(id)) {
    DEFAULT_IN_MEMORY_PLANS.forEach((p) => memoryStore.subscriptionPlans.set(p.id, p));
  }
  return memoryStore.subscriptionPlans.get(id) || null;
}

export async function setPlan(plan: FirestoreSubscriptionPlan): Promise<void> {
  memoryStore.subscriptionPlans.set(plan.id, plan);
  if (db) {
    try {
      await setDoc(doc(db, 'subscriptionPlans', plan.id), {
        ...plan,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore setPlan failed:', e);
    }
  }
}

// ==========================================
// 6. Subscriptions Repository
// ==========================================

export async function getAllSubscriptions(status?: string): Promise<FirestoreSubscription[]> {
  if (db) {
    try {
      const col = collection(db, 'subscriptions');
      const q = status ? query(col, where('status', '==', status)) : query(col);
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: FirestoreSubscription[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreSubscription));
        list.forEach((s) => memoryStore.subscriptions.set(s.id, s));
        return list;
      }
    } catch (e) {
      console.warn('Firestore getAllSubscriptions failed:', e);
    }
  }
  const all = Array.from(memoryStore.subscriptions.values());
  return status ? all.filter((s) => s.status === status) : all;
}

export async function getSubscriptionsByCommuterId(commuterId: string): Promise<FirestoreSubscription[]> {
  if (db) {
    try {
      const q = query(collection(db, 'subscriptions'), where('commuterId', '==', commuterId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: FirestoreSubscription[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreSubscription));
        list.forEach((s) => memoryStore.subscriptions.set(s.id, s));
        return list;
      }
    } catch (e) {
      console.warn('Firestore getSubscriptionsByCommuterId failed:', e);
    }
  }
  return Array.from(memoryStore.subscriptions.values()).filter((s) => s.commuterId === commuterId);
}

export async function getSubscriptionsByRouteId(routeId: string, activeOnly = true): Promise<FirestoreSubscription[]> {
  if (db) {
    try {
      const col = collection(db, 'subscriptions');
      const q = activeOnly
        ? query(col, where('routeId', '==', routeId), where('status', '==', 'ACTIVE'))
        : query(col, where('routeId', '==', routeId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: FirestoreSubscription[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreSubscription));
        return list;
      }
    } catch (e) {
      console.warn('Firestore getSubscriptionsByRouteId failed:', e);
    }
  }
  return Array.from(memoryStore.subscriptions.values()).filter(
    (s) => s.routeId === routeId && (!activeOnly || s.status === 'ACTIVE')
  );
}

export async function getSubscriptionById(id: string): Promise<FirestoreSubscription | null> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'subscriptions', id));
      if (snap.exists()) {
        const s = { id: snap.id, ...snap.data() } as FirestoreSubscription;
        memoryStore.subscriptions.set(id, s);
        return s;
      }
    } catch (e) {
      console.warn('Firestore getSubscriptionById failed:', e);
    }
  }
  return memoryStore.subscriptions.get(id) || null;
}

export async function setSubscription(subscription: FirestoreSubscription): Promise<void> {
  memoryStore.subscriptions.set(subscription.id, subscription);
  if (db) {
    try {
      await setDoc(doc(db, 'subscriptions', subscription.id), {
        ...subscription,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore setSubscription failed:', e);
    }
  }
}

export async function updateSubscription(id: string, data: Partial<FirestoreSubscription>): Promise<void> {
  const existing = memoryStore.subscriptions.get(id);
  if (existing) {
    memoryStore.subscriptions.set(id, { ...existing, ...data, updatedAt: new Date() });
  }
  if (db) {
    try {
      await updateDoc(doc(db, 'subscriptions', id), {
        ...data,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      });
    } catch (e) {
      console.warn('Firestore updateSubscription failed:', e);
    }
  }
}

// ==========================================
// 7. Dedicated Bookings Repository (INR ₹)
// ==========================================

export async function createBooking(booking: FirestoreBooking): Promise<void> {
  memoryStore.bookings.set(booking.id, booking);
  if (db) {
    try {
      await setDoc(doc(db, 'bookings', booking.id), {
        ...booking,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore createBooking failed:', e);
    }
  }
}

export async function getBookingsByCommuterId(commuterId: string): Promise<FirestoreBooking[]> {
  if (db) {
    try {
      const q = query(collection(db, 'bookings'), where('commuterId', '==', commuterId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: FirestoreBooking[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreBooking));
        return list;
      }
    } catch (e) {
      console.warn('Firestore getBookingsByCommuterId failed:', e);
    }
  }
  return Array.from(memoryStore.bookings.values()).filter((b) => b.commuterId === commuterId);
}

export async function getBookingsBySubscriptionId(subscriptionId: string): Promise<FirestoreBooking[]> {
  if (db) {
    try {
      const q = query(collection(db, 'bookings'), where('subscriptionId', '==', subscriptionId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: FirestoreBooking[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreBooking));
        return list;
      }
    } catch (e) {
      console.warn('Firestore getBookingsBySubscriptionId failed:', e);
    }
  }
  return Array.from(memoryStore.bookings.values()).filter((b) => b.subscriptionId === subscriptionId);
}

export async function updateBooking(id: string, data: Partial<FirestoreBooking>): Promise<void> {
  const existing = memoryStore.bookings.get(id);
  if (existing) {
    memoryStore.bookings.set(id, { ...existing, ...data, updatedAt: new Date() });
  }
  if (db) {
    try {
      await updateDoc(doc(db, 'bookings', id), {
        ...data,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      });
    } catch (e) {
      console.warn('Firestore updateBooking failed:', e);
    }
  }
}

export async function getBookingById(id: string): Promise<FirestoreBooking | null> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'bookings', id));
      if (snap.exists()) {
        const b = { id: snap.id, ...snap.data() } as FirestoreBooking;
        memoryStore.bookings.set(id, b);
        return b;
      }
    } catch (e) {
      console.warn('Firestore getBookingById failed:', e);
    }
  }
  return memoryStore.bookings.get(id) || null;
}

export async function getAllBookings(): Promise<FirestoreBooking[]> {
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'bookings'));
      if (!snap.empty) {
        const list: FirestoreBooking[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreBooking));
        list.forEach((b) => memoryStore.bookings.set(b.id, b));
        return list;
      }
    } catch (e) {
      console.warn('Firestore getAllBookings failed:', e);
    }
  }
  return Array.from(memoryStore.bookings.values());
}

// ==========================================
// 8. Payments Repository (INR ₹)
// ==========================================

export async function createPayment(payment: FirestorePayment): Promise<void> {
  memoryStore.payments.set(payment.id, payment);
  if (db) {
    try {
      await setDoc(doc(db, 'payments', payment.id), {
        ...payment,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore createPayment failed:', e);
    }
  }
}

export async function getPaymentByInvoice(invoiceNumber: string): Promise<FirestorePayment | null> {
  if (db) {
    try {
      const q = query(collection(db, 'payments'), where('invoiceNumber', '==', invoiceNumber), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        const p = { id: d.id, ...d.data() } as FirestorePayment;
        memoryStore.payments.set(p.id, p);
        return p;
      }
    } catch (e) {
      console.warn('Firestore getPaymentByInvoice failed:', e);
    }
  }
  for (const p of memoryStore.payments.values()) {
    if (p.invoiceNumber === invoiceNumber) return p;
  }
  return null;
}

export async function getPaymentsByCommuterId(commuterId: string): Promise<FirestorePayment[]> {
  if (db) {
    try {
      const q = query(collection(db, 'payments'), where('commuterId', '==', commuterId));
      const snap = await getDocs(q);
      const list: FirestorePayment[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestorePayment));
      list.sort((a, b) => new Date(toIsoOrTimestamp(b.createdAt)).getTime() - new Date(toIsoOrTimestamp(a.createdAt)).getTime());
      return list;
    } catch (e) {
      console.warn('Firestore getPaymentsByCommuterId failed:', e);
    }
  }
  return Array.from(memoryStore.payments.values())
    .filter((p) => p.commuterId === commuterId)
    .sort((a, b) => new Date(toIsoOrTimestamp(b.createdAt)).getTime() - new Date(toIsoOrTimestamp(a.createdAt)).getTime());
}

export async function getAllPayments(): Promise<FirestorePayment[]> {
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'payments'));
      const list: FirestorePayment[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestorePayment));
      list.sort((a, b) => new Date(toIsoOrTimestamp(b.createdAt)).getTime() - new Date(toIsoOrTimestamp(a.createdAt)).getTime());
      return list;
    } catch (e) {
      console.warn('Firestore getAllPayments failed:', e);
    }
  }
  return Array.from(memoryStore.payments.values())
    .sort((a, b) => new Date(toIsoOrTimestamp(b.createdAt)).getTime() - new Date(toIsoOrTimestamp(a.createdAt)).getTime());
}

export async function getPaymentByTransactionId(transactionId: string): Promise<FirestorePayment | null> {
  if (!transactionId) return null;
  if (db) {
    try {
      const q = query(collection(db, 'payments'), where('transactionId', '==', transactionId), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        const p = { id: d.id, ...d.data() } as FirestorePayment;
        memoryStore.payments.set(p.id, p);
        return p;
      }
    } catch (e) {
      console.warn('Firestore getPaymentByTransactionId failed:', e);
    }
  }
  for (const p of memoryStore.payments.values()) {
    if (p.transactionId === transactionId) return p;
  }
  return null;
}

export async function isWebhookEventProcessed(eventId: string): Promise<boolean> {
  if (!eventId) return false;
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'webhook_events', eventId));
      if (snap.exists()) {
        return true;
      }
    } catch (e) {
      console.warn('Firestore isWebhookEventProcessed failed:', e);
    }
  }
  if (!memoryStore.webhookEvents) {
    memoryStore.webhookEvents = new Map();
  }
  return memoryStore.webhookEvents.has(eventId);
}

export async function markWebhookEventProcessed(event: {
  eventId: string;
  provider: string;
  transactionId?: string;
  subscriptionId?: string;
  commuterId?: string;
  amount?: number;
}): Promise<void> {
  if (!event || !event.eventId) return;
  if (!memoryStore.webhookEvents) {
    memoryStore.webhookEvents = new Map();
  }
  const record: FirestoreWebhookEvent = {
    id: event.eventId,
    provider: event.provider,
    transactionId: event.transactionId,
    subscriptionId: event.subscriptionId,
    commuterId: event.commuterId,
    amount: event.amount,
    processedAt: new Date(),
  };
  memoryStore.webhookEvents.set(event.eventId, record);

  if (db) {
    try {
      await setDoc(doc(db, 'webhook_events', event.eventId), {
        ...record,
        processedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore markWebhookEventProcessed failed:', e);
    }
  }
}

// ==========================================
// 9. Attendance Repository
// ==========================================

export async function getAttendancesForCommuter(commuterId: string, date: string): Promise<FirestoreAttendance[]> {
  if (db) {
    try {
      const q = query(
        collection(db, 'attendances'),
        where('commuterId', '==', commuterId),
        where('date', '==', date)
      );
      const snap = await getDocs(q);
      const list: FirestoreAttendance[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreAttendance));
      return list;
    } catch (e) {
      console.warn('Firestore getAttendancesForCommuter failed:', e);
    }
  }
  return Array.from(memoryStore.attendances.values()).filter(
    (a) => a.commuterId === commuterId && a.date === date
  );
}

export async function getAttendancesForRoute(
  routeId: string,
  date: string,
  tripType: string
): Promise<FirestoreAttendance[]> {
  if (db) {
    try {
      const q = query(
        collection(db, 'attendances'),
        where('routeId', '==', routeId),
        where('date', '==', date),
        where('tripType', '==', tripType)
      );
      const snap = await getDocs(q);
      const list: FirestoreAttendance[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreAttendance));
      return list;
    } catch (e) {
      console.warn('Firestore getAttendancesForRoute failed:', e);
    }
  }
  return Array.from(memoryStore.attendances.values()).filter(
    (a) => a.routeId === routeId && a.date === date && a.tripType === tripType
  );
}

export async function getAttendancesByDate(date: string): Promise<FirestoreAttendance[]> {
  if (db) {
    try {
      const q = query(collection(db, 'attendances'), where('date', '==', date));
      const snap = await getDocs(q);
      const list: FirestoreAttendance[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreAttendance));
      return list;
    } catch (e) {
      console.warn('Firestore getAttendancesByDate failed:', e);
    }
  }
  return Array.from(memoryStore.attendances.values()).filter((a) => a.date === date);
}

export async function upsertAttendance(attendance: FirestoreAttendance): Promise<FirestoreAttendance> {
  const docId = attendance.id || `${attendance.commuterId}_${attendance.date}_${attendance.tripType}`;
  const record: FirestoreAttendance = {
    ...attendance,
    id: docId,
    updatedAt: new Date(),
  };

  memoryStore.attendances.set(docId, record);

  if (db) {
    try {
      await setDoc(doc(db, 'attendances', docId), {
        ...record,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore upsertAttendance failed:', e);
    }
  }

  return record;
}

export async function updateAttendancesBulk(
  filter: { routeId: string; date: string; tripType: string; status: string },
  updateData: Partial<FirestoreAttendance>
): Promise<void> {
  if (db) {
    try {
      const q = query(
        collection(db, 'attendances'),
        where('routeId', '==', filter.routeId),
        where('date', '==', filter.date),
        where('tripType', '==', filter.tripType),
        where('status', '==', filter.status)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach((d) => {
        batch.update(d.ref, {
          ...updateData,
          updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
        });
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore updateAttendancesBulk failed:', e);
    }
  }

  for (const [id, a] of memoryStore.attendances.entries()) {
    if (
      a.routeId === filter.routeId &&
      a.date === filter.date &&
      a.tripType === filter.tripType &&
      a.status === filter.status
    ) {
      memoryStore.attendances.set(id, { ...a, ...updateData, updatedAt: new Date() });
    }
  }
}

// ==========================================
// 10. Leave Requests Repository
// ==========================================

export async function getAllLeaveRequests(status?: string): Promise<FirestoreLeaveRecord[]> {
  if (db) {
    try {
      const col = collection(db, 'leaveRequests');
      const q = status ? query(col, where('status', '==', status)) : query(col);
      const snap = await getDocs(q);
      const list: FirestoreLeaveRecord[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreLeaveRecord));
      list.sort((a, b) => new Date(toIsoOrTimestamp(b.appliedAt)).getTime() - new Date(toIsoOrTimestamp(a.appliedAt)).getTime());
      return list;
    } catch (e) {
      console.warn('Firestore getAllLeaveRequests failed:', e);
    }
  }
  const all = Array.from(memoryStore.leaveRequests.values());
  const filtered = status ? all.filter((l) => l.status === status) : all;
  return filtered.sort((a, b) => new Date(toIsoOrTimestamp(b.appliedAt)).getTime() - new Date(toIsoOrTimestamp(a.appliedAt)).getTime());
}

export async function getLeaveRequestsByDriver(driverId: string): Promise<FirestoreLeaveRecord[]> {
  if (db) {
    try {
      const q = query(collection(db, 'leaveRequests'), where('driverId', '==', driverId));
      const snap = await getDocs(q);
      const list: FirestoreLeaveRecord[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreLeaveRecord));
      list.sort((a, b) => new Date(toIsoOrTimestamp(b.appliedAt)).getTime() - new Date(toIsoOrTimestamp(a.appliedAt)).getTime());
      return list;
    } catch (e) {
      console.warn('Firestore getLeaveRequestsByDriver failed:', e);
    }
  }
  return Array.from(memoryStore.leaveRequests.values())
    .filter((l) => l.driverId === driverId)
    .sort((a, b) => new Date(toIsoOrTimestamp(b.appliedAt)).getTime() - new Date(toIsoOrTimestamp(a.appliedAt)).getTime());
}

export async function getLeaveRequestById(id: string): Promise<FirestoreLeaveRecord | null> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'leaveRequests', id));
      if (snap.exists()) {
        const l = { id: snap.id, ...snap.data() } as FirestoreLeaveRecord;
        memoryStore.leaveRequests.set(id, l);
        return l;
      }
    } catch (e) {
      console.warn('Firestore getLeaveRequestById failed:', e);
    }
  }
  return memoryStore.leaveRequests.get(id) || null;
}

export async function setLeaveRequest(leave: FirestoreLeaveRecord): Promise<void> {
  memoryStore.leaveRequests.set(leave.id, leave);
  if (db) {
    try {
      await setDoc(doc(db, 'leaveRequests', leave.id), {
        ...leave,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore setLeaveRequest failed:', e);
    }
  }
}

export async function updateLeaveRequest(id: string, data: Partial<FirestoreLeaveRecord>): Promise<void> {
  const existing = memoryStore.leaveRequests.get(id);
  if (existing) {
    memoryStore.leaveRequests.set(id, { ...existing, ...data, updatedAt: new Date() });
  }
  if (db) {
    try {
      await updateDoc(doc(db, 'leaveRequests', id), {
        ...data,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      });
    } catch (e) {
      console.warn('Firestore updateLeaveRequest failed:', e);
    }
  }
}

export async function getActiveLeaveForRoute(routeId: string, dateStr: string): Promise<FirestoreLeaveRecord | null> {
  const all = await getAllLeaveRequests('approved');
  return (
    all.find(
      (l) => l.assignedRouteId === routeId && l.startDate <= dateStr && l.endDate >= dateStr
    ) || null
  );
}

// ==========================================
// 11. Notifications Repository
// ==========================================

export async function getNotificationsForUser(userId: string, limitCount = 10): Promise<FirestoreNotification[]> {
  if (db) {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      const list: FirestoreNotification[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreNotification));
      list.sort((a, b) => new Date(toIsoOrTimestamp(b.createdAt)).getTime() - new Date(toIsoOrTimestamp(a.createdAt)).getTime());
      return list;
    } catch (e) {
      console.warn('Firestore getNotificationsForUser failed:', e);
    }
  }
  return Array.from(memoryStore.notifications.values())
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(toIsoOrTimestamp(b.createdAt)).getTime() - new Date(toIsoOrTimestamp(a.createdAt)).getTime())
    .slice(0, limitCount);
}

export async function createNotification(data: {
  userId: string;
  title: string;
  message: string;
  type?: 'INFO' | 'WARNING' | 'SUCCESS';
}): Promise<FirestoreNotification> {
  const notif: FirestoreNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: data.userId,
    title: data.title,
    message: data.message,
    type: data.type || 'INFO',
    read: false,
    createdAt: new Date(),
  };

  memoryStore.notifications.set(notif.id, notif);

  if (db) {
    try {
      await setDoc(doc(db, 'notifications', notif.id), {
        ...notif,
        createdAt: serverTimestamp ? serverTimestamp() : new Date(),
      });
    } catch (e) {
      console.warn('Firestore createNotification failed:', e);
    }
  }

  return notif;
}

export async function markNotificationRead(id: string): Promise<void> {
  const existing = memoryStore.notifications.get(id);
  if (existing) {
    memoryStore.notifications.set(id, { ...existing, read: true });
  }
  if (db) {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      console.warn('Firestore markNotificationRead failed:', e);
    }
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (db) {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach((d) => batch.update(d.ref, { read: true }));
      await batch.commit();
    } catch (e) {
      console.warn('Firestore markAllNotificationsRead failed:', e);
    }
  }

  for (const [id, n] of memoryStore.notifications.entries()) {
    if (n.userId === userId && !n.read) {
      memoryStore.notifications.set(id, { ...n, read: true });
    }
  }
}

// ==========================================
// 12. Payouts Repository (INR ₹)
// ==========================================

export async function getPayoutsByDriver(driverId: string): Promise<FirestorePayout[]> {
  if (db) {
    try {
      const q = query(collection(db, 'payouts'), where('driverId', '==', driverId));
      const snap = await getDocs(q);
      const list: FirestorePayout[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestorePayout));
      list.sort((a, b) => new Date(toIsoOrTimestamp(b.createdAt)).getTime() - new Date(toIsoOrTimestamp(a.createdAt)).getTime());
      return list;
    } catch (e) {
      console.warn('Firestore getPayoutsByDriver failed:', e);
    }
  }
  return Array.from(memoryStore.payouts.values())
    .filter((p) => p.driverId === driverId)
    .sort((a, b) => new Date(toIsoOrTimestamp(b.createdAt)).getTime() - new Date(toIsoOrTimestamp(a.createdAt)).getTime());
}

export async function createPayout(payout: FirestorePayout): Promise<void> {
  memoryStore.payouts.set(payout.id, payout);
  if (db) {
    try {
      await setDoc(doc(db, 'payouts', payout.id), {
        ...payout,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      });
    } catch (e) {
      console.warn('Firestore createPayout failed:', e);
    }
  }
}

// ==========================================
// 13. Trips Repository
// ==========================================

export async function getTripByRouteDriverDateTripType(
  routeId: string,
  driverId: string,
  date: string,
  tripType: string
): Promise<FirestoreTripRecord | null> {
  if (db) {
    try {
      const q = query(
        collection(db, 'trips'),
        where('routeId', '==', routeId),
        where('driverId', '==', driverId),
        where('date', '==', date),
        where('tripType', '==', tripType),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        const t = { id: d.id, ...d.data() } as FirestoreTripRecord;
        memoryStore.trips.set(t.id, t);
        return t;
      }
    } catch (e) {
      console.warn('Firestore getTripByRouteDriverDateTripType failed:', e);
    }
  }

  for (const t of memoryStore.trips.values()) {
    if (
      t.routeId === routeId &&
      t.driverId === driverId &&
      t.date === date &&
      t.tripType === tripType
    ) {
      return t;
    }
  }
  return null;
}

export async function getTripById(id: string): Promise<FirestoreTripRecord | null> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'trips', id));
      if (snap.exists()) {
        const t = { id: snap.id, ...snap.data() } as FirestoreTripRecord;
        memoryStore.trips.set(id, t);
        return t;
      }
    } catch (e) {
      console.warn('Firestore getTripById failed:', e);
    }
  }
  return memoryStore.trips.get(id) || null;
}

export async function setTripRecord(trip: FirestoreTripRecord): Promise<void> {
  memoryStore.trips.set(trip.id, trip);
  if (db) {
    try {
      await setDoc(doc(db, 'trips', trip.id), {
        ...trip,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore setTripRecord failed:', e);
    }
  }
}

export async function updateTripRecord(id: string, data: Partial<FirestoreTripRecord>): Promise<void> {
  const existing = memoryStore.trips.get(id);
  if (existing) {
    memoryStore.trips.set(id, { ...existing, ...data, updatedAt: new Date() });
  }
  if (db) {
    try {
      await updateDoc(doc(db, 'trips', id), {
        ...data,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      });
    } catch (e) {
      console.warn('Firestore updateTripRecord failed:', e);
    }
  }
}

export async function getTripsByDriver(driverId: string, limitCount = 30): Promise<FirestoreTripRecord[]> {
  if (db) {
    try {
      const q = query(
        collection(db, 'trips'),
        where('driverId', '==', driverId),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      const list: FirestoreTripRecord[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreTripRecord));
      list.sort((a, b) => new Date(toIsoOrTimestamp(b.createdAt)).getTime() - new Date(toIsoOrTimestamp(a.createdAt)).getTime());
      return list;
    } catch (e) {
      console.warn('Firestore getTripsByDriver failed:', e);
    }
  }
  return Array.from(memoryStore.trips.values())
    .filter((t) => t.driverId === driverId)
    .sort((a, b) => new Date(toIsoOrTimestamp(b.createdAt)).getTime() - new Date(toIsoOrTimestamp(a.createdAt)).getTime())
    .slice(0, limitCount);
}

export async function countTripsByDriver(driverId: string, status?: string): Promise<number> {
  const trips = await getTripsByDriver(driverId, 1000);
  return status ? trips.filter((t) => t.status === status).length : trips.length;
}

export async function countAllTrips(status?: string): Promise<number> {
  if (db) {
    try {
      const col = collection(db, 'trips');
      const q = status ? query(col, where('status', '==', status)) : query(col);
      const snap = await getDocs(q);
      return snap.size;
    } catch (e) {
      console.warn('Firestore countAllTrips failed:', e);
    }
  }
  const all = Array.from(memoryStore.trips.values());
  return status ? all.filter((t) => t.status === status).length : all.length;
}

export async function getTripsByDate(date: string): Promise<FirestoreTripRecord[]> {
  if (db) {
    try {
      const q = query(collection(db, 'trips'), where('date', '==', date));
      const snap = await getDocs(q);
      const list: FirestoreTripRecord[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreTripRecord));
      return list;
    } catch (e) {
      console.warn('Firestore getTripsByDate failed:', e);
    }
  }
  return Array.from(memoryStore.trips.values()).filter((t) => t.date === date);
}

// ==========================================
// 14. AI Demand Prediction & Model Runs Repository
// ==========================================

export async function saveAIDemandPrediction(prediction: FirestoreAIDemandPrediction): Promise<void> {
  memoryStore.aiPredictions.set(prediction.id, prediction);
  if (db) {
    try {
      await setDoc(doc(db, 'aiDemandPredictions', prediction.id), {
        ...prediction,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore saveAIDemandPrediction failed:', e);
    }
  }
}

export async function getLatestAIDemandPredictions(limitCount = 50): Promise<FirestoreAIDemandPrediction[]> {
  if (db) {
    try {
      const q = query(
        collection(db, 'aiDemandPredictions'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      const list: FirestoreAIDemandPrediction[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FirestoreAIDemandPrediction));
      if (list.length > 0) return list;
    } catch (e) {
      console.warn('Firestore getLatestAIDemandPredictions failed:', e);
    }
  }
  return Array.from(memoryStore.aiPredictions.values())
    .sort((a, b) => new Date(toIsoOrTimestamp(b.createdAt)).getTime() - new Date(toIsoOrTimestamp(a.createdAt)).getTime())
    .slice(0, limitCount);
}

export async function saveAIModelRun(run: FirestoreAIModelRun): Promise<void> {
  memoryStore.aiModelRuns.set(run.id, run);
  if (db) {
    try {
      await setDoc(doc(db, 'aiModelRuns', run.id), {
        ...run,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date(),
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore saveAIModelRun failed:', e);
    }
  }
}

export async function getLatestAIModelRun(): Promise<FirestoreAIModelRun | null> {
  if (db) {
    try {
      const q = query(
        collection(db, 'aiModelRuns'),
        orderBy('trainedAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...d.data() } as FirestoreAIModelRun;
      }
    } catch (e) {
      console.warn('Firestore getLatestAIModelRun failed:', e);
    }
  }
  const runs = Array.from(memoryStore.aiModelRuns.values())
    .sort((a, b) => new Date(toIsoOrTimestamp(b.trainedAt)).getTime() - new Date(toIsoOrTimestamp(a.trainedAt)).getTime());
  return runs.length > 0 ? runs[0] : null;
}


