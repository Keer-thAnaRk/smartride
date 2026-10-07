import crypto from 'crypto';
import prisma from '../prisma';
import { logSecurityAudit } from './audit-logger';

export interface StoredRideOtp {
  id: string; // `${commuterId}_${date}_${tripType}`
  commuterId: string;
  routeId: string;
  date: string; // YYYY-MM-DD
  tripType: 'MORNING_PICKUP' | 'EVENING_DROP';
  otpHash: string;
  salt: string;
  expiresAt: number; // Unix timestamp in ms
  failedAttempts: number;
  maxAttempts: number;
  isConsumed: boolean;
  isLocked: boolean;
  isVerifying?: boolean;
  consumedAt?: number;
  consumedByDriverId?: string;
  createdAt: number;
  // Transient server-side plain OTP for the authorized commuter's active retrieval window
  transientPlainOtp?: string;
}

// In-memory server-authoritative store attached to globalThis across Next.js route bundles
const otpStore: Map<string, StoredRideOtp> =
  (globalThis as any).__smartride_rideOtpStore || new Map<string, StoredRideOtp>();

if (!(globalThis as any).__smartride_rideOtpStore) {
  (globalThis as any).__smartride_rideOtpStore = otpStore;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ATTEMPTS = 3;

/**
 * Generates a cryptographically secure 4-digit OTP using Node.js crypto.randomInt.
 * Guarantees uniform 0000-9999 distribution and preserves leading zeros.
 */
export function generateSecureRideOtp(): string {
  const num = crypto.randomInt(0, 10000);
  return num.toString().padStart(4, '0');
}

/**
 * Computes a SHA-256 HMAC digest of the OTP using a per-OTP cryptographic salt.
 */
export function hashRideOtp(otp: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(otp, 'utf8').digest('hex');
}

/**
 * Generates a fresh cryptographic salt.
 */
export function generateOtpSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Safely compares two hex hashes using constant-time comparison.
 */
export function timingSafeHashMatch(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Retrieves or creates a secure Ride OTP for the authenticated commuter.
 * Strictly server-controlled; client cannot supply or modify OTP values.
 */
export function getOrCreateCommuterRideOtp(
  commuterId: string,
  routeId: string,
  date: string,
  tripType: 'MORNING_PICKUP' | 'EVENING_DROP' = 'MORNING_PICKUP',
  ttlMs: number = DEFAULT_TTL_MS
): {
  otp: string;
  expiresAt: number;
  isConsumed: boolean;
  isLocked: boolean;
  failedAttempts: number;
} {
  const key = `${commuterId}_${date}_${tripType}`;
  const existing = otpStore.get(key);
  const now = Date.now();

  // If unconsumed, unexpired, and not locked, return active plain OTP
  if (
    existing &&
    !existing.isConsumed &&
    !existing.isLocked &&
    now < existing.expiresAt &&
    existing.transientPlainOtp
  ) {
    return {
      otp: existing.transientPlainOtp,
      expiresAt: existing.expiresAt,
      isConsumed: existing.isConsumed,
      isLocked: existing.isLocked,
      failedAttempts: existing.failedAttempts,
    };
  }

  // If existing is consumed or locked, do not generate a new one without explicit cycle reset
  if (existing && (existing.isConsumed || existing.isLocked)) {
    return {
      otp: existing.transientPlainOtp || '••••',
      expiresAt: existing.expiresAt,
      isConsumed: existing.isConsumed,
      isLocked: existing.isLocked,
      failedAttempts: existing.failedAttempts,
    };
  }

  // Generate fresh secure OTP
  const plainOtp = generateSecureRideOtp();
  const salt = generateOtpSalt();
  const otpHash = hashRideOtp(plainOtp, salt);
  const expiresAt = now + ttlMs;

  const record: StoredRideOtp = {
    id: key,
    commuterId,
    routeId,
    date,
    tripType,
    otpHash,
    salt,
    expiresAt,
    failedAttempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    isConsumed: false,
    isLocked: false,
    createdAt: now,
    transientPlainOtp: plainOtp,
  };

  otpStore.set(key, record);

  return {
    otp: plainOtp,
    expiresAt,
    isConsumed: false,
    isLocked: false,
    failedAttempts: 0,
  };
}

/**
 * Checks whether an OTP has already been verified for this commuter/date/tripType.
 */
export function isCommuterOtpVerified(
  commuterId: string,
  date: string,
  tripType: 'MORNING_PICKUP' | 'EVENING_DROP' = 'MORNING_PICKUP'
): boolean {
  const key = `${commuterId}_${date}_${tripType}`;
  const record = otpStore.get(key);
  return !!record?.isConsumed;
}

export interface VerifyRideOtpParams {
  commuterId: string;
  routeId: string;
  date: string;
  tripType: 'MORNING_PICKUP' | 'EVENING_DROP';
  driverId: string;
  enteredOtp: string;
}

export interface VerifyRideOtpResult {
  success: boolean;
  error?: string;
  statusCode: number;
  remainingAttempts?: number;
}

/**
 * Server-authoritative verification of a commuter's Ride Start OTP.
 * Enforces rate limiting, expiration, route context, and one-time consumption.
 */
export async function verifyRideOtp(
  params: VerifyRideOtpParams
): Promise<VerifyRideOtpResult> {
  const { commuterId, routeId, date, tripType, driverId, enteredOtp } = params;

  if (!enteredOtp || typeof enteredOtp !== 'string' || enteredOtp.trim().length !== 4) {
    return {
      success: false,
      error: 'Please enter a valid 4-digit OTP code',
      statusCode: 400,
    };
  }

  const key = `${commuterId}_${date}_${tripType}`;
  const record = otpStore.get(key);

  if (!record) {
    return {
      success: false,
      error: 'No active ride OTP found for this passenger and schedule',
      statusCode: 404,
    };
  }

  // 1. Race-condition check: prevent simultaneous concurrent verification
  if (record.isVerifying) {
    return {
      success: false,
      error: 'Verification currently in progress. Please retry in a moment.',
      statusCode: 409,
    };
  }

  record.isVerifying = true;

  try {
    const now = Date.now();

    // 2. Lockout check
    if (record.isLocked || record.failedAttempts >= record.maxAttempts) {
      record.isLocked = true;
      return {
        success: false,
        error: 'OTP is locked due to too many failed attempts. Passenger must contact dispatch.',
        statusCode: 429,
        remainingAttempts: 0,
      };
    }

    // 3. One-time consumption check
    if (record.isConsumed) {
      return {
        success: false,
        error: 'This OTP has already been verified and consumed. Passenger is already boarded.',
        statusCode: 400,
        remainingAttempts: 0,
      };
    }

    // 4. Expiration check
    if (now > record.expiresAt) {
      return {
        success: false,
        error: 'OTP has expired. Passenger must request a fresh code on their dashboard.',
        statusCode: 400,
      };
    }

    // 5. Route context check
    if (record.routeId !== routeId) {
      await logSecurityAudit({
        action: 'UNAUTHORIZED_DISPATCH_ATTEMPT',
        actorId: driverId,
        actorName: 'Driver Dispatch',
        details: 'Attempted OTP verification on incorrect route corridor.',
        metadata: {
          commuterId,
          expectedRouteId: record.routeId,
          providedRouteId: routeId,
        },
      });
      return {
        success: false,
        error: 'Trip context mismatch: OTP is not valid for this route corridor',
        statusCode: 403,
      };
    }

    // 6. Cryptographic Hash Comparison
    const cleanEntered = enteredOtp.trim();
    const computedHash = hashRideOtp(cleanEntered, record.salt);
    const isMatch = timingSafeHashMatch(computedHash, record.otpHash);

    if (!isMatch) {
      record.failedAttempts += 1;
      const remaining = Math.max(0, record.maxAttempts - record.failedAttempts);

      if (record.failedAttempts >= record.maxAttempts) {
        record.isLocked = true;

        // Emit high-severity security anomaly
        try {
          await prisma.safetyEvent.create({
            data: {
              id: `anom-otp-lock-${Date.now()}`,
              tripId: `trip_${routeId}_${date}_${tripType}`,
              type: 'MULTIPLE_OTP_FAILURES',
              severity: 'HIGH',
              status: 'ACTIVE',
              title: 'Ride OTP Brute-Force Lockout Triggered',
              description: 'Passenger OTP locked after 3 consecutive failed verification attempts.',
              detectedAt: new Date(),
              metadata: JSON.stringify({
                commuterId,
                routeId,
                driverId,
                failedAttempts: record.failedAttempts,
              }),
            },
          });
        } catch {
          // Non-blocking if safety table not initialized
        }

        await logSecurityAudit({
          action: 'ANOMALY_DETECTED',
          actorId: driverId,
          actorName: 'Driver Dispatch',
          details: 'Ride Start OTP locked after 3 failed verification attempts.',
          metadata: {
            commuterId,
            routeId,
            failedAttempts: record.failedAttempts,
          },
        });

        return {
          success: false,
          error: 'Invalid OTP code. 3 failed attempts reached — OTP locked for security.',
          statusCode: 400,
          remainingAttempts: 0,
        };
      }

      return {
        success: false,
        error: `Invalid OTP code. ${remaining} attempt(s) remaining.`,
        statusCode: 400,
        remainingAttempts: remaining,
      };
    }

    // 7. Successful verification & atomic consumption
    record.isConsumed = true;
    record.consumedAt = now;
    record.consumedByDriverId = driverId;
    record.failedAttempts = 0;
    // Clear plaintext once consumed
    record.transientPlainOtp = undefined;

    return {
      success: true,
      statusCode: 200,
    };
  } finally {
    record.isVerifying = false;
  }
}

/**
 * Resets the in-memory OTP store (used in test suites).
 */
export function resetRideOtpStore(): void {
  otpStore.clear();
}
