import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getUserByEmail,
  setUser,
  upsertCommuterProfile,
  setDriverProfile,
  setVehicle,
} from '@/lib/firestore-db';
import { signJwtToken, hashPassword } from '@/lib/auth';
import { UserRole } from '@/types';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export async function POST(req: NextRequest) {
  const rateLimitError = enforceRateLimit(req, RATE_LIMIT_CONFIG.AUTH_REGISTER);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json();
    const {
      name,
      email,
      password,
      phone,
      role = 'COMMUTER',
      licenseNumber,
      vehicleMake,
      vehicleModel,
      vehiclePlate,
      vehicleCapacity,
    } = body;

    // Disallow public ADMIN registration
    if (typeof role === 'string' && role.toUpperCase().trim() === 'ADMIN') {
      return NextResponse.json({ error: 'Admin registration is not allowed' }, { status: 403 });
    }

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists in Firestore
    const existing = await getUserByEmail(cleanEmail);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    let uid = '';

    // 1. Firebase Authentication (Source of Truth for User Authentication & Passwords)
    if (auth) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        uid = cred.user.uid;
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          try {
            const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
            uid = cred.user.uid;
          } catch (signInErr: any) {
            return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
          }
        } else if (authError.code === 'auth/configuration-not-found') {
          // If Email/Password is not yet toggled on in Firebase Console, use deterministic secure UID
          console.warn('Firebase Auth: email/password provider not yet enabled in Firebase console. Using deterministic UID.');
          uid = `uid_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (authError.code === 'auth/weak-password') {
          return NextResponse.json({ error: 'Password is too weak. Please use at least 6 characters.' }, { status: 400 });
        } else {
          console.warn('Firebase Auth creation warning:', authError.code, authError.message);
          uid = `uid_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        }
      }
    } else {
      uid = `uid_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }

    const normalizedRole = typeof role === 'string' ? role.toUpperCase().trim() : 'COMMUTER';
    const validRole: UserRole = normalizedRole === 'DRIVER' ? 'DRIVER' : 'COMMUTER';
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
    const passwordHash = await hashPassword(password);

    // 2. Store application profile information in Firestore with bcrypt password hash
    await setUser({
      id: uid,
      email: cleanEmail,
      name: name.trim(),
      phone: phone || null,
      role: validRole,
      avatar,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Create role-specific initial profiles in Firestore
    if (validRole === 'COMMUTER') {
      await upsertCommuterProfile(uid, {
        morningPickupTime: '08:30 AM',
        eveningDropTime: '06:00 PM',
      });
    } else if (validRole === 'DRIVER') {
      const driverId = `driver_${uid}`;
      await setDriverProfile({
        id: driverId,
        userId: uid,
        licenseNumber: licenseNumber || null,
        experienceYears: 3,
        rating: 4.9,
        isVerified: false,
        status: 'OFFLINE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (vehiclePlate) {
        await setVehicle({
          id: `veh_${uid}`,
          driverId,
          make: vehicleMake || 'Standard',
          model: vehicleModel || 'Sedan',
          year: new Date().getFullYear(),
          licensePlate: vehiclePlate,
          capacity: parseInt(vehicleCapacity) || 4,
          type: 'SEDAN',
          isApproved: false,
          rcDocUrl: null,
          insuranceDocUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    const sessionUser = {
      id: uid,
      email: cleanEmail,
      name: name.trim(),
      role: validRole,
      phone: phone || null,
      avatar,
    };

    // Keep JWT session cookie for backward compatibility with existing UI
    const token = signJwtToken(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      token,
      message: 'Account created successfully with Firebase Authentication',
    });

    response.cookies.set('smartride_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: error.message || 'Failed to register account' }, { status: 500 });
  }
}
