import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getBookingsByCommuterId,
  getAllBookings,
  getRouteById,
  getPlanById,
} from '@/lib/firestore-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized role' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    // Identity boundary: Commuters ALWAYS query their own verified session.id
    // Query parameter commuterId is ONLY honored for ADMINs
    const targetCommuterId = session.role === 'ADMIN' ? searchParams.get('commuterId') : session.id;

    const rawBookings =
      session.role === 'ADMIN' && !searchParams.get('commuterId')
        ? await getAllBookings()
        : await getBookingsByCommuterId(targetCommuterId || session.id);

    const bookings = await Promise.all(
      rawBookings.map(async (b) => {
        const route = b.routeId ? await getRouteById(b.routeId) : null;
        const plan = b.planId ? await getPlanById(b.planId) : null;
        return {
          ...b,
          route,
          plan,
        };
      })
    );

    return NextResponse.json({ success: true, bookings });
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
