import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { UserRole, UserSession } from '@/types';

export interface AuthResult {
  session: UserSession;
}

export interface AuthError {
  errorResponse: NextResponse;
  session: null;
}

/**
 * Ensures the request contains a valid, authenticated user session.
 * Returns 401 Unauthorized if no session or invalid token.
 */
export function requireAuth(req: NextRequest): { errorResponse: null; session: UserSession } | AuthError {
  const session = getSessionFromRequest(req);
  if (!session || !session.id) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      ),
      session: null,
    };
  }

  return { errorResponse: null, session };
}

/**
 * Ensures the request is authenticated AND the user possesses one of the allowed roles.
 * Returns 401 if unauthenticated, 403 if role is insufficient.
 */
export function requireRole(
  req: NextRequest,
  allowedRoles: UserRole | UserRole[],
  customForbiddenMessage?: string
): { errorResponse: null; session: UserSession } | { errorResponse: NextResponse; session: UserSession | null } {
  const auth = requireAuth(req);
  if (auth.errorResponse) {
    return auth;
  }

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!roles.includes(auth.session.role)) {
    return {
      errorResponse: NextResponse.json(
        {
          error:
            customForbiddenMessage ||
            `Forbidden: Insufficient privileges. Required role: ${roles.join(' or ')}`,
        },
        { status: 403 }
      ),
      session: auth.session,
    };
  }

  return { errorResponse: null, session: auth.session };
}

/**
 * Requires ADMIN role. Returns 401 if unauthenticated, 403 if not ADMIN.
 */
export function requireAdmin(
  req: NextRequest,
  customForbiddenMessage = 'Forbidden: Admin access required'
) {
  return requireRole(req, 'ADMIN', customForbiddenMessage);
}

/**
 * Requires DRIVER (or ADMIN) role. Returns 401 if unauthenticated, 403 if neither.
 */
export function requireDriver(
  req: NextRequest,
  allowAdmin = true,
  customForbiddenMessage = 'Forbidden: Driver access required'
) {
  const roles: UserRole[] = allowAdmin ? ['DRIVER', 'ADMIN'] : ['DRIVER'];
  return requireRole(req, roles, customForbiddenMessage);
}

/**
 * Requires COMMUTER (or ADMIN) role. Returns 401 if unauthenticated, 403 if neither.
 */
export function requireCommuter(
  req: NextRequest,
  allowAdmin = true,
  customForbiddenMessage = 'Forbidden: Commuter access required'
) {
  const roles: UserRole[] = allowAdmin ? ['COMMUTER', 'ADMIN'] : ['COMMUTER'];
  return requireRole(req, roles, customForbiddenMessage);
}

/**
 * Verifies that the authenticated session owns the target resource, or is an ADMIN.
 * Returns 403 Forbidden if the user is attempting to access/mutate another user's resource.
 */
export function requireResourceOwner(
  session: UserSession,
  resourceOwnerId: string,
  customForbiddenMessage = 'Forbidden: You do not have permission to access or modify this resource'
): NextResponse | null {
  if (session.role === 'ADMIN') {
    return null; // Admins can manage resources across users
  }

  if (session.id !== resourceOwnerId) {
    return NextResponse.json(
      { error: customForbiddenMessage },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Validates that an untrusted client-supplied identity parameter (e.g. body.userId, query.userId)
 * does not attempt to impersonate another user. Non-admins cannot substitute another ID.
 */
export function assertUntamperedIdentity(
  session: UserSession,
  claimedUserId?: string | null,
  customForbiddenMessage = 'Forbidden: Cannot perform actions on behalf of another user'
): NextResponse | null {
  if (!claimedUserId) return null;

  if (session.role !== 'ADMIN' && claimedUserId !== session.id) {
    return NextResponse.json(
      { error: customForbiddenMessage },
      { status: 403 }
    );
  }

  return null;
}
