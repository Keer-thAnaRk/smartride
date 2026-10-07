/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔐 SMARTRIDE (COMMUTESYNC) — SECURITY RULES & THRESHOLDS
 * ══════════════════════════════════════════════════════════════════════════════
 * Centralized, configurable security detection rules and thresholds.
 *
 * All thresholds are transparent, auditable, and documented:
 * - Brute-Force Login: >= 5 failed attempts in 5 minutes
 * - Repeated OTP Failures: >= 3 failed code entries on the same trip
 * - Suspicious Session / Authorization Probing: >= 4 401/403 denials in 5 minutes
 */

export interface SecurityRulesConfig {
  bruteForceFailedLoginsThreshold: number;
  bruteForceWindowMinutes: number;
  otpFailureThreshold: number;
  suspiciousAuthzFailuresThreshold: number;
  suspiciousAuthzWindowMinutes: number;
  postureWeights: {
    criticalPenalty: number;
    highPenalty: number;
    mediumPenalty: number;
  };
}

export const SECURITY_RULES_CONFIG: SecurityRulesConfig = {
  // Authentication brute-force
  bruteForceFailedLoginsThreshold: 5,
  bruteForceWindowMinutes: 5,

  // Boarding OTP verification
  otpFailureThreshold: 3,

  // Authorization / RBAC probing
  suspiciousAuthzFailuresThreshold: 4,
  suspiciousAuthzWindowMinutes: 5,

  // Security posture scoring penalties
  postureWeights: {
    criticalPenalty: 35,
    highPenalty: 15,
    mediumPenalty: 5,
  },
};

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SecurityStatusLevel = 'SECURE' | 'MONITOR' | 'ELEVATED' | 'CRITICAL';
export type SecurityEventStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export type SecurityEventType =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT'
  | 'AUTH_SESSION_CREATED'
  | 'AUTH_SESSION_REVOKED'
  | 'AUTH_ALL_SESSIONS_REVOKED'
  | 'AUTH_ACCOUNT_DISABLED'
  | 'POSSIBLE_BRUTE_FORCE'
  | 'OTP_VERIFICATION_SUCCESS'
  | 'OTP_VERIFICATION_FAILURE'
  | 'OTP_ANOMALY'
  | 'API_UNAUTHORIZED'
  | 'API_FORBIDDEN'
  | 'RBAC_ACCESS_DENIED'
  | 'SUSPICIOUS_SESSION'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ADMIN_ACTION'
  | 'DRIVER_ACTION'
  | 'DRIVER_APPROVED'
  | 'DRIVER_REJECTED'
  | 'STANDBY_ASSIGNED'
  | 'ROUTE_DEVIATION'
  | 'SPEED_ANOMALY'
  | 'GPS_SIGNAL_LOSS'
  | 'UNEXPECTED_STOP'
  | 'SOS_TRIGGERED';
