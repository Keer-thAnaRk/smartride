import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/security/authorization';
import { revokeAllUserTokens, disableUser, enableUser } from '@/lib/security/token-revocation';
import { recordSecurityEvent } from '@/lib/security/security-events';
import { enforceRateLimit, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const rateLimitError = enforceRateLimit(req, RATE_LIMIT_CONFIG.AUTH_SENSITIVE, undefined, auth.session);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'ALL_SESSIONS', targetUserId } = body;

    // Rule: Normal users can ONLY invalidate their own sessions
    // Only ADMIN can specify a targetUserId to invalidate another user
    let affectedUserId = auth.session.id;

    if (targetUserId && targetUserId !== auth.session.id) {
      if (auth.session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only administrators can invalidate sessions for other users' },
          { status: 403 }
        );
      }
      affectedUserId = targetUserId;
    }

    if (action === 'DISABLE_USER') {
      if (auth.session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only administrators can disable user accounts' },
          { status: 403 }
        );
      }
      disableUser(affectedUserId, 'ADMIN_SECURITY_ACTION');

      try {
        await recordSecurityEvent({
          eventType: 'AUTH_ACCOUNT_DISABLED',
          severity: 'HIGH',
          actorUserId: auth.session.id,
          actorRole: auth.session.role,
          resourceType: 'USER',
          resourceId: affectedUserId,
          action: 'DISABLE_USER',
          result: 'SUCCESS',
          metadata: { affectedUserId, reason: 'ADMIN_SECURITY_ACTION' },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `User account ${affectedUserId} disabled and all sessions invalidated.`,
      });
    }

    if (action === 'ENABLE_USER') {
      if (auth.session.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only administrators can enable user accounts' },
          { status: 403 }
        );
      }
      enableUser(affectedUserId);

      return NextResponse.json({
        success: true,
        message: `User account ${affectedUserId} re-enabled successfully.`,
      });
    }

    // Default: Invalidate all active sessions for affectedUserId
    revokeAllUserTokens(affectedUserId, auth.session.role === 'ADMIN' ? 'ADMIN_SECURITY_ACTION' : 'USER_REQUEST');

    try {
      await recordSecurityEvent({
        eventType: 'AUTH_ALL_SESSIONS_REVOKED',
        severity: 'MEDIUM',
        actorUserId: auth.session.id,
        actorRole: auth.session.role,
        resourceType: 'USER',
        resourceId: affectedUserId,
        action: 'REVOKE_ALL_SESSIONS',
        result: 'SUCCESS',
        metadata: { affectedUserId, reason: 'SESSION_INVALIDATION' },
      });
    } catch {}

    const response = NextResponse.json({
      success: true,
      message: `All active sessions for user ${affectedUserId} have been invalidated.`,
    });

    // If user invalidated their own sessions, clear their current cookie
    if (affectedUserId === auth.session.id) {
      response.cookies.set('smartride_token', '', {
        path: '/',
        expires: new Date(0),
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }

    return response;
  } catch (err: any) {
    console.error('Session revocation error:', err);
    return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500 });
  }
}
