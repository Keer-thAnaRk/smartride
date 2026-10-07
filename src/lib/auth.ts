import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { UserSession } from '@/types';
import { getJwtSecret } from '@/lib/security/jwt-secret';
import { isTokenRevoked } from '@/lib/security/token-revocation';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signJwtToken(payload: UserSession, expiresIn: jwt.SignOptions['expiresIn'] = '7d'): string {
  const secret = getJwtSecret();
  const jti = payload.jti || crypto.randomUUID();
  const nowMs = Date.now();
  const tokenPayload: UserSession = {
    ...payload,
    jti,
    iatMs: nowMs,
  };
  return jwt.sign(tokenPayload, secret, {
    algorithm: 'HS256',
    expiresIn,
  } as jwt.SignOptions);
}

export function verifyJwtToken(token: string): UserSession | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as UserSession;

    // Server-authoritative session revocation and account status check
    if (isTokenRevoked(decoded, token)) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): UserSession | null {
  // Check Authorization Header: Bearer <token>
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = verifyJwtToken(token);
    if (session) return session;
  }

  // Check Cookie: smartride_token
  const cookie = req.cookies.get('smartride_token')?.value;
  if (cookie) {
    const session = verifyJwtToken(cookie);
    if (session) return session;
  }

  return null;
}
