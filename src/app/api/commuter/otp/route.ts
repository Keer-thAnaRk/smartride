import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getSubscriptionsByCommuterId, getRouteById } from '@/lib/firestore-db';
import { getOrCreateCommuterRideOtp } from '@/lib/security/ride-otp';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Commuter access required' }, { status: 403 });
    }

    const rateLimitError = enforceRateLimit(req, RATE_LIMIT_CONFIG.OTP_ACTIONS, undefined, session);
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(req.url);
    // Identity boundary: Commuters ALWAYS request their own session ID; query param only for ADMIN
    const commuterId = session.role === 'ADMIN' ? searchParams.get('commuterId') || session.id : session.id;
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const tripType = (searchParams.get('tripType') || 'MORNING_PICKUP') as 'MORNING_PICKUP' | 'EVENING_DROP';

    const subscriptions = await getSubscriptionsByCommuterId(commuterId);
    const activeSub = subscriptions.find((s) => s.status === 'ACTIVE') || subscriptions[0];

    if (!activeSub) {
      return NextResponse.json(
        { error: 'No active commute subscription found for commuter' },
        { status: 404 }
      );
    }

    const route = await getRouteById(activeSub.routeId);

    const otpData = getOrCreateCommuterRideOtp(
      commuterId,
      activeSub.routeId,
      dateStr,
      tripType
    );

    return NextResponse.json({
      success: true,
      otp: otpData.otp,
      expiresAt: otpData.expiresAt,
      isConsumed: otpData.isConsumed,
      isLocked: otpData.isLocked,
      tripType,
      date: dateStr,
      route: route
        ? {
            id: route.id,
            name: route.name,
            code: route.code,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Error retrieving commuter OTP:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve ride OTP' },
      { status: 500 }
    );
  }
}
