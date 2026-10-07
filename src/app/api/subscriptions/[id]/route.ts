import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getSubscriptionById,
  updateSubscription,
  getPlanById,
  getRouteById,
  getDriverProfileById,
  getUserById,
  getVehicleById,
  getPaymentsByCommuterId,
} from '@/lib/firestore-db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized role' }, { status: 403 });
    }

    const { id } = params;
    const subscription = await getSubscriptionById(id);

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Strict ownership verification:
    // Only the subscription owner or an authenticated ADMIN may view the record
    if (session.role === 'COMMUTER' && subscription.commuterId !== session.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this subscription' },
        { status: 403 }
      );
    }

    const plan = await getPlanById(subscription.planId);
    const route = await getRouteById(subscription.routeId);
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

    const allPayments = await getPaymentsByCommuterId(subscription.commuterId);
    const subPayments = allPayments.filter((p) => p.subscriptionId === subscription.id);

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
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
  } catch (error: any) {
    console.error('Error fetching subscription by ID:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized role' }, { status: 403 });
    }

    const { id } = params;
    const subscription = await getSubscriptionById(id);

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Strict ownership verification
    if (session.role === 'COMMUTER' && subscription.commuterId !== session.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this subscription' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Prevent ID tampering: commuterId, routeId, planId, seatNumber cannot be manipulated across users
    const allowedUpdates: any = {};
    if (body.pickupAddress !== undefined) allowedUpdates.pickupAddress = body.pickupAddress;
    if (body.dropAddress !== undefined) allowedUpdates.dropAddress = body.dropAddress;
    if (body.morningPickupTime !== undefined) allowedUpdates.morningPickupTime = body.morningPickupTime;
    if (body.eveningPickupTime !== undefined) allowedUpdates.eveningPickupTime = body.eveningPickupTime;
    if (body.autoRenew !== undefined) allowedUpdates.autoRenew = Boolean(body.autoRenew);
    if (body.status !== undefined && ['ACTIVE', 'PAUSED'].includes(body.status)) {
      allowedUpdates.status = body.status;
    }

    await updateSubscription(subscription.id, allowedUpdates);
    const updated = await getSubscriptionById(subscription.id);

    return NextResponse.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: updated,
    });
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized role' }, { status: 403 });
    }

    const { id } = params;
    const subscription = await getSubscriptionById(id);

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Strict ownership verification
    if (session.role === 'COMMUTER' && subscription.commuterId !== session.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this subscription' },
        { status: 403 }
      );
    }

    await updateSubscription(subscription.id, { status: 'CANCELLED' });

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully',
    });
  } catch (error: any) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
