import { NextRequest } from 'next/server';
import { handleLogout } from '@/lib/security/auth-logout';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleLogout(req);
}
