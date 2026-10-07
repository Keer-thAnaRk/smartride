/**
 * Server-Side JWT Secret Hardening & Governance Module
 * Enforces production-safe secret validation, minimum entropy (32+ chars),
 * and disallows weak, placeholder, or default secrets.
 *
 * This module is server-only and Edge-runtime compatible (zero native Node dependencies).
 */

export const MIN_JWT_SECRET_LENGTH = 32;

// Known weak/placeholder secrets that must NEVER be accepted in any environment
export const DISALLOWED_SECRETS: readonly string[] = [
  'secret',
  'jwtsecret',
  'jwt_secret',
  'change-me',
  'changeme',
  'change_me_locally',
  'your-secret',
  'development-secret',
  'test-secret',
  'password',
  '123456',
  '12345678',
  'smartride',
  'smart_ride',
  'smart_ride_default_super_secret_jwt_key_2026',
  'generate_a_long_random_secret_locally',
];

// In production, publicly committed repository defaults are strictly forbidden
export const DISALLOWED_IN_PRODUCTION: readonly string[] = [
  ...DISALLOWED_SECRETS,
  'smart_ride_super_secure_production_secret_key_2026_@jwt!',
];

export interface SecretValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates a candidate JWT secret against entropy, length, and weak-pattern rules.
 * Never logs or reveals the secret value in the returned error reason.
 */
export function validateJwtSecret(
  secret?: string | null,
  isProduction: boolean = process.env.NODE_ENV === 'production'
): SecretValidationResult {
  if (!secret || secret.trim() === '') {
    return {
      valid: false,
      reason: isProduction
        ? 'FATAL: JWT_SECRET environment variable is missing. Server failed closed in production.'
        : 'CONFIG ERROR: JWT_SECRET is not configured in .env or .env.local. Please configure a secure JWT_SECRET (minimum 32 characters).',
    };
  }

  const cleanSecret = secret.trim();

  // Length check (RFC 7518 specifies at least 256 bits = 32 bytes for HS256)
  if (cleanSecret.length < MIN_JWT_SECRET_LENGTH) {
    return {
      valid: false,
      reason: `SECURITY CONFIG ERROR: JWT_SECRET is too short (${cleanSecret.length} chars). Minimum required length is ${MIN_JWT_SECRET_LENGTH} characters for HMAC-SHA256.`,
    };
  }

  const normalized = cleanSecret.toLowerCase();

  // Check against general disallowed placeholders
  for (const disallowed of DISALLOWED_SECRETS) {
    if (normalized === disallowed.toLowerCase()) {
      return {
        valid: false,
        reason: 'SECURITY CONFIG ERROR: Configured JWT_SECRET is a known insecure placeholder.',
      };
    }
  }

  // Check against production-disallowed repository defaults
  if (isProduction) {
    for (const disallowed of DISALLOWED_IN_PRODUCTION) {
      if (normalized === disallowed.toLowerCase()) {
        return {
          valid: false,
          reason: 'SECURITY CONFIG ERROR: Configured JWT_SECRET is a publicly documented repository example and is prohibited in production.',
        };
      }
    }
  }

  // Check for degenerate low-entropy repetitions (e.g., 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  const uniqueChars = new Set(cleanSecret).size;
  if (uniqueChars < 4) {
    return {
      valid: false,
      reason: 'SECURITY CONFIG ERROR: Configured JWT_SECRET lacks sufficient entropy (too few unique characters).',
    };
  }

  return { valid: true };
}

/**
 * Retrieves the validated server-side JWT secret.
 * Throws an explicit configuration error if the secret is missing or insecure,
 * ensuring the application fails closed.
 */
export function getJwtSecret(): string {
  const rawSecret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const validation = validateJwtSecret(rawSecret, isProd);

  if (!validation.valid) {
    // Fail closed: never fall back to an insecure or hardcoded default
    throw new Error(validation.reason);
  }

  return rawSecret!.trim();
}
