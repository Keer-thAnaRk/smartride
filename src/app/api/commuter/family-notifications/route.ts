import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'COMMUTER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Unauthorized role' }, { status: 403 });
    }

    const commuterId = session.id;

    const notifications = await prisma.familyNotification.findMany({
      where: { commuterId },
      orderBy: { deliveredAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      notifications,
    });
  } catch (error: any) {
    console.error('Error fetching family notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch family notifications' },
      { status: 500 }
    );
  }
}
