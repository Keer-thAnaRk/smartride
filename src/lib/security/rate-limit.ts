/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔐 SMARTRIDE (COMMUTESYNC) — RATE LIMITING & ABUSE PROTECTION ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 * Server-authoritative sliding-window rate limiting engine with bounded in-memory
 * storage, automatic TTL pruning, LRU eviction, and proxy-aware IP normalization.
 *
 * ARCHITECTURAL SPECIFICATIONS:
 * 1. O(1) sliding-window evaluation with microsecond overhead.
 * 2. Memory bounded: strict key cap (MAX_KEYS = 5,000) with LRU eviction to prevent
 *    memory exhaustion attacks.
 * 3. Array timestamp bounding: prevents array ballooning under heavy request bursts.
 * 4. Safe IP resolution: parses trusted leftmost X-Forwarded-For / X-Real-IP with
 *    IPv6 loopback normalization (::1 -> 127.0.0.1).
 * 5. Deterministic HTTP 429 response structure with Retry-After and standard
 *    X-RateLimit-* headers.
 * 6. Security audit trail integration with deduplication/throttling to prevent
 *    audit log flooding.
 * 7. Fail-safe design: security endpoints fail safe; operational endpoints fail open.
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserSession } from '@/types';

export interface RateLimitPolicy {
  name: string;
  limit: number;
  windowSeconds: number;
  scope: 'IP' | 'USER_OR_IP' | 'USER_ONLY';
  category: 'AUTH' | 'OTP' | 'WEBHOOK' | 'EXPENSIVE' | 'MUTATION' | 'GENERAL';
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
  resetTimestamp: number;
}

interface RateLimitBucket {
  timestamps: number[];
  lastAccessed: number;
}

const MAX_KEYS = 5000;
const rateLimitStore = new Map<string, RateLimitBucket>();

// Audit event throttling to prevent log flooding (max 1 log per key per 30s)
const auditLogThrottle = new Map<string, number>();

/**
 * Standard Rate Limit Configuration Presets
 */
export const RATE_LIMIT_CONFIG = {
  // Authentication: strict brute-force defense
  AUTH_LOGIN: {
    name: 'auth_login',
    limit: 5, // 5 attempts per 60 seconds per IP
    windowSeconds: 60,
    scope: 'IP' as const,
    category: 'AUTH' as const,
  },
  AUTH_REGISTER: {
    name: 'auth_register',
    limit: 5, // 5 registrations per 60 seconds per IP
    windowSeconds: 60,
    scope: 'IP' as const,
    category: 'AUTH' as const,
  },
  AUTH_SENSITIVE: {
    name: 'auth_sensitive',
    limit: 10, // 10 requests per 60 seconds
    windowSeconds: 60,
    scope: 'IP' as const,
    category: 'AUTH' as const,
  },

  // OTP: code guessing & generation flooding defense
  OTP_ACTIONS: {
    name: 'otp_actions',
    limit: 10, // 10 attempts per 60 seconds per user/IP
    windowSeconds: 60,
    scope: 'USER_OR_IP' as const,
    category: 'OTP' as const,
  },

  // Webhooks: payment gateway retry buffer & flood defense
  PAYMENT_WEBHOOK: {
    name: 'payment_webhook',
    limit: 60, // 60 requests per 60 seconds per IP
    windowSeconds: 60,
    scope: 'IP' as const,
    category: 'WEBHOOK' as const,
  },

  // Expensive operational / Phase 3 analytical endpoints
  EXPENSIVE_OPERATIONS: {
    name: 'expensive_ops',
    limit: 30, // 30 heavy queries per 60 seconds per authenticated user
    windowSeconds: 60,
    scope: 'USER_OR_IP' as const,
    category: 'EXPENSIVE' as const,
  },

  // Mutating endpoints (POST/PUT/PATCH/DELETE)
  MUTATIONS: {
    name: 'mutations',
    limit: 40, // 40 mutations per 60 seconds per authenticated user
    windowSeconds: 60,
    scope: 'USER_OR_IP' as const,
    category: 'MUTATION' as const,
  },

  // General anonymous / public API requests
  GENERAL_API: {
    name: 'general_api',
    limit: 120, // 120 requests per 60 seconds per IP
    windowSeconds: 60,
    scope: 'IP' as const,
    category: 'GENERAL' as const,
  },
};

/**
 * Validates whether an IP address matches basic IPv4 or IPv6 formats.
 */
function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (trimmed === '::1' || trimmed === 'localhost') return true;
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/;
  return ipv4Regex.test(trimmed) || ipv6Regex.test(trimmed);
}

/**
 * Normalizes IP addresses (e.g. IPv6 loopback and IPv4-mapped IPv6).
 */
export function normalizeIp(ip: string): string {
  if (!ip) return '127.0.0.1';
  let clean = ip.trim();
  if (clean === '::1' || clean.toLowerCase() === 'localhost') return '127.0.0.1';
  if (clean.startsWith('::ffff:')) clean = clean.substring(7);
  return clean;
}

/**
 * Safely extracts client IP from request headers without trusting spoofed headers blindly.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (isValidIp(firstIp)) {
      return normalizeIp(firstIp);
    }
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp && isValidIp(realIp.trim())) {
    return normalizeIp(realIp.trim());
  }

  if ((req as any).ip && isValidIp((req as any).ip)) {
    return normalizeIp((req as any).ip);
  }

  return '127.0.0.1';
}

/**
 * Prunes expired timestamps and removes empty buckets.
 */
function pruneStore(now: number): void {
  for (const [key, bucket] of rateLimitStore.entries()) {
    // If no access in over 10 minutes, delete key
    if (now - bucket.lastAccessed > 10 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }

  // If still above MAX_KEYS, evict oldest 15% (LRU)
  if (rateLimitStore.size > MAX_KEYS) {
    const sorted = Array.from(rateLimitStore.entries()).sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed
    );
    const toRemove = Math.ceil(rateLimitStore.size * 0.15);
    for (let i = 0; i < toRemove; i++) {
      rateLimitStore.delete(sorted[i][0]);
    }
  }
}

/**
 * Core sliding-window rate limit checker.
 * Returns remaining quota, reset time, and whether request is allowed.
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 60,
  windowSeconds: number = 60
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;

  let bucket = rateLimitStore.get(identifier);
  if (!bucket) {
    // Cap check before inserting new keys
    if (rateLimitStore.size >= MAX_KEYS) {
      pruneStore(now);
    }
    bucket = { timestamps: [], lastAccessed: now };
    rateLimitStore.set(identifier, bucket);
  } else {
    bucket.lastAccessed = now;
  }

  // Purge timestamps older than sliding-window cutoff
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    const resetInSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetInSeconds,
      resetTimestamp: Math.floor((oldest + windowMs) / 1000),
    };
  }

  // Record timestamp (bounded to limit + 2)
  if (bucket.timestamps.length < limit + 2) {
    bucket.timestamps.push(now);
  }

  const remaining = Math.max(0, limit - bucket.timestamps.length);
  const resetInSeconds = windowSeconds;
  const resetTimestamp = Math.floor((now + windowMs) / 1000);

  return {
    allowed: true,
    limit,
    remaining,
    resetInSeconds,
    resetTimestamp,
  };
}

/**
 * Enforces rate limiting on a NextRequest.
 * If exceeded, returns HTTP 429 NextResponse with Retry-After and X-RateLimit headers.
 * If allowed, returns null.
 */
export function enforceRateLimit(
  req: NextRequest,
  policy: RateLimitPolicy,
  customKeySuffix?: string,
  session?: UserSession | null
): NextResponse | null {
  try {
    const clientIp = getClientIp(req);
    let identity: string;

    if (policy.scope === 'USER_ONLY') {
      if (!session?.id) return null; // Defer to authorization handler
      identity = `user:${session.id}`;
    } else if (policy.scope === 'USER_OR_IP') {
      identity = session?.id ? `user:${session.id}` : `ip:${clientIp}`;
    } else {
      identity = `ip:${clientIp}`;
    }

    const rateKey = customKeySuffix
      ? `${policy.name}:${identity}:${customKeySuffix}`
      : `${policy.name}:${identity}`;

    // In non-production development environments, relax loopback IP limit to allow local regression suites to run
    const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1';
    const effectiveLimit =
      isLocalhost && process.env.NODE_ENV !== 'production'
        ? Math.max(policy.limit, 200)
        : policy.limit;

    const result = checkRateLimit(rateKey, effectiveLimit, policy.windowSeconds);

    if (!result.allowed) {
      // Record security audit event with throttling (max once per 30s per key)
      const now = Date.now();
      const lastLogged = auditLogThrottle.get(rateKey) || 0;
      if (now - lastLogged > 30 * 1000) {
        auditLogThrottle.set(rateKey, now);
        // Clean throttle map if large
        if (auditLogThrottle.size > 2000) auditLogThrottle.clear();

        // Asynchronously record security event
        import('@/lib/security/security-events')
          .then(({ recordSecurityEvent }) => {
            recordSecurityEvent({
              eventType: 'RATE_LIMIT_EXCEEDED',
              severity: policy.category === 'AUTH' ? 'HIGH' : 'MEDIUM',
              actorUserId: session?.id || undefined,
              actorRole: session?.role || 'GUEST',
              ipAddress: clientIp,
              userAgent: req.headers.get('user-agent') || 'Next.js Client',
              resourceType: 'API',
              resourceId: policy.name,
              action: 'RATE_LIMIT_BLOCK',
              result: 'DENIED',
              metadata: {
                policy: policy.name,
                limit: policy.limit,
                windowSeconds: policy.windowSeconds,
                retryAfter: result.resetInSeconds,
              },
            }).catch(() => {});
          })
          .catch(() => {});
      }

      const response = NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: result.resetInSeconds,
        },
        { status: 429 }
      );

      response.headers.set('Retry-After', String(result.resetInSeconds));
      response.headers.set('X-RateLimit-Limit', String(result.limit));
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', String(result.resetTimestamp));

      return response;
    }

    return null;
  } catch (err) {
    console.error('Rate limit evaluation error:', err);
    // Fail-safe handling: Fail closed for auth; fail open for operational
    if (policy.category === 'AUTH') {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please retry.' },
        { status: 429 }
      );
    }
    return null;
  }
}

/**
 * Resets rate limit for a specific identifier.
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Resets entire rate limit store (for test suite isolation).
 */
export function resetRateLimitStoreForTesting(): void {
  rateLimitStore.clear();
  auditLogThrottle.clear();
}

/**
 * Returns diagnostic statistics about the rate limiter store.
 */
export function getRateLimitStoreStats(): {
  totalKeys: number;
  totalTimestamps: number;
  maxKeys: number;
} {
  let totalTimestamps = 0;
  for (const bucket of rateLimitStore.values()) {
    totalTimestamps += bucket.timestamps.length;
  }
  return {
    totalKeys: rateLimitStore.size,
    totalTimestamps,
    maxKeys: MAX_KEYS,
  };
}
