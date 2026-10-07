import { NextRequest, NextResponse } from 'next/server';
import {
  getUserByEmail,
  getDriverProfileByUserId,
  getVehiclesByDriverId,
  getCommuterProfile,
  setUser,
  upsertCommuterProfile,
  setDriverProfile,
  setVehicle,
} from '@/lib/firestore-db';
import { signJwtToken } from '@/lib/auth';
import { recordSecurityEvent } from '@/lib/security/security-events';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

// Safe server-side demo account configurations for non-privileged roles only
const DEMO_COMMUTER_EMAIL = 'commuter.rahul@smartride.com';
const DEMO_DRIVER_EMAIL = 'driver.rajesh@smartride.com';

export async function POST(req: NextRequest) {
  const rateLimitError = enforceRateLimit(req, RATE_LIMIT_CONFIG.AUTH_SENSITIVE);
  if (rateLimitError) return rateLimitError;

  try {
    // 1. Guard against demo login in production environments
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_LOGIN !== 'true') {
      return NextResponse.json(
        { error: 'Demo authentication is disabled in production environments.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { role } = body;

    // 2. STRICT SECURITY GOVERNANCE: Admin accounts cannot be accessed via demo shortcuts
    if (role === 'ADMIN') {
      await recordSecurityEvent({
        eventType: 'AUTH_LOGIN_FAILURE',
        severity: 'HIGH',
        actorUserId: 'ANONYMOUS_DEMO_ATTEMPT',
        actorRole: 'GUEST',
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Next.js Client',
        resourceType: 'AUTH',
        resourceId: 'DEMO_ENDPOINT',
        action: 'ADMIN_DEMO_BYPASS_ATTEMPT',
        result: 'FAILED',
        metadata: { reason: 'Administrative impersonation via demo shortcut prohibited' },
      });

      return NextResponse.json(
        { error: 'Administrative accounts require explicit credential authentication. Demo bypass is prohibited.' },
        { status: 403 }
      );
    }

    // 3. Validate supported non-admin demo roles
    if (role !== 'COMMUTER' && role !== 'DRIVER') {
      return NextResponse.json(
        { error: 'Invalid demo role requested. Only COMMUTER and DRIVER are supported.' },
        { status: 400 }
      );
    }

    const cleanEmail = role === 'DRIVER' ? DEMO_DRIVER_EMAIL : DEMO_COMMUTER_EMAIL;
    const effectiveUid = `uid_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // 4. Load or auto-provision demo user in Firestore
    let user = await getUserByEmail(cleanEmail);
    if (!user) {
      user = {
        id: effectiveUid,
        email: cleanEmail,
        name: role === 'DRIVER' ? 'Rajesh Sharma' : 'Rahul Verma',
        role: role as any,
        phone: '+91 98450 00000',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await setUser(user);

      if (role === 'COMMUTER') {
        await upsertCommuterProfile(effectiveUid, {
          morningPickupTime: '08:30 AM',
          eveningDropTime: '06:00 PM',
        });
      } else if (role === 'DRIVER') {
        await setDriverProfile({
          id: `driver_${effectiveUid}`,
          userId: effectiveUid,
          licenseNumber: 'DL-BLR-2022-99000',
          experienceYears: 5,
          rating: 4.9,
          isVerified: true,
          status: 'AVAILABLE',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await setVehicle({
          id: `veh_${effectiveUid}`,
          driverId: `driver_${effectiveUid}`,
          make: 'Toyota',
          model: 'Innova Crysta AC',
          year: 2023,
          licensePlate: 'KA-01-MJ-8822',
          capacity: 6,
          type: 'SUV',
          isApproved: true,
          rcDocUrl: null,
          insuranceDocUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // 5. Load role profiles
    let driverProfile: any = null;
    let commuterProfile: any = null;

    if (role === 'DRIVER') {
      let dp = await getDriverProfileByUserId(user.id);
      if (!dp) {
        const driverId = `driver_${user.id}`;
        await setDriverProfile({
          id: driverId,
          userId: user.id,
          licenseNumber: 'DL-BLR-2022-99000',
          experienceYears: 5,
          rating: 4.9,
          isVerified: true,
          status: 'AVAILABLE',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await setVehicle({
          id: `veh_${user.id}`,
          driverId,
          make: 'Toyota',
          model: 'Innova Crysta AC',
          year: 2023,
          licensePlate: 'KA-01-MJ-8822',
          capacity: 6,
          type: 'SUV',
          isApproved: true,
          rcDocUrl: null,
          insuranceDocUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        dp = await getDriverProfileByUserId(user.id);
      }
      if (dp) {
        const vehicles = await getVehiclesByDriverId(dp.id);
        driverProfile = {
          ...dp,
          vehicles,
        };
      }
    } else if (role === 'COMMUTER') {
      commuterProfile = await getCommuterProfile(user.id);
      if (!commuterProfile) {
        commuterProfile = await upsertCommuterProfile(user.id, {
          morningPickupTime: '08:30 AM',
          eveningDropTime: '06:00 PM',
        });
      }
    }

    // 6. Safe session user — omitting any password or sensitive hash
    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      phone: user.phone,
      avatar: user.avatar,
    };

    const token = signJwtToken(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      token,
      driverProfile,
      commuterProfile,
      message: 'Demo session initialized securely without client credential exposure.',
    });

    response.cookies.set('smartride_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    // Record demo login event
    try {
      await recordSecurityEvent({
        eventType: 'AUTH_LOGIN_SUCCESS',
        severity: 'LOW',
        actorUserId: sessionUser.id,
        actorRole: sessionUser.role,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Next.js Client',
        resourceType: 'AUTH',
        resourceId: 'DEMO_ENDPOINT',
        action: 'DEMO_LOGIN',
        result: 'SUCCESS',
        metadata: { role: sessionUser.role, isDemo: true },
      });
    } catch (e) {
      console.warn('Failed to record demo login security event:', e);
    }

    return response;
  } catch (error: any) {
    console.error('Demo auth error:', error);
    return NextResponse.json({ error: error.message || 'Demo authentication failed' }, { status: 500 });
  }
}
