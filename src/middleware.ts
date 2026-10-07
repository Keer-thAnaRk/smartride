import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getJwtSecret } from '@/lib/security/jwt-secret';

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyJwtInEdge(token: string): Promise<any | null> {
  try {
    const secret = getJwtSecret();
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    // Enforce HS256 algorithm verification
    const headerJson = new TextDecoder().decode(base64UrlToUint8Array(headerB64));
    const header = JSON.parse(headerJson);
    if (header.alg !== 'HS256') return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = base64UrlToUint8Array(signatureB64);
    const dataBytes = encoder.encode(headerB64 + '.' + payloadB64);
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes as any, dataBytes as any);
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(payloadB64));
    const payload = JSON.parse(payloadJson);
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('smartride_token')?.value;

  // Protected paths
  const isCommuterPath = pathname.startsWith('/commuter');
  const isDriverPath = pathname.startsWith('/driver');
  const isAdminPath = pathname.startsWith('/admin');
  const isProfilePath = pathname === '/profile' || pathname.startsWith('/profile/');

  if (isCommuterPath || isDriverPath || isAdminPath || isProfilePath) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Cryptographically verify token signature
    const session = await verifyJwtInEdge(token);
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role-based protection: Only users with role === 'ADMIN' may access /admin/*
    if (isAdminPath) {
      if (session.role !== 'ADMIN') {
        const dest = session.role === 'DRIVER' ? '/driver/dashboard' : '/commuter/dashboard';
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }

    // Role-based protection: Commuter cannot access /driver/*
    if (isDriverPath) {
      if (session.role !== 'DRIVER' && session.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/commuter/dashboard', request.url));
      }
    }

    // Role-based protection: Driver cannot access /commuter/*
    if (isCommuterPath) {
      if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/driver/dashboard', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/commuter',
    '/commuter/:path*',
    '/driver',
    '/driver/:path*',
    '/admin',
    '/admin/:path*',
    '/profile',
    '/profile/:path*',
  ],
};
