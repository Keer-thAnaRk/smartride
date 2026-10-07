import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getUserById,
  getUserByEmail,
  setUser,
  getCommuterProfile,
  getDriverProfileByUserId,
  getVehiclesByDriverId,
  getAllRoutes,
} from '@/lib/firestore-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    let user = (await getUserById(session.id)) || (await getUserByEmail(session.email));

    if (!user) {
      // Fallback to verified JWT session so valid authenticated sessions are never lost
      user = {
        id: session.id,
        name: session.name || session.email.split('@')[0],
        email: session.email,
        phone: session.phone || '+91 98450 00000',
        role: session.role || 'COMMUTER',
        avatar: session.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(session.name || session.email)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await setUser(user);
    }

    let commuterProfile: any = null;
    let driverProfile: any = null;

    if (user.role === 'COMMUTER') {
      commuterProfile = await getCommuterProfile(user.id);
    } else if (user.role === 'DRIVER') {
      const dp = await getDriverProfileByUserId(user.id);
      if (dp) {
        const vehicles = await getVehiclesByDriverId(dp.id);
        const allRoutes = await getAllRoutes();
        const routes = allRoutes.filter((r) => r.assignedDriverId === dp.id);
        driverProfile = {
          ...dp,
          vehicles,
          routes,
        };
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
        commuterProfile,
        driverProfile,
      },
    });
  } catch (error: any) {
    console.error('Session retrieval error:', error);
    return NextResponse.json({ error: 'Failed to verify session' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { handleLogout } = await import('@/lib/security/auth-logout');
  return handleLogout(req);
}
