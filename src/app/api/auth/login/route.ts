import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
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
import { signJwtToken, comparePassword } from '@/lib/auth';
import { recordSecurityEvent } from '@/lib/security/security-events';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

// Configurable demo credentials for development/testing environments
const DEMO_ADMIN_PASS = process.env.DEMO_ADMIN_PASSWORD || 'admin123';
const DEMO_DRIVER_PASS = process.env.DEMO_DRIVER_PASSWORD || 'driver123';
const DEMO_COMMUTER_PASS = process.env.DEMO_COMMUTER_PASSWORD || 'user123';

const DEMO_ACCOUNTS: Record<string, { pass: string; name: string; role: 'ADMIN' | 'DRIVER' | 'COMMUTER' }> = {
  'admin@smartride.com': { pass: DEMO_ADMIN_PASS, name: 'Elena Rostova', role: 'ADMIN' },
  'driver.rajesh@smartride.com': { pass: DEMO_DRIVER_PASS, name: 'Rajesh Sharma', role: 'DRIVER' },
  'driver.vikram@smartride.com': { pass: DEMO_DRIVER_PASS, name: 'Vikram Singh', role: 'DRIVER' },
  'driver.anita@smartride.com': { pass: DEMO_DRIVER_PASS, name: 'Anita Deshmukh', role: 'DRIVER' },
  'driver.suresh@smartride.com': { pass: DEMO_DRIVER_PASS, name: 'Suresh Kumar', role: 'DRIVER' },
  'driver.standby@smartride.com': { pass: DEMO_DRIVER_PASS, name: 'Amit Verma', role: 'DRIVER' },
  'commuter.rahul@smartride.com': { pass: DEMO_COMMUTER_PASS, name: 'Rahul Verma', role: 'COMMUTER' },
  'commuter.priya@smartride.com': { pass: DEMO_COMMUTER_PASS, name: 'Priya Sharma', role: 'COMMUTER' },
  'commuter.amit@smartride.com': { pass: DEMO_COMMUTER_PASS, name: 'Amit Patel', role: 'COMMUTER' },
  'commuter.sneha@smartride.com': { pass: DEMO_COMMUTER_PASS, name: 'Sneha Reddy', role: 'COMMUTER' },
  'commuter.karthik@smartride.com': { pass: DEMO_COMMUTER_PASS, name: 'Karthik Nair', role: 'COMMUTER' },
};

export async function POST(req: NextRequest) {
  const rateLimitError = enforceRateLimit(req, RATE_LIMIT_CONFIG.AUTH_LOGIN);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    let authUid: string | null = null;
    let authSuccess = false;

    const recordFailedLogin = async (reason: string = 'Invalid credentials') => {
      try {
        await recordSecurityEvent({
          eventType: 'AUTH_LOGIN_FAILURE',
          severity: 'MEDIUM',
          actorUserId: cleanEmail,
          actorRole: 'GUEST',
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Next.js Client',
          resourceType: 'AUTH',
          resourceId: 'LOGIN_ENDPOINT',
          action: 'LOGIN_ATTEMPT',
          result: 'FAILED',
          metadata: { attemptedAccount: cleanEmail, reason },
        });
      } catch (e) {
        console.warn('Failed to record security event:', e);
      }
    };

    // 1. Authenticate Request
    const allowDemo = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_ACCOUNTS === 'true';
    const demo = allowDemo ? DEMO_ACCOUNTS[cleanEmail] : undefined;
    if (demo) {
      // Documented demo accounts: verify demo credentials
      if (demo.pass === password) {
        authSuccess = true;
        authUid = `uid_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      } else {
        await recordFailedLogin('Invalid demo credentials');
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }
    } else {
      // Normal registered accounts: try Firebase Auth first if available
      if (auth) {
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
          authUid = cred.user.uid;
          authSuccess = true;
        } catch (authErr: any) {
          console.warn('Firebase Auth sign in notice:', authErr.code);
        }
      }

      // If Firebase Auth is unavailable or did not succeed, verify local password hash with bcrypt
      if (!authSuccess) {
        const existing = await getUserByEmail(cleanEmail);
        if (!existing || !existing.passwordHash) {
          await recordFailedLogin('Invalid credentials');
          return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const isPasswordValid = await comparePassword(password, existing.passwordHash);
        if (!isPasswordValid) {
          await recordFailedLogin('Invalid credentials');
          return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        authSuccess = true;
        authUid = existing.id;
      }
    }

    if (!authSuccess || !authUid) {
      await recordFailedLogin('Authentication unsuccessful');
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 2. Fetch or initialize profile from Cloud Firestore
    let user = await getUserByEmail(cleanEmail);

    if (!user) {
      // Auto-provision demo account if not yet seeded
      const demo = DEMO_ACCOUNTS[cleanEmail];
      const effectiveUid = authUid || `uid_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      user = {
        id: effectiveUid,
        email: cleanEmail,
        name: demo ? demo.name : cleanEmail.split('@')[0],
        role: demo ? demo.role : 'COMMUTER',
        phone: '+91 98450 00000',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(demo ? demo.name : cleanEmail)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await setUser(user);

      if (user.role === 'COMMUTER') {
        await upsertCommuterProfile(effectiveUid, {
          morningPickupTime: '08:30 AM',
          eveningDropTime: '06:00 PM',
        });
      } else if (user.role === 'DRIVER') {
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

    // 3. Load role-specific profile details
    let driverProfile: any = null;
    let commuterProfile: any = null;

    if (user.role === 'DRIVER') {
      let dp = await getDriverProfileByUserId(user.id);
      if (!dp && DEMO_ACCOUNTS[cleanEmail]) {
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
    } else if (user.role === 'COMMUTER') {
      commuterProfile = await getCommuterProfile(user.id);
      if (!commuterProfile && DEMO_ACCOUNTS[cleanEmail]) {
        commuterProfile = await upsertCommuterProfile(user.id, {
          morningPickupTime: '08:30 AM',
          eveningDropTime: '06:00 PM',
        });
      }
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      phone: user.phone,
      avatar: user.avatar,
    };

    // Keep JWT session cookie for backward compatibility with existing UI
    const token = signJwtToken(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      token,
      driverProfile,
      commuterProfile,
      message: 'Logged in successfully via Firebase Authentication',
    });

    response.cookies.set('smartride_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    // Record successful authentication event in security audit trail
    try {
      await recordSecurityEvent({
        eventType: 'AUTH_LOGIN_SUCCESS',
        severity: 'LOW',
        actorUserId: sessionUser.id,
        actorRole: sessionUser.role,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Next.js Client',
        resourceType: 'AUTH',
        resourceId: 'LOGIN_ENDPOINT',
        action: 'LOGIN_ATTEMPT',
        result: 'SUCCESS',
        metadata: { email: sessionUser.email, role: sessionUser.role },
      });
    } catch (e) {
      console.warn('Failed to record login success event:', e);
    }

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
  }
}
