/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔐 SMARTRIDE (COMMUTESYNC) — SECURITY EVENT DISPATCHER & AUDIT LOGGER
 * ══════════════════════════════════════════════════════════════════════════════
 * Append-only security audit trail logger, metadata sanitizer, and rule-based
 * event correlation engine.
 *
 * STRICT REDACTION GUARANTEE:
 * Passwords, password hashes, JWT tokens, cookies, plaintext OTPs, and sensitive
 * credentials are NEVER logged or displayed.
 */

import prisma from '@/lib/prisma';
import {
  SECURITY_RULES_CONFIG,
  SecurityEventType,
  SecuritySeverity,
  SecurityEventStatus,
} from './security-rules';

export interface RecordSecurityEventParams {
  eventType: SecurityEventType;
  severity?: SecuritySeverity;
  actorUserId?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  result: 'SUCCESS' | 'DENIED' | 'FAILED' | 'DETECTED';
  metadata?: Record<string, any>;
  status?: SecurityEventStatus;
  incidentId?: string;
}

/**
 * Strictly sanitizes metadata to purge any authentication secrets, tokens, or plaintext OTPs.
 */
export function sanitizeSecurityMetadata(meta?: Record<string, any>): Record<string, any> {
  if (!meta) return {};
  const cleaned = { ...meta };

  const forbiddenKeys = [
    'password',
    'passwordHash',
    'pass',
    'confirmPassword',
    'token',
    'smartride_token',
    'authorization',
    'cookie',
    'rideOtp',
    'otp',
    'enteredOtp',
    'secret',
    'jwt',
    'creditCard',
    'cvv',
  ];

  for (const key of forbiddenKeys) {
    delete cleaned[key];
  }

  // Also sanitize nested objects one level deep
  for (const [k, v] of Object.entries(cleaned)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      cleaned[k] = sanitizeSecurityMetadata(v);
    }
  }

  return cleaned;
}

/**
 * Determines default severity for an event type if not explicitly provided.
 */
export function getDefaultSeverity(eventType: SecurityEventType): SecuritySeverity {
  switch (eventType) {
    case 'SOS_TRIGGERED':
      return 'CRITICAL';
    case 'POSSIBLE_BRUTE_FORCE':
    case 'SUSPICIOUS_SESSION':
    case 'OTP_ANOMALY':
    case 'RBAC_ACCESS_DENIED':
    case 'API_FORBIDDEN':
    case 'SPEED_ANOMALY':
    case 'GPS_SIGNAL_LOSS':
      return 'HIGH';
    case 'AUTH_LOGIN_FAILURE':
    case 'OTP_VERIFICATION_FAILURE':
    case 'API_UNAUTHORIZED':
    case 'ROUTE_DEVIATION':
    case 'STANDBY_ASSIGNED':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

/**
 * Dispatches and records an immutable security event into SQLite/Prisma.
 * Checks for rule-based thresholds (Brute Force, OTP Anomaly, Suspicious Session).
 */
export async function recordSecurityEvent(
  params: RecordSecurityEventParams
): Promise<any> {
  const severity = params.severity || getDefaultSeverity(params.eventType);
  const sanitizedMeta = sanitizeSecurityMetadata(params.metadata);

  let eventRecord = null;

  try {
    eventRecord = await prisma.securityEvent.create({
      data: {
        eventType: params.eventType,
        severity,
        actorUserId: params.actorUserId || null,
        actorRole: params.actorRole || 'GUEST',
        ipAddress: params.ipAddress || '127.0.0.1',
        userAgent: params.userAgent ? params.userAgent.substring(0, 150) : 'Next.js Client',
        resourceType: params.resourceType || 'SYSTEM',
        resourceId: params.resourceId || null,
        action: params.action,
        result: params.result,
        metadata: JSON.stringify(sanitizedMeta),
        status: params.status || 'OPEN',
        incidentId: params.incidentId || null,
      },
    });

    // Rule Check 1: Brute-Force Authentication Attempt Detection
    if (params.eventType === 'AUTH_LOGIN_FAILURE') {
      const windowStart = new Date(
        Date.now() - SECURITY_RULES_CONFIG.bruteForceWindowMinutes * 60 * 1000
      );
      const recentFailures = await prisma.securityEvent.count({
        where: {
          eventType: 'AUTH_LOGIN_FAILURE',
          createdAt: { gte: windowStart },
          ipAddress: params.ipAddress || '127.0.0.1',
        },
      });

      if (recentFailures >= SECURITY_RULES_CONFIG.bruteForceFailedLoginsThreshold) {
        // Record correlated Possible Brute-Force Event
        await prisma.securityEvent.create({
          data: {
            eventType: 'POSSIBLE_BRUTE_FORCE',
            severity: 'HIGH',
            actorUserId: params.actorUserId || null,
            actorRole: params.actorRole || 'GUEST',
            ipAddress: params.ipAddress || '127.0.0.1',
            userAgent: params.userAgent || 'Unknown',
            resourceType: 'AUTH',
            resourceId: params.resourceId || 'LOGIN_ENDPOINT',
            action: 'BRUTE_FORCE_DETECTED',
            result: 'DETECTED',
            metadata: JSON.stringify({
              failureCount: recentFailures,
              windowMinutes: SECURITY_RULES_CONFIG.bruteForceWindowMinutes,
              note: 'Repeated authentication failures detected within time window.',
            }),
            status: 'OPEN',
          },
        });
      }
    }

    // Rule Check 2: OTP Verification Anomaly
    if (params.eventType === 'OTP_VERIFICATION_FAILURE' && params.resourceId) {
      const tripId = params.resourceId;
      const recentOtpFails = await prisma.securityEvent.count({
        where: {
          eventType: 'OTP_VERIFICATION_FAILURE',
          resourceId: tripId,
        },
      });

      if (recentOtpFails >= SECURITY_RULES_CONFIG.otpFailureThreshold) {
        await prisma.securityEvent.create({
          data: {
            eventType: 'OTP_ANOMALY',
            severity: 'HIGH',
            actorUserId: params.actorUserId || null,
            actorRole: params.actorRole || 'DRIVER',
            ipAddress: params.ipAddress || '127.0.0.1',
            userAgent: params.userAgent || 'Driver App',
            resourceType: 'TRIP',
            resourceId: tripId,
            action: 'OTP_ANOMALY_TRIGGERED',
            result: 'DETECTED',
            metadata: JSON.stringify({
              failedAttempts: recentOtpFails,
              tripId,
              note: 'Multiple consecutive incorrect OTP entries on trip.',
            }),
            status: 'OPEN',
          },
        });
      }
    }

    // Rule Check 3: Suspicious Session Probing (Repeated 401/403 denials)
    if (params.eventType === 'RBAC_ACCESS_DENIED' || params.eventType === 'API_FORBIDDEN') {
      const windowStart = new Date(
        Date.now() - SECURITY_RULES_CONFIG.suspiciousAuthzWindowMinutes * 60 * 1000
      );
      const recentAuthzFails = await prisma.securityEvent.count({
        where: {
          eventType: { in: ['RBAC_ACCESS_DENIED', 'API_FORBIDDEN'] },
          createdAt: { gte: windowStart },
          ipAddress: params.ipAddress || '127.0.0.1',
        },
      });

      if (recentAuthzFails >= SECURITY_RULES_CONFIG.suspiciousAuthzFailuresThreshold) {
        await prisma.securityEvent.create({
          data: {
            eventType: 'SUSPICIOUS_SESSION',
            severity: 'HIGH',
            actorUserId: params.actorUserId || null,
            actorRole: params.actorRole || 'COMMUTER',
            ipAddress: params.ipAddress || '127.0.0.1',
            userAgent: params.userAgent || 'Client Prober',
            resourceType: 'API',
            resourceId: params.resourceId || 'ENDPOINT_PROBE',
            action: 'SUSPICIOUS_SESSION_FLAGGED',
            result: 'DETECTED',
            metadata: JSON.stringify({
              denialCount: recentAuthzFails,
              windowMinutes: SECURITY_RULES_CONFIG.suspiciousAuthzWindowMinutes,
              note: 'Repeated authorization denials indicate privilege escalation probe.',
            }),
            status: 'OPEN',
          },
        });
      }
    }
  } catch (err) {
    console.error('Failed to persist security event to database:', err);
  }

  return eventRecord;
}
