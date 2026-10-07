import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { FAMILY_TRACKING_CONFIG } from './family-tracking-config';

/**
 * Generates a cryptographically strong, unpredictable tracking token.
 * Format: st_<32 random hex characters>
 */
export function generateShareToken(): string {
  const bytes = crypto.randomBytes(FAMILY_TRACKING_CONFIG.TOKEN_BYTE_LENGTH);
  return `${FAMILY_TRACKING_CONFIG.TOKEN_PREFIX}${bytes.toString('hex')}`;
}

/**
 * Hashes a raw share token using SHA-256 for secure database storage.
 */
export function hashShareToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Calculates session expiration date:
 * - If arrived: now + 60 minutes
 * - If active/in-transit: now + 6 hours
 */
export function calculateSessionExpiration(isArrived: boolean, arrivedAt?: Date): Date {
  const now = arrivedAt || new Date();
  const bufferMinutes = isArrived
    ? FAMILY_TRACKING_CONFIG.EXPIRATION_POST_ARRIVAL_MINUTES
    : FAMILY_TRACKING_CONFIG.EXPIRATION_DEFAULT_ACTIVE_HOURS * 60;
  return new Date(now.getTime() + bufferMinutes * 60 * 1000);
}

/**
 * Checks if a session has expired based on current timestamp and status.
 */
export function isSessionExpired(session: { expiresAt: Date | string; status: string }): boolean {
  if (session.status === 'EXPIRED') return true;
  const expiryTime = new Date(session.expiresAt).getTime();
  return Date.now() > expiryTime;
}

/**
 * Finds a FamilyTrackingSession by raw share token or creates the default demo session.
 */
export async function getSessionByRawToken(token: string) {
  const cleanToken = token.trim();
  const tokenHash = hashShareToken(cleanToken);

  try {
    let session = await prisma.familyTrackingSession.findUnique({
      where: { shareTokenHash: tokenHash },
      include: {
        notifications: {
          orderBy: { deliveredAt: 'desc' },
          take: 5,
        },
      },
    });

    // If it's the demo token and doesn't exist yet, seed it
    if (!session && cleanToken === FAMILY_TRACKING_CONFIG.DEFAULT_DEMO_SHARE_TOKEN) {
      session = await prisma.familyTrackingSession.create({
        data: {
          tripId: FAMILY_TRACKING_CONFIG.DEFAULT_TRIP_ID,
          commuterId: 'commuter_rahul_1',
          shareTokenHash: tokenHash,
          shareTokenPrefix: cleanToken.substring(0, 8),
          destinationStop: FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_STOP,
          destinationLat: FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_LAT,
          destinationLng: FAMILY_TRACKING_CONFIG.DEFAULT_DESTINATION_LNG,
          status: 'ACTIVE',
          isArrived: false,
          scheduledArrival: FAMILY_TRACKING_CONFIG.DEFAULT_SCHEDULED_ARRIVAL,
          expiresAt: calculateSessionExpiration(false),
        },
        include: {
          notifications: true,
        },
      });
    }

    return session;
  } catch (err) {
    console.error('Error fetching session by token:', err);
    return null;
  }
}
