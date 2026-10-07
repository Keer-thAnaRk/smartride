import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Smart Ride database seed...');

  // 1. Clean existing records safely
  await prisma.attendance.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.route.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driverProfile.deleteMany();
  await prisma.commuterProfile.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(process.env.DEMO_DEFAULT_PASSWORD || 'password123', 10);
  const adminPasswordHash = await bcrypt.hash(process.env.DEMO_ADMIN_PASSWORD || 'admin123', 10);
  const driverPasswordHash = await bcrypt.hash(process.env.DEMO_DRIVER_PASSWORD || 'driver123', 10);
  const userPasswordHash = await bcrypt.hash(process.env.DEMO_COMMUTER_PASSWORD || 'user123', 10);

  // 2. Create Subscription Plans
  const monthlyPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Smart Standard (Monthly)',
      billingCycle: 'MONTHLY',
      durationMonths: 1,
      price: 129,
      discountPercent: 0,
      description: 'Ideal for everyday professionals needing guaranteed daily pickup and drop with zero surge pricing.',
      features: JSON.stringify([
        'Door-to-door morning pickup & evening drop',
        'Guaranteed reserved AC seat',
        'Live vehicle GPS tracking & ETA alerts',
        'Free 2 skip ride credits per month',
        'Dedicated route captain & 24/7 SOS support',
      ]),
      isPopular: false,
    },
  });

  const quarterlyPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Smart Pro (Quarterly)',
      billingCycle: 'QUARTERLY',
      durationMonths: 3,
      price: 349,
      discountPercent: 10,
      description: 'Most popular choice for steady hybrid & office commuters. Save 10% with flexible pickup slot swaps.',
      features: JSON.stringify([
        'Everything in Standard plan',
        '10% direct savings on quarterly billing',
        'Flexible 15-minute slot time adjustment',
        'Priority driver dispatch & window seats',
        'Free 8 skip ride roll-over credits',
        'Priority commuter concierge assistance',
      ]),
      isPopular: true,
    },
  });

  const yearlyPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Smart Executive (Yearly)',
      billingCycle: 'YEARLY',
      durationMonths: 12,
      price: 1299,
      discountPercent: 16,
      description: 'Maximum savings and exclusive executive perks for long-term daily corporate commuters.',
      features: JSON.stringify([
        'Everything in Pro plan',
        '16% ultimate annual cost savings',
        'Guaranteed premium luxury SUV/Van seating',
        'Complimentary weekend airport shuttle voucher (2x/yr)',
        'Unlimited skip ride bank with cash-back credit',
        'VIP Corporate billing & GST automated invoicing',
      ]),
      isPopular: false,
    },
  });

  // 3. Create Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@smartride.com',
      passwordHash: adminPasswordHash,
      name: 'Elena Rostova',
      phone: '+1 (555) 019-2834',
      role: 'ADMIN',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
  });

  // 4. Create Drivers & Profiles & Vehicles
  const driverUser1 = await prisma.user.create({
    data: {
      email: 'driver.rajesh@smartride.com',
      passwordHash: driverPasswordHash,
      name: 'Rajesh Sharma',
      phone: '+1 (555) 234-5678',
      role: 'DRIVER',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
  });
  const driverProfile1 = await prisma.driverProfile.create({
    data: {
      userId: driverUser1.id,
      licenseNumber: 'DL-BLR-2018-98421',
      experienceYears: 6,
      rating: 4.96,
      isVerified: true,
      status: 'AVAILABLE',
    },
  });
  const vehicle1 = await prisma.vehicle.create({
    data: {
      driverId: driverProfile1.id,
      make: 'Toyota',
      model: 'Innova Crysta AC',
      year: 2023,
      licensePlate: 'KA-01-MJ-8822',
      capacity: 6,
      type: 'SUV',
      isApproved: true,
      rcDocUrl: 'https://smartride.com/docs/rc/KA-01-MJ-8822.pdf',
      insuranceDocUrl: 'https://smartride.com/docs/ins/KA-01-MJ-8822.pdf',
    },
  });

  const driverUser2 = await prisma.user.create({
    data: {
      email: 'driver.vikram@smartride.com',
      passwordHash: driverPasswordHash,
      name: 'Vikram Singh',
      phone: '+1 (555) 345-6789',
      role: 'DRIVER',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    },
  });
  const driverProfile2 = await prisma.driverProfile.create({
    data: {
      userId: driverUser2.id,
      licenseNumber: 'DL-BLR-2019-33821',
      experienceYears: 5,
      rating: 4.89,
      isVerified: true,
      status: 'AVAILABLE',
    },
  });
  const vehicle2 = await prisma.vehicle.create({
    data: {
      driverId: driverProfile2.id,
      make: 'Force',
      model: 'Urbania Executive 12S',
      year: 2024,
      licensePlate: 'KA-04-TR-4590',
      capacity: 12,
      type: 'MINI_BUS',
      isApproved: true,
      rcDocUrl: 'https://smartride.com/docs/rc/KA-04-TR-4590.pdf',
      insuranceDocUrl: 'https://smartride.com/docs/ins/KA-04-TR-4590.pdf',
    },
  });

  const driverUser3 = await prisma.user.create({
    data: {
      email: 'driver.anita@smartride.com',
      passwordHash: driverPasswordHash,
      name: 'Anita Deshmukh',
      phone: '+1 (555) 456-7890',
      role: 'DRIVER',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    },
  });
  const driverProfile3 = await prisma.driverProfile.create({
    data: {
      userId: driverUser3.id,
      licenseNumber: 'DL-BLR-2020-77190',
      experienceYears: 4,
      rating: 4.93,
      isVerified: true,
      status: 'AVAILABLE',
    },
  });
  const vehicle3 = await prisma.vehicle.create({
    data: {
      driverId: driverProfile3.id,
      make: 'Hyundai',
      model: 'Creta Executive',
      year: 2023,
      licensePlate: 'KA-05-AB-3310',
      capacity: 4,
      type: 'SUV',
      isApproved: true,
      rcDocUrl: 'https://smartride.com/docs/rc/KA-05-AB-3310.pdf',
      insuranceDocUrl: 'https://smartride.com/docs/ins/KA-05-AB-3310.pdf',
    },
  });

  // Pending Driver for verification demo
  const driverUser4 = await prisma.user.create({
    data: {
      email: 'driver.suresh@smartride.com',
      passwordHash: driverPasswordHash,
      name: 'Suresh Kumar',
      phone: '+1 (555) 567-8901',
      role: 'DRIVER',
      avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    },
  });
  const driverProfile4 = await prisma.driverProfile.create({
    data: {
      userId: driverUser4.id,
      licenseNumber: 'DL-BLR-2022-11945',
      experienceYears: 3,
      rating: 5.0,
      isVerified: false,
      status: 'OFFLINE',
    },
  });
  await prisma.vehicle.create({
    data: {
      driverId: driverProfile4.id,
      make: 'Honda',
      model: 'City V-Tec',
      year: 2022,
      licensePlate: 'KA-03-MK-7711',
      capacity: 4,
      type: 'SEDAN',
      isApproved: false,
      rcDocUrl: 'https://smartride.com/docs/rc/KA-03-MK-7711.pdf',
      insuranceDocUrl: 'https://smartride.com/docs/ins/KA-03-MK-7711.pdf',
    },
  });

  // 4b. Create Verified Standby Driver (Captain Amit Verma) available for route substitution
  const driverUser5 = await prisma.user.create({
    data: {
      email: 'driver.standby@smartride.com',
      passwordHash: driverPasswordHash,
      name: 'Amit Verma',
      phone: '+1 (555) 789-0123',
      role: 'DRIVER',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    },
  });
  const driverProfile5 = await prisma.driverProfile.create({
    data: {
      userId: driverUser5.id,
      licenseNumber: 'DL-BLR-2021-88452',
      experienceYears: 7,
      rating: 4.98,
      isVerified: true,
      status: 'AVAILABLE',
    },
  });
  await prisma.vehicle.create({
    data: {
      driverId: driverProfile5.id,
      make: 'Maruti Suzuki',
      model: 'Ertiga Smart Hybrid AC',
      year: 2024,
      licensePlate: 'KA-01-SB-9900',
      capacity: 6,
      type: 'SUV',
      isApproved: true,
      rcDocUrl: 'https://smartride.com/docs/rc/KA-01-SB-9900.pdf',
      insuranceDocUrl: 'https://smartride.com/docs/ins/KA-01-SB-9900.pdf',
    },
  });

  // 5. Create Fixed Routes
  const route1 = await prisma.route.create({
    data: {
      name: 'Whitefield Tech Corridor Express',
      code: 'SR-101',
      origin: 'Electronic City Toll Gate',
      destination: 'ITPB Tech Park, Whitefield',
      distanceKm: 28.5,
      estimatedMinutes: 50,
      morningStartTime: '08:00 AM',
      eveningStartTime: '06:15 PM',
      status: 'ACTIVE',
      assignedDriverId: driverProfile1.id,
      assignedVehicleId: vehicle1.id,
      waypoints: JSON.stringify([
        {
          stopName: 'Electronic City Toll Gate',
          landmark: 'Flyover Entry Gate',
          estimatedPickupTime: '08:00 AM',
          estimatedDropTime: '07:15 PM',
          lat: 12.8452,
          lng: 77.6602,
        },
        {
          stopName: 'HSR Layout 27th Main',
          landmark: 'Near BDA Complex',
          estimatedPickupTime: '08:20 AM',
          estimatedDropTime: '06:55 PM',
          lat: 12.9116,
          lng: 77.6389,
        },
        {
          stopName: 'Bellandur EcoSpace',
          landmark: 'Central Service Road Bus Bay',
          estimatedPickupTime: '08:35 AM',
          estimatedDropTime: '06:40 PM',
          lat: 12.926,
          lng: 77.6762,
        },
        {
          stopName: 'Marathahalli Bridge',
          landmark: 'Kalamandir Footbridge',
          estimatedPickupTime: '08:45 AM',
          estimatedDropTime: '06:25 PM',
          lat: 12.9569,
          lng: 77.7011,
        },
        {
          stopName: 'ITPB Whitefield Hub',
          landmark: 'Gate 2 Main Concourse',
          estimatedPickupTime: '08:55 AM',
          estimatedDropTime: '06:15 PM',
          lat: 12.9863,
          lng: 77.7314,
        },
      ]),
    },
  });

  const route2 = await prisma.route.create({
    data: {
      name: 'CyberCity & Manyata Tech Shuttle',
      code: 'SR-102',
      origin: 'Banashankari Metro Hub',
      destination: 'Embassy Manyata Tech Park Gate 1',
      distanceKm: 24.2,
      estimatedMinutes: 48,
      morningStartTime: '08:15 AM',
      eveningStartTime: '06:30 PM',
      status: 'ACTIVE',
      assignedDriverId: driverProfile2.id,
      assignedVehicleId: vehicle2.id,
      waypoints: JSON.stringify([
        {
          stopName: 'Banashankari Metro Hub',
          landmark: 'Metro Station Gate 3',
          estimatedPickupTime: '08:15 AM',
          estimatedDropTime: '07:20 PM',
          lat: 12.9255,
          lng: 77.5468,
        },
        {
          stopName: 'South End Circle Jayanagar',
          landmark: 'Nanda Talkies Junction',
          estimatedPickupTime: '08:30 AM',
          estimatedDropTime: '07:05 PM',
          lat: 12.9385,
          lng: 77.58,
        },
        {
          stopName: 'MG Road Trinity Circle',
          landmark: 'Taj MG Road Concourse',
          estimatedPickupTime: '08:45 AM',
          estimatedDropTime: '06:50 PM',
          lat: 12.9738,
          lng: 77.6205,
        },
        {
          stopName: 'Hebbal Flyover Entry',
          landmark: 'Esteem Mall Bus Bay',
          estimatedPickupTime: '08:55 AM',
          estimatedDropTime: '06:40 PM',
          lat: 13.0358,
          lng: 77.597,
        },
        {
          stopName: 'Manyata Tech Park Gate 1',
          landmark: 'Main Entrance Terminal',
          estimatedPickupTime: '09:05 AM',
          estimatedDropTime: '06:30 PM',
          lat: 13.0458,
          lng: 77.6208,
        },
      ]),
    },
  });

  const route3 = await prisma.route.create({
    data: {
      name: 'Outer Ring Road tech Express',
      code: 'SR-103',
      origin: 'Sarjapur Decathlon',
      destination: 'Bagmane World Technology Center',
      distanceKm: 17.8,
      estimatedMinutes: 40,
      morningStartTime: '08:30 AM',
      eveningStartTime: '06:00 PM',
      status: 'ACTIVE',
      assignedDriverId: driverProfile3.id,
      assignedVehicleId: vehicle3.id,
      waypoints: JSON.stringify([
        {
          stopName: 'Sarjapur Decathlon',
          landmark: 'Main Parking Bay',
          estimatedPickupTime: '08:30 AM',
          estimatedDropTime: '06:45 PM',
          lat: 12.9082,
          lng: 77.6835,
        },
        {
          stopName: 'Kaikondrahalli Junction',
          landmark: 'Total Mall Junction',
          estimatedPickupTime: '08:42 AM',
          estimatedDropTime: '06:30 PM',
          lat: 12.915,
          lng: 77.674,
        },
        {
          stopName: 'Kadubeesanahalli Underpass',
          landmark: 'Cisco Systems Entry Bay',
          estimatedPickupTime: '08:55 AM',
          estimatedDropTime: '06:15 PM',
          lat: 12.936,
          lng: 77.692,
        },
        {
          stopName: 'Bagmane Tech Park',
          landmark: 'Lakeview Tower Concourse',
          estimatedPickupTime: '09:10 AM',
          estimatedDropTime: '06:00 PM',
          lat: 12.981,
          lng: 77.663,
        },
      ]),
    },
  });

  // 6. Create Commuters & Profiles & Subscriptions
  const commuterData = [
    {
      name: 'Rahul Verma',
      email: 'commuter.rahul@smartride.com',
      phone: '+1 (555) 678-1001',
      pickup: 'HSR Layout 27th Main (Near BDA Complex)',
      drop: 'ITPB Whitefield Hub (Gate 2)',
      morningTime: '08:20 AM',
      eveningTime: '06:15 PM',
      routeId: route1.id,
      planId: monthlyPlan.id,
      planPrice: 129,
      seatNumber: 1,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Priya Sharma',
      email: 'commuter.priya@smartride.com',
      phone: '+1 (555) 678-1002',
      pickup: 'Bellandur EcoSpace (Central Service Road)',
      drop: 'ITPB Whitefield Hub (Gate 2)',
      morningTime: '08:35 AM',
      eveningTime: '06:15 PM',
      routeId: route1.id,
      planId: quarterlyPlan.id,
      planPrice: 349,
      seatNumber: 2,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Amit Patel',
      email: 'commuter.amit@smartride.com',
      phone: '+1 (555) 678-1003',
      pickup: 'South End Circle Jayanagar',
      drop: 'Manyata Tech Park Gate 1',
      morningTime: '08:30 AM',
      eveningTime: '06:30 PM',
      routeId: route2.id,
      planId: monthlyPlan.id,
      planPrice: 129,
      seatNumber: 1,
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Sneha Reddy',
      email: 'commuter.sneha@smartride.com',
      phone: '+1 (555) 678-1004',
      pickup: 'MG Road Trinity Circle',
      drop: 'Manyata Tech Park Gate 1',
      morningTime: '08:45 AM',
      eveningTime: '06:30 PM',
      routeId: route2.id,
      planId: yearlyPlan.id,
      planPrice: 1299,
      seatNumber: 2,
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Karthik Nair',
      email: 'commuter.karthik@smartride.com',
      phone: '+1 (555) 678-1005',
      pickup: 'Kaikondrahalli Junction',
      drop: 'Bagmane Tech Park Lakeview',
      morningTime: '08:42 AM',
      eveningTime: '06:00 PM',
      routeId: route3.id,
      planId: monthlyPlan.id,
      planPrice: 129,
      seatNumber: 1,
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    },
  ];

  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setDate(now.getDate() + 30);
  const todayStr = now.toISOString().split('T')[0];

  for (let i = 0; i < commuterData.length; i++) {
    const c = commuterData[i];
    const user = await prisma.user.create({
      data: {
        email: c.email,
        passwordHash: userPasswordHash,
        name: c.name,
        phone: c.phone,
        role: 'COMMUTER',
        avatar: c.avatar,
      },
    });

    await prisma.commuterProfile.create({
      data: {
        userId: user.id,
        defaultPickupAddress: c.pickup,
        defaultDropAddress: c.drop,
        morningPickupTime: c.morningTime,
        eveningDropTime: c.eveningTime,
        emergencyContact: '+1 (555) 999-0011',
      },
    });

    const subscription = await prisma.subscription.create({
      data: {
        commuterId: user.id,
        planId: c.planId,
        routeId: c.routeId,
        status: 'ACTIVE',
        startDate: now,
        endDate: nextMonth,
        morningPickupTime: c.morningTime,
        eveningPickupTime: c.eveningTime,
        pickupAddress: c.pickup,
        dropAddress: c.drop,
        seatNumber: c.seatNumber,
        autoRenew: true,
      },
    });

    // Create payment
    const invNum = `INV-2026-00${i + 101}`;
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        commuterId: user.id,
        amount: c.planPrice,
        currency: 'USD',
        status: 'SUCCEEDED',
        paymentMethod: i % 2 === 0 ? 'CARD' : 'UPI',
        transactionId: `txn_stripe_demo_${100000 + i}`,
        invoiceNumber: invNum,
        receiptUrl: `/commuter/invoices?invoice=${invNum}`,
        createdAt: new Date(Date.now() - (i + 1) * 86400000 * 2),
      },
    });

    // Attendance records for today
    let driverId = driverProfile1.id;
    if (c.routeId === route2.id) driverId = driverProfile2.id;
    if (c.routeId === route3.id) driverId = driverProfile3.id;

    await prisma.attendance.create({
      data: {
        commuterId: user.id,
        driverId: driverId,
        routeId: c.routeId,
        date: todayStr,
        tripType: 'MORNING_PICKUP',
        status: i === 0 ? 'BOARDED' : i === 4 ? 'ABSENT' : 'SCHEDULED',
        notes: i === 4 ? 'Commuter notified working from home' : null,
      },
    });

    await prisma.attendance.create({
      data: {
        commuterId: user.id,
        driverId: driverId,
        routeId: c.routeId,
        date: todayStr,
        tripType: 'EVENING_DROP',
        status: 'SCHEDULED',
      },
    });
  }

  // 7. Create Driver Trips for today
  await prisma.trip.create({
    data: {
      routeId: route1.id,
      driverId: driverProfile1.id,
      date: todayStr,
      tripType: 'MORNING_PICKUP',
      status: 'IN_PROGRESS',
      startedAt: new Date(Date.now() - 35 * 60000),
    },
  });

  await prisma.trip.create({
    data: {
      routeId: route1.id,
      driverId: driverProfile1.id,
      date: todayStr,
      tripType: 'EVENING_DROP',
      status: 'PLANNED',
    },
  });

  // 8. Create Driver Payouts
  await prisma.payout.create({
    data: {
      driverId: driverProfile1.id,
      amount: 1450.0,
      periodStart: new Date(Date.now() - 15 * 86400000),
      periodEnd: new Date(Date.now() - 1 * 86400000),
      status: 'PROCESSED',
      reference: 'PAY-STRIPE-BLR-0982',
    },
  });

  await prisma.payout.create({
    data: {
      driverId: driverProfile2.id,
      amount: 1980.0,
      periodStart: new Date(Date.now() - 15 * 86400000),
      periodEnd: new Date(Date.now() - 1 * 86400000),
      status: 'PROCESSED',
      reference: 'PAY-STRIPE-BLR-0983',
    },
  });

  console.log('✅ Smart Ride database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
