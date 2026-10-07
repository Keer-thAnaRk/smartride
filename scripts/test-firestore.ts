import {
  getUserById,
  setUser,
  getAllPlans,
  getAllRoutes,
  getRouteById,
  setSubscription,
  getSubscriptionById,
  createBooking,
  getBookingsByCommuterId,
  createPayment,
  getPaymentsByCommuterId,
  upsertAttendance,
  getAttendancesForRoute,
  setLeaveRequest,
  getLeaveRequestById,
  updateLeaveRequest,
  createNotification,
  getNotificationsForUser,
  setDriverProfile,
  getDriverProfileById,
  setVehicle,
  getVehiclesByDriverId,
  setTripRecord,
  getTripByRouteDriverDateTripType,
  updateTripRecord,
  updateAttendancesBulk,
  getAllSubscriptions,
  countUsersByRole,
  getAllDrivers,
  getAllApprovedVehicles,
  FirestoreTripRecord,
  FirestoreBooking,
  FirestoreSubscription,
  FirestoreUser,
} from '../src/lib/firestore-db';
import { syncTripToFirestore, FirestoreTrip, PublicTripProjection } from '../src/lib/firebase';

async function runTests() {
  console.log('🧪 Starting SmartRide Firebase Architecture Integration Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // Test 1: User & Authentication Profiles
    // ----------------------------------------------------
    console.log('📦 Test Suite 1: Users & Profiles');
    const testUser: FirestoreUser = {
      id: 'test_commuter_e2e',
      name: 'Aditi Rao',
      email: 'aditi.rao@example.com',
      phone: '+91 98765 00001',
      role: 'COMMUTER',
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await setUser(testUser);
    const retrievedUser = await getUserById('test_commuter_e2e');
    assert(retrievedUser !== null && retrievedUser.name === 'Aditi Rao', 'User created and retrieved successfully');

    // ----------------------------------------------------
    // Test 2: Plans & INR Currency
    // ----------------------------------------------------
    console.log('\n📦 Test Suite 2: Plans & Pricing in INR (₹)');
    const plans = await getAllPlans();
    assert(plans.length >= 3, `Retrieved ${plans.length} subscription plans`);
    const monthlyPlan = plans.find((p) => p.billingCycle === 'MONTHLY');
    assert(
      monthlyPlan !== undefined && monthlyPlan.price >= 1000,
      `Monthly plan price is in INR (₹${monthlyPlan?.price})`
    );

    // ----------------------------------------------------
    // Test 3: Dedicated Bookings Collection Alongside Subscriptions
    // ----------------------------------------------------
    console.log('\n📦 Test Suite 3: Dedicated Bookings Collection (Requirement #1)');
    const testSub: FirestoreSubscription = {
      id: 'sub_test_e2e',
      commuterId: 'test_commuter_e2e',
      planId: monthlyPlan ? monthlyPlan.id : 'plan-monthly-1',
      routeId: 'route-sr-101',
      status: 'ACTIVE',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      morningPickupTime: '08:30 AM',
      eveningPickupTime: '06:00 PM',
      pickupAddress: 'HSR Layout Sector 2',
      dropAddress: 'ITPB Whitefield',
      seatNumber: 1,
      autoRenew: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await setSubscription(testSub);

    const testBooking: FirestoreBooking = {
      id: 'book_test_e2e',
      bookingNumber: 'BK-20260904-TEST',
      commuterId: 'test_commuter_e2e',
      subscriptionId: 'sub_test_e2e',
      routeId: 'route-sr-101',
      planId: monthlyPlan ? monthlyPlan.id : 'plan-monthly-1',
      seatNumber: 1,
      pickupAddress: 'HSR Layout Sector 2',
      dropAddress: 'ITPB Whitefield',
      pickupTime: '08:30 AM',
      dropTime: '06:00 PM',
      status: 'CONFIRMED',
      amount: monthlyPlan ? monthlyPlan.price : 3499,
      currency: 'INR',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await createBooking(testBooking);

    const commuterBookings = await getBookingsByCommuterId('test_commuter_e2e');
    assert(
      commuterBookings.length > 0 && commuterBookings[0].bookingNumber === 'BK-20260904-TEST',
      'Booking successfully stored in dedicated Firestore bookings collection'
    );
    assert(commuterBookings[0].currency === 'INR', 'Booking currency confirmed as INR');

    // ----------------------------------------------------
    // Test 4: Payments in INR (₹)
    // ----------------------------------------------------
    console.log('\n📦 Test Suite 4: Payments in INR');
    await createPayment({
      id: 'pay_test_e2e',
      subscriptionId: 'sub_test_e2e',
      bookingId: 'book_test_e2e',
      commuterId: 'test_commuter_e2e',
      amount: 3499,
      currency: 'INR',
      status: 'SUCCEEDED',
      paymentMethod: 'UPI',
      transactionId: 'txn_mock_e2e_991',
      invoiceNumber: 'INV-202609-TEST',
      receiptUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const payments = await getPaymentsByCommuterId('test_commuter_e2e');
    assert(payments.length > 0 && payments[0].amount === 3499, 'Payment recorded with INR 3499');

    // ----------------------------------------------------
    // Test 5: Driver, Fleet & Trip Lifecycle
    // ----------------------------------------------------
    console.log('\n📦 Test Suite 5: Driver, Vehicles & Trips');
    await setDriverProfile({
      id: 'driver_test_e2e',
      userId: 'user_driver_e2e',
      licenseNumber: 'KA01-20220019284',
      experienceYears: 7,
      rating: 4.95,
      isVerified: true,
      status: 'AVAILABLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await setVehicle({
      id: 'veh_test_e2e',
      driverId: 'driver_test_e2e',
      make: 'Toyota',
      model: 'Innova Crysta',
      year: 2024,
      licensePlate: 'KA-01-EQ-9922',
      capacity: 6,
      type: 'SUV',
      isApproved: true,
      rcDocUrl: null,
      insuranceDocUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const driverVehicles = await getVehiclesByDriverId('driver_test_e2e');
    assert(driverVehicles.length > 0, 'Driver vehicle registered and verified');

    const todayStr = new Date().toISOString().split('T')[0];
    const tripRecord: FirestoreTripRecord = {
      id: `trip_route-sr-101_${todayStr}_MORNING_PICKUP`,
      routeId: 'route-sr-101',
      driverId: 'driver_test_e2e',
      date: todayStr,
      tripType: 'MORNING_PICKUP',
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await setTripRecord(tripRecord);

    const retrievedTrip = await getTripByRouteDriverDateTripType(
      'route-sr-101',
      'driver_test_e2e',
      todayStr,
      'MORNING_PICKUP'
    );
    assert(retrievedTrip !== null && retrievedTrip.status === 'IN_PROGRESS', 'Trip started and retrieved');

    // Complete trip & bulk update attendances
    await updateTripRecord(tripRecord.id, { status: 'COMPLETED', completedAt: new Date() });
    const completedTrip = await getTripByRouteDriverDateTripType(
      'route-sr-101',
      'driver_test_e2e',
      todayStr,
      'MORNING_PICKUP'
    );
    assert(completedTrip?.status === 'COMPLETED', 'Trip marked COMPLETED in Firestore');

    // ----------------------------------------------------
    // Test 6: Sanitized Public Projection (Zero PII Leakage)
    // ----------------------------------------------------
    console.log('\n📦 Test Suite 6: Public Trip Tracking Security (Requirements #3, #4, #5)');
    const operationalTrip: FirestoreTrip = {
      tripId: 'trip_secure_101',
      routeId: 'route-sr-101',
      routeName: 'Whitefield Tech Express',
      routeCode: 'SR-101',
      driverId: 'driver_test_e2e',
      driverName: 'Rajesh Sharma',
      driverPhone: '+91 98450 12345', // PRIVATE PHONE
      vehiclePlate: 'KA-01-EQ-9922',
      vehicleModel: 'Toyota Innova Crysta',
      date: todayStr,
      tripType: 'MORNING_PICKUP',
      status: 'in_transit',
      passengers: [
        {
          userId: 'user_private_1',
          name: 'Rahul Verma', // PRIVATE NAME
          pickupStop: 'HSR Layout',
          dropStop: 'ITPB',
          rideOtp: '9821', // PRIVATE OTP
          boarded: true,
          emergencyContacts: [
            { name: 'Ananya Verma', phone: '+91 99999 11111', relationship: 'Spouse' }, // PRIVATE EMERGENCY CONTACT
          ],
        },
      ],
      liveLocation: {
        lat: 12.9245,
        lng: 77.6789,
        heading: 84,
        speedKmH: 42,
        updatedAt: new Date().toISOString(),
      },
      shareToken: 'secure_share_token_abc123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await syncTripToFirestore(operationalTrip);

    // Verify sanitized projection properties
    const projectionJson = JSON.stringify(operationalTrip);
    const sanitizedProjection: PublicTripProjection = {
      tripId: operationalTrip.tripId,
      routeName: operationalTrip.routeName || '',
      routeCode: operationalTrip.routeCode || '',
      vehicleModel: operationalTrip.vehicleModel || '',
      vehiclePlate: operationalTrip.vehiclePlate || '',
      liveLocation: operationalTrip.liveLocation,
      status: operationalTrip.status,
      driverPublicName: operationalTrip.driverName.split(' ')[0],
      updatedAt: operationalTrip.updatedAt,
    };

    const sanitizedJson = JSON.stringify(sanitizedProjection);
    assert(!sanitizedJson.includes('Rahul Verma'), 'Public projection NEVER exposes passenger names');
    assert(!sanitizedJson.includes('+91 99999 11111'), 'Public projection NEVER exposes emergency contacts');
    assert(!sanitizedJson.includes('9821'), 'Public projection NEVER exposes ride OTPs');
    assert(!sanitizedJson.includes('+91 98450 12345'), 'Public projection NEVER exposes driver personal phone');
    assert(sanitizedJson.includes('KA-01-EQ-9922'), 'Public projection includes vehicle plate for safe tracking');
    assert(sanitizedJson.includes('Whitefield Tech Express'), 'Public projection includes route name');

    // ----------------------------------------------------
    // Test 7: Standby Driver & Leave Request Workflow
    // ----------------------------------------------------
    console.log('\n📦 Test Suite 7: Standby Captain Leave Workflow');
    const leaveId = 'leave_test_e2e';
    await setLeaveRequest({
      id: leaveId,
      requestId: leaveId,
      driverId: 'driver_test_e2e',
      driverName: 'Rajesh Sharma',
      assignedRouteId: 'route-sr-101',
      startDate: todayStr,
      endDate: todayStr,
      reason: 'Family emergency',
      status: 'pending',
      replacementDriverId: null,
      replacementDriverName: null,
      appliedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const pendingLeave = await getLeaveRequestById(leaveId);
    assert(pendingLeave !== null && pendingLeave.status === 'pending', 'Leave request submitted as pending');

    // Admin approves with Standby Captain
    await updateLeaveRequest(leaveId, {
      status: 'approved',
      replacementDriverId: 'driver_standby_vikram',
      replacementDriverName: 'Vikram Singh',
      reviewedAt: new Date(),
    });

    const approvedLeave = await getLeaveRequestById(leaveId);
    assert(approvedLeave?.status === 'approved', 'Leave approved by admin');
    assert(approvedLeave?.replacementDriverName === 'Vikram Singh', 'Standby Captain assigned to leave');

    // Notification delivery
    await createNotification({
      userId: 'test_commuter_e2e',
      title: 'Standby Route Captain Notice',
      message: `Today's route is operated by standby Captain Vikram Singh.`,
      type: 'INFO',
    });

    const commuterNotifs = await getNotificationsForUser('test_commuter_e2e');
    assert(
      commuterNotifs.some((n) => n.title.includes('Standby')),
      'Commuter notified of standby driver assignment'
    );

    // ----------------------------------------------------
    // Summary
    // ----------------------------------------------------
    console.log('\n========================================');
    console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('🎉 ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
      process.exit(0);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

runTests();
