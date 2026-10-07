import {
  createPayment,
  getSubscriptionById,
  updateSubscription,
  getRouteById,
  getPlanById,
  getUserById,
  upsertAttendance,
  createBooking,
  getBookingsBySubscriptionId,
  updateBooking,
  FirestorePayment,
} from './firestore-db';

export interface MockPaymentPayload {
  subscriptionId: string;
  commuterId: string;
  amount: number;
  currency?: string;
  paymentMethod: 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET';
  gateway: 'STRIPE' | 'RAZORPAY';
  transactionId?: string;
}

export async function processMockPayment(payload: MockPaymentPayload) {
  const transactionId = payload.transactionId || `txn_${payload.gateway.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const payId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Create payment record in Firestore in INR ₹
  const payment: FirestorePayment = {
    id: payId,
    subscriptionId: payload.subscriptionId,
    commuterId: payload.commuterId,
    amount: payload.amount,
    currency: 'INR',
    status: 'SUCCEEDED',
    paymentMethod: payload.paymentMethod,
    transactionId,
    invoiceNumber,
    receiptUrl: `/commuter/invoices?invoice=${invoiceNumber}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await createPayment(payment);

  // 2. Activate the subscription in Firestore
  await updateSubscription(payload.subscriptionId, {
    status: 'ACTIVE',
  });

  const subscription = await getSubscriptionById(payload.subscriptionId);
  const route = subscription ? await getRouteById(subscription.routeId) : null;
  const plan = subscription ? await getPlanById(subscription.planId) : null;
  const commuter = await getUserById(payload.commuterId);

  // 3. Update or create dedicated Booking document in Firestore
  const existingBookings = await getBookingsBySubscriptionId(payload.subscriptionId);
  if (existingBookings.length > 0) {
    await updateBooking(existingBookings[0].id, {
      status: 'CONFIRMED',
    });
  } else if (subscription && route && plan) {
    const bookingId = `book_sr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await createBooking({
      id: bookingId,
      bookingNumber: `SR-BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      commuterId: payload.commuterId,
      subscriptionId: subscription.id,
      routeId: route.id,
      planId: plan.id,
      seatNumber: subscription.seatNumber || 1,
      pickupAddress: subscription.pickupAddress,
      dropAddress: subscription.dropAddress,
      pickupTime: subscription.morningPickupTime,
      dropTime: subscription.eveningPickupTime,
      fare: payload.amount,
      currency: 'INR',
      status: 'CONFIRMED',
      bookingDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 4. Automatically create today's scheduled attendance records if not existing
  const todayStr = new Date().toISOString().split('T')[0];
  if (route && route.assignedDriverId) {
    await upsertAttendance({
      id: `${payload.commuterId}_${todayStr}_MORNING_PICKUP`,
      commuterId: payload.commuterId,
      driverId: route.assignedDriverId,
      routeId: route.id,
      date: todayStr,
      tripType: 'MORNING_PICKUP',
      status: 'SCHEDULED',
      notes: null,
      markedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).catch(() => {});

    await upsertAttendance({
      id: `${payload.commuterId}_${todayStr}_EVENING_DROP`,
      commuterId: payload.commuterId,
      driverId: route.assignedDriverId,
      routeId: route.id,
      date: todayStr,
      tripType: 'EVENING_DROP',
      status: 'SCHEDULED',
      notes: null,
      markedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).catch(() => {});
  }

  return {
    success: true,
    payment,
    subscription: {
      ...subscription,
      plan,
      route,
      commuter,
    },
  };
}
