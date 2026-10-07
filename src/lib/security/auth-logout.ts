import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { revokeToken, parseJwtPayloadClaims } from '@/lib/security/token-revocation';
import { recordSecurityEvent } from '@/lib/security/security-events';

export async function handleLogout(req: NextRequest): Promise<NextResponse> {
  try {
    let token: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = req.cookies.get('smartride_token')?.value || null;
    }

    let session = getSessionFromRequest(req);
    let claims: { jti?: string; id?: string; exp?: number; iat?: number } | null = null;
    let jti: string | undefined = session?.jti;

    if (token) {
      claims = parseJwtPayloadClaims(token);
      const revoked = revokeToken(token, 'LOGOUT', session?.id || claims?.id);
      if (revoked.jti) {
        jti = revoked.jti;
      }
    }

    // Record security audit event
    const actorUserId = session?.id || claims?.id || 'GUEST';
    const actorRole = session?.role || 'GUEST';

    try {
      await recordSecurityEvent({
        eventType: 'AUTH_LOGOUT',
        severity: 'LOW',
        actorUserId: actorUserId === 'GUEST' ? undefined : actorUserId,
        actorRole,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Next.js Client',
        resourceType: 'AUTH',
        resourceId: 'LOGOUT_ENDPOINT',
        action: 'LOGOUT',
        result: 'SUCCESS',
        metadata: {
          jtiPrefix: jti ? `${jti.substring(0, 8)}...` : undefined,
          reason: 'USER_LOGOUT',
        },
      });

      if (token) {
        await recordSecurityEvent({
          eventType: 'AUTH_SESSION_REVOKED',
          severity: 'LOW',
          actorUserId: actorUserId === 'GUEST' ? undefined : actorUserId,
          actorRole,
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Next.js Client',
          resourceType: 'AUTH',
          resourceId: 'TOKEN_REVOCATION',
          action: 'REVOKE_TOKEN',
          result: 'SUCCESS',
          metadata: {
            jtiPrefix: jti ? `${jti.substring(0, 8)}...` : undefined,
            reason: 'LOGOUT',
          },
        });
      }
    } catch (err) {
      console.warn('Failed to record logout security event:', err);
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    response.cookies.set('smartride_token', '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
}
