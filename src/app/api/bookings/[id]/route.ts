import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getBookingById,
  updateBooking,
  getRouteById,
  getPlanById,
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
    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Strict ownership verification:
    // Only the booking owner or an authenticated ADMIN may view the record
    if (session.role === 'COMMUTER' && booking.commuterId !== session.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this booking' },
        { status: 403 }
      );
    }

    const route = booking.routeId ? await getRouteById(booking.routeId) : null;
    const plan = booking.planId ? await getPlanById(booking.planId) : null;

    return NextResponse.json({
      success: true,
      booking: {
        ...booking,
        route,
        plan,
      },
    });
  } catch (error: any) {
    console.error('Error fetching booking by ID:', error);
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 });
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
    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Strict ownership verification
    if (session.role === 'COMMUTER' && booking.commuterId !== session.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this booking' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Prevent ID tampering: commuterId, routeId, planId, seatNumber cannot be manipulated across users
    const allowedUpdates: any = {};
    if (body.pickupAddress !== undefined) allowedUpdates.pickupAddress = body.pickupAddress;
    if (body.dropAddress !== undefined) allowedUpdates.dropAddress = body.dropAddress;
    if (body.status !== undefined && ['CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(body.status)) {
      allowedUpdates.status = body.status;
    }

    await updateBooking(booking.id, allowedUpdates);
    const updated = await getBookingById(booking.id);

    return NextResponse.json({
      success: true,
      message: 'Booking updated successfully',
      booking: updated,
    });
  } catch (error: any) {
    console.error('Error updating booking:', error);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
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
    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Strict ownership verification
    if (session.role === 'COMMUTER' && booking.commuterId !== session.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this booking' },
        { status: 403 }
      );
    }

    await updateBooking(booking.id, { status: 'CANCELLED' });

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully',
    });
  } catch (error: any) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
}
