import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getAttendancesForCommuter,
  upsertAttendance,
  getSubscriptionsByCommuterId,
  getRouteById,
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
      return NextResponse.json({ error: 'Forbidden: Unauthorized role' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const rawAttendances = await getAttendancesForCommuter(session.id, dateStr);

    const attendances = await Promise.all(
      rawAttendances.map(async (a) => {
        const route = await getRouteById(a.routeId);
        return {
          ...a,
          route,
        };
      })
    );

    return NextResponse.json({ success: true, attendances });
  } catch (error: any) {
    console.error('Attendance fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized role' }, { status: 403 });
    }

    const rateLimitResponse = enforceRateLimit(req, RATE_LIMIT_CONFIG.MUTATIONS, undefined, session);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { tripType = 'MORNING_PICKUP', date, status = 'SKIPPED', notes } = body;

    // Commuters cannot self-mark as BOARDED or COMPLETED; only SKIPPED or ABSENT are allowed
    if (session.role === 'COMMUTER' && status !== 'SKIPPED' && status !== 'ABSENT') {
      return NextResponse.json(
        { error: 'Forbidden: Commuters may only mark their attendance as SKIPPED or ABSENT' },
        { status: 403 }
      );
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Find active subscription for user in Firestore
    const subscriptions = await getSubscriptionsByCommuterId(session.id);
    const subscription = subscriptions.find((s) => s.status === 'ACTIVE') || subscriptions[0];

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    const route = await getRouteById(subscription.routeId);

    const attendance = await upsertAttendance({
      id: `${session.id}_${targetDate}_${tripType}`,
      commuterId: session.id,
      routeId: subscription.routeId,
      driverId: route?.assignedDriverId || null,
      date: targetDate,
      tripType,
      status,
      notes: notes || 'Commuter skipped ride via app',
      markedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      attendance,
      message: status === 'SKIPPED' ? 'Ride skipped for today. Driver has been notified.' : 'Attendance updated',
    });
  } catch (error: any) {
    console.error('Attendance skip error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update attendance' }, { status: 500 });
  }
}
