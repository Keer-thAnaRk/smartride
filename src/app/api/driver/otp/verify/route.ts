import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getDriverProfileByUserId,
  getAllDriverProfiles,
  getRouteById,
  upsertAttendance,
  getSubscriptionsByRouteId,
  FirestoreDriverProfile,
} from '@/lib/firestore-db';
import { verifyRideOtp } from '@/lib/security/ride-otp';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'DRIVER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Driver access required' }, { status: 403 });
    }

    const rateLimitError = enforceRateLimit(req, RATE_LIMIT_CONFIG.OTP_ACTIONS, undefined, session);
    if (rateLimitError) return rateLimitError;

    const body = await req.json();
    const { commuterId, routeId, tripType = 'MORNING_PICKUP', date, otp } = body;

    if (!commuterId || !routeId || !otp) {
      return NextResponse.json(
        { error: 'Commuter ID, Route ID, and 4-digit OTP are required' },
        { status: 400 }
      );
    }

    // Find driver profile
    let driverProfile: FirestoreDriverProfile | null = null;
    if (session.role === 'DRIVER') {
      driverProfile = await getDriverProfileByUserId(session.id);
      if (!driverProfile) {
        return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 });
      }
      if (driverProfile.isVerified !== true) {
        return NextResponse.json({ error: 'Driver account pending approval' }, { status: 403 });
      }
    } else {
      const allDrivers = await getAllDriverProfiles();
      driverProfile = allDrivers[0] || null;
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const route = await getRouteById(routeId);
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    // Route assignment check: Driver must be assigned to route (unless admin)
    if (session.role === 'DRIVER' && route.assignedDriverId !== driverProfile?.id) {
      return NextResponse.json(
        { error: 'Forbidden: Driver is not assigned to this route corridor' },
        { status: 403 }
      );
    }

    // Verify commuter is registered for this route
    const routeSubs = await getSubscriptionsByRouteId(routeId, true);
    const commuterSub = routeSubs.find((s) => s.commuterId === commuterId);
    if (!commuterSub) {
      return NextResponse.json(
        { error: 'Commuter does not have an active subscription for this route' },
        { status: 400 }
      );
    }

    // Server-authoritative OTP verification
    const verifyResult = await verifyRideOtp({
      commuterId,
      routeId,
      date: targetDate,
      tripType: tripType as 'MORNING_PICKUP' | 'EVENING_DROP',
      driverId: driverProfile?.id || session.id,
      enteredOtp: String(otp).trim(),
    });

    if (!verifyResult.success) {
      return NextResponse.json(
        {
          error: verifyResult.error || 'Invalid OTP',
          remainingAttempts: verifyResult.remainingAttempts,
        },
        { status: verifyResult.statusCode }
      );
    }

    // Transition authoritative attendance record to BOARDED
    const attendance = await upsertAttendance({
      id: `${commuterId}_${targetDate}_${tripType}`,
      commuterId,
      driverId: driverProfile?.id || null,
      routeId,
      date: targetDate,
      tripType,
      status: 'BOARDED',
      notes: 'Verified via secure Ride Start OTP',
      markedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Commuter verified successfully and marked as boarded',
      status: 'BOARDED',
      attendance,
    });
  } catch (error: any) {
    console.error('Error during OTP verification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
