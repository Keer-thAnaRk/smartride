import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { processMockPayment } from '@/lib/mock-payment';
import {
  getAllSubscriptions,
  getSubscriptionsByCommuterId,
  getSubscriptionById,
  setSubscription,
  getPlanById,
  getRouteById,
  getDriverProfileById,
  getUserById,
  getVehicleById,
  getPaymentsByCommuterId,
  getSubscriptionsByRouteId,
  createBooking,
  FirestoreSubscription,
} from '@/lib/firestore-db';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized access to subscription records' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const singleSubId = searchParams.get('subscriptionId') || searchParams.get('id');

    if (singleSubId) {
      const sub = await getSubscriptionById(singleSubId);
      if (!sub) {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
      }

      if (session.role === 'COMMUTER' && sub.commuterId !== session.id) {
        return NextResponse.json({ error: 'Forbidden: You do not own this subscription' }, { status: 403 });
      }

      const plan = await getPlanById(sub.planId);
      const route = await getRouteById(sub.routeId);
      let assignedDriver: any = null;
      let assignedVehicle: any = null;

      if (route?.assignedDriverId) {
        const dp = await getDriverProfileById(route.assignedDriverId);
        if (dp) {
          const u = await getUserById(dp.userId);
          assignedDriver = {
            user: {
              name: u?.name || 'Driver',
              phone: u?.phone || null,
              avatar: u?.avatar || null,
            },
          };
        }
      }

      if (route?.assignedVehicleId) {
        assignedVehicle = await getVehicleById(route.assignedVehicleId);
      }

      const allPayments = await getPaymentsByCommuterId(sub.commuterId);
      const subPayments = allPayments.filter((p) => p.subscriptionId === sub.id);

      return NextResponse.json({
        success: true,
        subscription: {
          ...sub,
          plan,
          route: route
            ? {
                ...route,
                assignedDriver,
                assignedVehicle,
              }
            : null,
          payments: subPayments,
        },
      });
    }

    const commuterId = session.role === 'ADMIN' ? searchParams.get('commuterId') || session.id : session.id;

    const rawSubscriptions =
      session.role === 'ADMIN' && !searchParams.get('commuterId')
        ? await getAllSubscriptions()
        : await getSubscriptionsByCommuterId(commuterId);

    const subscriptions = await Promise.all(
      rawSubscriptions.map(async (sub) => {
        const plan = await getPlanById(sub.planId);
        const route = await getRouteById(sub.routeId);
        let assignedDriver: any = null;
        let assignedVehicle: any = null;

        if (route?.assignedDriverId) {
          const dp = await getDriverProfileById(route.assignedDriverId);
          if (dp) {
            const u = await getUserById(dp.userId);
            assignedDriver = {
              user: {
                name: u?.name || 'Driver',
                phone: u?.phone || null,
                avatar: u?.avatar || null,
              },
            };
          }
        }

        if (route?.assignedVehicleId) {
          assignedVehicle = await getVehicleById(route.assignedVehicleId);
        }

        const allPayments = await getPaymentsByCommuterId(sub.commuterId);
        const subPayments = allPayments.filter((p) => p.subscriptionId === sub.id);

        return {
          ...sub,
          plan,
          route: route
            ? {
                ...route,
                assignedDriver,
                assignedVehicle,
              }
            : null,
          payments: subPayments,
        };
      })
    );

    return NextResponse.json({ success: true, subscriptions });
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Please log in' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only commuters can subscribe' }, { status: 403 });
    }

    const rateLimitError = enforceRateLimit(req, RATE_LIMIT_CONFIG.MUTATIONS, undefined, session);
    if (rateLimitError) return rateLimitError;

    const body = await req.json();
    const {
      planId,
      routeId,
      pickupAddress,
      dropAddress,
      morningPickupTime,
      eveningPickupTime,
      paymentMethod = 'UPI',
      gateway = 'RAZORPAY',
    } = body;

    if (!planId || !routeId || !pickupAddress || !dropAddress) {
      return NextResponse.json(
        { error: 'Plan, Route, Pickup Address, and Drop Address are required' },
        { status: 400 }
      );
    }

    const plan = await getPlanById(planId);
    if (!plan) {
      return NextResponse.json({ error: 'Selected subscription plan not found' }, { status: 404 });
    }

    const route = await getRouteById(routeId);
    if (!route) {
      return NextResponse.json({ error: 'Selected route not found' }, { status: 404 });
    }

    // Check capacity
    const assignedVehicle = route.assignedVehicleId ? await getVehicleById(route.assignedVehicleId) : null;
    const capacity = assignedVehicle?.capacity || 4;
    const activeSubs = await getSubscriptionsByRouteId(route.id, true);
    if (activeSubs.length >= capacity) {
      return NextResponse.json(
        { error: `This route shuttle is at full capacity (${activeSubs.length}/${capacity} seats). Please select another route or contact support.` },
        { status: 400 }
      );
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.durationMonths);

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const seatNumber = activeSubs.length + 1;

    // 1. Create Firestore subscription
    const subscription: FirestoreSubscription = {
      id: subscriptionId,
      commuterId: session.id,
      planId: plan.id,
      routeId: route.id,
      status: 'PENDING',
      startDate,
      endDate,
      pickupAddress,
      dropAddress,
      morningPickupTime: morningPickupTime || route.morningStartTime,
      eveningPickupTime: eveningPickupTime || route.eveningStartTime,
      seatNumber,
      autoRenew: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setSubscription(subscription);

    // 2. Create dedicated Firestore Booking record
    const bookingId = `book_sr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await createBooking({
      id: bookingId,
      bookingNumber: `SR-BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      commuterId: session.id,
      subscriptionId,
      routeId: route.id,
      planId: plan.id,
      seatNumber,
      pickupAddress,
      dropAddress,
      pickupTime: subscription.morningPickupTime,
      dropTime: subscription.eveningPickupTime,
      fare: plan.price,
      currency: 'INR',
      status: 'CONFIRMED',
      bookingDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Process Instant Mock Payment in INR ₹
    const paymentResult = await processMockPayment({
      subscriptionId,
      commuterId: session.id,
      amount: plan.price,
      currency: 'INR',
      paymentMethod,
      gateway,
    });

    return NextResponse.json({
      success: true,
      subscriptionId,
      bookingId,
      subscription: paymentResult.subscription,
      payment: paymentResult.payment,
      message: 'Subscription created and payment confirmed in INR (₹) successfully!',
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: error.message || 'Failed to create subscription' }, { status: 500 });
  }
}
