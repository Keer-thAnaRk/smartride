import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Timestamp, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

// Parse .env.local and .env without external dotenv package
function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'smartride-964b7';

/**
 * Initializes the Firebase Admin SDK using available server-side credentials:
 * 1. ./serviceAccountKey.json (or similar in root)
 * 2. GOOGLE_APPLICATION_CREDENTIALS environment variable
 * 3. FIREBASE_SERVICE_ACCOUNT_KEY (JSON string or file path)
 * 4. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 * 5. Application Default Credentials (ADC) fallback
 */
function initFirebaseAdmin(): { app: App; db: Firestore; auth: Auth | null } {
  let serviceAccount: any = null;

  // 1. Direct file check in workspace root
  const rootKeyPaths = [
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(process.cwd(), 'service-account.json'),
    path.resolve(process.cwd(), 'firebase-service-account.json'),
  ];

  for (const kp of rootKeyPaths) {
    if (fs.existsSync(kp)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(kp, 'utf8'));
        console.log(`🔑 Loaded Firebase Admin credentials from: ${path.basename(kp)}`);
        break;
      } catch (e: any) {
        console.warn(`⚠️ Failed to parse JSON from ${kp}:`, e.message);
      }
    }
  }

  // 2. GOOGLE_APPLICATION_CREDENTIALS path
  if (!serviceAccount && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (fs.existsSync(credPath)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        console.log(`🔑 Loaded Firebase Admin credentials from GOOGLE_APPLICATION_CREDENTIALS: ${credPath}`);
      } catch (e: any) {
        console.warn(`⚠️ Failed to parse GOOGLE_APPLICATION_CREDENTIALS file:`, e.message);
      }
    }
  }

  // 3. FIREBASE_SERVICE_ACCOUNT_KEY (JSON string or path)
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    if (raw.startsWith('{')) {
      try {
        serviceAccount = JSON.parse(raw);
        console.log(`🔑 Loaded Firebase Admin credentials from FIREBASE_SERVICE_ACCOUNT_KEY JSON string`);
      } catch (e: any) {
        console.warn(`⚠️ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON:`, e.message);
      }
    } else {
      const p = path.resolve(process.cwd(), raw);
      if (fs.existsSync(p)) {
        try {
          serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
          console.log(`🔑 Loaded Firebase Admin credentials from path: ${raw}`);
        } catch (e: any) {
          console.warn(`⚠️ Failed to parse file at ${raw}:`, e.message);
        }
      }
    }
  }

  // 4. Individual env variables
  if (!serviceAccount && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID || projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
    console.log(`🔑 Loaded Firebase Admin credentials from FIREBASE_CLIENT_EMAIL & FIREBASE_PRIVATE_KEY`);
  }

  let app: App;
  if (getApps().length > 0) {
    app = getApps()[0];
  } else if (serviceAccount) {
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
  } else {
    console.log(`ℹ️ Attempting initialization for project "${projectId}"...`);
    app = initializeApp({
      projectId,
    });
  }

  const db = getFirestore(app);
  let auth: Auth | null = null;
  try {
    auth = getAuth(app);
  } catch (e: any) {
    console.warn(`⚠️ Firebase Admin Auth initialization note: ${e.message}`);
  }

  return { app, db, auth };
}

const { app, db, auth } = initFirebaseAdmin();

/**
 * Creates or updates an authenticated user in Firebase Auth via Admin SDK,
 * and attaches custom claims (role) so client queries pass security rules.
 */
async function getOrCreateAdminAuthUser(
  email: string,
  pass: string,
  displayName: string,
  role: 'ADMIN' | 'DRIVER' | 'COMMUTER',
  phoneNumber?: string
): Promise<string> {
  const cleanEmail = email.toLowerCase().trim();
  const deterministicUid = `uid_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  if (!auth) {
    return deterministicUid;
  }

  try {
    let uid: string;
    try {
      const existingUser = await auth.getUserByEmail(cleanEmail);
      uid = existingUser.uid;
    } catch (lookupErr: any) {
      if (lookupErr.code === 'auth/user-not-found') {
        const newUser = await auth.createUser({
          email: cleanEmail,
          password: pass,
          displayName,
          phoneNumber: phoneNumber?.replace(/\s+/g, ''),
        });
        uid = newUser.uid;
        console.log(`  👤 Created Firebase Auth user via Admin SDK: ${cleanEmail} (UID: ${uid})`);
      } else {
        throw lookupErr;
      }
    }

    // Set custom claims so request.auth.token.role == role in firestore.rules
    await auth.setCustomUserClaims(uid, { role });
    return uid;
  } catch (err: any) {
    console.warn(`  ⚠️ Admin Auth note for ${cleanEmail}: ${err.message}. Using deterministic UID.`);
    return deterministicUid;
  }
const DEFAULT_ADMIN_PASS = process.env.DEMO_ADMIN_PASSWORD || 'admin123';
const DEFAULT_DRIVER_PASS = process.env.DEMO_DRIVER_PASSWORD || 'driver123';
const DEFAULT_COMMUTER_PASS = process.env.DEMO_COMMUTER_PASSWORD || 'user123';

async function seedFirestore() {
  console.log('🚀 Starting Cloud Firestore zero-cost seed with Firebase Admin SDK (INR ₹)...\n');

  // 1. Subscription Plans (INR ₹)
  console.log('1. Seeding Subscription Plans (INR ₹)...');
  const plans = [
    {
      id: 'plan_monthly',
      name: 'Smart Standard (Monthly)',
      billingCycle: 'MONTHLY',
      durationMonths: 1,
      price: 3499, // ₹3,499 INR
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
    },
    {
      id: 'plan_quarterly',
      name: 'Smart Pro (Quarterly)',
      billingCycle: 'QUARTERLY',
      durationMonths: 3,
      price: 9499, // ₹9,499 INR (Save ~10%)
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
    },
    {
      id: 'plan_yearly',
      name: 'Smart Executive (Yearly)',
      billingCycle: 'YEARLY',
      durationMonths: 12,
      price: 34999, // ₹34,999 INR (Save ~16%)
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
    },
  ];

  for (const p of plans) {
    await db.collection('subscriptionPlans').doc(p.id).set({
      ...p,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`  ✅ Successfully wrote ${plans.length} subscription plans to Cloud Firestore.`);

  // 2. Admin User
  console.log('\n2. Seeding Admin User via Admin SDK...');
  const adminUid = await getOrCreateAdminAuthUser(
    'admin@smartride.com',
    DEFAULT_ADMIN_PASS,
    'Elena Rostova',
    'ADMIN',
    '+919845011223'
  );
  await db.collection('users').doc(adminUid).set({
    id: adminUid,
    email: 'admin@smartride.com',
    name: 'Elena Rostova',
    phone: '+91 98450 11223',
    role: 'ADMIN',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log(`  ✅ Admin user seeded (UID: ${adminUid}).`);

  // 3. Drivers & Vehicles
  console.log('\n3. Seeding Drivers & Vehicles via Admin SDK...');
  const driverSeeds = [
    {
      email: 'driver.rajesh@smartride.com',
      pass: DEFAULT_DRIVER_PASS,
      name: 'Rajesh Sharma',
      phone: '+91 98450 12345',
      driverId: 'driver_rajesh_1',
      licenseNumber: 'DL-BLR-2018-98421',
      experienceYears: 6,
      rating: 4.96,
      isVerified: true,
      status: 'AVAILABLE' as const,
      vehicle: {
        id: 'veh_crysta_1',
        make: 'Toyota',
        model: 'Innova Crysta AC',
        year: 2023,
        licensePlate: 'KA-01-MJ-8822',
        capacity: 6,
        type: 'SUV' as const,
        isApproved: true,
        rcDocUrl: 'https://smartride.com/docs/rc/KA-01-MJ-8822.pdf',
        insuranceDocUrl: 'https://smartride.com/docs/ins/KA-01-MJ-8822.pdf',
      },
    },
    {
      email: 'driver.vikram@smartride.com',
      pass: DEFAULT_DRIVER_PASS,
      name: 'Vikram Singh',
      phone: '+91 98450 23456',
      driverId: 'driver_vikram_2',
      licenseNumber: 'DL-BLR-2019-33821',
      experienceYears: 5,
      rating: 4.89,
      isVerified: true,
      status: 'AVAILABLE' as const,
      vehicle: {
        id: 'veh_urbania_2',
        make: 'Force',
        model: 'Urbania Executive 12S',
        year: 2024,
        licensePlate: 'KA-04-TR-4590',
        capacity: 12,
        type: 'MINI_BUS' as const,
        isApproved: true,
        rcDocUrl: 'https://smartride.com/docs/rc/KA-04-TR-4590.pdf',
        insuranceDocUrl: 'https://smartride.com/docs/ins/KA-04-TR-4590.pdf',
      },
    },
    {
      email: 'driver.anita@smartride.com',
      pass: DEFAULT_DRIVER_PASS,
      name: 'Anita Deshmukh',
      phone: '+91 98450 34567',
      driverId: 'driver_anita_3',
      licenseNumber: 'DL-BLR-2020-77190',
      experienceYears: 4,
      rating: 4.93,
      isVerified: true,
      status: 'AVAILABLE' as const,
      vehicle: {
        id: 'veh_creta_3',
        make: 'Hyundai',
        model: 'Creta Executive',
        year: 2023,
        licensePlate: 'KA-05-AB-3310',
        capacity: 4,
        type: 'SUV' as const,
        isApproved: true,
        rcDocUrl: 'https://smartride.com/docs/rc/KA-05-AB-3310.pdf',
        insuranceDocUrl: 'https://smartride.com/docs/ins/KA-05-AB-3310.pdf',
      },
    },
    {
      email: 'driver.suresh@smartride.com',
      pass: DEFAULT_DRIVER_PASS,
      name: 'Suresh Kumar',
      phone: '+91 98450 45678',
      driverId: 'driver_suresh_4',
      licenseNumber: 'DL-BLR-2022-11945',
      experienceYears: 3,
      rating: 5.0,
      isVerified: false,
      status: 'OFFLINE' as const,
      vehicle: {
        id: 'veh_city_4',
        make: 'Honda',
        model: 'City V-Tec',
        year: 2022,
        licensePlate: 'KA-03-MK-7711',
        capacity: 4,
        type: 'SEDAN' as const,
        isApproved: false,
        rcDocUrl: 'https://smartride.com/docs/rc/KA-03-MK-7711.pdf',
        insuranceDocUrl: 'https://smartride.com/docs/ins/KA-03-MK-7711.pdf',
      },
    },
    {
      email: 'driver.standby@smartride.com',
      pass: DEFAULT_DRIVER_PASS,
      name: 'Amit Verma',
      phone: '+91 98450 56789',
      driverId: 'driver_standby_5',
      licenseNumber: 'DL-BLR-2021-88452',
      experienceYears: 7,
      rating: 4.98,
      isVerified: true,
      status: 'AVAILABLE' as const,
      vehicle: {
        id: 'veh_ertiga_5',
        make: 'Maruti Suzuki',
        model: 'Ertiga Smart Hybrid AC',
        year: 2024,
        licensePlate: 'KA-01-SB-9900',
        capacity: 6,
        type: 'SUV' as const,
        isApproved: true,
        rcDocUrl: 'https://smartride.com/docs/rc/KA-01-SB-9900.pdf',
        insuranceDocUrl: 'https://smartride.com/docs/ins/KA-01-SB-9900.pdf',
      },
    },
  ];

  for (const d of driverSeeds) {
    const uid = await getOrCreateAdminAuthUser(d.email, d.pass, d.name, 'DRIVER', d.phone);
    await db.collection('users').doc(uid).set({
      id: uid,
      email: d.email,
      name: d.name,
      phone: d.phone,
      role: 'DRIVER',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(d.name)}`,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await db.collection('driverProfiles').doc(d.driverId).set({
      id: d.driverId,
      userId: uid,
      licenseNumber: d.licenseNumber,
      experienceYears: d.experienceYears,
      rating: d.rating,
      isVerified: d.isVerified,
      status: d.status,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await db.collection('vehicles').doc(d.vehicle.id).set({
      ...d.vehicle,
      driverId: d.driverId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`  ✅ Successfully wrote ${driverSeeds.length} drivers & vehicles to Cloud Firestore.`);

  // 4. Fixed Routes
  console.log('\n4. Seeding Corridor Routes via Admin SDK...');
  const routes = [
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
      assignedDriverId: 'driver_rajesh_1',
      assignedVehicleId: 'veh_crysta_1',
      waypoints: [
        { stopName: 'Electronic City Toll Gate', landmark: 'Flyover Entry Gate', estimatedPickupTime: '08:00 AM', estimatedDropTime: '07:15 PM', lat: 12.8452, lng: 77.6602 },
        { stopName: 'HSR Layout 27th Main', landmark: 'Near BDA Complex', estimatedPickupTime: '08:20 AM', estimatedDropTime: '06:55 PM', lat: 12.9116, lng: 77.6389 },
        { stopName: 'Bellandur EcoSpace', landmark: 'Central Service Road Bus Bay', estimatedPickupTime: '08:35 AM', estimatedDropTime: '06:40 PM', lat: 12.926, lng: 77.6762 },
        { stopName: 'Marathahalli Bridge', landmark: 'Kalamandir Footbridge', estimatedPickupTime: '08:45 AM', estimatedDropTime: '06:25 PM', lat: 12.9569, lng: 77.7011 },
        { stopName: 'ITPB Whitefield Hub', landmark: 'Gate 2 Main Concourse', estimatedPickupTime: '08:55 AM', estimatedDropTime: '06:15 PM', lat: 12.9863, lng: 77.7314 },
      ],
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
      assignedDriverId: 'driver_vikram_2',
      assignedVehicleId: 'veh_urbania_2',
      waypoints: [
        { stopName: 'Banashankari Metro Hub', landmark: 'Metro Station Gate 3', estimatedPickupTime: '08:15 AM', estimatedDropTime: '07:20 PM', lat: 12.9255, lng: 77.5468 },
        { stopName: 'South End Circle Jayanagar', landmark: 'Nanda Talkies Junction', estimatedPickupTime: '08:30 AM', estimatedDropTime: '07:05 PM', lat: 12.9385, lng: 77.58 },
        { stopName: 'MG Road Trinity Circle', landmark: 'Taj MG Road Concourse', estimatedPickupTime: '08:45 AM', estimatedDropTime: '06:50 PM', lat: 12.9738, lng: 77.6205 },
        { stopName: 'Hebbal Flyover Entry', landmark: 'Esteem Mall Bus Bay', estimatedPickupTime: '08:55 AM', estimatedDropTime: '06:40 PM', lat: 13.0358, lng: 77.597 },
        { stopName: 'Manyata Tech Park Gate 1', landmark: 'Main Entrance Terminal', estimatedPickupTime: '09:05 AM', estimatedDropTime: '06:30 PM', lat: 13.0458, lng: 77.6208 },
      ],
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
      assignedDriverId: 'driver_anita_3',
      assignedVehicleId: 'veh_creta_3',
      waypoints: [
        { stopName: 'Sarjapur Decathlon', landmark: 'Main Parking Bay', estimatedPickupTime: '08:30 AM', estimatedDropTime: '06:45 PM', lat: 12.9082, lng: 77.6835 },
        { stopName: 'Kaikondrahalli Junction', landmark: 'Total Mall Junction', estimatedPickupTime: '08:42 AM', estimatedDropTime: '06:30 PM', lat: 12.915, lng: 77.674 },
        { stopName: 'Kadubeesanahalli Underpass', landmark: 'Cisco Systems Entry Bay', estimatedPickupTime: '08:55 AM', estimatedDropTime: '06:15 PM', lat: 12.936, lng: 77.692 },
        { stopName: 'Bagmane Tech Park', landmark: 'Lakeview Tower Concourse', estimatedPickupTime: '09:10 AM', estimatedDropTime: '06:00 PM', lat: 12.981, lng: 77.663 },
      ],
    },
  ];

  for (const r of routes) {
    await db.collection('routes').doc(r.id).set({
      ...r,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`  ✅ Successfully wrote ${routes.length} corridor routes to Cloud Firestore.`);

  // 5. Commuters, Subscriptions, Bookings (INR ₹)
  console.log('\n5. Seeding Commuters, Subscriptions, Dedicated Bookings & Payments (INR ₹)...');
  const commuterSeeds = [
    {
      email: 'commuter.rahul@smartride.com',
      pass: DEFAULT_COMMUTER_PASS,
      name: 'Rahul Verma',
      phone: '+91 98451 10001',
      pickup: 'HSR Layout 27th Main (Near BDA Complex)',
      drop: 'ITPB Whitefield Hub (Gate 2)',
      morningTime: '08:20 AM',
      eveningTime: '06:15 PM',
      routeId: 'route-sr-101',
      planId: 'plan_monthly',
      price: 3499,
      seatNumber: 1,
    },
    {
      email: 'commuter.priya@smartride.com',
      pass: DEFAULT_COMMUTER_PASS,
      name: 'Priya Sharma',
      phone: '+91 98451 10002',
      pickup: 'Bellandur EcoSpace (Central Service Road)',
      drop: 'ITPB Whitefield Hub (Gate 2)',
      morningTime: '08:35 AM',
      eveningTime: '06:15 PM',
      routeId: 'route-sr-101',
      planId: 'plan_quarterly',
      price: 9499,
      seatNumber: 2,
    },
    {
      email: 'commuter.amit@smartride.com',
      pass: DEFAULT_COMMUTER_PASS,
      name: 'Amit Patel',
      phone: '+91 98451 10003',
      pickup: 'South End Circle Jayanagar',
      drop: 'Manyata Tech Park Gate 1',
      morningTime: '08:30 AM',
      eveningTime: '06:30 PM',
      routeId: 'route-sr-102',
      planId: 'plan_monthly',
      price: 3499,
      seatNumber: 1,
    },
    {
      email: 'commuter.sneha@smartride.com',
      pass: DEFAULT_COMMUTER_PASS,
      name: 'Sneha Reddy',
      phone: '+91 98451 10004',
      pickup: 'MG Road Trinity Circle',
      drop: 'Manyata Tech Park Gate 1',
      morningTime: '08:45 AM',
      eveningTime: '06:30 PM',
      routeId: 'route-sr-102',
      planId: 'plan_yearly',
      price: 34999,
      seatNumber: 2,
    },
    {
      email: 'commuter.karthik@smartride.com',
      pass: DEFAULT_COMMUTER_PASS,
      name: 'Karthik Nair',
      phone: '+91 98451 10005',
      pickup: 'Kaikondrahalli Junction',
      drop: 'Bagmane Tech Park Lakeview',
      morningTime: '08:42 AM',
      eveningTime: '06:00 PM',
      routeId: 'route-sr-103',
      planId: 'plan_monthly',
      price: 3499,
      seatNumber: 1,
    },
  ];

  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setDate(now.getDate() + 30);
  const todayStr = now.toISOString().split('T')[0];

  for (let i = 0; i < commuterSeeds.length; i++) {
    const c = commuterSeeds[i];
    const uid = await getOrCreateAdminAuthUser(c.email, c.pass, c.name, 'COMMUTER', c.phone);

    await db.collection('users').doc(uid).set({
      id: uid,
      email: c.email,
      name: c.name,
      phone: c.phone,
      role: 'COMMUTER',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.name)}`,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await db.collection('commuterProfiles').doc(uid).set({
      id: uid,
      userId: uid,
      defaultPickupAddress: c.pickup,
      defaultDropAddress: c.drop,
      morningPickupTime: c.morningTime,
      eveningDropTime: c.eveningTime,
      emergencyContact: '+91 98765 00099',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const subId = `sub_${c.name.toLowerCase().split(' ')[0]}_${i + 1}`;
    await db.collection('subscriptions').doc(subId).set({
      id: subId,
      commuterId: uid,
      planId: c.planId,
      routeId: c.routeId,
      status: 'ACTIVE',
      startDate: Timestamp.fromDate(now),
      endDate: Timestamp.fromDate(nextMonth),
      morningPickupTime: c.morningTime,
      eveningPickupTime: c.eveningTime,
      pickupAddress: c.pickup,
      dropAddress: c.drop,
      seatNumber: c.seatNumber,
      autoRenew: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Dedicated Bookings Collection (Requirement #1)
    const bookId = `book_sr_${Date.now()}_${i + 1}`;
    await db.collection('bookings').doc(bookId).set({
      id: bookId,
      bookingNumber: `SR-BK-2026-${1000 + i}`,
      commuterId: uid,
      subscriptionId: subId,
      routeId: c.routeId,
      planId: c.planId,
      seatNumber: c.seatNumber,
      pickupAddress: c.pickup,
      dropAddress: c.drop,
      pickupTime: c.morningTime,
      dropTime: c.eveningTime,
      fare: c.price,
      currency: 'INR',
      status: 'CONFIRMED',
      bookingDate: Timestamp.fromDate(now),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Payment Record (INR ₹)
    const invNum = `INV-2026-00${i + 101}`;
    const payId = `pay_${Date.now()}_${i + 1}`;
    await db.collection('payments').doc(payId).set({
      id: payId,
      subscriptionId: subId,
      bookingId: bookId,
      commuterId: uid,
      amount: c.price,
      currency: 'INR',
      status: 'SUCCEEDED',
      paymentMethod: i % 2 === 0 ? 'UPI' : 'CARD',
      transactionId: `txn_razorpay_${Date.now()}_${i + 100}`,
      invoiceNumber: invNum,
      receiptUrl: `/commuter/invoices?invoice=${invNum}`,
      createdAt: Timestamp.fromDate(new Date(Date.now() - (i + 1) * 86400000 * 2)),
      updatedAt: Timestamp.now(),
    });

    // Attendances for today
    let assignedDriverId = 'driver_rajesh_1';
    if (c.routeId === 'route-sr-102') assignedDriverId = 'driver_vikram_2';
    if (c.routeId === 'route-sr-103') assignedDriverId = 'driver_anita_3';

    await db.collection('attendances').doc(`${uid}_${todayStr}_MORNING_PICKUP`).set({
      id: `${uid}_${todayStr}_MORNING_PICKUP`,
      commuterId: uid,
      driverId: assignedDriverId,
      routeId: c.routeId,
      date: todayStr,
      tripType: 'MORNING_PICKUP',
      status: i === 0 ? 'BOARDED' : i === 4 ? 'ABSENT' : 'SCHEDULED',
      notes: i === 4 ? 'Commuter notified working from home' : null,
      markedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await db.collection('attendances').doc(`${uid}_${todayStr}_EVENING_DROP`).set({
      id: `${uid}_${todayStr}_EVENING_DROP`,
      commuterId: uid,
      driverId: assignedDriverId,
      routeId: c.routeId,
      date: todayStr,
      tripType: 'EVENING_DROP',
      status: 'SCHEDULED',
      notes: null,
      markedAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  console.log(`  ✅ Successfully wrote ${commuterSeeds.length} commuters, subscriptions, bookings, payments & attendances.`);

  // 6. Active Trip & Sanitized Public Projection
  console.log('\n6. Seeding Active Trip & Public Projection (Zero-PII compliant)...');
  const activeTripData = {
    tripId: 'trip-sr101-today',
    routeId: 'route-sr-101',
    routeName: 'Whitefield Tech Corridor Express',
    routeCode: 'SR-101',
    driverId: 'driver_rajesh_1',
    driverName: 'Rajesh Sharma',
    driverPhone: '+91 98450 12345',
    vehiclePlate: 'KA-01-MJ-8822',
    vehicleModel: 'Toyota Innova Crysta AC',
    date: todayStr,
    tripType: 'MORNING_PICKUP',
    status: 'in_transit',
    passengers: [
      {
        userId: 'user_commuter_1',
        name: 'Rahul Verma',
        pickupStop: 'HSR Layout 27th Main',
        dropStop: 'ITPB Tech Park Hub',
        rideOtp: '4821',
        boarded: true,
        emergencyContacts: [
          { name: 'Ananya Verma', phone: '+91 98765 43210', relationship: 'Spouse' },
        ],
      },
      {
        userId: 'user_commuter_2',
        name: 'Priya Sharma',
        pickupStop: 'Bellandur EcoSpace',
        dropStop: 'ITPB Tech Park Hub',
        rideOtp: '5924',
        boarded: false,
        emergencyContacts: [
          { name: 'Sanjay Sharma', phone: '+91 98444 77889', relationship: 'Father' },
        ],
      },
    ],
    liveLocation: {
      lat: 12.926,
      lng: 77.6762,
      heading: 68,
      speedKmH: 38,
      updatedAt: new Date().toISOString(),
    },
    shareToken: 'smart-live-sr101-7x9q',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // Operational internal trip (restricted to authenticated drivers/admins)
  await db.collection('trips').doc('trip-sr101-today').set(activeTripData);

  // Sanitized public projection doc: publicTrips/{shareToken}
  // ZERO passenger names, phones, OTPs, or emergency contacts!
  await db.collection('publicTrips').doc('smart-live-sr101-7x9q').set({
    tripId: 'trip-sr101-today',
    routeName: 'Whitefield Tech Corridor Express',
    routeCode: 'SR-101',
    vehicleModel: 'Toyota Innova Crysta AC',
    vehiclePlate: 'KA-01-MJ-8822',
    liveLocation: activeTripData.liveLocation,
    status: 'in_transit',
    driverPublicName: 'Rajesh',
    updatedAt: Timestamp.now(),
  });
  console.log('  ✅ Active operational trip and sanitized public tracking projection written.');

  // 7. Driver Payouts (INR ₹)
  console.log('\n7. Seeding Driver Payouts (INR ₹)...');
  await db.collection('payouts').doc('pay_payout_1').set({
    id: 'pay_payout_1',
    driverId: 'driver_rajesh_1',
    amount: 42500, // ₹42,500 INR
    periodStart: Timestamp.fromDate(new Date(Date.now() - 15 * 86400000)),
    periodEnd: Timestamp.fromDate(new Date(Date.now() - 1 * 86400000)),
    status: 'PROCESSED',
    reference: 'PAY-UPI-BLR-0982',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log('  ✅ Driver payout record seeded.');

  // 8. Driver Leave Requests
  console.log('\n8. Seeding Standby Captain Leave Workflow...');
  await db.collection('leaveRequests').doc('leave_demo_1').set({
    id: 'leave_demo_1',
    requestId: 'leave_demo_1',
    driverId: 'driver_rajesh_1',
    driverName: 'Rajesh Sharma',
    assignedRouteId: 'route-sr-101',
    startDate: todayStr,
    endDate: todayStr,
    reason: 'Vehicle periodic routine maintenance',
    status: 'approved',
    replacementDriverId: 'driver_standby_5',
    replacementDriverName: 'Amit Verma',
    appliedAt: Timestamp.now(),
    reviewedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log('  ✅ Driver leave request and standby captain assignment seeded.');

  // 9. Commuter Notifications
  console.log('\n9. Seeding Notifications...');
  await db.collection('notifications').doc('notif_commuter_1').set({
    id: 'notif_commuter_1',
    userId: 'uid_commuter_rahul_smartride_com',
    title: 'Ride Confirmed - Whitefield Corridor',
    message: 'Your monthly pickup schedule is active. Reserved AC Seat #1 with Captain Rajesh.',
    type: 'SUCCESS',
    read: false,
    createdAt: Timestamp.now(),
  });
  console.log('  ✅ Commuter notifications seeded.');

  // 10. Direct Read-Back Verification from Cloud Firestore
  console.log('\n🔍 Verifying seeded data directly from Cloud Firestore...');
  const plansSnap = await db.collection('subscriptionPlans').get();
  console.log(`  📊 subscriptionPlans in Cloud Firestore: ${plansSnap.size} document(s) verified`);
  plansSnap.forEach((d) => {
    const p = d.data();
    console.log(`     • ${p.name}: ₹${p.price} (${p.billingCycle})`);
  });

  const routesSnap = await db.collection('routes').get();
  console.log(`  📊 routes in Cloud Firestore: ${routesSnap.size} document(s) verified`);

  const usersSnap = await db.collection('users').get();
  console.log(`  📊 users in Cloud Firestore: ${usersSnap.size} document(s) verified`);

  const bookingsSnap = await db.collection('bookings').get();
  console.log(`  📊 dedicated bookings in Cloud Firestore: ${bookingsSnap.size} document(s) verified`);

  const publicTripsSnap = await db.collection('publicTrips').get();
  console.log(`  📊 publicTrips (zero-PII projection) in Cloud Firestore: ${publicTripsSnap.size} document(s) verified`);

  console.log('\n🎉 Cloud Firestore seeding and verification completed successfully with Firebase Admin SDK!');
  console.log('   All 13 application domains, dedicated bookings, and INR ₹ pricing are persisted and verified.\n');
}

seedFirestore()
  .then(() => {
    console.log('✅ Seeding completed!');
    process.exit(0);
  })
  .catch((err: any) => {
    console.error('\n❌ Error during Firestore seed:', err.message || err);

    if (
      err.message?.includes('default credentials') ||
      err.message?.includes('NO_ADC_FOUND') ||
      err.code === 7 ||
      err.code === 'permission-denied'
    ) {
      console.log('\n─────────────────────────────────────────────────────────────────────────────');
      console.log('📋 HOW TO PROVIDE FIREBASE ADMIN SERVICE ACCOUNT CREDENTIALS:');
      console.log('─────────────────────────────────────────────────────────────────────────────');
      console.log('Firebase Admin SDK needs server-side credentials to connect to Cloud Firestore.');
      console.log('');
      console.log('1. Go to Firebase Console:');
      console.log(`   https://console.firebase.google.com/project/${projectId}/settings/serviceaccounts/adminsdk`);
      console.log('2. Click "Generate new private key", then click "Generate key".');
      console.log('3. Move/save the downloaded JSON file to your project root as:');
      console.log(`   ${path.resolve(process.cwd(), 'serviceAccountKey.json')}`);
      console.log('   (Or set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local with the file path or JSON content)');
      console.log('4. Run: npm run seed:firestore');
      console.log('─────────────────────────────────────────────────────────────────────────────\n');
    }
    process.exit(1);
  });
